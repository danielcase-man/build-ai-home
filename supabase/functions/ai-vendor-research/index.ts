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
    const { projectId, location, zipCode, categoryId, categoryName, specialization, customContext, phase, stream = false } = await req.json();
    
    console.log('Starting vendor research for:', { projectId, location, categoryName, phase, stream });
    
    // Create Supabase client first
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      throw new Error('FIRECRAWL_API_KEY not configured');
    }

    // Build search query
    const baseSearchTerm = specialization || categoryName;
    
    const contextInfo = customContext ? ` ${customContext}` : '';
    const searchQuery = `${baseSearchTerm} near ${location} ${zipCode}${contextInfo}`;
    
    console.log('Search query:', searchQuery);

    // Save initial staging record
    console.log('Creating staging record...');
    const { data: stagingRecord, error: stagingError } = await supabase
      .from('vendor_research_staging')
      .insert({
        project_id: projectId,
        category_name: categoryName,
        search_query: searchQuery,
        raw_firecrawl_data: { initial: 'Starting research...' },
        processing_status: 'starting'
      })
      .select()
      .single();

    if (stagingError) {
      console.error('Error creating staging record:', stagingError);
      throw new Error(`Failed to create staging record: ${stagingError.message}`);
    }

    console.log('Staging record created:', stagingRecord?.id);

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

            // Research vendors using Firecrawl with streaming
            const baseSearchTermStream = specialization || categoryName;
            
            const contextInfo = customContext ? ` ${customContext}` : '';
            const searchQueryStream = `${baseSearchTermStream} near ${location} ${zipCode}${contextInfo}`;
            
            // Define search URLs for comprehensive vendor discovery
            const searchUrls = [
              `https://www.google.com/search?q=${encodeURIComponent(searchQueryStream + ' site:yelp.com')}`,
              `https://www.google.com/search?q=${encodeURIComponent(searchQueryStream + ' site:yellowpages.com')}`,
              `https://www.google.com/search?q=${encodeURIComponent(searchQueryStream + ' site:bbb.org')}`,
              `https://www.google.com/search?q=${encodeURIComponent(searchQueryStream + ' contractor directory')}`,
              `https://www.google.com/search?q=${encodeURIComponent(searchQueryStream + ' reviews ratings')}`
            ];

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              stage: 'searching',
              message: `Searching for ${categoryName} contractors in ${location}...`,
              progress: 20
            })}\n\n`));

            console.log('Starting Firecrawl vendor search...');

            let allVendorData: any[] = [];
            const totalUrls = searchUrls.length;

            // Crawl each search URL for comprehensive vendor data
            for (let i = 0; i < searchUrls.length; i++) {
              const url = searchUrls[i];
              const progressStart = 20 + (i * 50 / totalUrls);
              const progressEnd = 20 + ((i + 1) * 50 / totalUrls);

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                stage: 'crawling',
                message: `Crawling vendor directory ${i + 1} of ${totalUrls}...`,
                progress: progressStart
              })}\n\n`));

              try {
                const crawlResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${firecrawlApiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    url: url,
                    formats: ['markdown', 'html'],
                    onlyMainContent: true,
                    extractorOptions: {
                      mode: 'llm-extraction',
                      extractionSchema: {
                        type: "object",
                        properties: {
                          vendors: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                business_name: { type: "string" },
                                contact_name: { type: "string" },
                                phone: { type: "string" },
                                email: { type: "string" },
                                website: { type: "string" },
                                address: { type: "string" },
                                city: { type: "string" },
                                state: { type: "string" },
                                zip_code: { type: "string" },
                                rating: { type: "number" },
                                review_count: { type: "number" },
                                cost_estimate_low: { type: "number" },
                                cost_estimate_avg: { type: "number" },
                                cost_estimate_high: { type: "number" },
                                notes: { type: "string" }
                              }
                            }
                          }
                        }
                      },
                      extractionPrompt: `Extract detailed vendor/business information for ${categoryName} services in ${location} area (${zipCode}). Focus on established businesses with contact info and reviews.`
                    }
                  }),
                });

                if (crawlResponse.ok) {
                  const crawlData = await crawlResponse.json();
                  console.log('Firecrawl response:', JSON.stringify(crawlData, null, 2));
                  if (crawlData.success && crawlData.data) {
                    allVendorData.push(crawlData.data);
                    console.log(`Successfully scraped ${url}, collected data:`, crawlData.data);
                  } else {
                    console.warn(`No data returned from ${url}`);
                  }
                } else {
                  const errorText = await crawlResponse.text();
                  console.warn(`Failed to scrape ${url}:`, errorText);
                }

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'progress',
                  stage: 'crawling',
                  message: `Processed directory ${i + 1} of ${totalUrls}...`,
                  progress: progressEnd
                })}\n\n`));

              } catch (error) {
                console.warn(`Error crawling ${url}:`, error);
                // Continue with other URLs
              }
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              stage: 'parsing',
              message: 'Extracting vendor details from crawled data...',
              progress: 75
            })}\n\n`));

            console.log('Firecrawl crawling complete, parsing vendors...');

            // Combine all crawled data into a single text for processing
            const combinedData = allVendorData.map(item => 
              typeof item === 'string' ? item : 
              item.markdown || item.content || JSON.stringify(item)
            ).join('\n\n');

            // Use OpenAI structured extraction to clean and parse vendor data
            const vendors = await extractStructuredVendorData(combinedData, categoryId, projectId, location, zipCode);
            
            console.log('Structured vendors:', vendors);

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

    // Research vendors using Firecrawl (non-streaming fallback)
    const baseSearchTermFallback = specialization || categoryName;
    
    const contextInfo = customContext ? ` ${customContext}` : '';
    const searchQueryFallback = `${baseSearchTermFallback} near ${location} ${zipCode}${contextInfo}`;
    
    // Define search URLs for comprehensive vendor discovery
    const searchUrls = [
      `https://www.google.com/search?q=${encodeURIComponent(searchQueryFallback + ' site:yelp.com')}`,
      `https://www.google.com/search?q=${encodeURIComponent(searchQueryFallback + ' site:yellowpages.com')}`,
      `https://www.google.com/search?q=${encodeURIComponent(searchQueryFallback + ' site:bbb.org')}`,
      `https://www.google.com/search?q=${encodeURIComponent(searchQueryFallback + ' contractor directory')}`,
      `https://www.google.com/search?q=${encodeURIComponent(searchQueryFallback + ' reviews ratings')}`
    ];

    console.log('Starting Firecrawl vendor search with URLs:', searchUrls);

    let allVendorData: any[] = [];

    // Crawl each search URL for comprehensive vendor data using scrape API
    for (const url of searchUrls) {
      try {
        const crawlResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: url,
            formats: ['markdown', 'html'],
            onlyMainContent: true,
            extractorOptions: {
              mode: 'llm-extraction',
              extractionSchema: {
                type: "object",
                properties: {
                  vendors: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        business_name: { type: "string" },
                        contact_name: { type: "string" },
                        phone: { type: "string" },
                        email: { type: "string" },
                        website: { type: "string" },
                        address: { type: "string" },
                        city: { type: "string" },
                        state: { type: "string" },
                        zip_code: { type: "string" },
                        rating: { type: "number" },
                        review_count: { type: "number" },
                        cost_estimate_low: { type: "number" },
                        cost_estimate_avg: { type: "number" },
                        cost_estimate_high: { type: "number" },
                        notes: { type: "string" }
                      }
                    }
                  }
                }
              },
              extractionPrompt: `Extract detailed vendor/business information for ${categoryName} services in ${location} area (${zipCode}). Focus on established businesses with contact info and reviews.`
            }
          }),
        });

        if (crawlResponse.ok) {
          const crawlData = await crawlResponse.json();
          console.log('Firecrawl response for', url, ':', JSON.stringify(crawlData, null, 2));
          if (crawlData.success && crawlData.data) {
            allVendorData.push({
              url: url,
              data: crawlData.data,
              success: true
            });
            console.log(`Successfully scraped ${url}, collected data:`, crawlData.data);
          } else {
            console.warn(`No data returned from ${url}:`, crawlData);
            allVendorData.push({
              url: url,
              data: crawlData,
              success: false,
              error: 'No data returned'
            });
          }
        } else {
          const errorText = await crawlResponse.text();
          console.warn(`Failed to scrape ${url}:`, errorText);
          allVendorData.push({
            url: url,
            data: null,
            success: false,
            error: errorText
          });
        }
      } catch (error) {
        console.warn(`Error scraping ${url}:`, error);
        allVendorData.push({
          url: url,
          data: null,
          success: false,
          error: error.message
        });
        // Continue with other URLs
      }
    }

    console.log('Raw Firecrawl data collected:', JSON.stringify(allVendorData, null, 2));

    // Update the existing staging record with raw data
    const { error: updateError } = await supabase
      .from('vendor_research_staging')
      .update({
        raw_firecrawl_data: allVendorData,
        processing_status: 'raw_data_collected'
      })
      .eq('id', stagingRecord.id);

    if (updateError) {
      console.error('Error updating staging with raw data:', updateError);
    } else {
      console.log('Updated staging record with raw data:', stagingRecord.id);
    }

    // Extract successful crawl data for processing
    const successfulData = allVendorData
      .filter(item => item.success && item.data)
      .map(item => item.data);

    // Combine successful crawled data for processing
    const combinedData = successfulData.map(item => 
      typeof item === 'string' ? item : 
      item.markdown || item.content || item.extract || JSON.stringify(item)
    ).join('\n\n');

    console.log('Combined successful data length:', combinedData.length);
    console.log('Combined data preview:', combinedData.substring(0, 1000));

    if (!combinedData.trim()) {
      console.log('No usable data extracted from Firecrawl');
      
      // Update staging record
      await supabase
        .from('vendor_research_staging')
        .update({
          processing_status: 'no_data_found',
          processing_notes: 'No usable data extracted from Firecrawl responses',
          processed_at: new Date().toISOString()
        })
        .eq('id', stagingRecord.id);

      return new Response(JSON.stringify({ 
        success: true, 
        vendors: [],
        rawData: allVendorData,
        stagingId: stagingRecord.id,
        count: 0,
        message: 'No vendor data found in crawled results'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use OpenAI structured extraction to clean and parse vendor data
    const vendors = await extractStructuredVendorData(combinedData, categoryId, projectId, location, zipCode);
    
    console.log('Structured vendors:', vendors);

    // Update staging record with extracted vendors
    await supabase
      .from('vendor_research_staging')
      .update({
        extracted_vendors: vendors,
        processing_status: vendors.length > 0 ? 'vendors_extracted' : 'no_vendors_extracted',
        processing_notes: `Extracted ${vendors.length} vendors from combined data`,
        processed_at: new Date().toISOString()
      })
      .eq('id', stagingRecord.id);

    // Only insert vendors if we have valid data
    let insertedVendors = [];
    if (vendors.length > 0) {
      const { data, error: insertError } = await supabase
        .from('vendors')
        .insert(vendors)
        .select();

      if (insertError) {
        console.error('Database insert error:', insertError);
        
        // Update staging with error
        await supabase
          .from('vendor_research_staging')
          .update({
            processing_status: 'insert_failed',
            processing_notes: `Failed to insert vendors: ${insertError.message}`
          })
          .eq('id', stagingRecord.id);
      } else {
        insertedVendors = data || [];
        console.log('Successfully inserted vendors:', insertedVendors);
        
        // Update staging with success
        await supabase
          .from('vendor_research_staging')
          .update({
            processing_status: 'completed',
            processing_notes: `Successfully inserted ${insertedVendors.length} vendors`
          })
          .eq('id', stagingRecord.id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      vendors: insertedVendors,
      rawData: allVendorData,
      stagingId: stagingRecord.id,
      count: insertedVendors.length 
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

// OpenAI structured extraction for vendor data
async function extractStructuredVendorData(rawData: string, categoryId: string, projectId: string, location: string, zipCode: string) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    console.log('OpenAI API key not found, falling back to regex parsing');
    return parseVendorsFromAI(rawData, categoryId, projectId, location, zipCode);
  }

  try {
    console.log('Using OpenAI structured extraction for vendor data...');
    
    // Preprocess the data to remove common artifacts
    const cleanedData = preprocessVendorData(rawData);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a data extraction specialist. Extract vendor information from unstructured research data and return it as a structured JSON array. Each vendor should have these fields:
- business_name (required): The company name
- contact_name: Primary contact person if mentioned
- phone: Phone number (clean format)
- email: Email address
- website: Website URL
- address: Street address
- city: City name
- state: State abbreviation  
- rating: Numeric rating (1-5 scale)
- review_count: Number of reviews as integer
- cost_estimate_low: Lowest cost estimate as number
- cost_estimate_avg: Average cost estimate as number  
- cost_estimate_high: Highest cost estimate as number
- notes: Any additional relevant information

Important: Only extract real vendor data that appears in the text. Do not invent or hallucinate information. Return empty array if no valid vendors found.`
          },
          {
            role: 'user',
            content: `Extract vendor information from this research data:\n\n${cleanedData}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "vendor_extraction",
            schema: {
              type: "object",
              properties: {
                vendors: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      business_name: { type: "string" },
                      contact_name: { type: ["string", "null"] },
                      phone: { type: ["string", "null"] },
                      email: { type: ["string", "null"] },
                      website: { type: ["string", "null"] },
                      address: { type: ["string", "null"] },
                      city: { type: ["string", "null"] },
                      state: { type: ["string", "null"] },
                      rating: { type: ["number", "null"], minimum: 1, maximum: 5 },
                      review_count: { type: ["integer", "null"], minimum: 0 },
                      cost_estimate_low: { type: ["number", "null"] },
                      cost_estimate_avg: { type: ["number", "null"] },
                      cost_estimate_high: { type: ["number", "null"] },
                      notes: { type: ["string", "null"] }
                    },
                    required: ["business_name"],
                    additionalProperties: false
                  }
                }
              },
              required: ["vendors"],
              additionalProperties: false
            }
          }
        },
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', await response.text());
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const extractedData = JSON.parse(data.choices[0].message.content);
    
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
      zip_code: zipCode,
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
    const validVendors = vendors.filter(vendor => 
      vendor.business_name && 
      vendor.business_name.length > 2 && 
      !vendor.business_name.toLowerCase().includes('contractor ')
    );

    console.log(`Validated ${validVendors.length} vendors from ${vendors.length} extracted`);

    // If no valid vendors, fall back to regex parsing
    if (validVendors.length === 0) {
      console.log('No valid vendors from structured extraction, falling back to regex');
      return parseVendorsFromAI(rawData, categoryId, projectId, location, zipCode);
    }

    return validVendors;

  } catch (error) {
    console.error('Error in structured extraction:', error);
    console.log('Falling back to regex parsing');
    return parseVendorsFromAI(rawData, categoryId, projectId, location, zipCode);
  }
}

