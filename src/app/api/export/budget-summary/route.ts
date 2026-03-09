import { NextRequest, NextResponse } from 'next/server'
import { getProject } from '@/lib/project-service'
import { getBudgetItems } from '@/lib/budget-service'
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
    const format = request.nextUrl.searchParams.get('format') || 'csv'
    const project = await getProject()
    if (!project) {
      return NextResponse.json({ error: 'No project found' }, { status: 404 })
    }

    const items = await getBudgetItems(project.id)
    const budgetTotal = parseFloat(project.budget_total) || 1200000

    if (format === 'csv') {
      const headers = ['Category', 'Subcategory', 'Description', 'Estimated', 'Actual', 'Status', 'Payment Date']
      const rows = items.map(i => [
        i.category,
        i.subcategory || '',
        i.description,
        i.estimated_cost?.toString() || '',
        i.actual_cost?.toString() || '',
        i.status,
        i.payment_date || '',
      ])

      const totalEstimated = items.reduce((s, i) => s + (i.estimated_cost || 0), 0)
      const totalActual = items.reduce((s, i) => s + (i.actual_cost || 0), 0)
      rows.push(['TOTAL', '', '', totalEstimated.toString(), totalActual.toString(), '', ''])

      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="budget-summary-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // PDF format
    const doc = createPdfDocument()

    addHeader(doc, 'Budget Summary', `${project.address || 'UBuildIt Project'} — ${new Date().toLocaleDateString()}`)

    const totalEstimated = items.reduce((s, i) => s + (i.estimated_cost || 0), 0)
    const totalActual = items.reduce((s, i) => s + (i.actual_cost || 0), 0)

    addParagraph(doc, `Budget Total: $${budgetTotal.toLocaleString()} | Estimated: $${totalEstimated.toLocaleString()} | Actual: $${totalActual.toLocaleString()} | Remaining: $${(budgetTotal - totalActual).toLocaleString()}`)

    addSectionTitle(doc, 'Line Items')

    const tableHeaders = ['Category', 'Description', 'Estimated', 'Actual', 'Status']
    const tableRows = items.map(i => [
      i.category,
      i.description,
      i.estimated_cost ? `$${i.estimated_cost.toLocaleString()}` : '-',
      i.actual_cost ? `$${i.actual_cost.toLocaleString()}` : '-',
      i.status,
    ])

    addTable(doc, tableHeaders, tableRows, [100, 180, 80, 80, 72])

    addFooter(doc)

    const buffer = await docToBuffer(doc)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="budget-summary-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating budget summary:', error)
    return NextResponse.json({ error: 'Failed to generate export' }, { status: 500 })
  }
}
