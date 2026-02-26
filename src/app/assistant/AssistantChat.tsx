'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Send, Bot, User, CheckCircle2, X, Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage, PendingAction, AssistantStreamEvent } from '@/types'

export default function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  async function handleSend() {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    const assistantMessage: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      pendingActions: [],
    }

    setMessages(prev => [...prev, userMessage, assistantMessage])
    setInput('')
    setIsStreaming(true)

    try {
      // Build message history for API (strip metadata)
      const apiMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }))

      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Request failed')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const json = line.slice(6)

          try {
            const event: AssistantStreamEvent = JSON.parse(json)

            if (event.type === 'text_delta' && event.content) {
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last.role === 'assistant') {
                  last.content += event.content
                }
                return updated
              })
            } else if (event.type === 'tool_call' && event.action) {
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last.role === 'assistant') {
                  last.pendingActions = [...(last.pendingActions || []), event.action!]
                }
                return updated
              })
            } else if (event.type === 'error') {
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last.role === 'assistant') {
                  last.content += `\n\nError: ${event.error}`
                }
                return updated
              })
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last.role === 'assistant') {
          last.content = `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
      inputRef.current?.focus()
    }
  }

  async function handleApplyAction(messageId: string, actionId: string) {
    const message = messages.find(m => m.id === messageId)
    const action = message?.pendingActions?.find(a => a.id === actionId)
    if (!action) return

    // Mark as loading
    updateActionStatus(messageId, actionId, 'applied')

    try {
      const res = await fetch('/api/assistant/apply-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const json = await res.json()
      if (!json.success) {
        updateActionStatus(messageId, actionId, 'pending')
        alert(`Failed: ${json.error}`)
      }
    } catch {
      updateActionStatus(messageId, actionId, 'pending')
      alert('Failed to apply action')
    }
  }

  function handleDismissAction(messageId: string, actionId: string) {
    updateActionStatus(messageId, actionId, 'dismissed')
  }

  function updateActionStatus(messageId: string, actionId: string, status: PendingAction['status']) {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m
      return {
        ...m,
        pendingActions: m.pendingActions?.map(a =>
          a.id === actionId ? { ...a, status } : a
        ),
      }
    }))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="container max-w-3xl py-6 flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          Project Assistant
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ask questions about your build or provide updates to track changes.
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12 space-y-3">
            <Bot className="h-12 w-12 mx-auto opacity-30" />
            <p className="text-sm">Try asking:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'What\'s the status of window bids?',
                'How much have I spent so far?',
                'What\'s blocking permitting?',
                'CobraStone quoted $85K for stone',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus() }}
                  className="text-xs px-3 py-1.5 rounded-full border hover:bg-accent transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-1">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={cn(
              'max-w-[85%] space-y-2',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5'
                : 'space-y-3'
            )}>
              {msg.role === 'assistant' ? (
                <>
                  {msg.content && (
                    <div className="bg-muted/50 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm whitespace-pre-wrap">
                      {msg.content}
                      {isStreaming && messages[messages.length - 1]?.id === msg.id && (
                        <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </div>
                  )}
                  {msg.pendingActions?.map(action => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      onApply={() => handleApplyAction(msg.id, action.id)}
                      onDismiss={() => handleDismissAction(msg.id, action.id)}
                    />
                  ))}
                </>
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center mt-1">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border rounded-xl p-2 bg-white shadow-sm flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your project or provide an update..."
          className="flex-1 resize-none border-0 bg-transparent text-sm focus:outline-none px-2 py-1.5 max-h-32"
          rows={1}
          disabled={isStreaming}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className="rounded-lg h-8 w-8 flex-shrink-0"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

function ActionCard({
  action,
  onApply,
  onDismiss,
}: {
  action: PendingAction
  onApply: () => void
  onDismiss: () => void
}) {
  const isApplied = action.status === 'applied'
  const isDismissed = action.status === 'dismissed'

  return (
    <Card className={cn(
      'border-l-4 transition-opacity',
      isApplied ? 'border-l-green-500 opacity-75' :
      isDismissed ? 'border-l-gray-300 opacity-50' :
      'border-l-amber-500'
    )}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                'text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded',
                isApplied ? 'bg-green-100 text-green-700' :
                isDismissed ? 'bg-gray-100 text-gray-500' :
                'bg-amber-100 text-amber-700'
              )}>
                {isApplied ? 'Applied' : isDismissed ? 'Dismissed' : action.type.replace(/_/g, ' ')}
              </span>
            </div>
            <p className={cn('text-sm font-medium', isDismissed && 'line-through')}>{action.label}</p>
            {/* Show key data fields */}
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              {Object.entries(action.data)
                .filter(([, v]) => v != null && v !== '')
                .slice(0, 4)
                .map(([k, v]) => (
                  <div key={k}>
                    <span className="font-medium">{k.replace(/_/g, ' ')}:</span>{' '}
                    {typeof v === 'number' && (k.includes('amount') || k.includes('cost') || k.includes('price'))
                      ? `$${(v as number).toLocaleString()}`
                      : String(v)}
                  </div>
                ))}
            </div>
          </div>
          {!isApplied && !isDismissed && (
            <div className="flex gap-1 flex-shrink-0">
              <Button size="sm" variant="outline" onClick={onApply} className="h-7 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Apply
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismiss} className="h-7 px-2 text-xs text-muted-foreground">
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {isApplied && (
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
