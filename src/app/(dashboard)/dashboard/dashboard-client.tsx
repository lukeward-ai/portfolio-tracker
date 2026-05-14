'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrency } from '@/lib/currency-context'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import { PortfolioChart } from '@/components/portfolio-chart'
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  BarChart2, Activity, Clock, RefreshCw,
} from 'lucide-react'
import { format as formatDate } from 'date-fns'
import type { Profile, Portfolio, Transaction, CashPosition, Currency } from '@/lib/types'

interface Props {
  profile: Profile | null
  portfolios: Portfolio[]
  transactions: Transaction[]
  cashPositions: CashPosition[]
}

function StatCard({
  label, value, sub, positive, loading, accent,
}: {
  label: string
  value: string | null
  sub?: string | null
  positive?: boolean
  loading?: boolean
  accent?: boolean
}) {
  return (
    <Card className={`border ${accent ? 'border-[#2563EB]/20 bg-[#2563EB]/5' : 'border-border'}`}>
      <CardContent className="pt-5 pb-4 px-5">
        <p className="stat-label">{label}</p>
        {loading || value === null ? (
          <Skeleton className="h-7 w-28 mt-2 mb-1" />
        ) : (
          <p className="stat-value mt-1.5">{value}</p>
        )}
        {sub && !loading && (
          <p className={`text-xs mt-1 font-medium ${
            positive === true ? 'text-positive' : positive === false ? 'text-negative' : 'text-muted-foreground'
          }`}>
            {sub}
          </p>
        )}
        {loading && <Skeleton className="h-3.5 w-20 mt-1.5" />}
      </CardContent>
    </Card>
  )
}

