# Gmail MCP Setup for Claude Code

## What This Does

This gives Claude Code (the AI coding assistant) the ability to **search, read, and send Gmail emails** directly — the same capability that Cline already has in VSCodium. This uses the `@sowonai/mcp-gmail` MCP server package.

## Prerequisites

- Node.js and `npx` available in your WSL environment
- The Gmail OAuth credentials are already set up (reusing from the Cline/VSCodium config)

---

## Option A: CLI Command (Recommended — Simplest)

Run this in your WSL terminal from the project directory (`~/Projects/ubuildit-manager` or wherever it maps):

```bash
claude mcp add gmail \
  --command "npx" \
  --args "-y" "@sowonai/mcp-gmail" \
  --env "GOOGLE_CLIENT_ID=52695817098-8j1irp74k7mnrg26jkse31ors1cf1aau.apps.googleusercontent.com" \
  --env "GOOGLE_CLIENT_SECRET=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" \
  --env "GOOGLE_REFRESH_TOKEN=1//0fYKLOPp_xNKWCgYIARAAGA8SNwF-L9IrxHAJTp1xgM_gdzsNoQsujTEGkwPy4FS8e3ONmX05yNlAWABenfL-JrLgeFG0hi2ol74"
```

This will automatically update `.claude/settings.local.json` for you.

---

## Option B: Manual Edit

Edit the file `.claude/settings.local.json` in the project root to look like this:

```json
{
  "permissions": {
    "allow": [
      "Bash(find:*)"
    ]
  },
  "mcpServers": {
    "gmail": {
      "command": "npx",
      "args": ["-y", "@sowonai/mcp-gmail"],
      "env": {
        "GOOGLE_CLIENT_ID": "52695817098-8j1irp74k7mnrg26jkse31ors1cf1aau.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "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",
        "GOOGLE_REFRESH_TOKEN": "1//0fYKLOPp_xNKWCgYIARAAGA8SNwF-L9IrxHAJTp1xgM_gdzsNoQsujTEGkwPy4FS8e3ONmX05yNlAWABenfL-JrLgeFG0hi2ol74"
      }
    }
  }
}
```

---

## Available Tools After Setup

Once configured, Claude Code will have these Gmail MCP tools:

| Tool | What It Does |
|------|-------------|
| `gmail_listMessages` | List recent emails (default: 10 most recent) |
| `gmail_searchMessages` | Search emails with Gmail query syntax (e.g., `from:vendor@email.com`, `subject:bid`, `is:unread`) |
| `gmail_readMessage` | Read the full content of a specific email by message ID |
| `gmail_sendMessage` | Compose and send an email (TO, SUBJECT, BODY) |

---

## Important Notes

### These credentials are from a DIFFERENT Google Cloud project than the app's built-in Gmail
- **Cline/Claude Code MCP** uses Google Cloud project `52695817098` (the "Construction Email Manager" OAuth app)
- **The ubuildit-manager app** uses Google Cloud project `217172068796` (configured in `.env.local`)
- Both access the same Gmail account (`danielcase.info@gmail.com`), just via different OAuth clients

### Email Sending Protocol
Add this to `CLAUDE.md` so Claude Code follows the same rules:

```markdown
## 📧 Email Protocol (Gmail MCP)

### NEVER send emails without explicit owner approval.
When asked to draft or write an email:
1. **Draft first, send never (unless told to).** Show the email content for review.
2. **If the owner explicitly says "send it"**, use the Gmail MCP with **HTML formatting** in the body.

### HTML Formatting Rules for Gmail
The `body` parameter must use HTML tags (Gmail renders HTML):
- Use `<p>` for paragraphs (NOT plain text with `\n`)
- Use `<br>` for line breaks within a block
- Use `<b>` or `<strong>` for bold
- Use `<ul>` and `<li>` for bullet lists
- Use `<h3>` for section headers

### Attachments
The Gmail MCP does NOT support attachments. Remind the owner to attach files manually.
```

---

## Verification

After setup, restart Claude Code and ask it:
> "Search my Gmail for the 5 most recent emails about CobraStone"

If it returns results, the MCP is working correctly.

---

## Credential Source Reference

These credentials live in Cline's MCP config at:
```
C:\Users\danie\AppData\Roaming\VSCodium\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
```
Under the `"gmail"` server entry.

The original Google Cloud OAuth keys are also at:
```
C:\Users\danie\.gmail-mcp\gcp-oauth.keys.json
```
