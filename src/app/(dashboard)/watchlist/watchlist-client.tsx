'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrency } from '@/lib/currency-context'
import { toast } from 'sonner'
import { Plus, Trash2, Search, TrendingUp, TrendingDown, Star } from 'lucide-react'
import type { WatchlistItem, Currency } from '@/lib/types'

interface SearchResult { ticker: string; name: string; exchange: string }

interface Props {
  userId: string
  watchlist: WatchlistItem[]
}

export function WatchlistClient({ userId, watchlist: initial }: Props) {
  const [watchlist, setWatchlist] = useState(initial)
  const [prices, setPrices] = useState<Record<string, { price: number; changePercent: number; currency: string; name: string | null; previousClose: number }>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const { format } = useCurrency()

  const tickers = watchlist.map((w) => w.ticker)

  useEffect(() => {
    if (tickers.length === 0) { setLoading(false); return }
    fetch(`/api/prices?tickers=${tickers.join(',')}`)
      .then((r) => r.json())
      .then((d) => { setPrices(d.prices ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tickers.join(',')])

  const searchTickers = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setSearchResults(data.results ?? [])
  }, [])

  async function addToWatchlist(ticker: string, name: string) {
    if (watchlist.some((w) => w.ticker === ticker)) {
      toast.info(`${ticker} is already in your watchlist`)
      return
    }
    const supabase = createClient()
    const { data, error } = await supabase.from('watchlist').insert({
      user_id: userId, ticker, name,
    }).select().single()

    if (error) { toast.error(error.message); return }
    setWatchlist([data, ...watchlist])
    setSearchQuery(''); setSearchResults([])
    toast.success(`${ticker} added to watchlist`)

    fetch(`/api/prices?tickers=${ticker}`)
      .then((r) => r.json())
      .then((d) => setPrices((prev) => ({ ...prev, ...d.prices })))
  }

  async function removeFromWatchlist(id: string, ticker: string) {
    const supabase = createClient()
    const { error } = await supabase.from('watchlist').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setWatchlist(watchlist.filter((w) => w.id !== id))
    toast.success(`${ticker} removed from watchlist`)
  }

  return (
    <div className="space-y-7">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Watchlist</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Track stocks you&apos;re interested in</p>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-10"
            placeholder="Search stocks to add to watchlist..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); searchTickers(e.target.value) }}
          />
        </div>
        {searchResults.length > 0 && (
          <div className="absolute z-10 top-full left-0 right-0 bg-background border border-border rounded-lg shadow-lg mt-1.5 max-h-52 overflow-auto">
            {searchResults.map((r) => (
              <button
                key={r.ticker}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent text-left transition-colors first:rounded-t-lg last:rounded-b-lg"
                onClick={() => addToWatchlist(r.ticker, r.name)}
              >
                <div className="h-6 w-6 rounded bg-[#2563EB]/10 flex items-center justify-center shrink-0">
                  <Plus className="h-3 w-3 text-[#2563EB]" />
                </div>
                <span className="font-semibold text-sm">{r.ticker}</span>
                <span className="text-xs text-muted-foreground flex-1 truncate">{r.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{r.exchange}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Watchlist grid */}
      {watchlist.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-20 text-center">
            <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Your watchlist is empty</p>
            <p className="text-xs text-muted-foreground mt-1">Search for stocks above to start tracking them</p>
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
                      <p className="text-[11px] text-muted-foreground mt-1 truncate max-w-[160px]">{p?.name ?? item.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {p && (
                        <Badge
                          className={`text-xs font-semibold ${
                            isUp
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400'
                              : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400'
                          }`}
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
                        Prev close: {format(p.previousClose, p.currency as Currency)}
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
