import { db } from '@/lib/database'
import { getProject } from '@/lib/project-service'
import EmailsClient from './EmailsClient'
import type { EmailRecord } from '@/types'

export default async function EmailsPage() {
  // Pre-fetch emails + status + auth state from DB server-side (fast, no Gmail API)
  const [recentEmails, project, gmailConfigured] = await Promise.all([
    db.getRecentEmails(7),
    getProject(),
    db.hasEmailAccountConfigured(),
  ])

  const status = project ? await db.getLatestProjectStatus(project.id) : null

  return (
    <EmailsClient
      initialEmails={recentEmails}
      initialStatus={status}
      gmailConfigured={gmailConfigured}
    />
  )
}
