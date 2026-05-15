'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { addWatchlistItem, removeWatchlistItem } from './actions'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrency } from '@/lib/currency-context'
import { useTickerDrawer } from '@/lib/ticker-drawer-context'
import { deriveWatchlistLabel, LABEL_STYLES } from '@/lib/analysis'
import { toast } from 'sonner'
import { Trash2, TrendingUp, TrendingDown, Star, Search, Loader2, Plus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import type { WatchlistItem, Currency } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SearchResult {
  ticker: string
  name: string
  exchange: string
  type: 'Stock' | 'ETF'
  sector: string | null
}

interface PriceData {
  price: number
  changePercent: number
  currency: string
  name: string | null
  previousClose: number
  week52High: number | null
  week52Low: number | null
  trailingPE: number | null
  dividendYield: number | null
}

interface Props {
  userId: string
  watchlist: WatchlistItem[]
}

type SortKey = 'ticker' | 'price' | 'change' | 'distFromHigh' | 'pe' | 'yield'
type SortDir = 'asc' | 'desc'

export function WatchlistClient({ watchlist: initial }: Props) {
  const [watchlist, setWatchlist] = useState(initial)
  const [prices, setPrices] = useState<Record<string, PriceData>>({})
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('ticker')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

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
  const { openTicker } = useTickerDrawer()
  const tickers = watchlist.map((w) => w.ticker)

  useEffect(() => {
    if (tickers.length === 0) { setLoading(false); return }
    fetch(`/api/prices?tickers=${tickers.join(',')}`)
      .then((r) => r.json())
      .then((d) => { setPrices(d.prices ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.join(',')])

  const handleInput = useCallback((value: string) => {
    setQuery(value)
    setHighlighted(0)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 1) { setResults([]); setOpen(false); setSearching(false); return }
    setSearching(true)
    setOpen(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`)
        const data = await res.json()
        setResults(data.results ?? [])
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 280)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((i) => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const r = results[highlighted]; if (r) addToWatchlist(r.ticker, r.name) }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  async function addToWatchlist(ticker: string, name: string) {
    if (watchlist.some((w) => w.ticker === ticker)) {
      toast.info(`${ticker} is already in your watchlist`)
      setOpen(false); setQuery(''); return
    }
    setAdding(ticker)
    const { data, error } = await addWatchlistItem(ticker, name)
    setAdding(null)
    if (error || !data) { toast.error(error ?? 'Failed to add'); return }
    setWatchlist([data, ...watchlist])
    setQuery(''); setResults([]); setOpen(false)
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

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'ticker' ? 'asc' : 'desc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-30" />
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 inline ml-1 text-[#2563EB]" />
      : <ArrowDown className="h-3 w-3 inline ml-1 text-[#2563EB]" />
  }

  const sorted = [...watchlist].sort((a, b) => {
    const pa = prices[a.ticker], pb = prices[b.ticker]
    let diff = 0
    if (sortKey === 'ticker') diff = a.ticker.localeCompare(b.ticker)
    else if (sortKey === 'price') diff = (pa?.price ?? 0) - (pb?.price ?? 0)
    else if (sortKey === 'change') diff = (pa?.changePercent ?? 0) - (pb?.changePercent ?? 0)
    else if (sortKey === 'distFromHigh') {
      const da = pa?.week52High ? (pa.week52High - pa.price) / pa.week52High * 100 : 999
      const db = pb?.week52High ? (pb.week52High - pb.price) / pb.week52High * 100 : 999
      diff = da - db
    }
    else if (sortKey === 'pe') diff = (pa?.trailingPE ?? 999) - (pb?.trailingPE ?? 999)
    else if (sortKey === 'yield') diff = (pa?.dividendYield ?? 0) - (pb?.dividendYield ?? 0)
    return sortDir === 'asc' ? diff : -diff
  })

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
          {searching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />}
        </div>

        {open && (
          <div ref={dropdownRef} className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-background border border-border rounded-xl shadow-xl overflow-hidden">
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
                        <div className="flex-none w-16 text-right">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-foreground/5 text-[11px] font-bold font-mono tracking-wide text-foreground">
                            {r.ticker}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate leading-tight">{r.name}</p>
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
                            <Plus className={cn('h-4 w-4 transition-colors', isHighlighted ? 'text-foreground' : 'text-muted-foreground/40')} />
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
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

      {/* Watchlist table */}
      {watchlist.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-20 text-center">
            <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Your watchlist is empty</p>
            <p className="text-xs text-muted-foreground mt-1">Search for a stock or ETF above to get started</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground" onClick={() => handleSort('ticker')}>
                    Ticker <SortIcon col="ticker" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground" onClick={() => handleSort('price')}>
                    Price <SortIcon col="price" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground" onClick={() => handleSort('change')}>
                    Change <SortIcon col="change" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">
                    52W High
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground hidden lg:table-cell" onClick={() => handleSort('distFromHigh')}>
                    vs High <SortIcon col="distFromHigh" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground hidden xl:table-cell" onClick={() => handleSort('pe')}>
                    P/E <SortIcon col="pe" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs cursor-pointer hover:text-foreground hidden xl:table-cell" onClick={() => handleSort('yield')}>
                    Yield <SortIcon col="yield" />
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">
                    View
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => {
                  const p = prices[item.ticker]
                  const isUp = (p?.changePercent ?? 0) >= 0
                  const distFromHigh = p?.week52High
                    ? ((p.week52High - p.price) / p.week52High) * 100
                    : null
                  const label = p ? deriveWatchlistLabel({
                    price: p.price,
                    changePercent: p.changePercent,
                    week52High: p.week52High,
                    week52Low: p.week52Low,
                    trailingPE: p.trailingPE,
                    dividendYield: p.dividendYield,
                  }) : 'Insufficient Data'
                  const labelStyle = LABEL_STYLES[label]

                  return (
                    <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <button
                            className="font-semibold text-foreground hover:text-[#2563EB] transition-colors"
                            onClick={() => openTicker(item.ticker)}
                          >
                            {item.ticker}
                          </button>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[140px]">
                            {p?.name ?? item.name}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {loading && !p ? (
                          <Skeleton className="h-4 w-16 ml-auto" />
                        ) : p ? (
                          format(p.price, p.currency as Currency)
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {loading && !p ? (
                          <Skeleton className="h-4 w-14 ml-auto" />
                        ) : p ? (
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
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground hidden lg:table-cell">
                        {p?.week52High ? format(p.week52High, p.currency as Currency) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        {distFromHigh != null ? (
                          <span className={cn(
                            'text-sm tabular-nums font-medium',
                            distFromHigh < 5 ? 'text-[#2563EB]' : distFromHigh > 30 ? 'text-[#DC2626]' : 'text-muted-foreground'
                          )}>
                            -{distFromHigh.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground hidden xl:table-cell">
                        {p?.trailingPE != null ? `${p.trailingPE.toFixed(1)}x` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground hidden xl:table-cell">
                        {p?.dividendYield != null && p.dividendYield > 0 ? `${p.dividendYield.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={cn(
                          'text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap',
                          labelStyle.bg, labelStyle.text
                        )}>
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground/50 hover:text-destructive"
                          onClick={() => removeFromWatchlist(item.id, item.ticker)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
