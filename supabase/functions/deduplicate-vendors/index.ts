import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { projectId, categoryId, dryRun = true } = await req.json();

    console.log('Starting vendor deduplication for:', {
      projectId,
      categoryId,
      dryRun
    });

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all vendors for the project/category
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('project_id', projectId)
      .eq('category_id', categoryId)
      .order('created_at', { ascending: true }); // Keep older vendors

    if (error) {
      throw error;
    }

    console.log(`Found ${vendors?.length || 0} vendors to analyze`);

    if (!vendors || vendors.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No vendors found to deduplicate',
        duplicatesFound: 0,
        duplicatesRemoved: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find duplicates
    const duplicates: any[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < vendors.length; i++) {
      const vendor = vendors[i];
      const normalizedName = normalizeBusinessName(vendor.business_name || '');
      const normalizedPhone = normalizePhone(vendor.phone || '');
      const normalizedEmail = (vendor.email || '').toLowerCase();
      const normalizedAddress = normalizeAddress(vendor.address || '');

      let isDuplicate = false;
      let duplicateReason = '';

      // Check against previous vendors
      for (let j = 0; j < i; j++) {
        const existingVendor = vendors[j];
        const existingNormalizedName = normalizeBusinessName(existingVendor.business_name || '');
        const existingNormalizedPhone = normalizePhone(existingVendor.phone || '');
        const existingNormalizedEmail = (existingVendor.email || '').toLowerCase();
        const existingNormalizedAddress = normalizeAddress(existingVendor.address || '');

        // Check for duplicates based on multiple criteria
        if (normalizedName && existingNormalizedName && normalizedName === existingNormalizedName) {
          isDuplicate = true;
          duplicateReason = 'Same business name';
          break;
        }
        
        if (normalizedPhone && existingNormalizedPhone && normalizedPhone === existingNormalizedPhone && normalizedPhone.length >= 10) {
          isDuplicate = true;
          duplicateReason = 'Same phone number';
          break;
        }
        
        if (normalizedEmail && existingNormalizedEmail && normalizedEmail === existingNormalizedEmail) {
          isDuplicate = true;
          duplicateReason = 'Same email';
          break;
        }
        
        if (normalizedAddress && existingNormalizedAddress && normalizedAddress === existingNormalizedAddress && normalizedAddress.length > 10) {
          isDuplicate = true;
          duplicateReason = 'Same address';
          break;
        }
      }

      if (isDuplicate) {
        duplicates.push({
          id: vendor.id,
          business_name: vendor.business_name,
          reason: duplicateReason,
          phone: vendor.phone,
          email: vendor.email,
          address: vendor.address
        });
      }
    }

    console.log(`Found ${duplicates.length} duplicates`);

    // Also check for builders/contractors that should be removed from architects category
    const buildersToRemove: any[] = [];
    if (categoryId) {
      // Get category info to check if this is an architects category
      const { data: category } = await supabase
        .from('vendor_categories')
        .select('name')
        .eq('id', categoryId)
        .single();

      if (category?.name?.toLowerCase().includes('architect')) {
        for (const vendor of vendors) {
          const businessName = (vendor.business_name || '').toLowerCase();
          const notes = (vendor.notes || '').toLowerCase();
          
          // Check if this is actually a builder/contractor and not an architect
          if (isBuilderNotArchitect(businessName, notes)) {
            buildersToRemove.push({
              id: vendor.id,
              business_name: vendor.business_name,
              reason: 'Builder/contractor in architect category',
              notes: vendor.notes
            });
          }
        }
      }
    }

    console.log(`Found ${buildersToRemove.length} builders to remove from architect category`);

    const allToRemove = [...duplicates, ...buildersToRemove];

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        dryRun: true,
        duplicatesFound: duplicates.length,
        buildersFound: buildersToRemove.length,
        totalToRemove: allToRemove.length,
        duplicates: duplicates,
        builders: buildersToRemove,
        message: `Found ${allToRemove.length} vendors to remove (${duplicates.length} duplicates, ${buildersToRemove.length} builders)`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Actually remove the duplicates and builders
    let removedCount = 0;
    if (allToRemove.length > 0) {
      const idsToRemove = allToRemove.map(item => item.id);
      const { error: deleteError } = await supabase
        .from('vendors')
        .delete()
        .in('id', idsToRemove);

      if (deleteError) {
        throw deleteError;
      }
      removedCount = idsToRemove.length;
    }

    console.log(`Successfully removed ${removedCount} vendors`);

    return new Response(JSON.stringify({
      success: true,
      dryRun: false,
      duplicatesFound: duplicates.length,
      buildersFound: buildersToRemove.length,
      totalRemoved: removedCount,
      message: `Successfully removed ${removedCount} vendors (${duplicates.length} duplicates, ${buildersToRemove.length} builders)`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in deduplicate-vendors function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper functions for normalization
function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\b(inc|llc|corp|ltd|company|co|pllc)\b/g, '') // Remove business suffixes
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, ''); // Keep only digits
}

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\b(street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd)\b/g, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Function to identify builders/contractors that shouldn't be in architect category
function isBuilderNotArchitect(businessName: string, notes: string): boolean {
  const combined = `${businessName} ${notes}`.toLowerCase();
  
  // Builder/contractor indicators
  const builderIndicators = [
    'builder', 'building', 'construction', 'contractor', 'homes',
    'custom homes', 'home builder', 'residential builder',
    'general contractor', 'gc ', 'construction company',
    'construction services', 'building company', 'home construction'
  ];
  
  // Architectural indicators that would override builder indicators
  const architectIndicators = [
    'architect', 'architectural', 'design', 'aia', 'licensed architect',
    'registered architect', 'architectural firm', 'architecture',
    'architectural design', 'architectural services'
  ];
  
  // If it has architectural indicators, it's probably an architect
  for (const indicator of architectIndicators) {
    if (combined.includes(indicator)) {
      return false; // Not a builder, it's an architect
    }
  }
  
  // If it has builder indicators and no architectural indicators, it's a builder
  for (const indicator of builderIndicators) {
    if (combined.includes(indicator)) {
      return true; // It's a builder, not an architect
    }
  }
  
  return false; // Default to keeping it
}