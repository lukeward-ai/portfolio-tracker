'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCurrency } from '@/lib/currency-context'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import { accountLabel } from '@/lib/portfolio-utils'
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Building2 } from 'lucide-react'
import type { Profile, Portfolio, Transaction, Currency } from '@/lib/types'

interface Props {
  profile: Profile | null
  portfolios: Portfolio[]
  transactions: Transaction[]
}

type PriceMap = Record<string, { price: number; changePercent: number; currency: string; name: string | null }>

function HoldingsTable({ transactions, prices, loading, profile, totalValue }: {
  transactions: Transaction[]
  prices: PriceMap
  loading: boolean
  profile: Profile | null
  totalValue?: number
}) {
  const { convert, format } = useCurrency()
  const { lots } = calculatePnL(transactions, profile?.tax_jurisdiction ?? 'UK')
  const holdings = getHoldings(transactions, lots)

  let localTotal = 0
  let localCost = 0

  const rows = holdings.map((h) => {
    const p = prices[h.ticker]
    const priceCur = (p?.currency ?? h.currency) as Currency
    const currentValue = p ? convert(p.price * h.quantity, priceCur) : null
    const cost = convert(h.costBasis, h.currency)
    const unrealisedPnL = currentValue !== null ? currentValue - cost : null
    const unrealisedPnLPct = cost > 0 && unrealisedPnL !== null ? (unrealisedPnL / cost) * 100 : null
    if (currentValue !== null) localTotal += currentValue
    localCost += cost
    return { ...h, p, currentValue, cost, unrealisedPnL, unrealisedPnLPct, priceCur }
  })

  const tv = totalValue ?? localTotal

  if (holdings.length === 0 && !loading) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">No holdings in this account</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <TableHead className="pl-6">Symbol</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Avg Cost</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Market Value</TableHead>
          <TableHead className="text-right">Unrealised P&L</TableHead>
          <TableHead className="text-right pr-6">Weight</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i} className="border-border">
              {Array.from({ length: 7 }).map((_, j) => (
                <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          rows.map((row) => {
            const weight = tv > 0 && row.currentValue ? (row.currentValue / tv) * 100 : 0
            const positive = (row.unrealisedPnL ?? 0) >= 0
            return (
              <TableRow key={row.ticker} className="border-border">
                <TableCell className="pl-6">
                  <div>
                    <p className="font-semibold text-sm">{row.ticker}</p>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{row.p?.name ?? row.name}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{row.quantity.toFixed(4)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{format(row.avgCost, row.currency)}</TableCell>
                <TableCell className="text-right">
                  {row.p ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-sm tabular-nums">{format(row.p.price, row.priceCur)}</span>
                      <Badge
                        className={`text-[10px] font-semibold px-1.5 py-0 ${
                          row.p.changePercent >= 0
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400'
                            : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400'
                        }`}
                        variant="outline"
                      >
                        {row.p.changePercent >= 0 ? '+' : ''}{row.p.changePercent.toFixed(2)}%
                      </Badge>
                    </div>
                  ) : <span className="text-muted-foreground text-sm">—</span>}
                </TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums">
                  {row.currentValue !== null ? format(row.currentValue) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  {row.unrealisedPnL !== null ? (
                    <div className={`flex flex-col items-end gap-0.5 ${positive ? 'text-positive' : 'text-negative'}`}>
                      <div className="flex items-center gap-0.5 text-sm font-medium tabular-nums">
                        {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {positive ? '+' : ''}{format(row.unrealisedPnL)}
                      </div>
                      <p className="text-[11px]">{row.unrealisedPnLPct?.toFixed(2)}%</p>
                    </div>
                  ) : <span className="text-muted-foreground text-right block text-sm">—</span>}
                </TableCell>
                <TableCell className="text-right text-sm pr-6">
                  <div className="flex flex-col items-end gap-1">
                    <span className="tabular-nums">{weight.toFixed(1)}%</span>
                    <div className="w-14 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${weight}%` }} />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

export function PortfolioClient({ profile, portfolios, transactions }: Props) {
  const { convert, format } = useCurrency()
  const [prices, setPrices] = useState<PriceMap>({})
  const [loading, setLoading] = useState(true)

  const { lots } = calculatePnL(transactions, profile?.tax_jurisdiction ?? 'UK')
  const holdings = getHoldings(transactions, lots)
  const tickers = holdings.map((h) => h.ticker)

  useEffect(() => {
    if (tickers.length === 0) { setLoading(false); return }
    fetch(`/api/prices?tickers=${tickers.join(',')}`)
      .then((r) => r.json())
      .then((d) => { setPrices(d.prices ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tickers.join(',')])

  // Overall totals
  let totalValue = 0
  let totalCost = 0
  let totalDayChange = 0
  for (const h of holdings) {
    const p = prices[h.ticker]
    if (!p) continue
    const priceCur = p.currency as Currency
    const cv = convert(p.price * h.quantity, priceCur)
    const prev = convert((p.price / (1 + p.changePercent / 100)) * h.quantity, priceCur)
    totalValue += cv
    totalCost += convert(h.costBasis, h.currency)
    totalDayChange += cv - prev
  }

  const totalPnL = totalValue - totalCost
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0
  const dayChangePct = (totalValue - totalDayChange) > 0 ? (totalDayChange / (totalValue - totalDayChange)) * 100 : 0

  // Per-account totals
  const accountSummaries = portfolios.map((portfolio) => {
    const ptx = transactions.filter((t) => t.portfolio_id === portfolio.id)
    const { lots: plots } = calculatePnL(ptx, profile?.tax_jurisdiction ?? 'UK')
    const pHoldings = getHoldings(ptx, plots)
    let pValue = 0
    let pCost = 0
    for (const h of pHoldings) {
      const p = prices[h.ticker]
      if (!p) continue
      pValue += convert(p.price * h.quantity, p.currency as Currency)
      pCost += convert(h.costBasis, h.currency)
    }
    return { portfolio, value: pValue, cost: pCost, txCount: ptx.length }
  }).filter((s) => s.txCount > 0)

  return (
    <div className="space-y-7">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Portfolio</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your holdings across all accounts</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="pt-5 pb-4 px-5">
            <p className="stat-label">Total Value</p>
            {loading ? (
              <Skeleton className="h-9 w-32 mt-2" />
            ) : (
              <p className="text-3xl font-bold tracking-tight mt-1.5 tabular-nums">{format(totalValue)}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5 pb-4 px-5">
            <p className="stat-label">Total P&L</p>
            {loading ? <Skeleton className="h-7 w-28 mt-2 mb-1" /> : (
              <p className={`stat-value mt-1.5 ${totalPnL >= 0 ? 'text-positive' : 'text-negative'}`}>
                {totalPnL >= 0 ? '+' : ''}{format(totalPnL)}
              </p>
            )}
            {!loading && (
              <p className={`text-xs mt-1 font-medium flex items-center gap-0.5 ${totalPnL >= 0 ? 'text-positive' : 'text-negative'}`}>
                {totalPnL >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}% all time
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="pt-5 pb-4 px-5">
            <p className="stat-label">Today&apos;s Change</p>
            {loading ? <Skeleton className="h-7 w-28 mt-2 mb-1" /> : (
              <p className={`stat-value mt-1.5 ${totalDayChange >= 0 ? 'text-positive' : 'text-negative'}`}>
                {totalDayChange >= 0 ? '+' : ''}{format(totalDayChange)}
              </p>
            )}
            {!loading && (
              <p className={`text-xs mt-1 font-medium flex items-center gap-0.5 ${totalDayChange >= 0 ? 'text-positive' : 'text-negative'}`}>
                {totalDayChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}% today
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all">
        <TabsList className="h-9">
          <TabsTrigger value="all" className="text-xs">All Holdings</TabsTrigger>
          <TabsTrigger value="by-account" className="text-xs">By Account</TabsTrigger>
        </TabsList>

        {/* All holdings tab */}
        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <HoldingsTable
                transactions={transactions}
                prices={prices}
                loading={loading}
                profile={profile}
                totalValue={totalValue}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* By account tab */}
        <TabsContent value="by-account" className="mt-4 space-y-4">
          {accountSummaries.length === 0 && !loading && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No holdings yet</p>
              </CardContent>
            </Card>
          )}
          {accountSummaries.map(({ portfolio, value, cost }) => {
            const pnl = value - cost
            const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
            const ptx = transactions.filter((t) => t.portfolio_id === portfolio.id)
            return (
              <Card key={portfolio.id}>
                <CardHeader className="pb-0 pt-5 px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-[#2563EB]/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-[#2563EB]" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm leading-none">{accountLabel(portfolio)}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{ptx.length} trade{ptx.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {loading ? (
                        <Skeleton className="h-5 w-24" />
                      ) : (
                        <>
                          <p className="text-base font-bold tabular-nums">{format(value)}</p>
                          <p className={`text-xs font-medium ${pnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                            {pnl >= 0 ? '+' : ''}{format(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 mt-3">
                  <HoldingsTable
                    transactions={ptx}
                    prices={prices}
                    loading={loading}
                    profile={profile}
                    totalValue={value}
                  />
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>
      </Tabs>
    </div>
  )
}
