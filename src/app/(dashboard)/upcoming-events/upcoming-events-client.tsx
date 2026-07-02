'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useTickerDrawer } from '@/lib/ticker-drawer-context'
import {
  getUpcomingEvents, generateWhatToWatch,
  eventTypeColor,
} from '@/lib/events'
import {
  format as formatDate, differenceInDays,
  startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isToday, addMonths, subMonths,
  getDay, isSameMonth,
} from 'date-fns'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import {
  Calendar, TrendingUp, DollarSign, Sparkles, CalendarDays,
  Info, Package, ChevronLeft, ChevronRight, LayoutList, CalendarRange, X,
} from 'lucide-react'
import type { Profile, Transaction, WatchlistItem, MarketEvent, MarketEventType } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  profile: Profile | null
  transactions: Transaction[]
  watchlist: WatchlistItem[]
}

type ViewMode = 'calendar' | 'list'
type Timeframe = '7' | '30' | '90' | 'all'

const EVENT_COLORS: Record<MarketEventType, { pill: string; dot: string }> = {
  earnings: { pill: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  dividend: { pill: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  economic: { pill: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
}

const EVENT_LABELS: Record<MarketEventType, string> = {
  earnings: 'Earnings',
  dividend: 'Dividend',
  economic: 'Economic',
}

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

function EventDetailSheet({ event, onClose }: { event: MarketEvent | null; onClose: () => void }) {
  if (!event) return null
  const days = daysUntil(event.date)
  const colors = EVENT_COLORS[event.type]

  return (
    <Sheet open={!!event} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0" side="right">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border sticky top-0 bg-background z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-base font-bold">{event.title}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(new Date(event.date), 'EEEE, d MMMM yyyy')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </SheetHeader>

        <div className="px-5 py-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn('text-xs font-semibold', colors.pill)}>
              {EVENT_LABELS[event.type]}
            </Badge>
            {!event.isConfirmed && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50">Estimated</Badge>
            )}
            {event.isConfirmed && (
              <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">Confirmed</Badge>
            )}
            <DaysChip days={days} />
          </div>

          {event.ticker && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Related to</p>
              <p className="text-sm font-bold">{event.ticker}</p>
              {event.name && <p className="text-xs text-muted-foreground mt-0.5">{event.name}</p>}
            </div>
          )}

          {event.description && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1.5">Details</p>
              <p className="text-sm leading-relaxed text-foreground">{event.description}</p>
            </div>
          )}

          {event.type === 'earnings' && event.epsEstimate != null && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Estimates</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">EPS Estimate</span>
                <span className="text-sm font-semibold tabular-nums">${event.epsEstimate.toFixed(2)}</span>
              </div>
            </div>
          )}

          {event.type === 'dividend' && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Dividend Details</p>
              {event.dividendAmount != null && (
                <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">Dividend Amount</span>
                  <span className="text-sm font-semibold tabular-nums">${event.dividendAmount.toFixed(4)}</span>
                </div>
              )}
              {event.exDividendDate && (
                <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                  <span className="text-xs text-muted-foreground">Ex-Dividend Date</span>
                  <span className="text-sm font-semibold">{formatDate(new Date(event.exDividendDate), 'd MMM yyyy')}</span>
                </div>
              )}
              {event.paymentDate && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-muted-foreground">Payment Date</span>
                  <span className="text-sm font-semibold">{formatDate(new Date(event.paymentDate), 'd MMM yyyy')}</span>
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {!event.isConfirmed
                ? 'This date is estimated and may change. Always confirm with official company or regulatory sources before acting.'
                : 'Date confirmed. This is not financial advice.'}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Calendar grid ──────────────────────────────────────────────────────────

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonthDays(month: Date): (Date | null)[] {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const days = eachDayOfInterval({ start, end })

  // Monday = 0, Sunday = 6 padding
  const startWeekday = (getDay(start) + 6) % 7
  const padded: (Date | null)[] = Array(startWeekday).fill(null)
  return [...padded, ...days]
}

function eventShortLabel(event: MarketEvent): string {
  if (event.ticker) return `${event.ticker} ${EVENT_LABELS[event.type]}`
  return event.title.length > 18 ? event.title.slice(0, 16) + '…' : event.title
}

function CalendarView({
  events,
  typeFilter,
  onEventClick,
}: {
  events: MarketEvent[]
  typeFilter: MarketEventType | 'all'
  onEventClick: (e: MarketEvent) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const days = getMonthDays(currentMonth)

  // Build a map: dateStr → events
  const eventsByDate = new Map<string, MarketEvent[]>()
  for (const ev of events) {
    if (typeFilter !== 'all' && ev.type !== typeFilter) continue
    const key = ev.date.slice(0, 10)
    if (!eventsByDate.has(key)) eventsByDate.set(key, [])
    eventsByDate.get(key)!.push(ev)
  }

  const selectedDateKey = selectedDay ? formatDate(selectedDay, 'yyyy-MM-dd') : null
  const selectedEvents = selectedDateKey ? (eventsByDate.get(selectedDateKey) ?? []) : []

  function goToToday() {
    const today = new Date()
    setCurrentMonth(today)
    setSelectedDay(today)
  }

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-sm font-bold text-foreground min-w-32 text-center">
            {formatDate(currentMonth, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday} className="h-8 text-xs">
          Today
        </Button>
      </div>

      {/* Calendar grid */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              if (!day) {
                return (
                  <div key={`pad-${idx}`} className="min-h-[90px] border-b border-r border-border/40 bg-muted/10 last:border-r-0" />
                )
              }

              const dateKey = formatDate(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDate.get(dateKey) ?? []
              const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
              const todayDay = isToday(day)
              const isCurrentMonth = isSameMonth(day, currentMonth)
              const visibleEvents = dayEvents.slice(0, 3)
              const overflow = dayEvents.length - 3

              const isLastCol = (idx + 1) % 7 === 0
              const rows = Math.ceil(days.length / 7)
              const rowIdx = Math.floor(idx / 7)
              const isLastRow = rowIdx === rows - 1

              return (
                <div
                  key={dateKey}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={cn(
                    'min-h-[90px] p-1.5 cursor-pointer transition-colors border-b border-r border-border/40',
                    isLastCol && 'border-r-0',
                    isLastRow && 'border-b-0',
                    isSelected && 'bg-[#2563EB]/8 ring-1 ring-inset ring-[#2563EB]/30',
                    !isSelected && isCurrentMonth && 'hover:bg-muted/40',
                    !isCurrentMonth && 'bg-muted/10',
                  )}
                >
                  <div className="flex items-center justify-end mb-1">
                    <span className={cn(
                      'text-xs font-semibold h-6 w-6 flex items-center justify-center rounded-full',
                      todayDay && 'bg-[#2563EB] text-white',
                      !todayDay && isCurrentMonth && 'text-foreground',
                      !todayDay && !isCurrentMonth && 'text-muted-foreground/40',
                    )}>
                      {formatDate(day, 'd')}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {visibleEvents.map((ev) => {
                      const colors = EVENT_COLORS[ev.type]
                      return (
                        <button
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
                          className={cn(
                            'w-full text-left flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium leading-tight truncate border transition-opacity hover:opacity-80',
                            colors.pill,
                          )}
                        >
                          <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', colors.dot)} />
                          <span className="truncate">{eventShortLabel(ev)}</span>
                        </button>
                      )
                    })}
                    {overflow > 0 && (
                      <p className="text-[10px] text-muted-foreground px-1">+{overflow} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected day panel */}
      {selectedDay && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">
              Events on {formatDate(selectedDay, 'EEEE, d MMMM yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No events scheduled for this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((ev) => {
                  const colors = EVENT_COLORS[ev.type]
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-border hover:bg-muted/40 transition-colors group"
                    >
                      <div className={cn('h-2 w-2 rounded-full mt-1.5 shrink-0', colors.dot)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {ev.ticker && <span className="text-sm font-semibold text-foreground">{ev.ticker}</span>}
                          <Badge variant="outline" className={cn('text-[10px] font-semibold', colors.pill)}>
                            {EVENT_LABELS[ev.type]}
                          </Badge>
                          {!ev.isConfirmed && <span className="text-[10px] text-muted-foreground italic">estimated</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{ev.title}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-opacity" />
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── List view (existing) ────────────────────────────────────────────────────

function EventRow({ event, onEventClick, onTickerClick }: {
  event: MarketEvent
  onEventClick: (e: MarketEvent) => void
  onTickerClick: (t: string) => void
}) {
  const days = daysUntil(event.date)
  const colorClass = eventTypeColor(event.type)

  return (
    <div
      className="flex items-start gap-3 py-3.5 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/20 transition-colors -mx-1 px-1 rounded"
      onClick={() => onEventClick(event)}
    >
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
              onClick={(e) => { e.stopPropagation(); onTickerClick(event.ticker!) }}
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

// ─── Main component ──────────────────────────────────────────────────────────

export function UpcomingEventsClient({ profile, transactions, watchlist }: Props) {
  const { openTicker } = useTickerDrawer()
  const [events, setEvents] = useState<MarketEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<Timeframe>('30')
  const [typeFilter, setTypeFilter] = useState<MarketEventType | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [selectedEvent, setSelectedEvent] = useState<MarketEvent | null>(null)

  const { lots } = calculatePnL(transactions, profile?.tax_jurisdiction ?? 'UK')
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

  // Filtered events for list view
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const cutoff = timeframe === 'all' ? null : new Date(now.getTime() + parseInt(timeframe) * 86400000)
  const filteredForList = events.filter((e) => {
    const d = new Date(e.date)
    if (d < now) return false
    if (cutoff && d > cutoff) return false
    if (typeFilter !== 'all' && e.type !== typeFilter) return false
    return true
  }).sort((a, b) => a.date.localeCompare(b.date))

  const upcoming = getUpcomingEvents(events, 5)
  const whatToWatch = generateWhatToWatch(events)

  const earningsCount = events.filter((e) => e.type === 'earnings').length
  const dividendCount = events.filter((e) => e.type === 'dividend').length
  const next7Count = events.filter((e) => {
    const d = new Date(e.date)
    const cutoff7 = new Date(now.getTime() + 7 * 86400000)
    return d >= now && d <= cutoff7
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
            sub: 'Total tracked',
          },
          {
            label: 'Dividend Events',
            value: loading ? null : String(dividendCount),
            icon: DollarSign,
            sub: 'Total tracked',
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

      {/* View toggle + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* View mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setViewMode('calendar')}
            className={cn(
              'flex items-center gap-1.5 px-3 h-8 text-xs font-medium transition-colors',
              viewMode === 'calendar' ? 'bg-[#0F172A] text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Calendar
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 h-8 text-xs font-medium border-l border-border transition-colors',
              viewMode === 'list' ? 'bg-[#0F172A] text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
            List
          </button>
        </div>

        {/* Type filter */}
        <div className="flex gap-1">
          {(['all', 'earnings', 'dividend', 'economic'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={cn(
                'px-3 h-8 text-xs font-medium rounded-lg border transition-colors',
                typeFilter === t
                  ? 'bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/30'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
              )}
            >
              {t === 'all' ? 'All' : t === 'earnings' ? 'Earnings' : t === 'dividend' ? 'Dividends' : 'Economic'}
            </button>
          ))}
        </div>

        {viewMode === 'list' && (
          <div className="flex gap-1 ml-1">
            {(['7', '30', '90', 'all'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={cn(
                  'px-2.5 h-8 text-xs font-medium rounded-lg border transition-colors',
                  timeframe === t
                    ? 'bg-muted border-muted-foreground/30 text-foreground'
                    : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                )}
              >
                {t === 'all' ? 'All' : `${t}d`}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground ml-auto">
          {loading ? 'Loading…' : `${events.length} event${events.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Main content */}
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
      ) : viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2">
            <CalendarView
              events={events}
              typeFilter={typeFilter}
              onEventClick={setSelectedEvent}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Next Up
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming events found.</p>
                ) : (
                  <div className="space-y-0">
                    {upcoming.map((event) => {
                      const days = daysUntil(event.date)
                      const colors = EVENT_COLORS[event.type]
                      return (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className="w-full flex items-center justify-between py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors -mx-1 px-1 rounded"
                        >
                          <div className="flex-1 min-w-0 mr-2 text-left">
                            <div className="flex items-center gap-1.5">
                              {event.ticker && (
                                <span className="text-sm font-semibold">{event.ticker}</span>
                              )}
                              <Badge variant="outline" className={cn('text-[9px] font-semibold px-1.5 py-0', colors.pill)}>
                                {event.type === 'earnings' ? 'E' : event.type === 'dividend' ? 'D' : 'M'}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {formatDate(new Date(event.date), 'd MMM yyyy')}
                            </p>
                          </div>
                          <DaysChip days={days} />
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Earnings dates sourced from Yahoo Finance and may be estimates. Always confirm with official company filings before trading.
              </p>
            </div>
          </div>
        </div>
      ) : (
        // List view
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Event Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                {filteredForList.length === 0 ? (
                  <div className="py-12 text-center">
                    <Calendar className="h-7 w-7 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No events in this period</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try expanding the timeframe or changing the event type filter.
                    </p>
                  </div>
                ) : (
                  filteredForList.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      onEventClick={setSelectedEvent}
                      onTickerClick={openTicker}
                    />
                  ))
                )}
              </CardContent>
            </Card>

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

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3 pt-5 px-5">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Next Up
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming events found.</p>
                ) : (
                  <div className="space-y-0">
                    {upcoming.map((event) => {
                      const days = daysUntil(event.date)
                      const colors = EVENT_COLORS[event.type]
                      return (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className="w-full flex items-center justify-between py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors -mx-1 px-1 rounded"
                        >
                          <div className="flex-1 min-w-0 mr-2 text-left">
                            <div className="flex items-center gap-1.5">
                              {event.ticker && (
                                <button
                                  className="text-sm font-semibold hover:text-[#2563EB] transition-colors"
                                  onClick={(e) => { e.stopPropagation(); openTicker(event.ticker!) }}
                                >
                                  {event.ticker}
                                </button>
                              )}
                              <Badge variant="outline" className={cn('text-[9px] font-semibold px-1.5 py-0', colors.pill)}>
                                {event.type === 'earnings' ? 'E' : event.type === 'dividend' ? 'D' : 'M'}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {formatDate(new Date(event.date), 'd MMM yyyy')}
                            </p>
                          </div>
                          <DaysChip days={days} />
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Earnings dates sourced from Yahoo Finance and may be estimates. Always confirm with official company filings before trading.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Event detail drawer */}
      <EventDetailSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  )
}
