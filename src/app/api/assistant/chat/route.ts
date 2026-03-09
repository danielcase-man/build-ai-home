/**
 * POST /api/assistant/chat
 *
 * Agentic chat endpoint with multi-turn tool execution loop.
 *
 * Flow:
 *   1. Client sends { messages[], projectId }
 *   2. Build lightweight system prompt (project metadata only)
 *   3. Agentic loop (max 10 rounds):
 *      - Stream Claude response → SSE text_delta events to client
 *      - Read tool_use  → auto-execute server-side → tool_result back to Claude
 *      - Write tool_use → create PendingAction → SSE tool_call to client
 *                        → return "pending_confirmation" to Claude
 *      - If stop_reason == 'tool_use', loop again; otherwise break
 *   4. SSE done event
 */

import { NextRequest } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient } from '@/lib/ai-clients'
import {
  ASSISTANT_TOOLS,
  buildSystemPrompt,
  executeReadTool,
  isReadTool,
  isWriteTool,
  parseToolCall,
  getToolStatusLabel,
} from '@/lib/assistant'
import { getProject } from '@/lib/project-service'
import type { AssistantStreamEvent } from '@/types'

const MAX_TOOL_ROUNDS = 10
const MODEL = 'claude-sonnet-4-6'

interface ChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  projectId?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequest
    const { messages: clientMessages } = body

    if (!clientMessages || clientMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Resolve project ID
    let projectId = body.projectId
    if (!projectId) {
      const project = await getProject()
      projectId = project?.id
    }
    if (!projectId) {
      return new Response(JSON.stringify({ error: 'No project found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const system = await buildSystemPrompt(projectId)
    const client = getAnthropicClient()

    // SSE stream setup
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: AssistantStreamEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }

        try {
          await runAgentLoop({ client, system, messages: clientMessages, projectId: projectId!, send })
        } catch (err) {
          console.error('Agent loop error:', err)
          send({ type: 'error', error: err instanceof Error ? err.message : 'Unknown error' })
        } finally {
          send({ type: 'done' })
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('Chat route error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// ---------------------------------------------------------------------------
// Agentic Loop
// ---------------------------------------------------------------------------

interface AgentLoopParams {
  client: Anthropic
  system: string
  messages: Array<{ role: string; content: string | Anthropic.ContentBlockParam[] | Anthropic.ToolResultBlockParam[] }>
  projectId: string
  send: (event: AssistantStreamEvent) => void
}

async function runAgentLoop({ client, system, messages, projectId, send }: AgentLoopParams) {
  // Build Anthropic-format messages from client messages
  const apiMessages: Anthropic.MessageParam[] = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content as string,
  }))

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // Stream the response
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system,
      tools: ASSISTANT_TOOLS,
      messages: apiMessages,
    })

    // Forward text deltas to client as they arrive
    stream.on('text', (text) => {
      send({ type: 'text_delta', content: text })
    })

    const finalMessage = await stream.finalMessage()

    // Process tool_use blocks
    const toolUseBlocks = finalMessage.content.filter(
      (b): b is Anthropic.ContentBlock & { type: 'tool_use' } => b.type === 'tool_use'
    )

    if (toolUseBlocks.length === 0 || finalMessage.stop_reason !== 'tool_use') {
      // No tools or natural stop — we're done
      break
    }

    // Build tool results
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const block of toolUseBlocks) {
      const { name, input, id } = block
      const toolInput = input as Record<string, unknown>

      if (isReadTool(name)) {
        send({ type: 'tool_status', toolName: name, content: getToolStatusLabel(name) })
        const result = await executeReadTool(name, toolInput, projectId)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: id,
          content: result,
        })
      } else if (isWriteTool(name)) {
        const action = parseToolCall(name, toolInput, id)
        send({ type: 'tool_call', action })
        toolResults.push({
          type: 'tool_result',
          tool_use_id: id,
          content: JSON.stringify({ status: 'pending_confirmation', description: action.description }),
        })
      } else {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: id,
          content: JSON.stringify({ error: `Unknown tool: ${name}` }),
          is_error: true,
        })
      }
    }

    // Append assistant turn + tool results for next round
    apiMessages.push({
      role: 'assistant',
      content: finalMessage.content as Anthropic.ContentBlockParam[],
    })
    apiMessages.push({
      role: 'user',
      content: toolResults,
    })
  }
}