// Data preprocessing to clean artifacts
function preprocessVendorData(rawData: string): string {
  return rawData
    // Remove citations and AI artifacts
    .replace(/\[[^\]]*\]/g, '')
    .replace(/AI Research/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
    // Fix common geographic errors
    .replace(/Lander,TX/g, 'Leander, TX')
    .replace(/(\w+),(\w+)/g, '$1, $2') // Add space after commas
    // Clean excessive whitespace
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// Fallback regex parsing (original function)
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

  // If no vendors were parsed, log the issue and return empty array
  if (vendors.length === 0) {
    console.log('No vendors parsed from AI response. Raw data length:', aiResponse.length);
    console.log('AI response preview:', aiResponse.substring(0, 500));
    // Don't create fallback vendors - return empty array to indicate real failure
    return [];
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

// Helper function to get specialization label
function getSpecializationLabel(specialization: string, subcategoryKey: string): string | null {
  const specializationOptions: { [key: string]: { [value: string]: string } } = {
    'architects': {
      'residential': 'Residential Architects',
      'custom_home': 'Custom Home Architects',
      'green_building': 'Green Building Architects',
      'modern_design': 'Modern Design Architects',
      'traditional': 'Traditional Style Architects',
      'luxury': 'Luxury Home Architects',
      'renovation': 'Renovation Specialists'
    },
    'engineers': {
      'structural': 'Structural Engineers',
      'civil': 'Civil Engineers',
      'geotechnical': 'Geotechnical Engineers',
      'mechanical': 'Mechanical Engineers',
      'electrical': 'Electrical Engineers'
    },
    'interior_designers': {
      'kitchen': 'Kitchen Designers',
      'bathroom': 'Bathroom Designers',
      'lighting': 'Lighting Designers',
      'general': 'General Interior Designers'
    }
  };

  return specializationOptions[subcategoryKey]?.[specialization] || null;
}