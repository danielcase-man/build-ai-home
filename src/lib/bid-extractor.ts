/**
 * AI Bid Extraction Agent
 *
 * Analyzes emails and documents to extract structured bid information
 * Uses Claude AI to parse vendor proposals and quotes
 */

import { getAnthropicClient, parseAIJsonResponse } from './ai-clients'
import type { ExtractedBid, BidExtractionResult } from '@/types'

/**
 * Extract bid information from email content
 */
export async function extractBidFromEmail(
  emailSubject: string,
  emailBody: string,
  senderEmail: string,
  senderName?: string
): Promise<BidExtractionResult> {

  const prompt = `You are an AI assistant specialized in extracting structured bid/quote information from construction project emails.

Analyze the following email and extract ALL bid/quote information. If the email contains multiple bids or line items, extract each one.

EMAIL DETAILS:
From: ${senderName || senderEmail} <${senderEmail}>
Subject: ${emailSubject}

EMAIL BODY:
${emailBody}

EXTRACTION INSTRUCTIONS:
1. Identify the vendor/company name
2. Determine the category of work (e.g., "Windows & Doors", "Foundation", "HVAC", "Plumbing", "Roofing", etc.)
3. Extract all pricing information including:
   - Total bid amount
   - Line item breakdowns (if provided)
   - Material costs vs labor costs (if separated)
4. Extract scope details:
   - What work is included
   - What materials/services are provided
   - What is explicitly excluded
5. Extract terms:
   - Payment terms (deposit, progress payments, etc.)
   - Timeline/duration
   - Lead time for materials
   - Warranty information
   - Bid validity period
6. Assess your confidence in the extraction (0.0 to 1.0)

IMPORTANT RULES:
- If this is NOT a bid/quote email, return empty bids array
- Be precise with numbers - extract exact amounts
- If multiple bids are in one email, create separate entries
- If information is unclear, note it in ai_extraction_notes
- Use standard category names (see examples below)

STANDARD CATEGORIES:
- "Site Work" (clearing, grading, excavation)
- "Well & Septic" (well drilling, septic systems)
- "Foundation" (concrete, slab work)
- "Framing" (lumber, framing labor)
- "Roofing" (shingles, metal roofing)
- "Windows & Doors" (exterior windows, doors)
- "Siding & Exterior" (siding, stone, masonry)
- "MEP - HVAC" (heating, cooling, ventilation)
- "MEP - Plumbing" (plumbing rough-in, fixtures)
- "MEP - Electrical" (electrical service, wiring)
- "Insulation" (spray foam, batt, blown)
- "Drywall" (hanging, taping, finishing)
- "Flooring" (hardwood, tile, carpet)
- "Cabinetry" (kitchen cabinets, built-ins)
- "Countertops" (stone, quartz, marble)
- "Interior Finishes" (trim, doors, paint)
- "Appliances" (kitchen, laundry appliances)
- "Landscaping" (grading, plants, irrigation)
- "Pool & Spa" (pool construction, equipment)
- "Other" (if none of above fit)

Return ONLY valid JSON in this exact format:
{
  "bids": [
    {
      "vendor_name": "Company Name",
      "vendor_contact": "Contact Person Name (if mentioned)",
      "vendor_email": "email@example.com",
      "vendor_phone": "(123) 456-7890",
      "category": "One of the standard categories above",
      "subcategory": "More specific classification",
      "description": "Brief description of what this bid covers",
      "total_amount": 12345.67,
      "line_items": [
        {
          "item": "Specific item description",
          "quantity": 1,
          "unit_price": 1000.00,
          "total": 1000.00,
          "specs": "Technical specifications",
          "notes": "Any special notes"
        }
      ],
      "scope_of_work": "Detailed description of what will be done",
      "inclusions": [
        "What IS included in the bid",
        "Materials provided",
        "Services included"
      ],
      "exclusions": [
        "What is NOT included",
        "Owner-provided items",
        "Out of scope work"
      ],
      "payment_terms": "e.g., 50% deposit, 50% on completion",
      "warranty_terms": "e.g., 1-year workmanship, 10-year materials",
      "estimated_duration": "e.g., 2-3 weeks",
      "lead_time_weeks": 8,
      "valid_until": "2026-03-15",
      "ai_confidence": 0.95,
      "ai_extraction_notes": "Any uncertainties or assumptions made"
    }
  ]
}

If this is NOT a bid/quote email, return: {"bids": []}`

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const parsed = parseAIJsonResponse(content.text) as { bids?: ExtractedBid[] }

      return {
        success: true,
        bids: parsed.bids || [],
        raw_response: content.text
      }
    }

    return {
      success: false,
      bids: [],
      error: 'Unexpected response format from AI'
    }

  } catch (error) {
    console.error('Error extracting bid from email:', error)
    return {
      success: false,
      bids: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Extract bid from attached PDF or document
 */
export async function extractBidFromDocument(
  documentText: string,
  vendorName?: string,
  filename?: string
): Promise<BidExtractionResult> {

  const prompt = `You are an AI assistant specialized in extracting structured bid/quote information from construction proposal documents.

Analyze the following document and extract ALL bid/quote information.

${vendorName ? `VENDOR: ${vendorName}` : ''}
${filename ? `DOCUMENT: ${filename}` : ''}

DOCUMENT CONTENT:
${documentText}

[Use the same extraction instructions and JSON format as extractBidFromEmail above]

Return ONLY valid JSON with the bids array.`

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const parsed = parseAIJsonResponse(content.text) as { bids?: ExtractedBid[] }

      return {
        success: true,
        bids: parsed.bids || [],
        raw_response: content.text
      }
    }

    return {
      success: false,
      bids: [],
      error: 'Unexpected response format from AI'
    }

  } catch (error) {
    console.error('Error extracting bid from document:', error)
    return {
      success: false,
      bids: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Re-analyze a bid with additional context or corrections
 */
export async function refineBidExtraction(
  originalBid: ExtractedBid,
  additionalContext: string,
  userFeedback?: string
): Promise<BidExtractionResult> {

  const prompt = `You previously extracted this bid information:

${JSON.stringify(originalBid, null, 2)}

${userFeedback ? `USER FEEDBACK: ${userFeedback}` : ''}

ADDITIONAL CONTEXT:
${additionalContext}

Please refine the bid extraction based on this new information. Correct any errors and fill in missing details.

Return ONLY valid JSON with the updated bid in the same format.`

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const parsed = parseAIJsonResponse(content.text) as { bids?: ExtractedBid[] } | ExtractedBid

      if ('bids' in parsed) {
        return {
          success: true,
          bids: parsed.bids || [],
          raw_response: content.text
        }
      }

      return {
        success: true,
        bids: [parsed as ExtractedBid],
        raw_response: content.text
      }
    }

    return {
      success: false,
      bids: [],
      error: 'Unexpected response format'
    }

  } catch (error) {
    console.error('Error refining bid:', error)
    return {
      success: false,
      bids: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Compare multiple bids and provide analysis
 */
export async function compareBids(
  bids: ExtractedBid[],
  projectContext?: string
): Promise<{
  comparison: string
  recommendation?: string
  pros_cons: Array<{
    bid_id: number
    vendor: string
    pros: string[]
    cons: string[]
  }>
}> {

  const prompt = `You are a construction project consultant. Compare these bids and provide analysis.

${projectContext ? `PROJECT CONTEXT: ${projectContext}` : ''}

BIDS TO COMPARE:
${bids.map((bid, i) => `
BID ${i + 1}: ${bid.vendor_name}
Category: ${bid.category}
Total: $${bid.total_amount.toLocaleString()}
Description: ${bid.description}
Inclusions: ${bid.inclusions?.join(', ') || 'Not specified'}
Exclusions: ${bid.exclusions?.join(', ') || 'Not specified'}
Timeline: ${bid.estimated_duration || 'Not specified'}
Lead Time: ${bid.lead_time_weeks ? bid.lead_time_weeks + ' weeks' : 'Not specified'}
`).join('\n')}

Provide a structured comparison including:
1. Overview of pricing differences
2. Scope differences (what each includes/excludes)
3. Timeline considerations
4. Quality/reputation factors if evident
5. Pros and cons for each bid
6. Your recommendation (if appropriate)

Return valid JSON:
{
  "comparison": "Overall comparison narrative",
  "recommendation": "Which bid and why (if clear choice)",
  "pros_cons": [
    {
      "bid_id": 0,
      "vendor": "Vendor Name",
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"]
    }
  ]
}`

  try {
    const response = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = response.content[0]
    if (content.type === 'text') {
      return parseAIJsonResponse(content.text) as {
        comparison: string
        recommendation?: string
        pros_cons: Array<{ bid_id: number; vendor: string; pros: string[]; cons: string[] }>
      }
    }

    return {
      comparison: 'Unable to generate comparison',
      pros_cons: []
    }

  } catch (error) {
    console.error('Error comparing bids:', error)
    return {
      comparison: 'Error generating comparison: ' + (error instanceof Error ? error.message : 'Unknown error'),
      pros_cons: []
    }
  }
}
