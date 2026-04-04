import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { findOrCreateVendor } from '@/lib/bid-ingestion-service'

export async function POST() {
  try {
    // Get the default project
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'No project found' }, { status: 404 })
    }

    // Get all bids with no vendor_id
    const { data: bids, error } = await supabase
      .from('bids')
      .select('id, vendor_name, vendor_contact, vendor_email, vendor_phone, category')
      .eq('project_id', project.id)
      .is('vendor_id', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!bids || bids.length === 0) {
      return NextResponse.json({ message: 'No bids need backfill', linked: 0, created: 0 })
    }

    let linked = 0
    let created = 0
    const errors: string[] = []

    for (const bid of bids) {
      if (!bid.vendor_name) continue

      // Count vendors before to detect if a new one was created
      const { count: beforeCount } = await supabase
        .from('vendors')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project.id)

      const vendorId = await findOrCreateVendor(project.id, bid.vendor_name, {
        contact: bid.vendor_contact,
        email: bid.vendor_email,
        phone: bid.vendor_phone,
        category: bid.category,
      })

      if (vendorId) {
        const { error: updateError } = await supabase
          .from('bids')
          .update({ vendor_id: vendorId })
          .eq('id', bid.id)

        if (updateError) {
          errors.push(`${bid.vendor_name}: ${updateError.message}`)
        } else {
          const { count: afterCount } = await supabase
            .from('vendors')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', project.id)

          if ((afterCount || 0) > (beforeCount || 0)) {
            created++
          } else {
            linked++
          }
        }
      }
    }

    return NextResponse.json({
      message: `Backfilled ${linked + created} of ${bids.length} bids`,
      total: bids.length,
      linked,
      created,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('Backfill vendor IDs error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
