'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { addWatchlistItem, removeWatchlistItem } from './actions'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrency } from '@/lib/currency-context'
import { toast } from 'sonner'
import { Trash2, TrendingUp, TrendingDown, Star, Search, Loader2, Plus } from 'lucide-react'
import type { WatchlistItem, Currency } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SearchResult {
  ticker: string
  name: string
  exchange: string
  type: 'Stock' | 'ETF'
  sector: string | null
}

interface Props {
  userId: string
  watchlist: WatchlistItem[]
}

export function WatchlistClient({ userId, watchlist: initial }: Props) {
  const [watchlist, setWatchlist] = useState(initial)
  const [prices, setPrices] = useState<Record<string, {
    price: number; changePercent: number; currency: string; name: string | null; previousClose: number
  }>>({})
  const [loading, setLoading] = useState(true)

  // Search state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [adding, setAdding] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { format } = useCurrency()
  const tickers = watchlist.map((w) => w.ticker)

  // Fetch prices for watchlist
  useEffect(() => {
    if (tickers.length === 0) { setLoading(false); return }
    fetch(`/api/prices?tickers=${tickers.join(',')}`)
      .then((r) => r.json())
      .then((d) => { setPrices(d.prices ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.join(',')])

  // Debounced search
  const handleInput = useCallback((value: string) => {
    setQuery(value)
    setHighlighted(0)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.length < 1) {
      setResults([])
      setOpen(false)
      setSearching(false)
      return
    }

    setSearching(true)
    setOpen(true)

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        setResults(data.results ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 280)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[highlighted]
      if (r) addToWatchlist(r.ticker, r.name)
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  async function addToWatchlist(ticker: string, name: string) {
    if (watchlist.some((w) => w.ticker === ticker)) {
      toast.info(`${ticker} is already in your watchlist`)
      setOpen(false)
      setQuery('')
      return
    }
    setAdding(ticker)
    const { data, error } = await addWatchlistItem(ticker, name)

    setAdding(null)
    if (error || !data) { toast.error(error ?? 'Failed to add'); return }

    setWatchlist([data, ...watchlist])
    setQuery('')
    setResults([])
    setOpen(false)
    toast.success(`${ticker} added to watchlist`)

    fetch(`/api/prices?tickers=${ticker}`)
      .then((r) => r.json())
      .then((d) => setPrices((prev) => ({ ...prev, ...d.prices })))
  }

  async function removeFromWatchlist(id: string, ticker: string) {
    const { error } = await removeWatchlistItem(id)
    if (error) { toast.error(error); return }
    setWatchlist(watchlist.filter((w) => w.id !== id))
    toast.success(`${ticker} removed`)
  }

  return (
    <div className="space-y-7">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Watchlist</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track stocks you&apos;re interested in</p>
      </div>

      {/* Search */}
      <div className="relative max-w-xl">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            className="w-full h-11 pl-10 pr-10 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
            placeholder="Search stocks or ETFs by name or ticker…"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => { if (results.length > 0) setOpen(true) }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {searching && (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>

        {/* Dropdown */}
        {open && (
          <div
            ref={dropdownRef}
            className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-background border border-border rounded-xl shadow-xl overflow-hidden"
          >
            {searching && results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-muted-foreground/50" />
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              <ul>
                {results.map((r, i) => {
                  const alreadyAdded = watchlist.some((w) => w.ticker === r.ticker)
                  const isHighlighted = i === highlighted
                  return (
                    <li key={r.ticker}>
                      <button
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                          isHighlighted ? 'bg-accent' : 'hover:bg-accent/50',
                          'border-b border-border/50 last:border-0',
                        )}
                        onMouseEnter={() => setHighlighted(i)}
                        onClick={() => !alreadyAdded && addToWatchlist(r.ticker, r.name)}
                        disabled={alreadyAdded || adding === r.ticker}
                      >
                        {/* Ticker badge */}
                        <div className="flex-none w-16 text-right">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-foreground/5 text-[11px] font-bold font-mono tracking-wide text-foreground">
                            {r.ticker}
                          </span>
                        </div>

                        {/* Name + meta */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate leading-tight">
                            {r.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">{r.exchange}</span>
                            {r.sector && (
                              <>
                                <span className="text-muted-foreground/40 text-[11px]">·</span>
                                <span className="text-[11px] text-muted-foreground truncate">{r.sector}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Type + action */}
                        <div className="flex-none flex items-center gap-2">
                          <span className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                            r.type === 'ETF'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
                          )}>
                            {r.type}
                          </span>
                          {alreadyAdded ? (
                            <span className="text-[11px] text-muted-foreground">Added</span>
                          ) : adding === r.ticker ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          ) : (
                            <Plus className={cn(
                              'h-4 w-4 transition-colors',
                              isHighlighted ? 'text-foreground' : 'text-muted-foreground/40',
                            )} />
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Footer hint */}
            {results.length > 0 && (
              <div className="px-4 py-2 border-t border-border/50 bg-muted/30 flex items-center gap-4 text-[11px] text-muted-foreground">
                <span><kbd className="font-mono bg-background border border-border rounded px-1">↑↓</kbd> navigate</span>
                <span><kbd className="font-mono bg-background border border-border rounded px-1">↵</kbd> add</span>
                <span><kbd className="font-mono bg-background border border-border rounded px-1">Esc</kbd> close</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Watchlist grid */}
      {watchlist.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-20 text-center">
            <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Your watchlist is empty</p>
            <p className="text-xs text-muted-foreground mt-1">Search for a stock or ETF above to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {watchlist.map((item) => {
            const p = prices[item.ticker]
            const isUp = (p?.changePercent ?? 0) >= 0

            return (
              <Card key={item.id} className="border-border overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0">
                      <p className="text-lg font-bold tracking-tight leading-none">{item.ticker}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 truncate max-w-[160px]">
                        {p?.name ?? item.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {p && (
                        <Badge
                          className={cn(
                            'text-xs font-semibold',
                            isUp
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400'
                              : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400',
                          )}
                          variant="outline"
                        >
                          {isUp ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                          {isUp ? '+' : ''}{p.changePercent.toFixed(2)}%
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground/50 hover:text-destructive"
                        onClick={() => removeFromWatchlist(item.id, item.ticker)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {loading && !p ? (
                    <div className="space-y-1.5">
                      <Skeleton className="h-8 w-28" />
                      <Skeleton className="h-3.5 w-20" />
                    </div>
                  ) : p ? (
                    <div>
                      <p className="text-2xl font-bold tabular-nums tracking-tight">
                        {format(p.price, p.currency as Currency)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Prev close {format(p.previousClose, p.currency as Currency)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Price unavailable</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
