import { NextResponse } from 'next/server'
import { getProject, getProjectStatus } from '@/lib/project-service'
import {
  createPdfDocument,
  addHeader,
  addSectionTitle,
  addParagraph,
  addBulletList,
  addFooter,
  docToBuffer,
} from '@/lib/pdf-generator'

export async function GET() {
  try {
    const project = await getProject()
    if (!project) {
      return NextResponse.json({ error: 'No project found' }, { status: 404 })
    }

    const status = await getProjectStatus()
    if (!status) {
      return NextResponse.json({ error: 'No status data' }, { status: 404 })
    }

    const doc = createPdfDocument()

    addHeader(doc, 'Project Status Report', `${project.address || 'UBuildIt Project'} — ${new Date().toLocaleDateString()}`)

    addSectionTitle(doc, 'Overview')
    addParagraph(doc, `Phase: ${status.phase} | Step: ${status.currentStep} (${status.stepNumber}/${status.totalSteps})`)
    addParagraph(doc, `Progress: ${status.progressPercentage}% | Days Elapsed: ${status.daysElapsed}/${status.totalDays}`)
    addParagraph(doc, `Budget: $${status.budgetUsed.toLocaleString()} / $${status.budgetTotal.toLocaleString()} (${status.budgetStatus})`)

    if (status.aiSummary) {
      addSectionTitle(doc, 'AI Summary')
      addParagraph(doc, status.aiSummary)
    }

    if (status.hotTopics.length > 0) {
      addSectionTitle(doc, 'Hot Topics')
      addBulletList(doc, status.hotTopics.map(t => `[${t.priority}] ${t.text}`))
    }

    if (status.actionItems.length > 0) {
      addSectionTitle(doc, 'Action Items')
      addBulletList(doc, status.actionItems.map(a => `[${a.status}] ${a.text}`))
    }

    if (status.recentDecisions.length > 0) {
      addSectionTitle(doc, 'Recent Decisions')
      addBulletList(doc, status.recentDecisions.map(d => `${d.decision} — Impact: ${d.impact}`))
    }

    if (status.nextSteps.length > 0) {
      addSectionTitle(doc, 'Next Steps')
      addBulletList(doc, status.nextSteps)
    }

    addFooter(doc)

    const buffer = await docToBuffer(doc)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="status-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating status report PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
