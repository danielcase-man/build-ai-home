#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const GRANT_KEY = process.env.JOBTREAD_API_KEY || ''
const API_URL = process.env.JOBTREAD_API_URL || 'https://api.jobtread.com/pave'
const ORG_ID = process.env.JOBTREAD_ORG_ID || ''
const JOB_ID = process.env.JOBTREAD_JOB_ID || ''

// ─── Pave Query Helper ─────────────────────────────────────────────

async function pave<T = unknown>(query: Record<string, unknown>): Promise<T> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: { $: { grantKey: GRANT_KEY }, ...query },
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`JobTread API error: HTTP ${response.status} — ${text}`)
  }

  const data = await response.json()

  if (typeof data === 'string') {
    throw new Error(`JobTread API error: ${data}`)
  }

  return data as T
}

function jsonText(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

// ─── MCP Server ─────────────────────────────────────────────────────

const server = new McpServer({
  name: 'jobtread',
  version: '1.0.0',
})

// ─── Read Tools ─────────────────────────────────────────────────────

server.tool(
  'jobtread_getJob',
  'Get the Case Home project details from JobTread (status, description, custom fields)',
  {},
  async () => {
    const result = await pave({
      job: {
        $: { id: JOB_ID },
        id: {}, name: {}, number: {}, status: {}, description: {}, createdAt: {},
        customFieldValues: {
          $: { size: 50 },
          nodes: { id: {}, value: {}, customField: { name: {}, type: {} } },
        },
      },
    })
    return jsonText(result)
  },
)

server.tool(
  'jobtread_getCostItems',
  'Get budget/cost items from JobTread with cost codes and pricing',
  { limit: z.number().optional().describe('Max items to return (default 100, max 100)') },
  async ({ limit }) => {
    const size = Math.min(limit || 100, 100)
    const result = await pave({
      job: {
        $: { id: JOB_ID },
        costItems: {
          $: { size },
          nodes: {
            id: {}, name: {}, description: {},
            quantity: {}, unitCost: {}, unitPrice: {}, cost: {}, price: {},
            costCode: { name: {}, number: {} },
          },
        },
      },
    })
    return jsonText(result)
  },
)

server.tool(
  'jobtread_getTasks',
  'Get tasks/schedule from the Case Home job in JobTread',
  {},
  async () => {
    const result = await pave({
      job: {
        $: { id: JOB_ID },
        tasks: {
          $: { size: 100 },
          nodes: {
            id: {}, name: {}, description: {},
            progress: {}, startDate: {}, endDate: {},
            completed: {}, createdAt: {},
            taskType: { name: {} },
          },
        },
      },
    })
    return jsonText(result)
  },
)

server.tool(
  'jobtread_getDailyLogs',
  'Get daily log entries from the Case Home job in JobTread',
  {},
  async () => {
    const result = await pave({
      job: {
        $: { id: JOB_ID },
        dailyLogs: {
          $: { size: 100 },
          nodes: { id: {}, date: {}, notes: {}, createdAt: {} },
        },
      },
    })
    return jsonText(result)
  },
)

server.tool(
  'jobtread_getComments',
  'Get comments from the Case Home job in JobTread',
  {},
  async () => {
    const result = await pave({
      job: {
        $: { id: JOB_ID },
        comments: {
          $: { size: 100 },
          nodes: { id: {}, message: {}, createdAt: {} },
        },
      },
    })
    return jsonText(result)
  },
)

server.tool(
  'jobtread_getFiles',
  'Get files (photos, documents) from the Case Home job in JobTread',
  {},
  async () => {
    const result = await pave({
      job: {
        $: { id: JOB_ID },
        files: {
          $: { size: 100 },
          nodes: { id: {}, name: {}, url: {}, size: {}, folder: {}, createdAt: {} },
        },
      },
    })
    return jsonText(result)
  },
)

// ─── Write Tools ────────────────────────────────────────────────────

server.tool(
  'jobtread_createComment',
  'Add a comment to the Case Home job in JobTread',
  { message: z.string().describe('The comment text to add') },
  async ({ message }) => {
    const result = await pave({
      createComment: {
        $: { jobId: JOB_ID, message },
        id: {}, message: {}, createdAt: {},
      },
    })
    return jsonText(result)
  },
)

server.tool(
  'jobtread_createDailyLog',
  'Add a daily log entry to the Case Home job in JobTread',
  {
    date: z.string().describe('Date in YYYY-MM-DD format'),
    notes: z.string().describe('The daily log notes'),
  },
  async ({ date, notes }) => {
    const result = await pave({
      createDailyLog: {
        $: { jobId: JOB_ID, date, notes },
        id: {}, date: {}, notes: {},
      },
    })
    return jsonText(result)
  },
)

server.tool(
  'jobtread_createTask',
  'Create a task in the Case Home job in JobTread',
  {
    name: z.string().describe('Task name'),
    description: z.string().optional().describe('Task description'),
    startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  },
  async ({ name, description, startDate, endDate }) => {
    const params: Record<string, unknown> = { jobId: JOB_ID, name }
    if (description) params.description = description
    if (startDate) params.startDate = startDate
    if (endDate) params.endDate = endDate

    const result = await pave({
      createTask: {
        $: params,
        id: {}, name: {}, description: {},
      },
    })
    return jsonText(result)
  },
)

// ─── Start Server ───────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
