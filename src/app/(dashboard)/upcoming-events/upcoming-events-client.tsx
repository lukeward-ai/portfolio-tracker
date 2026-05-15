'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTickerDrawer } from '@/lib/ticker-drawer-context'
import {
  getUpcomingEvents, generateWhatToWatch,
  eventTypeColor, filterEventsByTimeframe, filterEventsByType,
} from '@/lib/events'
import { format as formatDate, differenceInDays } from 'date-fns'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import {
  Calendar, TrendingUp, DollarSign, Sparkles, CalendarDays,
  Info, Package,
} from 'lucide-react'
import type { Transaction, WatchlistItem, MarketEvent, MarketEventType } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  transactions: Transaction[]
  watchlist: WatchlistItem[]
}

type Timeframe = '7' | '30' | '90' | 'all'

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return differenceInDays(new Date(dateStr), today)
}

function DaysChip({ days }: { days: number }) {
  if (days === 0) return <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">Today</span>
  if (days === 1) return <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">Tomorrow</span>
  if (days <= 7) return <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">{days}d</span>
  return <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{days}d</span>
}

function EventRow({ event, onTickerClick }: { event: MarketEvent; onTickerClick: (t: string) => void }) {
  const days = daysUntil(event.date)
  const colorClass = eventTypeColor(event.type)

  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-border/50 last:border-0">
      <div className="flex flex-col items-center gap-1 mt-0.5 shrink-0 w-10">
        <span className="text-xs font-bold tabular-nums text-foreground">
          {formatDate(new Date(event.date), 'd')}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase">
          {formatDate(new Date(event.date), 'MMM')}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {event.ticker && (
            <button
              className="text-sm font-semibold text-foreground hover:text-[#2563EB] transition-colors"
              onClick={() => onTickerClick(event.ticker!)}
            >
              {event.ticker}
            </button>
          )}
          <Badge variant="outline" className={cn('text-[10px] font-semibold', colorClass)}>
            {event.type === 'earnings' ? 'Earnings' : event.type === 'dividend' ? 'Dividend' : 'Economic'}
          </Badge>
          {!event.isConfirmed && (
            <span className="text-[10px] text-muted-foreground italic">unconfirmed</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5 truncate">{event.title}</p>
        {event.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
        )}
      </div>
      <div className="shrink-0">
        <DaysChip days={days} />
      </div>
    </div>
  )
}

