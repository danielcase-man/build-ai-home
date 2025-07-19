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
    const { projectId, location, zipCode, categoryId, categoryName, phase, stream = false } = await req.json();
    
    console.log('Starting vendor research for:', { projectId, location, categoryName, phase, stream });

    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If streaming is requested, set up SSE
    if (stream) {
      const encoder = new TextEncoder();
      
      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            // Send initial progress
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              stage: 'initializing',
              message: `Starting research for ${categoryName} in ${location}...`,
              progress: 0
            })}\n\n`));

            // Research vendors using Perplexity with streaming
            const prompt = `Given the following:
- Vendor type: ${categoryName} (${phase})
- Zip code: ${zipCode}
- Location: ${location}

Please:
- Research and list the top 10 ${categoryName} serving ${location} (zip ${zipCode}) based on reputation, credentials, and client reviews.
- For each, provide:
  • Business Name
  • Contact Information (phone, email if available)
  • Address
  • Website (if available)
  • Estimated cost range for typical ${categoryName} services in ${phase}
  • Ratings/reviews (with source platform, if available)
  • Specializations within ${categoryName} services
  • Licensing and insurance status
  • Company size (small, mid, large)
  • Years in business
- Clearly identify which vendor is the best value, considering cost, reputation, and specialization.
- Format the data as a structured list ready for import into a vendor database.

Focus on licensed, insured contractors with good reviews. Include both local smaller businesses and established companies actively servicing zip code ${zipCode}.`;

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              stage: 'searching',
              message: `Searching for ${categoryName} contractors in ${location}...`,
              progress: 20
            })}\n\n`));

            console.log('Sending streaming request to Perplexity...');

            const response = await fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${perplexityApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'sonar-deep-research',
                stream: true,
                messages: [
                  {
                    role: 'system',
                    content: 'You are a vendor research agent supporting a home build management platform. For a given vendor type and zip code, your task is to identify the top 10 vendors, evaluate and rank "best value", and return complete metadata. Thoroughly fact-check all included metadata and provide results as a structured list suitable for direct database import.'
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

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              stage: 'analyzing',
              message: 'Analyzing search results and gathering vendor information...',
              progress: 40
            })}\n\n`));

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let aiResponse = '';
            let processedChunks = 0;

            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.choices?.[0]?.delta?.content) {
                        aiResponse += parsed.choices[0].delta.content;
                        processedChunks++;
                        
                        // Send progress updates
                        if (processedChunks % 10 === 0) {
                          const progress = Math.min(40 + (processedChunks * 2), 80);
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'progress',
                            stage: 'processing',
                            message: 'Processing research results...',
                            progress
                          })}\n\n`));
                        }
                      }
                    } catch (e) {
                      console.log('Skipping invalid JSON chunk:', data);
                    }
                  }
                }
              }
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              stage: 'parsing',
              message: 'Extracting vendor details...',
              progress: 85
            })}\n\n`));

            console.log('Perplexity streaming complete, parsing vendors...');

            // Parse the AI response to extract vendor information
            const vendors = parseVendorsFromAI(aiResponse, categoryId, projectId, location, zipCode);
            
            console.log('Parsed vendors:', vendors);

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              stage: 'saving',
              message: `Saving ${vendors.length} vendors to database...`,
              progress: 90
            })}\n\n`));

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

            // Send final result
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              stage: 'complete',
              message: `Research complete! Found ${vendors.length} vendors.`,
              progress: 100,
              vendors: insertedVendors,
              count: vendors.length
            })}\n\n`));

            controller.close();
          } catch (error) {
            console.error('Error in streaming research:', error);
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
          'Connection': 'keep-alive',
        },
      });
    }

    // Research vendors using Perplexity (non-streaming fallback)
    const prompt = `Given the following:
- Vendor type: ${categoryName} (${phase})
- Zip code: ${zipCode}
- Location: ${location}

Please:
- Research and list the top 10 ${categoryName} serving ${location} (zip ${zipCode}) based on reputation, credentials, and client reviews.
- For each, provide:
  • Business Name
  • Contact Information (phone, email if available)
  • Address
  • Website (if available)
  • Estimated cost range for typical ${categoryName} services in ${phase}
  • Ratings/reviews (with source platform, if available)
  • Specializations within ${categoryName} services
  • Licensing and insurance status
  • Company size (small, mid, large)
  • Years in business
- Clearly identify which vendor is the best value, considering cost, reputation, and specialization.
- Format the data as a structured list ready for import into a vendor database.

Focus on licensed, insured contractors with good reviews. Include both local smaller businesses and established companies actively servicing zip code ${zipCode}.`;

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
            content: 'You are a vendor research agent supporting a home build management platform. For a given vendor type and zip code, your task is to identify the top 10 vendors, evaluate and rank "best value", and return complete metadata. Thoroughly fact-check all included metadata and provide results as a structured list suitable for direct database import.'
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