import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Environment validation
function validateEnvironment() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PERPLEXITY_API_KEY'];
  const missing = required.filter(key => !Deno.env.get(key));

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment first
    validateEnvironment();

    const { projectId, location, zipCode, categoryId, categoryName, specialization, customContext, phase, stream = false } = await req.json();

    console.log('Starting vendor research for:', {
      projectId,
      location,
      categoryName,
      phase,
      stream
    });

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY')!;

    // Build research query
    const researchQuery = buildComprehensiveResearchQuery(categoryName, location, zipCode, specialization, customContext);
    console.log('Research query:', researchQuery);

    // Save initial staging record
    console.log('Creating staging record...');
    const { data: stagingRecord, error: stagingError } = await supabase
      .from('vendor_research_staging')
      .insert({
        project_id: projectId,
        category_name: categoryName,
        search_query: researchQuery,
        raw_firecrawl_data: {
          initial: 'Starting comprehensive vendor research...'
        },
        processing_status: 'starting'
      })
      .select()
      .single();

    if (stagingError) {
      console.error('Error creating staging record:', stagingError);
      throw new Error(`Failed to create staging record: ${stagingError.message}`);
    }

    console.log('Staging record created:', stagingRecord?.id);

    // If streaming is requested
    if (stream) {
      const encoder = new TextEncoder();

      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            // Send initial progress
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              stage: 'initializing',
              message: `Starting comprehensive research for ${categoryName} in ${location}...`,
              progress: 0
            })}\n\n`));

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              stage: 'researching',
              message: `AI agent researching ${categoryName} vendors with professional criteria...`,
              progress: 20
            })}\n\n`));

            // Perform comprehensive research
            const researchData = await performComprehensiveVendorResearch(
              perplexityApiKey,
              researchQuery,
              categoryName,
              location,
              zipCode
            );

            // Update staging with research data
            await supabase.from('vendor_research_staging').update({
              raw_firecrawl_data: { perplexity_research: researchData },
              processing_status: 'research_complete'
            }).eq('id', stagingRecord.id);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              stage: 'extracting',
              message: 'Extracting and validating vendor information...',
              progress: 70
            })}\n\n`));

            // Extract structured vendor data
            const vendors = await extractVendorsFromResearch(
              researchData,
              categoryId,
              projectId,
              location,
              zipCode
            );

            console.log('Extracted vendors:', vendors);

            // Update staging record
            await supabase.from('vendor_research_staging').update({
              extracted_vendors: vendors,
              processing_status: vendors.length > 0 ? 'vendors_extracted' : 'no_vendors_extracted',
              processing_notes: `Extracted ${vendors.length} vendors from research data`,
              processed_at: new Date().toISOString()
            }).eq('id', stagingRecord.id);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              stage: 'saving',
              message: `Checking for duplicates and saving ${vendors.length} vendors...`,
              progress: 90
            })}\n\n`));

            // Deduplicate and insert vendors into database
            let insertedVendors = [];
            if (vendors.length > 0) {
              const deduplicatedVendors = await deduplicateVendors(supabase, projectId, categoryId, vendors);
              
              if (deduplicatedVendors.length > 0) {
                const { data, error: insertError } = await supabase
                  .from('vendors')
                  .insert(deduplicatedVendors)
                  .select();

                if (insertError) {
                  console.error('Database insert error:', insertError);
                  await supabase.from('vendor_research_staging').update({
                    processing_status: 'insert_failed',
                    processing_notes: `Failed to insert vendors: ${insertError.message}`
                  }).eq('id', stagingRecord.id);
                  throw insertError;
                } else {
                  insertedVendors = data || [];
                  console.log('Successfully inserted vendors:', insertedVendors);
                  await supabase.from('vendor_research_staging').update({
                    processing_status: 'completed',
                    processing_notes: `Inserted ${insertedVendors.length} new vendors (${vendors.length - deduplicatedVendors.length} duplicates skipped)`
                  }).eq('id', stagingRecord.id);
                }
              } else {
                console.log('All vendors were duplicates, none inserted');
                await supabase.from('vendor_research_staging').update({
                  processing_status: 'completed',
                  processing_notes: `All ${vendors.length} vendors were duplicates, none inserted`
                }).eq('id', stagingRecord.id);
              }
            }

            // Send final result
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              stage: 'complete',
              message: `Research complete! Added ${insertedVendors.length} new vendors${vendors.length > insertedVendors.length ? ` (${vendors.length - insertedVendors.length} duplicates skipped)` : ''}.`,
              progress: 100,
              vendors: insertedVendors,
              count: insertedVendors.length
            })}\n\n`));

            controller.close();

          } catch (error) {
            console.error('Error in streaming research:', error);

            // Update staging record with error
            try {
              await supabase.from('vendor_research_staging').update({
                processing_status: 'failed',
                processing_notes: `Streaming error: ${error.message}`,
                processed_at: new Date().toISOString()
              }).eq('id', stagingRecord.id);
            } catch (updateError) {
              console.error('Failed to update staging record:', updateError);
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              message: error.message
            })}\n\n`));

            controller.close();
          }
        }
      });

      return new Response(streamResponse, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    // Non-streaming fallback
    try {
      // Perform research
      const researchData = await performComprehensiveVendorResearch(
        perplexityApiKey,
        researchQuery,
        categoryName,
        location,
        zipCode
      );

      // Update staging with research data
      await supabase.from('vendor_research_staging').update({
        raw_firecrawl_data: { perplexity_research: researchData },
        processing_status: 'research_complete'
      }).eq('id', stagingRecord.id);

      // Extract vendor data
      const vendors = await extractVendorsFromResearch(
        researchData,
        categoryId,
        projectId,
        location,
        zipCode
      );

      console.log('Extracted vendors:', vendors);

      // Update staging record
      await supabase.from('vendor_research_staging').update({
        extracted_vendors: vendors,
        processing_status: vendors.length > 0 ? 'vendors_extracted' : 'no_vendors_extracted',
        processing_notes: `Extracted ${vendors.length} vendors from research data`,
        processed_at: new Date().toISOString()
      }).eq('id', stagingRecord.id);

      // Deduplicate and insert vendors
      let insertedVendors = [];
      if (vendors.length > 0) {
        const deduplicatedVendors = await deduplicateVendors(supabase, projectId, categoryId, vendors);
        
        if (deduplicatedVendors.length > 0) {
          const { data, error: insertError } = await supabase
            .from('vendors')
            .insert(deduplicatedVendors)
            .select();

          if (insertError) {
            console.error('Database insert error:', insertError);
            await supabase.from('vendor_research_staging').update({
              processing_status: 'insert_failed',
              processing_notes: `Failed to insert vendors: ${insertError.message}`
            }).eq('id', stagingRecord.id);
            throw insertError;
          } else {
            insertedVendors = data || [];
            console.log('Successfully inserted vendors:', insertedVendors);
            await supabase.from('vendor_research_staging').update({
              processing_status: 'completed',
              processing_notes: `Inserted ${insertedVendors.length} new vendors (${vendors.length - deduplicatedVendors.length} duplicates skipped)`
            }).eq('id', stagingRecord.id);
          }
        } else {
          console.log('All vendors were duplicates, none inserted');
          await supabase.from('vendor_research_staging').update({
            processing_status: 'completed',
            processing_notes: `All ${vendors.length} vendors were duplicates, none inserted`
          }).eq('id', stagingRecord.id);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        vendors: insertedVendors,
        stagingId: stagingRecord.id,
        count: insertedVendors.length
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });

    } catch (error) {
      console.error('Error in vendor research:', error);

      await supabase.from('vendor_research_staging').update({
        processing_status: 'failed',
        processing_notes: `Research failed: ${error.message}`,
        processed_at: new Date().toISOString()
      }).eq('id', stagingRecord.id);

      throw error;
    }

  } catch (error) {
    console.error('Error in ai-vendor-research function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

// Implement missing function: performComprehensiveVendorResearch
async function performComprehensiveVendorResearch(
  apiKey: string,
  query: string,
  categoryName: string,
  location: string,
  zipCode: string
): Promise<string> {
  console.log('Starting Perplexity research for:', categoryName);

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar-deep-research',
      messages: [
        {
          role: 'system',
          content: 'You are an expert construction industry researcher. Find qualified construction vendors with complete contact information, licensing details, and pricing estimates.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      max_tokens: 2000,
      temperature: 0.2,
      top_p: 0.9,
      search_domain_filter: ["perplexity.ai"],
      return_images: false,
      return_related_questions: false,
      search_recency_filter: "month",
      presence_penalty: 0,
      frequency_penalty: 1
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response from Perplexity API');
  }

  const researchResult = data.choices[0].message.content;
  console.log('Perplexity research complete, result length:', researchResult.length);
  console.log('Research preview:', researchResult.substring(0, 500));

  return researchResult;
}

// Implement missing function: extractVendorsFromResearch
async function extractVendorsFromResearch(
  researchData: string,
  categoryId: string,
  projectId: string,
  location: string,
  zipCode: string
): Promise<any[]> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

  if (!openaiApiKey) {
    console.log('OpenAI API key not found, using fallback parsing');
    return parseVendorsFromText(researchData, categoryId, projectId, location, zipCode);
  }

  try {
    console.log('Using OpenAI to extract structured vendor data...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `You are an expert construction industry researcher specializing in vendor identification and qualification. Your task is to extract comprehensive vendor information from research data for construction projects.

EXTRACTION REQUIREMENTS:
You must extract ONLY real, verifiable vendor information that appears in the provided data. Do not invent, assume, or hallucinate any information.

REQUIRED JSON OUTPUT FORMAT:
Extract vendor data and format it as a JSON object with a "vendors" array. Each vendor object must match this exact structure:

{
  "vendors": [
    {
      "business_name": "string (REQUIRED - Official company name)",
      "contact_name": "string or null (Primary contact person)",
      "phone": "string or null (Phone in clean format: 5125551234)",
      "email": "string or null (Professional email address)",
      "website": "string or null (Company website URL with https://)",
      "address": "string or null (Complete street address)",
      "city": "string or null (City name)",
      "state": "string or null (State abbreviation: TX, CA, NY)",
      "zip_code": "string or null (5-digit ZIP code)",
      "rating": number or null (Numeric rating 1.0-5.0),
      "review_count": integer or null (Total reviews as whole number),
      "cost_estimate_low": number or null (Lowest cost as number),
      "cost_estimate_avg": number or null (Average cost as number),
      "cost_estimate_high": number or null (Highest cost as number),
      "notes": "string or null (Licenses, certifications, specializations)"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Extract vendor information from this research data and format as JSON:\n\n${researchData}`
          }
        ],
        temperature: 0.1,
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from OpenAI API');
    }

    let extractedData;
    try {
      extractedData = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON response:', parseError);
      throw new Error('Invalid JSON response from OpenAI');
    }

    console.log('OpenAI extracted vendors:', extractedData.vendors?.length || 0);

    // Transform extracted data to match database schema
    const vendors = extractedData.vendors?.map((vendor: any) => ({
      category_id: categoryId,
      project_id: projectId,
      business_name: vendor.business_name,
      contact_name: vendor.contact_name || null,
      phone: vendor.phone || null,
      email: vendor.email || null,
      website: vendor.website || null,
      address: vendor.address || null,
      city: vendor.city || extractCity(location),
      state: vendor.state || extractState(location),
      zip_code: vendor.zip_code || zipCode,
      rating: vendor.rating || null,
      review_count: vendor.review_count || null,
      cost_estimate_low: vendor.cost_estimate_low || null,
      cost_estimate_avg: vendor.cost_estimate_avg || null,
      cost_estimate_high: vendor.cost_estimate_high || null,
      notes: vendor.notes || null,
      ai_generated: true,
      status: 'researched'
    })) || [];

    // Quality validation
    const validVendors = vendors.filter((vendor: any) =>
      vendor.business_name &&
      vendor.business_name.length > 2 &&
      !vendor.business_name.toLowerCase().includes('contractor ')
    );

    console.log(`Validated ${validVendors.length} vendors from ${vendors.length} extracted`);
    return validVendors;

  } catch (error) {
    console.error('Error in structured extraction:', error);
    console.log('Falling back to text parsing');
    return parseVendorsFromText(researchData, categoryId, projectId, location, zipCode);
  }
}

// Build comprehensive research query for Perplexity
function buildComprehensiveResearchQuery(
  categoryName: string,
  location: string,
  zipCode: string,
  specialization?: string,
  customContext?: string
): string {
  const specializationText = specialization ? `specializing in ${specialization}` : '';
  const contextText = customContext ? `Additional requirements: ${customContext}.` : '';

  return `Find qualified ${categoryName} ${specializationText} in ${location}, Texas ${zipCode} area for construction projects.

RESEARCH REQUIREMENTS:
- Focus on licensed, insured, and bonded contractors
- Include established businesses with professional credentials
- Prioritize companies with positive customer reviews and ratings
- Look for businesses with relevant project portfolios
- Include contact information (phone, email, website)
- Find cost estimates and pricing information where available
- Include business addresses and service areas

QUALITY CRITERIA:
- Valid business licenses and certifications
- Insurance coverage and bonding information
- Professional certifications and associations
- Years in business and experience level
- Customer reviews and BBB ratings
- Notable projects and specializations

${contextText}

OUTPUT FORMAT:
For each vendor found, provide:
1. Business name and contact person
2. Complete contact information (phone, email, website)
3. Business address and service areas
4. Licenses, certifications, and insurance status
5. Customer ratings and review counts
6. Cost estimates and pricing ranges
7. Notable projects, specializations, and experience
8. Years in business and professional associations

Focus on finding real, verifiable businesses with established reputations in the ${location} area.`;
}

// Fallback text parsing function
function parseVendorsFromText(
  text: string,
  categoryId: string,
  projectId: string,
  location: string,
  zipCode: string
): any[] {
  const vendors = [];

  // Split by common patterns that indicate new vendors
  const sections = text.split(/\n(?=\d+\.|\*\*|##)/);

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
      vendor.phone = phoneMatch[1].replace(/[^\d]/g, '');
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

    // Extract website
    const websiteMatch = section.match(/(https?:\/\/[^\s]+)/);
    if (websiteMatch) {
      vendor.website = websiteMatch[1];
    }

    // Only add if we have at least a business name
    if (vendor.business_name && vendor.business_name.length > 2) {
      vendor.notes = section.substring(0, 500); // Store original text as notes
      vendors.push(vendor);
    }
  }

  console.log(`Parsed ${vendors.length} vendors from text`);
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

// Deduplication function to prevent duplicate vendors
async function deduplicateVendors(
  supabase: any,
  projectId: string,
  categoryId: string,
  newVendors: any[]
): Promise<any[]> {
  console.log(`Checking for duplicates among ${newVendors.length} vendors...`);

  // Get existing vendors for this project and category
  const { data: existingVendors, error } = await supabase
    .from('vendors')
    .select('business_name, phone, email, address')
    .eq('project_id', projectId)
    .eq('category_id', categoryId);

  if (error) {
    console.error('Error fetching existing vendors:', error);
    return newVendors; // Return all if we can't check for duplicates
  }

  const deduplicatedVendors = [];
  
  for (const newVendor of newVendors) {
    let isDuplicate = false;
    
    for (const existing of existingVendors || []) {
      // Check for duplicates based on multiple criteria
      const nameMatch = newVendor.business_name && existing.business_name &&
        normalizeBusinessName(newVendor.business_name) === normalizeBusinessName(existing.business_name);
      
      const phoneMatch = newVendor.phone && existing.phone &&
        normalizePhone(newVendor.phone) === normalizePhone(existing.phone);
      
      const emailMatch = newVendor.email && existing.email &&
        newVendor.email.toLowerCase() === existing.email.toLowerCase();
      
      const addressMatch = newVendor.address && existing.address &&
        normalizeAddress(newVendor.address) === normalizeAddress(existing.address);
      
      // Consider it a duplicate if:
      // 1. Business name matches exactly, OR
      // 2. Phone number matches, OR  
      // 3. Email matches, OR
      // 4. Address matches closely
      if (nameMatch || phoneMatch || emailMatch || addressMatch) {
        isDuplicate = true;
        console.log(`Skipping duplicate vendor: ${newVendor.business_name} (matched on ${nameMatch ? 'name' : phoneMatch ? 'phone' : emailMatch ? 'email' : 'address'})`);
        break;
      }
    }
    
    if (!isDuplicate) {
      deduplicatedVendors.push(newVendor);
    }
  }
  
  console.log(`Deduplicated ${newVendors.length} vendors to ${deduplicatedVendors.length} (${newVendors.length - deduplicatedVendors.length} duplicates removed)`);
  return deduplicatedVendors;
}

// Helper functions for normalization
function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\b(inc|llc|corp|ltd|company|co)\b/g, '') // Remove business suffixes
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
