import { getAnthropicClient } from '@/lib/ai-clients'
import { buildAssistantContext, ASSISTANT_TOOLS, parseToolCall } from '@/lib/assistant'

export async function POST(request: Request) {
  try {
    const { messages } = await request.json() as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!messages?.length) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { systemPrompt } = await buildAssistantContext()
    const client = getAnthropicClient()

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      temperature: 0.3,
      system: systemPrompt,
      tools: ASSISTANT_TOOLS,
      messages,
    })

    const encoder = new TextEncoder()
    const sentToolIds = new Set<string>()

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'text_delta', content: event.delta.text })}\n\n`
                ))
              }
            } else if (event.type === 'content_block_stop') {
              const message = stream.currentMessage
              if (message) {
                for (const block of message.content) {
                  if (block.type === 'tool_use' && !sentToolIds.has(block.id)) {
                    sentToolIds.add(block.id)
                    const action = parseToolCall(
                      block.name,
                      block.input as Record<string, unknown>,
                      block.id
                    )
                    controller.enqueue(encoder.encode(
                      `data: ${JSON.stringify({ type: 'tool_call', action })}\n\n`
                    ))
                  }
                }
              }
            }
          }

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'done' })}\n\n`
          ))
          controller.close()
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Stream error'
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`
          ))
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Assistant chat error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
