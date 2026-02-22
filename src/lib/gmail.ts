import { google, type Auth } from 'googleapis'
import { env } from './env'

interface GmailHeader {
  name: string
  value: string
}

interface GmailPayloadPart {
  mimeType: string
  body: { data?: string }
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

  getAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ]
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

  private parseEmail(email: GmailMessage) {
    const headers = email.payload.headers
    const subject = headers.find((h) => h.name === 'Subject')?.value || ''
    const from = headers.find((h) => h.name === 'From')?.value || ''
    const date = headers.find((h) => h.name === 'Date')?.value || ''

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

    return {
      id: email.id,
      threadId: email.threadId,
      subject,
      from,
      date,
      body,
      snippet: email.snippet
    }
  }

  async sendEmail(to: string, subject: string, htmlBody: string): Promise<string | null> {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })

    try {
      const messageParts = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        htmlBody
      ]
      const rawMessage = messageParts.join('\r\n')
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
