'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrency } from '@/lib/currency-context'
import { toast } from 'sonner'
import { Plus, Trash2, Search, TrendingUp, TrendingDown } from 'lucide-react'
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
  const { format, convert } = useCurrency()
  const supabase = createClient()

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
    const { data, error } = await supabase.from('watchlist').insert({
      user_id: userId, ticker, name,
    }).select().single()

    if (error) { toast.error(error.message); return }
    setWatchlist([data, ...watchlist])
    setSearchQuery(''); setSearchResults([])
    toast.success(`${ticker} added to watchlist`)

    // Fetch price for new ticker
    fetch(`/api/prices?tickers=${ticker}`)
      .then((r) => r.json())
      .then((d) => setPrices((prev) => ({ ...prev, ...d.prices })))
  }

  async function removeFromWatchlist(id: string, ticker: string) {
    const { error } = await supabase.from('watchlist').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setWatchlist(watchlist.filter((w) => w.id !== id))
    toast.success(`${ticker} removed from watchlist`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Watchlist</h1>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search stocks to add..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); searchTickers(e.target.value) }}
              />
            </div>
            {searchResults.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 bg-background border rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
                {searchResults.map((r) => (
                  <button
                    key={r.ticker}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left"
                    onClick={() => addToWatchlist(r.ticker, r.name)}
                  >
                    <Plus className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-sm">{r.ticker}</span>
                    <span className="text-xs text-muted-foreground flex-1 truncate">{r.name}</span>
                    <span className="text-xs text-muted-foreground">{r.exchange}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Watchlist grid */}
      {watchlist.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">Your watchlist is empty. Search for stocks to add them.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {watchlist.map((item) => {
            const p = prices[item.ticker]
            const isUp = (p?.changePercent ?? 0) >= 0

            return (
              <Card key={item.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{item.ticker}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">{p?.name ?? item.name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={isUp ? 'default' : 'destructive'} className="text-xs">
                        {isUp ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                        {p ? `${isUp ? '+' : ''}${p.changePercent.toFixed(2)}%` : '—'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFromWatchlist(item.id, item.ticker)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading && !p ? (
                    <Skeleton className="h-8 w-24" />
                  ) : p ? (
                    <div>
                      <p className="text-2xl font-bold">{format(p.price, p.currency as Currency)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Prev close: {format(p.previousClose, p.currency as Currency)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Price unavailable</p>
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
