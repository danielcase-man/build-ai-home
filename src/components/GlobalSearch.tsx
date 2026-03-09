'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Gavel, DollarSign, ClipboardList, Mail, Users, CheckSquare } from 'lucide-react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'

interface SearchResult {
  type: 'bid' | 'budget' | 'selection' | 'email' | 'contact' | 'task'
  title: string
  subtitle: string
  id: string
  href: string
}

const TYPE_ICONS: Record<string, typeof Search> = {
  bid: Gavel,
  budget: DollarSign,
  selection: ClipboardList,
  email: Mail,
  contact: Users,
  task: CheckSquare,
}

const TYPE_LABELS: Record<string, string> = {
  bid: 'Bid',
  budget: 'Budget',
  selection: 'Selection',
  email: 'Email',
  contact: 'Contact',
  task: 'Task',
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const router = useRouter()

  // Cmd+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [open])

  // Debounced search
  const search = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`)
      if (res.ok) {
        const json = await res.json()
        setResults(json.data?.results ?? [])
      }
    } catch {
      // silent fail
    }
    setLoading(false)
  }, [])

  const handleInputChange = (value: string) => {
    setQuery(value)
    setSelectedIndex(0)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }

  const navigateTo = (result: SearchResult) => {
    setOpen(false)
    router.push(result.href)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      navigateTo(results[selectedIndex])
    }
  }

  // Group results by type
  const groupedResults = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  let flatIndex = -1

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border rounded-md hover:bg-accent transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden [&>button]:hidden">
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search bids, budget, selections, emails, contacts, tasks..."
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {loading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {query.length >= 2 && results.length === 0 && !loading && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No results found for &ldquo;{query}&rdquo;
              </div>
            )}

            {Object.entries(groupedResults).map(([type, items]) => (
              <div key={type}>
                <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 sticky top-0">
                  {TYPE_LABELS[type] || type}
                </div>
                {items.map((result) => {
                  flatIndex++
                  const isSelected = flatIndex === selectedIndex
                  const Icon = TYPE_ICONS[result.type] || Search
                  const currentIndex = flatIndex

                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors ${
                        isSelected ? 'bg-accent' : ''
                      }`}
                      onClick={() => navigateTo(result)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{result.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {query.length < 2 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
