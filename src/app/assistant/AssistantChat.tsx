'use client'

import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Send, Bot, User, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { AssistantStreamEvent, PendingAction, AssistantMessage } from '@/types'

export default function AssistantChat() {
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [toolStatus, setToolStatus] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, toolStatus, scrollToBottom])

  // Auto-resize textarea
  const handleInputChange = (value: string) => {
    setInput(value)
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMessage: AssistantMessage = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setToolStatus(null)

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto'

    // Prepare history for API (all previous messages + new user message)
    const allMessages = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }))

    // Start SSE streaming
    let assistantContent = ''
    const pendingActions: PendingAction[] = []

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      // Add placeholder assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const json = line.slice(6)

          let event: AssistantStreamEvent
          try {
            event = JSON.parse(json)
          } catch {
            continue
          }

          switch (event.type) {
            case 'text_delta':
              assistantContent += event.content || ''
              setToolStatus(null)
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    content: assistantContent,
                    actions: pendingActions.length > 0 ? [...pendingActions] : undefined,
                  }
                }
                return updated
              })
              break

            case 'tool_status':
              setToolStatus(event.content || event.toolName || null)
              break

            case 'tool_call':
              if (event.action) {
                pendingActions.push(event.action)
                setMessages(prev => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: assistantContent,
                      actions: [...pendingActions],
                    }
                  }
                  return updated
                })
              }
              break

            case 'error':
              assistantContent += `\n\n*Error: ${event.error}*`
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: assistantContent }
                }
                return updated
              })
              break

            case 'done':
              break
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong'
      if (!assistantContent) {
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: `*Error: ${errorMsg}*` }
          } else {
            updated.push({ role: 'assistant', content: `*Error: ${errorMsg}*` })
          }
          return updated
        })
      }
    } finally {
      setIsLoading(false)
      setToolStatus(null)
    }
  }

  const handleApplyAction = async (action: PendingAction, messageIndex: number) => {
    try {
      const res = await fetch('/api/assistant/apply-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      })
      const result = await res.json()

      // Update the action status in the message
      setMessages(prev => {
        const updated = [...prev]
        const msg = updated[messageIndex]
        if (msg?.actions) {
          msg.actions = msg.actions.map(a =>
            a.id === action.id
              ? { ...a, data: { ...a.data, _applied: result.success, _message: result.message } }
              : a
          )
          updated[messageIndex] = { ...msg }
        }
        return updated
      })
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        const msg = updated[messageIndex]
        if (msg?.actions) {
          msg.actions = msg.actions.map(a =>
            a.id === action.id
              ? { ...a, data: { ...a.data, _applied: false, _message: 'Network error' } }
              : a
          )
          updated[messageIndex] = { ...msg }
        }
        return updated
      })
    }
  }

  const handleDismissAction = (actionId: string, messageIndex: number) => {
    setMessages(prev => {
      const updated = [...prev]
      const msg = updated[messageIndex]
      if (msg?.actions) {
        msg.actions = msg.actions.map(a =>
          a.id === actionId
            ? { ...a, data: { ...a.data, _dismissed: true } }
            : a
        )
        updated[messageIndex] = { ...msg }
      }
      return updated
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b">
        <Bot className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">Project Assistant</h1>
        <span className="text-xs text-muted-foreground ml-auto">
          Powered by Claude Sonnet 4.6
        </span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12 space-y-3">
            <Bot className="h-10 w-10 mx-auto opacity-50" />
            <p className="text-sm">Ask about your project — bids, budget, selections, emails, or status.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'What window bids do we have?',
                "What's our budget status?",
                'Any recent emails from vendors?',
                'Compare our stone bids',
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => handleInputChange(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full border hover:bg-accent transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? 'order-first' : ''}`}>
              <div
                className={`rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : 'bg-muted'
                }`}
              >
                {msg.content || (isLoading && i === messages.length - 1 ? '' : '')}
                {!msg.content && isLoading && i === messages.length - 1 && !toolStatus && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>

              {/* Action cards */}
              {msg.actions?.map(action => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onApply={() => handleApplyAction(action, i)}
                  onDismiss={() => handleDismissAction(action.id, i)}
                />
              ))}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center mt-1">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {/* Tool status indicator */}
        {toolStatus && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-10">
            <Loader2 className="h-3 w-3 animate-spin" />
            {toolStatus}
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t pt-4 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
          placeholder="Ask about your project..."
          rows={1}
          className="flex-1 resize-none rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Action Card — shows a proposed write action with Apply/Dismiss buttons
// ---------------------------------------------------------------------------

function ActionCard({
  action,
  onApply,
  onDismiss,
}: {
  action: PendingAction
  onApply: () => void
  onDismiss: () => void
}) {
  const applied = action.data._applied as boolean | undefined
  const dismissed = action.data._dismissed as boolean | undefined
  const message = action.data._message as string | undefined
  const isSettled = applied !== undefined || dismissed

  return (
    <Card className="p-3 border-dashed">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {action.type.replace(/_/g, ' ')}
          </p>
          <p className="text-sm mt-0.5">{action.description}</p>
          {message && (
            <p className={`text-xs mt-1 ${applied ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}
        </div>
        {!isSettled && (
          <div className="flex gap-1.5 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={onDismiss} className="h-7 text-xs">
              Dismiss
            </Button>
            <Button size="sm" onClick={onApply} className="h-7 text-xs">
              Apply
            </Button>
          </div>
        )}
        {applied === true && <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />}
        {applied === false && <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />}
        {dismissed && (
          <span className="text-xs text-muted-foreground flex-shrink-0">Dismissed</span>
        )}
      </div>
    </Card>
  )
}
