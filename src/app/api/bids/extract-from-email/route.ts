import { NextRequest } from 'next/server'
import { extractBidFromEmail } from '@/lib/bid-extractor'
import { supabase } from '@/lib/supabase'
import { successResponse, errorResponse, validationError } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email_id, subject, body: emailBody, sender_email, sender_name, project_id } = body

    if (!subject || !emailBody || !sender_email || !project_id) {
      return validationError('Missing required fields: subject, body, sender_email, project_id')
    }

    // Extract bids using AI
    console.log('Extracting bids from email:', subject)
    const extraction = await extractBidFromEmail(subject, emailBody, sender_email, sender_name)

    if (!extraction.success) {
      return errorResponse(new Error(extraction.error || 'Extraction failed'), 'Failed to extract bids')
    }

    if (extraction.bids.length === 0) {
      return successResponse({
        message: 'No bids found in email',
        is_bid_email: false
      })
    }

    // Store extracted bids in database
    const insertedBids = []

    for (const bid of extraction.bids) {
      // Try to find matching vendor
      const { data: vendors } = await supabase
        .from('vendors')
        .select('id')
        .eq('company_name', bid.vendor_name)
        .eq('project_id', project_id)
        .limit(1)

      const vendor_id = vendors && vendors.length > 0 ? vendors[0].id : null

      // Insert bid
      const { data: insertedBid, error } = await supabase
        .from('bids')
        .insert([{
          project_id,
          vendor_id,
          vendor_name: bid.vendor_name,
          vendor_contact: bid.vendor_contact,
          vendor_email: bid.vendor_email || sender_email,
          vendor_phone: bid.vendor_phone,
          category: bid.category,
          subcategory: bid.subcategory,
          description: bid.description,
          total_amount: bid.total_amount,
          line_items: bid.line_items,
          scope_of_work: bid.scope_of_work,
          inclusions: bid.inclusions,
          exclusions: bid.exclusions,
          payment_terms: bid.payment_terms,
          warranty_terms: bid.warranty_terms,
          estimated_duration: bid.estimated_duration,
          lead_time_weeks: bid.lead_time_weeks,
          valid_until: bid.valid_until,
          status: 'pending',
          source: 'email',
          email_id: email_id || null,
          ai_extracted: true,
          ai_confidence: bid.ai_confidence,
          ai_extraction_notes: bid.ai_extraction_notes,
          needs_review: bid.ai_confidence < 0.85,
          bid_date: new Date().toISOString().split('T')[0],
          received_date: new Date().toISOString().split('T')[0]
        }])
        .select()

      if (error) {
        console.error('Error inserting bid:', error)
        continue
      }

      if (insertedBid && insertedBid.length > 0) {
        insertedBids.push(insertedBid[0])
      }
    }

    // If we linked to an email, update the email with a note
    if (email_id && insertedBids.length > 0) {
      await supabase
        .from('emails')
        .update({
          category: 'bid',
          ai_summary: `${insertedBids.length} bid(s) extracted: ${insertedBids.map((b: Record<string, unknown>) => `${b.vendor_name} - ${b.category} ($${(b.total_amount as number).toLocaleString()})`).join('; ')}`
        })
        .eq('id', email_id)
    }

    return successResponse({
      message: `Extracted ${insertedBids.length} bid(s) from email`,
      is_bid_email: true,
      bids: insertedBids,
      extraction_notes: extraction.bids.map(b => b.ai_extraction_notes)
    })

  } catch (error) {
    return errorResponse(error, 'Failed to extract bids from email')
  }
}