export function UpcomingEventsClient({ transactions, watchlist }: Props) {
  const { openTicker } = useTickerDrawer()
  const [events, setEvents] = useState<MarketEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<Timeframe>('30')
  const [typeFilter, setTypeFilter] = useState<MarketEventType | 'all'>('all')

  // Derive unique tickers from holdings + watchlist
  const { lots } = calculatePnL(transactions, 'UK')
  const holdings = getHoldings(transactions, lots)
  const holdingTickers = holdings.map((h) => h.ticker)
  const watchlistTickers = watchlist.map((w) => w.ticker)
  const allTickers = [...new Set([...holdingTickers, ...watchlistTickers])]

  useEffect(() => {
    if (allTickers.length === 0) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/events?tickers=${allTickers.join(',')}`)
      .then((r) => r.json())
      .then((d) => { setEvents(d.events ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTickers.join(',')])

  const timeframeDays = timeframe === 'all' ? 0 : parseInt(timeframe)
  const filtered = filterEventsByType(
    filterEventsByTimeframe(events, timeframeDays),
    typeFilter
  )

  const upcoming = getUpcomingEvents(events, 5)
  const whatToWatch = generateWhatToWatch(events)

  const earningsCount = filtered.filter((e) => e.type === 'earnings').length
  const dividendCount = filtered.filter((e) => e.type === 'dividend').length
  const next7Count = getUpcomingEvents(events).filter((e) => {
    const d = new Date(e.date)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + 7)
    return d <= cutoff
  }).length

  if (allTickers.length === 0) {
    return (
      <div className="space-y-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Upcoming Events</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Earnings dates, dividends, and market events for your portfolio</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-20 text-center">
            <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No holdings or watchlist items</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add transactions or watchlist items to see upcoming events.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-7">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Upcoming Events</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Earnings dates, dividends, and market events for your portfolio</p>
      </div>

      {/* KPI summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Events This Week',
            value: loading ? null : String(next7Count),
            icon: CalendarDays,
            sub: 'Next 7 days',
          },
          {
            label: 'Earnings',
            value: loading ? null : String(earningsCount),
            icon: TrendingUp,
            sub: `in selected period`,
          },
          {
            label: 'Dividend Events',
            value: loading ? null : String(dividendCount),
            icon: DollarSign,
            sub: `in selected period`,
          },
          {
            label: 'Tickers Tracked',
            value: String(allTickers.length),
            icon: Calendar,
            sub: `${holdingTickers.length} holdings · ${watchlistTickers.length} watchlist`,
          },
        ].map((s) => (
          <Card key={s.label} className="border-border">
            <CardContent className="pt-5 pb-4 px-5">
              <p className="stat-label">{s.label}</p>
              {s.value === null ? (
                <Skeleton className="h-7 w-12 mt-1.5 mb-1" />
              ) : (
                <p className="stat-value mt-1.5">{s.value}</p>
              )}
              <p className="text-xs mt-1 text-muted-foreground">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI What to Watch */}
      {!loading && events.length > 0 && (
        <Card className="border-[#2563EB]/20 bg-gradient-to-r from-[#2563EB]/5 to-transparent">
          <CardContent className="pt-5 pb-4 px-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-[#2563EB]" />
              <p className="text-sm font-semibold text-[#2563EB]">What to Watch</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{whatToWatch}</p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={timeframe} onValueChange={(v) => v && setTimeframe(v as Timeframe)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Next 7 days</SelectItem>
            <SelectItem value="30">Next 30 days</SelectItem>
            <SelectItem value="90">Next 90 days</SelectItem>
            <SelectItem value="all">All upcoming</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v as MarketEventType | 'all')}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="earnings">Earnings</SelectItem>
            <SelectItem value="dividend">Dividends</SelectItem>
            <SelectItem value="economic">Economic</SelectItem>
          </SelectContent>
        </Select>

        <p className="text-xs text-muted-foreground ml-auto">
          {loading ? 'Loading…' : `${filtered.length} event${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Main events list */}
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Event Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-10 w-10 shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <Calendar className="h-7 w-7 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No events in this period</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try expanding the timeframe or changing the event type filter.
                  </p>
                </div>
              ) : (
                filtered.map((event) => (
                  <EventRow key={event.id} event={event} onTickerClick={openTicker} />
                ))
              )}
            </CardContent>
          </Card>

          {/* Economic calendar empty state */}
          <Card className="border-dashed">
            <CardContent className="py-6 px-5">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Economic Calendar</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Macro events (Fed decisions, CPI, GDP releases) require an external data provider.
                    Set <code className="bg-muted px-1 rounded text-[11px]">ECONOMIC_CALENDAR_API_KEY</code> in
                    your environment to enable this feature.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Next up */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Next Up
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  ))}
                </div>
              ) : upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming events found.</p>
              ) : (
                <div className="space-y-0">
                  {upcoming.map((event) => {
                    const days = daysUntil(event.date)
                    const colorClass = eventTypeColor(event.type)
                    return (
                      <div key={event.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                        <div className="flex-1 min-w-0 mr-2">
                          <div className="flex items-center gap-1.5">
                            {event.ticker && (
                              <button
                                className="text-sm font-semibold hover:text-[#2563EB] transition-colors"
                                onClick={() => openTicker(event.ticker!)}
                              >
                                {event.ticker}
                              </button>
                            )}
                            <Badge variant="outline" className={cn('text-[9px] font-semibold px-1.5 py-0', colorClass)}>
                              {event.type === 'earnings' ? 'E' : event.type === 'dividend' ? 'D' : 'M'}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {formatDate(new Date(event.date), 'd MMM yyyy')}
                          </p>
                        </div>
                        <DaysChip days={days} />
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data note */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Earnings dates sourced from Yahoo Finance and may be estimates. Always confirm with official company filings before trading.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
