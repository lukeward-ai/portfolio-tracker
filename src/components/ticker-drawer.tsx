'use client'

import { useEffect, useState, useMemo } from 'react'
import { useTickerDrawer } from '@/lib/ticker-drawer-context'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrency } from '@/lib/currency-context'
import { TrendingUp, TrendingDown, ExternalLink, BarChart3, Building2, CalendarDays } from 'lucide-react'
import { format as formatDate, differenceInDays } from 'date-fns'
import { eventTypeColor } from '@/lib/events'
import type { TickerDetail, Currency, MarketEvent } from '@/lib/types'
import { cn } from '@/lib/utils'

interface UserPosition {
  quantity: number
  avgCost: number
  costBasis: number
  currency: Currency
  currentValue: number | null
  unrealisedPnL: number | null
  unrealisedPnLPct: number | null
  realisedPnL: number | null
  allocationPct: number | null
}

interface TickerDrawerProps {
  userPositions?: Record<string, UserPosition>
}

function StatRow({ label, value, className }: { label: string; value: string | null; className?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-medium tabular-nums', className)}>{value ?? '—'}</span>
    </div>
  )
}

function formatLargeNumber(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  return n.toLocaleString()
}

function RecoLabel({ reco }: { reco: string | null }) {
  if (!reco) return null
  const config: Record<string, { bg: string; text: string; label: string }> = {
    buy:  { bg: 'bg-green-100 dark:bg-green-950', text: 'text-green-700 dark:text-green-400', label: 'Analyst: Buy' },
    hold: { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400', label: 'Analyst: Hold' },
    sell: { bg: 'bg-red-100 dark:bg-red-950',     text: 'text-red-600 dark:text-red-400',     label: 'Analyst: Sell' },
  }
  const c = config[reco]
  if (!c) return null
  return (
    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', c.bg, c.text)}>
      {c.label}
    </span>
  )
}

export function TickerDrawer({ userPositions = {} }: TickerDrawerProps) {
  const { selectedTicker, closeTicker } = useTickerDrawer()
  const [detail, setDetail] = useState<TickerDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState<MarketEvent[]>([])
  const { format, convert } = useCurrency()

  useEffect(() => {
    if (!selectedTicker) { setDetail(null); setEvents([]); return }
    setLoading(true)
    fetch(`/api/ticker-detail/${selectedTicker}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setDetail(d); else setDetail(null) })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))

    fetch(`/api/events?tickers=${selectedTicker}`)
      .then((r) => r.json())
      .then((d) => {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const upcoming = (d.events ?? []).filter((e: MarketEvent) => new Date(e.date) >= today)
        setEvents(upcoming.slice(0, 4))
      })
      .catch(() => setEvents([]))
  }, [selectedTicker])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tickerEvents = useMemo(() => events, [events])

  const pos = selectedTicker ? userPositions[selectedTicker] : undefined

  const isUp = (detail?.changePercent ?? 0) >= 0

  // 52W position
  const week52Pct = detail?.week52High && detail?.week52Low
    ? ((detail.price - detail.week52Low) / (detail.week52High - detail.week52Low)) * 100
    : null

  const distFromHigh = detail?.week52High
    ? ((detail.week52High - detail.price) / detail.week52High) * 100
    : null

  // Generate deterministic AI summary for this ticker
  function buildTickerSummary(): string {
    if (!detail) return ''
    const parts: string[] = []

    if (distFromHigh != null) {
      if (distFromHigh < 3) {
        parts.push(`${detail.ticker} is trading near its 52-week high.`)
      } else {
        parts.push(`${detail.ticker} is trading ${distFromHigh.toFixed(1)}% below its 52-week high.`)
      }
    }

    if (pos?.unrealisedPnLPct != null) {
      const dir = pos.unrealisedPnLPct >= 0 ? 'up' : 'down'
      parts.push(`Your position is ${dir} ${Math.abs(pos.unrealisedPnLPct).toFixed(1)}% from your average cost.`)
    }

    if (detail.trailingPE != null) {
      if (detail.trailingPE > 35) {
        parts.push(`The P/E ratio of ${detail.trailingPE.toFixed(1)}x appears elevated versus the broader market average.`)
      } else if (detail.trailingPE < 12) {
        parts.push(`The P/E ratio of ${detail.trailingPE.toFixed(1)}x may indicate a value opportunity.`)
      } else {
        parts.push(`The trailing P/E of ${detail.trailingPE.toFixed(1)}x is within a moderate range.`)
      }
    }

    if (detail.dividendYield != null && detail.dividendYield > 0) {
      parts.push(`Current dividend yield is ${detail.dividendYield.toFixed(2)}%.`)
    }

    if (detail.news.length > 0) {
      parts.push(`${detail.news.length} recent news item${detail.news.length !== 1 ? 's' : ''} available below.`)
    }

    return parts.join(' ') || 'Insufficient data for detailed analysis.'
  }

  return (
    <Sheet open={!!selectedTicker} onOpenChange={(v) => !v && closeTicker()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">

        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
          {loading || !detail ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <SheetTitle className="text-xl font-bold">{detail.ticker}</SheetTitle>
                  {detail.sector && (
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {detail.sector}
                    </span>
                  )}
                  <RecoLabel reco={detail.recommendationKey} />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 leading-tight">{detail.name}</p>
              </div>
            </div>
          )}
        </SheetHeader>

        <div className="px-6 py-4 space-y-6">

          {/* Price section */}
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : detail ? (
            <div>
              <div className="flex items-end gap-3">
                <p className="text-4xl font-bold tabular-nums tracking-tight">
                  {format(detail.price, detail.currency as Currency)}
                </p>
                <div className="pb-1.5">
                  <Badge
                    className={cn(
                      'text-sm font-semibold px-2 py-0.5',
                      isUp
                        ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400'
                        : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400'
                    )}
                    variant="outline"
                  >
                    {isUp ? <TrendingUp className="h-3.5 w-3.5 mr-1" /> : <TrendingDown className="h-3.5 w-3.5 mr-1" />}
                    {isUp ? '+' : ''}{detail.change.toFixed(2)} ({isUp ? '+' : ''}{detail.changePercent.toFixed(2)}%)
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Prev close {format(detail.previousClose, detail.currency as Currency)} · {detail.currency}
              </p>

              {/* 52W bar */}
              {detail.week52High && detail.week52Low && (
                <div className="mt-4">
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                    <span>52W Low {format(detail.week52Low, detail.currency as Currency)}</span>
                    <span>52W High {format(detail.week52High, detail.currency as Currency)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', isUp ? 'bg-[#2563EB]' : 'bg-[#64748B]')}
                      style={{ width: `${Math.min(100, Math.max(2, week52Pct ?? 50))}%` }}
                    />
                  </div>
                  {distFromHigh != null && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {distFromHigh < 1 ? 'Near 52W high' : `${distFromHigh.toFixed(1)}% below 52W high`}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Failed to load data for this ticker.</p>
          )}

          {/* Key stats */}
          {detail && (
            <div className="rounded-xl border border-border overflow-hidden">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5 bg-muted/40 border-b border-border">
                Key Stats
              </p>
              <div className="px-4">
                <StatRow label="Market Cap" value={detail.marketCap ? formatLargeNumber(detail.marketCap) : null} />
                <StatRow label="P/E (Trailing)" value={detail.trailingPE != null ? `${detail.trailingPE.toFixed(1)}x` : null} />
                <StatRow label="P/E (Forward)" value={detail.forwardPE != null ? `${detail.forwardPE.toFixed(1)}x` : null} />
                <StatRow label="Dividend Yield" value={detail.dividendYield != null ? `${detail.dividendYield.toFixed(2)}%` : null} />
                <StatRow label="Beta" value={detail.beta != null ? detail.beta.toFixed(2) : null} />
                {detail.industry && <StatRow label="Industry" value={detail.industry} />}
                {detail.numberOfAnalystOpinions != null && (
                  <StatRow label="Analyst Opinions" value={`${detail.numberOfAnalystOpinions} analysts`} />
                )}
              </div>
            </div>
          )}

          {/* Your position */}
          {pos && (
            <div className="rounded-xl border border-border overflow-hidden">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5 bg-muted/40 border-b border-border">
                Your Position
              </p>
              <div className="px-4">
                <StatRow label="Quantity" value={pos.quantity.toFixed(4)} />
                <StatRow label="Avg Cost" value={format(pos.avgCost, pos.currency)} />
                <StatRow label="Cost Basis" value={format(pos.costBasis, pos.currency)} />
                <StatRow
                  label="Market Value"
                  value={pos.currentValue != null ? format(pos.currentValue) : null}
                />
                <StatRow
                  label="Unrealised P&L"
                  value={pos.unrealisedPnL != null
                    ? `${pos.unrealisedPnL >= 0 ? '+' : ''}${format(pos.unrealisedPnL)}`
                    : null}
                  className={pos.unrealisedPnL != null
                    ? pos.unrealisedPnL >= 0 ? 'text-positive' : 'text-negative'
                    : undefined}
                />
                {pos.unrealisedPnLPct != null && (
                  <StatRow
                    label="Return %"
                    value={`${pos.unrealisedPnLPct >= 0 ? '+' : ''}${pos.unrealisedPnLPct.toFixed(2)}%`}
                    className={pos.unrealisedPnLPct >= 0 ? 'text-positive' : 'text-negative'}
                  />
                )}
                {pos.realisedPnL != null && (
                  <StatRow
                    label="Realised P&L"
                    value={`${pos.realisedPnL >= 0 ? '+' : ''}${format(pos.realisedPnL)}`}
                    className={pos.realisedPnL >= 0 ? 'text-positive' : 'text-negative'}
                  />
                )}
                {pos.allocationPct != null && (
                  <StatRow label="Allocation" value={`${pos.allocationPct.toFixed(1)}%`} />
                )}
              </div>
            </div>
          )}

          {/* AI Summary */}
          {detail && (
            <div className="rounded-xl border border-[#2563EB]/20 bg-[#2563EB]/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-3.5 w-3.5 text-[#2563EB]" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#2563EB]">AI Summary</p>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{buildTickerSummary()}</p>
              <p className="text-[10px] text-muted-foreground mt-2">Based on available data. Not financial advice.</p>
            </div>
          )}

          {/* Company description */}
          {detail?.description && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                About
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{detail.description}</p>
            </div>
          )}

          {/* News */}
          {detail && detail.news.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Recent News
              </p>
              <div className="space-y-3">
                {detail.news.map((item, i) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl border border-border p-3.5 hover:bg-muted/40 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground leading-snug group-hover:text-[#2563EB] transition-colors line-clamp-2">
                        {item.title}
                      </p>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 mt-0.5" />
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      {item.source && (
                        <span className="text-[11px] text-muted-foreground">{item.source}</span>
                      )}
                      {item.publishedAt && (
                        <>
                          {item.source && <span className="text-[11px] text-muted-foreground">·</span>}
                          <span className="text-[11px] text-muted-foreground">
                            {formatDate(new Date(item.publishedAt), 'd MMM yyyy')}
                          </span>
                        </>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          {tickerEvents.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5 bg-muted/40 border-b border-border flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" />
                Upcoming Events
              </p>
              <div className="px-4">
                {tickerEvents.map((event) => {
                  const today = new Date(); today.setHours(0, 0, 0, 0)
                  const days = differenceInDays(new Date(event.date), today)
                  const colorClass = eventTypeColor(event.type)
                  return (
                    <div key={event.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{formatDate(new Date(event.date), 'd MMM yyyy')}</span>
                          <Badge variant="outline" className={cn('text-[10px] font-semibold', colorClass)}>
                            {event.type === 'earnings' ? 'Earnings' : event.type === 'dividend' ? 'Dividend' : 'Economic'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{event.description ?? event.title}</p>
                      </div>
                      <span className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-2',
                        days === 0
                          ? 'bg-amber-50 text-amber-600 border border-amber-200'
                          : days <= 7
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-[11px] text-muted-foreground pb-2">
            Data sourced from Yahoo Finance. Not financial advice.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Helper to build userPositions map from portfolio data
export function buildUserPositions(
  holdings: Array<{ ticker: string; quantity: number; avgCost: number; costBasis: number; currency: Currency }>,
  prices: Record<string, { price: number; currency: string; changePercent: number }>,
  realisedGains: Array<{ ticker: string; gain: number; currency: Currency }>,
  convert: (amount: number, from: Currency) => number,
  totalValue: number
): Record<string, UserPosition> {
  const positions: Record<string, UserPosition> = {}

  const realisedByTicker = new Map<string, number>()
  for (const g of realisedGains) {
    realisedByTicker.set(g.ticker, (realisedByTicker.get(g.ticker) ?? 0) + convert(g.gain, g.currency))
  }

  for (const h of holdings) {
    const p = prices[h.ticker]
    const priceCur = (p?.currency ?? h.currency) as Currency
    const currentValue = p ? convert(p.price * h.quantity, priceCur) : null
    const costInBase = convert(h.costBasis, h.currency)
    const unrealisedPnL = currentValue !== null ? currentValue - costInBase : null
    const unrealisedPnLPct = costInBase > 0 && unrealisedPnL !== null ? (unrealisedPnL / costInBase) * 100 : null
    const allocationPct = currentValue !== null && totalValue > 0 ? (currentValue / totalValue) * 100 : null

    positions[h.ticker] = {
      quantity: h.quantity,
      avgCost: h.avgCost,
      costBasis: h.costBasis,
      currency: h.currency,
      currentValue,
      unrealisedPnL,
      unrealisedPnLPct,
      realisedPnL: realisedByTicker.get(h.ticker) ?? null,
      allocationPct,
    }
  }

  return positions
}
