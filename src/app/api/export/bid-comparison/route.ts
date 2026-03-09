import { NextRequest, NextResponse } from 'next/server'
import { getProject } from '@/lib/project-service'
import { getBids } from '@/lib/bids-service'
import {
  createPdfDocument,
  addHeader,
  addSectionTitle,
  addTable,
  addParagraph,
  addFooter,
  docToBuffer,
} from '@/lib/pdf-generator'

export async function GET(request: NextRequest) {
  try {
    const category = request.nextUrl.searchParams.get('category')
    const project = await getProject()
    if (!project) {
      return NextResponse.json({ error: 'No project found' }, { status: 404 })
    }

    let bids = await getBids(project.id)

    if (category) {
      bids = bids.filter(b => b.category.toLowerCase() === category.toLowerCase())
    }

    const doc = createPdfDocument()

    addHeader(doc, 'Bid Comparison', `${project.address || 'UBuildIt Project'} — ${new Date().toLocaleDateString()}${category ? ` — ${category}` : ''}`)

    // Group by category
    const categories = new Map<string, typeof bids>()
    for (const bid of bids) {
      const existing = categories.get(bid.category) || []
      existing.push(bid)
      categories.set(bid.category, existing)
    }

    for (const [cat, catBids] of categories) {
      addSectionTitle(doc, cat)

      // Sort by amount
      catBids.sort((a, b) => a.total_amount - b.total_amount)

      const tableHeaders = ['Vendor', 'Amount', 'Status', 'Lead Time', 'Scope']
      const tableRows = catBids.map(b => [
        b.vendor_name,
        `$${b.total_amount.toLocaleString()}`,
        b.status,
        b.lead_time_weeks ? `${b.lead_time_weeks} wks` : '-',
        (b.scope_of_work || b.description || '').substring(0, 60),
      ])

      addTable(doc, tableHeaders, tableRows, [100, 80, 72, 60, 200])

      // Lowest/highest
      const lowest = catBids[0]
      const highest = catBids[catBids.length - 1]
      const spread = highest.total_amount - lowest.total_amount

      if (catBids.length > 1) {
        addParagraph(doc, `Range: $${lowest.total_amount.toLocaleString()} (${lowest.vendor_name}) to $${highest.total_amount.toLocaleString()} (${highest.vendor_name}) — Spread: $${spread.toLocaleString()}`)
      }

      const selected = catBids.find(b => b.status === 'selected')
      if (selected) {
        addParagraph(doc, `Selected: ${selected.vendor_name} at $${selected.total_amount.toLocaleString()}`)
      }
    }

    addFooter(doc)

    const buffer = await docToBuffer(doc)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="bid-comparison-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating bid comparison:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