export function DashboardClient({ profile, transactions, cashPositions }: Props) {
  const { currency, convert, format } = useCurrency()
  const [prices, setPrices] = useState<Record<string, {
    price: number; changePercent: number; currency: string; name: string | null
  }>>({})
  const [loadingPrices, setLoadingPrices] = useState(true)

  const { lots, realisedGains } = calculatePnL(transactions, profile?.tax_jurisdiction ?? 'UK')
  const holdings = getHoldings(transactions, lots)
  const tickers = holdings.map((h) => h.ticker)

  useEffect(() => {
    if (tickers.length === 0) { setLoadingPrices(false); return }
    fetch(`/api/prices?tickers=${tickers.join(',')}`)
      .then((r) => r.json())
      .then((d) => { setPrices(d.prices ?? {}); setLoadingPrices(false) })
      .catch(() => setLoadingPrices(false))
  }, [tickers.join(',')])

  // Compute portfolio metrics
  let totalValue = 0
  let totalCost = 0
  let dayChange = 0

  for (const h of holdings) {
    const p = prices[h.ticker]
    if (!p) continue
    const pc = p.currency as Currency
    const cur = convert(p.price * h.quantity, pc)
    const prev = convert((p.price / (1 + p.changePercent / 100)) * h.quantity, pc)
    totalValue += cur
    totalCost += convert(h.costBasis, h.currency)
    dayChange += cur - prev
  }

  let totalCash = 0
  for (const c of cashPositions) totalCash += convert(c.amount, c.currency as Currency)

  const totalUnrealised = totalValue - totalCost
  const totalUnrealisedPct = totalCost > 0 ? (totalUnrealised / totalCost) * 100 : 0
  const dayChangePct = (totalValue - dayChange) > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0
  const totalRealised = realisedGains.reduce((s, g) => s + convert(g.gain, g.currency), 0)
  const totalReturn = totalUnrealised + totalRealised
  const totalReturnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0

  // Best / worst performers
  const performers = holdings
    .map((h) => {
      const p = prices[h.ticker]
      if (!p) return null
      return { ticker: h.ticker, name: p.name ?? h.ticker, change: p.changePercent }
    })
    .filter(Boolean) as { ticker: string; name: string; change: number }[]

  const best = performers.sort((a, b) => b.change - a.change)[0]
  const worst = performers[performers.length - 1]

  // Recent transactions (last 5)
  const recent = [...transactions]
    .sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime())
    .slice(0, 5)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div className="space-y-7">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Here&apos;s your portfolio overview
        </p>
      </div>

      {/* KPI grid — 3 columns top row, then 3 more */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Portfolio Value — hero card */}
        <Card className="sm:col-span-2 xl:col-span-1 border-border">
          <CardContent className="pt-5 pb-4 px-5">
            <p className="stat-label">Portfolio Value</p>
            {loadingPrices ? (
              <Skeleton className="h-9 w-36 mt-2 mb-1" />
            ) : (
              <p className="text-3xl font-bold tracking-tight mt-1.5 tabular-nums">{format(totalValue)}</p>
            )}
            {loadingPrices ? (
              <Skeleton className="h-3.5 w-28 mt-1.5" />
            ) : (
              <p className={`text-xs mt-1.5 font-medium flex items-center gap-1 ${dayChange >= 0 ? 'text-positive' : 'text-negative'}`}>
                {dayChange >= 0
                  ? <ArrowUpRight className="h-3 w-3" />
                  : <ArrowDownRight className="h-3 w-3" />}
                {dayChange >= 0 ? '+' : ''}{format(dayChange)} today ({dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}%)
              </p>
            )}
          </CardContent>
        </Card>

        <StatCard
          label="Total Return"
          value={loadingPrices ? null : `${totalReturn >= 0 ? '+' : ''}${format(totalReturn)}`}
          sub={`${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(2)}% all time`}
          positive={totalReturn >= 0}
          loading={loadingPrices}
        />

        <StatCard
          label="Cash Invested"
          value={format(totalCost)}
          sub="Total cost basis"
        />

        <StatCard
          label="Unrealised P&L"
          value={loadingPrices ? null : `${totalUnrealised >= 0 ? '+' : ''}${format(totalUnrealised)}`}
          sub={`${totalUnrealisedPct >= 0 ? '+' : ''}${totalUnrealisedPct.toFixed(2)}% on open positions`}
          positive={totalUnrealised >= 0}
          loading={loadingPrices}
        />

        <StatCard
          label="Realised P&L"
          value={`${totalRealised >= 0 ? '+' : ''}${format(totalRealised)}`}
          sub={`${realisedGains.length} closed position${realisedGains.length !== 1 ? 's' : ''}`}
          positive={totalRealised >= 0}
        />

        <StatCard
          label="Cash Balance"
          value={format(totalCash)}
          sub={`${cashPositions.filter((c) => c.amount > 0).length} active currencies`}
        />
      </div>

      {/* Charts + performers row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Allocation chart */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Asset Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPrices ? (
              <div className="flex gap-6 items-center">
                <Skeleton className="h-48 w-48 rounded-full shrink-0" />
                <div className="space-y-2.5 flex-1">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-3.5 w-full" />)}
                </div>
              </div>
            ) : (
              <PortfolioChart
                holdings={holdings}
                prices={prices}
                currency={currency}
                convert={convert}
              />
            )}
          </CardContent>
        </Card>

        {/* Today's movers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Today&apos;s Movers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {loadingPrices ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center py-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ))
            ) : holdings.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No holdings yet</p>
                <p className="text-xs text-muted-foreground mt-1">Add a transaction to get started</p>
              </div>
            ) : (
              [...holdings]
                .filter((h) => prices[h.ticker])
                .sort((a, b) => (prices[b.ticker]?.changePercent ?? 0) - (prices[a.ticker]?.changePercent ?? 0))
                .map((h) => {
                  const p = prices[h.ticker]
                  if (!p) return null
                  const positive = p.changePercent >= 0
                  return (
                    <div key={h.ticker} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div>
                        <p className="text-sm font-semibold">{h.ticker}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(convert(p.price * h.quantity, p.currency as Currency))}
                        </p>
                      </div>
                      <Badge
                        className={`text-xs font-semibold ${
                          positive
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400'
                            : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400'
                        }`}
                        variant="outline"
                      >
                        {positive ? '+' : ''}{p.changePercent.toFixed(2)}%
                      </Badge>
                    </div>
                  )
                })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Best/Worst + Recent Trades row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Best / Worst performers */}
        <div className="grid grid-cols-2 gap-4">
          {best && (
            <Card className="border-green-200 bg-green-50/40 dark:border-green-900 dark:bg-green-950/20">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                  <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase tracking-wider">
                    Best Today
                  </p>
                </div>
                <p className="text-lg font-bold tracking-tight">{best.ticker}</p>
                <p className="text-xs text-green-600 font-semibold mt-0.5">+{best.change.toFixed(2)}%</p>
              </CardContent>
            </Card>
          )}
          {worst && worst.ticker !== best?.ticker && (
            <Card className="border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                  <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                    Worst Today
                  </p>
                </div>
                <p className="text-lg font-bold tracking-tight">{worst.ticker}</p>
                <p className="text-xs text-red-600 font-semibold mt-0.5">{worst.change.toFixed(2)}%</p>
              </CardContent>
            </Card>
          )}
          {(!best || !worst) && (
            <Card className="col-span-2 border-dashed">
              <CardContent className="pt-4 pb-4 text-center">
                <BarChart2 className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">No price data yet</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent trades */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent Trades
              </CardTitle>
              <a href="/transactions" className="text-xs text-[#2563EB] hover:underline font-medium">
                View all
              </a>
            </div>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="py-8 text-center">
                <RefreshCw className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No trades yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Import your transactions to see your performance
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {recent.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        tx.type === 'BUY'
                          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                          : 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                      }`}>
                        {tx.type === 'BUY' ? 'B' : 'S'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{tx.ticker}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {tx.quantity} shares · {formatDate(new Date(tx.executed_at), 'd MMM yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {format(tx.price * tx.quantity, tx.currency as Currency)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        @ {format(tx.price, tx.currency as Currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
