'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrency } from '@/lib/currency-context'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import { generatePortfolioAnalysis, analyseSnapshotRange } from '@/lib/analysis'
import { useTickerDrawer } from '@/lib/ticker-drawer-context'
import {
  TrendingUp, TrendingDown, Brain, Globe2, BarChart3,
  ArrowUpRight, ArrowDownRight, Info, Sparkles,
} from 'lucide-react'
import { format as formatDate } from 'date-fns'
import type { Profile, Transaction, PortfolioSnapshot, Currency } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  profile: Profile | null
  transactions: Transaction[]
  snapshots: PortfolioSnapshot[]
  rates: Record<string, number>
}

type Timeframe = '7D' | '30D' | '90D' | '1Y' | 'All'
const TIMEFRAMES: { label: Timeframe; days: number }[] = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 0 },
]

type PriceMap = Record<string, { price: number; changePercent: number; currency: string; name: string | null }>

function MetricCard({
  label, value, sub, positive, loading, icon: Icon,
}: {
  label: string
  value: string | null
  sub?: string | null
  positive?: boolean
  loading?: boolean
  icon?: React.ElementType
}) {
  return (
    <Card className="border-border">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center gap-1.5 mb-1">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <p className="stat-label">{label}</p>
        </div>
        {loading || value === null ? (
          <Skeleton className="h-7 w-24 mt-2" />
        ) : (
          <p className={cn('stat-value mt-1', positive === true ? 'text-positive' : positive === false ? 'text-negative' : '')}>
            {value}
          </p>
        )}
        {sub && !loading && (
          <p className="text-xs text-muted-foreground mt-1">{sub}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function AiAnalysisClient({ profile, transactions, snapshots, rates }: Props) {
  const { format, convert, currency: displayCurrency } = useCurrency()
  const { openTicker } = useTickerDrawer()
  const [prices, setPrices] = useState<PriceMap>({})
  const [loadingPrices, setLoadingPrices] = useState(true)
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('30D')

  const baseCurrency = (profile?.base_currency ?? 'GBP') as Currency
  const jurisdiction = profile?.tax_jurisdiction ?? 'UK'
  const { lots, realisedGains } = calculatePnL(transactions, jurisdiction)
  const holdings = getHoldings(transactions, lots)
  const tickers = holdings.map((h) => h.ticker)

  const fetchPrices = useCallback(() => {
    if (tickers.length === 0) { setLoadingPrices(false); return }
    fetch(`/api/prices?tickers=${tickers.join(',')}`)
      .then((r) => r.json())
      .then((d) => { setPrices(d.prices ?? {}); setLoadingPrices(false) })
      .catch(() => setLoadingPrices(false))
  }, [tickers.join(',')])

  useEffect(() => { fetchPrices() }, [fetchPrices])

  const activeDays = TIMEFRAMES.find((t) => t.label === activeTimeframe)?.days ?? 30
  const snapshotRange = analyseSnapshotRange(snapshots, activeDays)

  const analysis = generatePortfolioAnalysis({
    transactions,
    prices,
    realisedGains,
    snapshots,
    rates,
    baseCurrency,
    jurisdiction,
    timeframeDays: activeDays,
  })

  // Calculate FX exposure breakdown
  const fxBreakdown: Record<string, number> = {}
  let totalValue = 0
  for (const h of holdings) {
    const p = prices[h.ticker]
    if (!p) continue
    const priceCur = p.currency as Currency
    const val = convert(p.price * h.quantity, priceCur)
    totalValue += val
    fxBreakdown[priceCur] = (fxBreakdown[priceCur] ?? 0) + val
  }

  const fxRows = Object.entries(fxBreakdown)
    .map(([cur, val]) => ({ currency: cur, value: val, pct: totalValue > 0 ? (val / totalValue) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)

  const currencySymbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }

  // Snapshot-based metrics
  const { startSnapshot, endSnapshot, change, changePct, topContributors, hasEnoughData } = snapshotRange

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Brain className="h-6 w-6 text-[#2563EB]" />
            AI Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Portfolio intelligence based on your data
          </p>
        </div>
      </div>

      {/* Timeframe selector */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {TIMEFRAMES.map(({ label }) => (
          <button
            key={label}
            onClick={() => setActiveTimeframe(label)}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold rounded-md transition-all',
              activeTimeframe === label
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Portfolio Brief */}
      <Card className="border-[#2563EB]/20 bg-gradient-to-br from-[#2563EB]/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#2563EB]" />
            Portfolio Brief
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingPrices ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : (
            <>
              <p className="text-base font-semibold text-foreground">{analysis.headline}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>

              {/* Key drivers */}
              {analysis.keyDrivers.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 pt-1">
                  {analysis.keyDrivers.slice(0, 6).map((d) => (
                    <button
                      key={d.ticker}
                      onClick={() => openTicker(d.ticker)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors hover:bg-accent',
                        d.direction === 'positive'
                          ? 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30'
                          : d.direction === 'negative'
                          ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30'
                          : 'border-border bg-muted/30'
                      )}
                    >
                      <div className={cn(
                        'h-6 w-6 rounded-full flex items-center justify-center shrink-0',
                        d.direction === 'positive' ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                      )}>
                        {d.direction === 'positive'
                          ? <TrendingUp className="h-3 w-3 text-green-600" />
                          : <TrendingDown className="h-3 w-3 text-red-600" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">{d.ticker}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {d.impactPct >= 0 ? '+' : ''}{d.impactPct.toFixed(1)}% · {d.impactValue >= 0 ? '+' : ''}{format(d.impactValue)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-muted-foreground pt-1 italic">{analysis.disclaimer}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Snapshot-based period analysis */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {activeTimeframe === 'All' ? 'All Time' : `Last ${activeTimeframe}`} Performance
        </h2>

        {!hasEnoughData ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Info className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Not enough historical data yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Save daily snapshots to unlock richer period analysis. Go to Portfolio History and click Save Snapshot.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Period KPIs */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricCard
                label="Portfolio Change"
                value={`${change >= 0 ? '+' : ''}${format(change)}`}
                sub={`${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`}
                positive={change >= 0}
                icon={change >= 0 ? ArrowUpRight : ArrowDownRight}
              />
              <MetricCard
                label="Start Value"
                value={startSnapshot ? format(startSnapshot.portfolio_value) : null}
                sub={startSnapshot ? formatDate(new Date(startSnapshot.snapshot_date), 'd MMM yyyy') : null}
              />
              <MetricCard
                label="End Value"
                value={endSnapshot ? format(endSnapshot.portfolio_value) : null}
                sub={endSnapshot ? formatDate(new Date(endSnapshot.snapshot_date), 'd MMM yyyy') : null}
              />
              <MetricCard
                label="Holdings"
                value={endSnapshot ? `${endSnapshot.holdings_count}` : null}
                sub={`Realised: ${format(realisedGains.reduce((s, g) => s + convert(g.gain, g.currency), 0))}`}
              />
            </div>

            {/* Top contributors */}
            {topContributors.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Top Movers This Period</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {topContributors.map((c) => {
                      const positive = c.change >= 0
                      return (
                        <div key={c.ticker} className="flex items-center gap-3">
                          <button
                            className="font-semibold text-sm w-16 text-left hover:text-[#2563EB] transition-colors shrink-0"
                            onClick={() => openTicker(c.ticker)}
                          >
                            {c.ticker}
                          </button>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', positive ? 'bg-[#16A34A]' : 'bg-[#DC2626]')}
                              style={{
                                width: `${Math.min(100, Math.abs(c.change) / (Math.max(...topContributors.map((x) => Math.abs(x.change))) || 1) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className={cn('text-sm font-semibold tabular-nums w-28 text-right', positive ? 'text-positive' : 'text-negative')}>
                            {positive ? '+' : ''}{format(c.change)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* FX Impact section */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Globe2 className="h-4 w-4" />
          FX Exposure
        </h2>
        <Card>
          <CardContent className="pt-5">
            {loadingPrices ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
            ) : fxRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No holdings to analyse</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {fxRows.map((row) => (
                    <div key={row.currency} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                      <span className="text-xl font-bold text-muted-foreground shrink-0">
                        {currencySymbols[row.currency] ?? row.currency}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{row.currency}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{format(row.value)} · {row.pct.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Breakdown bar */}
                {fxRows.length > 1 && (
                  <div>
                    <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                      {fxRows.map((row, i) => {
                        const COLORS = ['#2563EB', '#16A34A', '#EA580C', '#7C3AED']
                        return (
                          <div
                            key={row.currency}
                            className="h-full first:rounded-l-full last:rounded-r-full"
                            style={{ width: `${row.pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        )
                      })}
                    </div>
                    <div className="flex gap-4 mt-2 flex-wrap">
                      {fxRows.map((row, i) => {
                        const COLORS = ['#2563EB', '#16A34A', '#EA580C', '#7C3AED']
                        return (
                          <div key={row.currency} className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-xs text-muted-foreground">{row.currency} {row.pct.toFixed(1)}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">FX note:</span>{' '}
                    {analysis.fxNote || `Your portfolio is ${fxRows[0]?.pct.toFixed(0)}% in ${fxRows[0]?.currency ?? baseCurrency}. Returns are shown in ${displayCurrency} using current exchange rates. Historical FX attribution requires rate snapshots not currently available.`}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Realised P&L summary */}
      {realisedGains.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Closed Positions Summary
          </h2>
          <Card>
            <CardContent className="pt-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  {
                    label: 'Total Realised',
                    value: format(realisedGains.reduce((s, g) => s + convert(g.gain, g.currency), 0)),
                    positive: realisedGains.reduce((s, g) => s + convert(g.gain, g.currency), 0) >= 0,
                  },
                  {
                    label: 'Closed Trades',
                    value: `${realisedGains.length}`,
                    positive: undefined,
                  },
                  {
                    label: 'Win Rate',
                    value: `${realisedGains.length > 0 ? ((realisedGains.filter((g) => g.gain > 0).length / realisedGains.length) * 100).toFixed(0) : 0}%`,
                    positive: realisedGains.filter((g) => g.gain > 0).length >= realisedGains.filter((g) => g.gain < 0).length,
                  },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-lg bg-muted/40">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={cn('text-lg font-bold mt-1', s.positive === true ? 'text-positive' : s.positive === false ? 'text-negative' : '')}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Holdings with today's performance */}
      {holdings.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Today&apos;s Position Detail
          </h2>
          <Card>
            <CardContent className="pt-0 pb-0">
              <div className="divide-y divide-border">
                {holdings
                  .filter((h) => prices[h.ticker])
                  .sort((a, b) => {
                    const pa = prices[a.ticker], pb = prices[b.ticker]
                    const va = convert(pa.price * a.quantity, pa.currency as Currency)
                    const vb = convert(pb.price * b.quantity, pb.currency as Currency)
                    return vb - va
                  })
                  .map((h) => {
                    const p = prices[h.ticker]
                    if (!p) return null
                    const pc = p.currency as Currency
                    const curVal = convert(p.price * h.quantity, pc)
                    const costVal = convert(h.costBasis, h.currency)
                    const pnl = curVal - costVal
                    const pnlPct = costVal > 0 ? (pnl / costVal) * 100 : 0
                    const alloc = totalValue > 0 ? (curVal / totalValue) * 100 : 0

                    return (
                      <div key={h.ticker} className="flex items-center justify-between py-3 px-5">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            className="font-semibold text-sm text-left hover:text-[#2563EB] transition-colors w-16 shrink-0"
                            onClick={() => openTicker(h.ticker)}
                          >
                            {h.ticker}
                          </button>
                          <div className="hidden sm:block w-24">
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-[#2563EB]"
                                style={{ width: `${Math.min(100, alloc * 5)}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{alloc.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-muted-foreground">Today</p>
                            <Badge
                              className={cn(
                                'text-[10px] font-semibold mt-0.5',
                                p.changePercent >= 0
                                  ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400'
                                  : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400'
                              )}
                              variant="outline"
                            >
                              {p.changePercent >= 0 ? '+' : ''}{p.changePercent.toFixed(2)}%
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">{format(curVal)}</p>
                            <p className={cn('text-xs font-medium tabular-nums', pnl >= 0 ? 'text-positive' : 'text-negative')}>
                              {pnl >= 0 ? '+' : ''}{format(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Analysis is generated deterministically from your portfolio, price and exchange rate data.
          It is not financial advice. Economic and news context requires integration of external data sources.
        </p>
      </div>
    </div>
  )
}
