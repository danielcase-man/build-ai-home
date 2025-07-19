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
    const { projectId, location, zipCode, categoryId, categoryName, phase } = await req.json();
    
    console.log('Starting vendor research for:', { projectId, location, categoryName, phase });

    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Research vendors using Perplexity
    const prompt = `Find 3-5 reputable ${categoryName} contractors/vendors in ${location} (zip code ${zipCode}) for construction projects. For each vendor, provide:
    - Business name
    - Contact information (phone, email if available)
    - Address
    - Estimated cost range for typical ${phase} phase work
    - Rating/reviews if available
    - Specializations within ${categoryName}

    Focus on licensed, insured contractors with good reviews. Include both local smaller businesses and established companies.`;

    console.log('Sending request to Perplexity with prompt:', prompt);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-deep-research',
        messages: [
          {
            role: 'system',
            content: 'You are a construction industry expert helping find qualified contractors. Provide accurate, current information with realistic cost estimates. Format your response as a structured list of vendors.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        top_p: 0.9,
        max_tokens: 2000,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'month',
        frequency_penalty: 1,
        presence_penalty: 0
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('Perplexity response received, parsing vendors...');

    // Parse the AI response to extract vendor information
    const vendors = parseVendorsFromAI(aiResponse, categoryId, projectId, location, zipCode);
    
    console.log('Parsed vendors:', vendors);

    // Insert vendors into database
    const { data: insertedVendors, error: insertError } = await supabase
      .from('vendors')
      .insert(vendors)
      .select();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    console.log('Successfully inserted vendors:', insertedVendors);

    return new Response(JSON.stringify({ 
      success: true, 
      vendors: insertedVendors,
      aiResponse,
      count: vendors.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-vendor-research function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function parseVendorsFromAI(aiResponse: string, categoryId: string, projectId: string, location: string, zipCode: string) {
  const vendors = [];
  
  // Split by common patterns that indicate new vendors
  const sections = aiResponse.split(/\n(?=\d+\.|\*\*|##)/);
  
  for (const section of sections) {
    if (section.trim().length < 20) continue; // Skip very short sections
    
    const vendor: any = {
      category_id: categoryId,
      project_id: projectId,
      city: extractCity(location),
      state: extractState(location),
      zip_code: zipCode,
      ai_generated: true,
      status: 'researched'
    };

    // Extract business name (usually the first bold text or after a number)
    const nameMatch = section.match(/(?:\d+\.\s*)?(?:\*\*)?([^*\n]+?)(?:\*\*)?(?:\n|:)/);
    if (nameMatch) {
      vendor.business_name = nameMatch[1].trim();
    }

    // Extract phone numbers
    const phoneMatch = section.match(/(?:phone|tel|call)[\s:]*([+]?[\d\s\-\(\)\.]{10,})/i);
    if (phoneMatch) {
      vendor.phone = phoneMatch[1].replace(/[^\d+\-]/g, '');
    }

    // Extract email
    const emailMatch = section.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      vendor.email = emailMatch[1];
    }

    // Extract address
    const addressMatch = section.match(/(?:address|location)[\s:]*([^,\n]+(?:,\s*[^,\n]+)*)/i);
    if (addressMatch) {
      vendor.address = addressMatch[1].trim();
    }

    // Extract rating
    const ratingMatch = section.match(/(?:rating|stars?)[\s:]*(\d+(?:\.\d+)?)/i);
    if (ratingMatch) {
      vendor.rating = parseFloat(ratingMatch[1]);
    }

    // Extract review count
    const reviewMatch = section.match(/(\d+)\s*(?:reviews?|ratings?)/i);
    if (reviewMatch) {
      vendor.review_count = parseInt(reviewMatch[1]);
    }

    // Extract cost estimates
    const costMatch = section.match(/\$\s*(\d+(?:,\d+)*)\s*(?:-|to)\s*\$?\s*(\d+(?:,\d+)*)/);
    if (costMatch) {
      vendor.cost_estimate_low = parseInt(costMatch[1].replace(/,/g, ''));
      vendor.cost_estimate_high = parseInt(costMatch[2].replace(/,/g, ''));
      vendor.cost_estimate_avg = Math.round((vendor.cost_estimate_low + vendor.cost_estimate_high) / 2);
    }

    // Extract website
    const websiteMatch = section.match(/(https?:\/\/[^\s]+)/);
    if (websiteMatch) {
      vendor.website = websiteMatch[1];
    }

    // Only add if we have at least a business name
    if (vendor.business_name) {
      vendors.push(vendor);
    }
  }

  // If no vendors were parsed, create some fallback vendors
  if (vendors.length === 0) {
    console.log('No vendors parsed, creating fallback vendors');
    for (let i = 1; i <= 3; i++) {
      vendors.push({
        category_id: categoryId,
        project_id: projectId,
        business_name: `${getCategoryTypeFromText(aiResponse)} Contractor ${i}`,
        city: extractCity(location),
        state: extractState(location),
        zip_code: zipCode,
        ai_generated: true,
        status: 'researched',
        notes: 'Generated from AI research - contact details to be verified'
      });
    }
  }

  return vendors;
}

function extractCity(location: string): string {
  const parts = location.split(',');
  return parts[0]?.trim() || location;
}

function extractState(location: string): string {
  const parts = location.split(',');
  return parts[1]?.trim() || '';
}

function getCategoryTypeFromText(text: string): string {
  if (text.toLowerCase().includes('plumb')) return 'Plumbing';
  if (text.toLowerCase().includes('electric')) return 'Electrical';
  if (text.toLowerCase().includes('roof')) return 'Roofing';
  if (text.toLowerCase().includes('floor')) return 'Flooring';
  return 'Construction';
}