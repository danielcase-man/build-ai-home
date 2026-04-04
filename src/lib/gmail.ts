import { google, type Auth } from 'googleapis'
import { env } from './env'

interface GmailHeader {
  name: string
  value: string
}

interface GmailPayloadPart {
  mimeType: string
  filename?: string
  body: { data?: string; attachmentId?: string; size?: number }
  parts?: GmailPayloadPart[]
}

interface GmailPayload {
  headers: GmailHeader[]
  parts?: GmailPayloadPart[]
  body?: { data?: string }
}

interface GmailMessage {
  id: string
  threadId: string
  snippet: string
  payload: GmailPayload
}

export class GmailService {
  private oauth2Client: Auth.OAuth2Client

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      env.googleClientId,
      env.googleClientSecret,
      env.googleRedirectUri
    )
  }

  setCredentials(tokens: {
    access_token?: string | null
    refresh_token?: string | null
    expiry_date?: number | null
    token_type?: string | null
    scope?: string
    id_token?: string | null
  }) {
    this.oauth2Client.setCredentials(tokens)
  }

  /**
   * Refreshes the access token using the stored refresh token.
   * Returns the new credentials or null if refresh fails.
   */
  async refreshAccessToken(): Promise<{ access_token: string; expiry_date: number } | null> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken()
      this.oauth2Client.setCredentials(credentials)
      return {
        access_token: credentials.access_token || '',
        expiry_date: credentials.expiry_date || 0
      }
    } catch (error) {
      console.error('Error refreshing access token:', error)
      return null
    }
  }

  /** Returns true if the current access token is expired or about to expire (within 5 minutes). */
  isTokenExpired(): boolean {
    const creds = this.oauth2Client.credentials
    if (!creds.expiry_date) return false
    return creds.expiry_date < Date.now() + 5 * 60 * 1000
  }

  getAuthUrl(state?: string) {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      login_hint: process.env.GMAIL_USER_EMAIL || 'danielcase.info@gmail.com',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ],
      ...(state ? { state } : {}),
    })
  }

  async getTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code)
    return tokens
  }

  async getEmails(query: string) {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })

    try {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 20
      })

      if (!response.data.messages) {
        return []
      }

      const emails = await Promise.all(
        response.data.messages.map(async (message) => {
          const email = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!
          })
          return this.parseEmail(email.data as GmailMessage)
        })
      )

      return emails
    } catch (error) {
      console.error('Error fetching emails:', error)
      return []
    }
  }

  /**
   * Parses a raw header value containing one or more email addresses
   * (e.g. `"John Doe" <john@example.com>, jane@example.com`) into an array
   * of plain email addresses.
   */
  private parseAddressList(headerValue: string | undefined): string[] {
    if (!headerValue) return []
    // Split on commas that are NOT inside quotes/angle brackets (simple heuristic:
    // split on comma, then extract the email from each token).
    return headerValue.split(',').reduce<string[]>((acc, token) => {
      const trimmed = token.trim()
      if (!trimmed) return acc
      // Try angle-bracket form: "Name" <email@domain>
      const angleMatch = trimmed.match(/<([^>]+)>/)
      if (angleMatch) {
        acc.push(angleMatch[1].toLowerCase())
      } else if (trimmed.includes('@')) {
        // Bare email address
        acc.push(trimmed.toLowerCase())
      }
      return acc
    }, [])
  }

  private parseEmail(email: GmailMessage) {
    const headers = email.payload.headers
    const subject = headers.find((h) => h.name === 'Subject')?.value || ''
    const from = headers.find((h) => h.name === 'From')?.value || ''
    const date = headers.find((h) => h.name === 'Date')?.value || ''

    // Extract recipients from To/Cc/Bcc headers
    const to = this.parseAddressList(headers.find((h) => h.name === 'To')?.value)
    const cc = this.parseAddressList(headers.find((h) => h.name === 'Cc')?.value)
    const bcc = this.parseAddressList(headers.find((h) => h.name === 'Bcc')?.value)
    const recipients: Record<string, string[]> = {}
    if (to.length > 0) recipients.to = to
    if (cc.length > 0) recipients.cc = cc
    if (bcc.length > 0) recipients.bcc = bcc

    // Recursively find a MIME part by type (handles nested multipart structures)
    const findPart = (parts: GmailPayloadPart[] | undefined, mimeType: string): GmailPayloadPart | undefined => {
      if (!parts) return undefined
      for (const part of parts) {
        if (part.mimeType === mimeType && part.body?.data) return part
        if (part.parts) {
          const nested = findPart(part.parts, mimeType)
          if (nested) return nested
        }
      }
      return undefined
    }

    let body = ''
    if (email.payload.parts) {
      const textPart = findPart(email.payload.parts, 'text/plain')
      if (textPart && textPart.body.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString()
      } else {
        // Fallback to text/html with tag stripping
        const htmlPart = findPart(email.payload.parts, 'text/html')
        if (htmlPart && htmlPart.body.data) {
          const html = Buffer.from(htmlPart.body.data, 'base64').toString()
          body = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        }
      }
    } else if (email.payload.body?.data) {
      body = Buffer.from(email.payload.body.data, 'base64').toString()
    }

    // Extract attachment metadata
    const attachments: Array<{ filename: string; mimeType: string; attachmentId: string; size: number }> = []
    const collectAttachments = (parts: GmailPayloadPart[] | undefined) => {
      if (!parts) return
      for (const part of parts) {
        if (part.filename && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            attachmentId: part.body.attachmentId,
            size: part.body.size || 0,
          })
        }
        if (part.parts) collectAttachments(part.parts)
      }
    }
    collectAttachments(email.payload.parts)

    return {
      id: email.id,
      threadId: email.threadId,
      subject,
      from,
      date,
      body,
      snippet: email.snippet,
      attachments,
      recipients,
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlBody: string,
    attachments?: Array<{ filename: string; mimeType: string; content: Buffer }>
  ): Promise<string | null> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })

    // P0 fix: Strip CRLF from header fields to prevent MIME header injection
    const sanitizedTo = to.replace(/[\r\n]/g, '')
    const sanitizedSubject = subject.replace(/[\r\n]/g, '')

    try {
      let rawMessage: string

      if (attachments && attachments.length > 0) {
        const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`
        const messageParts = [
          `To: ${sanitizedTo}`,
          `Subject: ${sanitizedSubject}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=utf-8',
          '',
          htmlBody,
        ]

        for (const att of attachments) {
          messageParts.push(
            `--${boundary}`,
            `Content-Type: ${att.mimeType}; name="${att.filename}"`,
            'Content-Transfer-Encoding: base64',
            `Content-Disposition: attachment; filename="${att.filename}"`,
            '',
            att.content.toString('base64'),
          )
        }

        messageParts.push(`--${boundary}--`)
        rawMessage = messageParts.join('\r\n')
      } else {
        const messageParts = [
          `To: ${sanitizedTo}`,
          `Subject: ${sanitizedSubject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          '',
          htmlBody
        ]
        rawMessage = messageParts.join('\r\n')
      }

      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      })

      return response.data.id || null
    } catch (error) {
      console.error('Error sending email:', error)
      return null
    }
  }

  async getProfile(): Promise<{ historyId: string } | null> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
    try {
      const response = await gmail.users.getProfile({ userId: 'me' })
      return { historyId: response.data.historyId || '' }
    } catch (error) {
      console.error('Error getting Gmail profile:', error)
      return null
    }
  }

  async getHistoryChanges(startHistoryId: string): Promise<{ messageIds: string[]; newHistoryId: string } | null> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
    try {
      const response = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
      })

      const messageIds = new Set<string>()
      for (const record of response.data.history || []) {
        for (const added of record.messagesAdded || []) {
          if (added.message?.id) {
            messageIds.add(added.message.id)
          }
        }
      }

      return {
        messageIds: Array.from(messageIds),
        newHistoryId: response.data.historyId || startHistoryId,
      }
    } catch (error: unknown) {
      // 404/410 means historyId is too old — fall back to full fetch
      if (error && typeof error === 'object' && 'code' in error && ((error as { code: number }).code === 404 || (error as { code: number }).code === 410)) {
        console.log('History ID expired, falling back to full fetch')
        return null
      }
      console.error('Error getting history changes:', error)
      return null
    }
  }

  async getEmailById(messageId: string) {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
    try {
      const email = await gmail.users.messages.get({ userId: 'me', id: messageId })
      return this.parseEmail(email.data as GmailMessage)
    } catch (error) {
      console.error(`Error fetching email ${messageId}:`, error)
      return null
    }
  }

  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer | null> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
    try {
      const response = await gmail.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId,
      })

      if (response.data.data) {
        // Gmail returns base64url encoded data
        return Buffer.from(response.data.data, 'base64url')
      }
      return null
    } catch (error) {
      console.error(`Error fetching attachment ${attachmentId}:`, error)
      return null
    }
  }

  async markAsRead(messageId: string) {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })

    try {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      })
    } catch (error) {
      console.error('Error marking email as read:', error)
    }
  }
}
