'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCurrency } from '@/lib/currency-context'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import { computeAllHoldingsFX } from '@/lib/fx-utils'
import { accountLabel } from '@/lib/portfolio-utils'
import { useTickerDrawer } from '@/lib/ticker-drawer-context'
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Building2, ArrowUpDown, ArrowUp, ArrowDown, DollarSign } from 'lucide-react'
import type { Profile, Portfolio, Transaction, Currency } from '@/lib/types'

interface Props {
  profile: Profile | null
  portfolios: Portfolio[]
  transactions: Transaction[]
}

type PriceMap = Record<string, { price: number; changePercent: number; currency: string; name: string | null }>
type SortKey = 'ticker' | 'value' | 'pnl' | 'pnlPct' | 'weight' | 'change'
type SortDir = 'asc' | 'desc'

function HoldingsTable({ transactions, prices, loading, profile, totalValue, fxMode, currentRates }: {
  transactions: Transaction[]
  prices: PriceMap
  loading: boolean
  profile: Profile | null
  totalValue?: number
  fxMode: boolean
  currentRates: Record<string, number>
}) {
  const { convert, format } = useCurrency()
  const { openTicker } = useTickerDrawer()
  const [sortKey, setSortKey] = useState<SortKey>('value')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const jurisdiction = profile?.tax_jurisdiction ?? 'UK'
  const { lots } = calculatePnL(transactions, jurisdiction)
  const holdings = getHoldings(transactions, lots)

  const baseCurrency = profile?.base_currency ?? 'GBP'

  const fxData = useMemo(() => {
    if (!fxMode) return {}
    const arr = computeAllHoldingsFX(
      lots,
      transactions as Parameters<typeof computeAllHoldingsFX>[1],
      Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, { price: v.price, currency: v.currency }])),
      currentRates,
      jurisdiction,
      baseCurrency,
    )
    return Object.fromEntries(arr.map((d) => [d.ticker, d]))
  }, [fxMode, lots, transactions, prices, currentRates, jurisdiction, baseCurrency])

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

  let localTotal = 0
  let localCost = 0

  const rawRows = holdings.map((h) => {
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

  const rows = [...rawRows].sort((a, b) => {
    let diff = 0
    if (sortKey === 'ticker') diff = a.ticker.localeCompare(b.ticker)
    else if (sortKey === 'value') diff = (a.currentValue ?? 0) - (b.currentValue ?? 0)
    else if (sortKey === 'pnl') diff = (a.unrealisedPnL ?? 0) - (b.unrealisedPnL ?? 0)
    else if (sortKey === 'pnlPct') diff = (a.unrealisedPnLPct ?? 0) - (b.unrealisedPnLPct ?? 0)
    else if (sortKey === 'weight') diff = (a.currentValue ?? 0) - (b.currentValue ?? 0)
    else if (sortKey === 'change') diff = (a.p?.changePercent ?? 0) - (b.p?.changePercent ?? 0)
    return sortDir === 'asc' ? diff : -diff
  })

  if (holdings.length === 0 && !loading) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">No holdings in this account</p>
      </div>
    )
  }

  const baseSymbol = baseCurrency === 'GBP' ? '£' : baseCurrency === 'USD' ? '$' : '€'
  const nativeFmt = (v: number, cur: string) => {
    const sym = cur === 'GBP' ? '£' : cur === 'EUR' ? '€' : '$'
    return sym + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  const baseFmt = (v: number) => baseSymbol + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <TableHead className="pl-6 cursor-pointer hover:text-foreground" onClick={() => handleSort('ticker')}>
            Symbol <SortIcon col="ticker" />
          </TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Avg Cost</TableHead>
          <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('change')}>
            Price <SortIcon col="change" />
          </TableHead>
          <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('value')}>
            {fxMode ? `Value USD / ${baseCurrency}` : 'Market Value'} <SortIcon col="value" />
          </TableHead>
          {fxMode ? (
            <>
              <TableHead className="text-right">Cost {baseCurrency} (hist.)</TableHead>
              <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('pnl')}>
                {baseCurrency} P&L <SortIcon col="pnl" />
              </TableHead>
              <TableHead className="text-right">FX Impact</TableHead>
            </>
          ) : (
            <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('pnl')}>
              Unrealised P&L <SortIcon col="pnl" />
            </TableHead>
          )}
          <TableHead className="text-right pr-6 cursor-pointer hover:text-foreground" onClick={() => handleSort('weight')}>
            Weight <SortIcon col="weight" />
          </TableHead>
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
                    <button
                      className="font-semibold text-sm hover:text-[#2563EB] transition-colors"
                      onClick={() => openTicker(row.ticker)}
                    >
                      {row.ticker}
                    </button>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{row.p?.name ?? row.name}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{row.quantity.toFixed(4)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {fxMode && fxData[row.ticker] ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <span>{nativeFmt(fxData[row.ticker].costBasisNative / row.quantity, fxData[row.ticker].nativeCurrency)}</span>
                      <span className="text-[11px] text-muted-foreground">{baseFmt(fxData[row.ticker].costBasisBase / row.quantity)} hist.</span>
                    </div>
                  ) : (
                    format(row.avgCost, row.currency)
                  )}
                </TableCell>
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
                {/* Market Value column */}
                <TableCell className="text-right text-sm font-medium tabular-nums">
                  {fxMode && fxData[row.ticker] ? (
                    fxData[row.ticker].currentValueNative !== null ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span>{nativeFmt(fxData[row.ticker].currentValueNative!, fxData[row.ticker].nativeCurrency)}</span>
                        <span className="text-[11px] text-muted-foreground">{baseFmt(fxData[row.ticker].currentValueBase!)}</span>
                      </div>
                    ) : <span className="text-muted-foreground">—</span>
                  ) : (
                    row.currentValue !== null ? format(row.currentValue) : <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                {/* FX mode extra columns */}
                {fxMode ? (
                  <>
                    <TableCell className="text-right text-sm tabular-nums">
                      {fxData[row.ticker] ? baseFmt(fxData[row.ticker].costBasisBase) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {fxData[row.ticker]?.currentValueBase != null ? (() => {
                        const basePnl = fxData[row.ticker].currentValueBase! - fxData[row.ticker].costBasisBase
                        const basePnlPct = fxData[row.ticker].costBasisBase > 0 ? (basePnl / fxData[row.ticker].costBasisBase) * 100 : 0
                        const pos = basePnl >= 0
                        return (
                          <div className={`flex flex-col items-end gap-0.5 ${pos ? 'text-positive' : 'text-negative'}`}>
                            <div className="flex items-center gap-0.5 text-sm font-medium tabular-nums">
                              {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {pos ? '+' : ''}{baseFmt(basePnl)}
                            </div>
                            <p className="text-[11px]">{basePnlPct.toFixed(2)}%</p>
                          </div>
                        )
                      })() : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {fxData[row.ticker]?.fxImpact != null ? (() => {
                        const fx = fxData[row.ticker].fxImpact!
                        const pos = fx >= 0
                        return (
                          <span className={`text-sm font-medium tabular-nums ${pos ? 'text-positive' : 'text-negative'}`}>
                            {pos ? '+' : ''}{baseFmt(fx)}
                          </span>
                        )
                      })() : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                  </>
                ) : (
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
                )}
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
  const [fxMode, setFxMode] = useState(false)
  const [currentRates, setCurrentRates] = useState<Record<string, number>>({})

  const jurisdiction = profile?.tax_jurisdiction ?? 'UK'
  const { lots } = calculatePnL(transactions, jurisdiction)
  const holdings = getHoldings(transactions, lots)
  const tickers = holdings.map((h) => h.ticker)

  useEffect(() => {
    if (tickers.length === 0) { setLoading(false); return }
    fetch(`/api/prices?tickers=${tickers.join(',')}`)
      .then((r) => r.json())
      .then((d) => { setPrices(d.prices ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tickers.join(',')])

  useEffect(() => {
    fetch('/api/exchange-rates')
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, number> = {}
        for (const r of d.rates ?? []) map[`${r.base}_${r.target}`] = r.rate
        setCurrentRates(map)
      })
      .catch(() => {})
  }, [])

  const baseCurrencyOuter = profile?.base_currency ?? 'GBP'
  const baseSymbolOuter = baseCurrencyOuter === 'GBP' ? '£' : baseCurrencyOuter === 'USD' ? '$' : '€'

  const fxBreakdown = useMemo(() => {
    if (!fxMode || Object.keys(prices).length === 0) return []
    return computeAllHoldingsFX(
      lots,
      transactions as Parameters<typeof computeAllHoldingsFX>[1],
      Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, { price: v.price, currency: v.currency }])),
      currentRates,
      jurisdiction,
      baseCurrencyOuter,
    )
  }, [fxMode, lots, transactions, prices, currentRates, jurisdiction, baseCurrencyOuter])

  const totalFxImpact = fxBreakdown.reduce((s, h) => s + (h.fxImpact ?? 0), 0)

  // Overall totals
  let totalValue = 0
  let totalCost = 0    // all open holdings (cost basis regardless of price availability)
  let pricedCost = 0   // only holdings with a live price (for unrealised P&L)
  let totalDayChange = 0
  for (const h of holdings) {
    totalCost += convert(h.costBasis, h.currency)

    const p = prices[h.ticker]
    if (!p) continue
    const priceCur = p.currency as Currency
    const cv = convert(p.price * h.quantity, priceCur)
    const prev = convert((p.price / (1 + p.changePercent / 100)) * h.quantity, priceCur)
    totalValue += cv
    pricedCost += convert(h.costBasis, h.currency)
    totalDayChange += cv - prev
  }

  const totalPnL = totalValue - pricedCost
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0
  const dayChangePct = (totalValue - totalDayChange) > 0 ? (totalDayChange / (totalValue - totalDayChange)) * 100 : 0

  // Per-account totals
  const accountSummaries = portfolios.map((portfolio) => {
    const ptx = transactions.filter((t) => t.portfolio_id === portfolio.id)
    const { lots: plots } = calculatePnL(ptx, profile?.tax_jurisdiction ?? 'UK')
    const pHoldings = getHoldings(ptx, plots)
    let pValue = 0
    let pCost = 0
    let pPricedCost = 0
    for (const h of pHoldings) {
      pCost += convert(h.costBasis, h.currency)
      const p = prices[h.ticker]
      if (!p) continue
      pValue += convert(p.price * h.quantity, p.currency as Currency)
      pPricedCost += convert(h.costBasis, h.currency)
    }
    return { portfolio, value: pValue, cost: pCost, pricedCost: pPricedCost, txCount: ptx.length }
  }).filter((s) => s.txCount > 0)

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your holdings across all accounts</p>
        </div>
        <button
          onClick={() => setFxMode((v) => !v)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all shrink-0 ${
            fxMode
              ? 'bg-[#2563EB] text-white border-[#2563EB]'
              : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
          }`}
        >
          <DollarSign className="h-3.5 w-3.5" />
          FX View
        </button>
      </div>

      {/* KPI cards */}
      <div className={`grid grid-cols-1 gap-4 ${fxMode ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
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

        {fxMode && (
          <Card className="border-border">
            <CardContent className="pt-5 pb-4 px-5">
              <p className="stat-label">FX Impact (EUR)</p>
              {loading ? <Skeleton className="h-7 w-28 mt-2 mb-1" /> : (
                <p className={`stat-value mt-1.5 ${totalFxImpact >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {totalFxImpact >= 0 ? '+' : ''}{baseSymbolOuter + Math.abs(totalFxImpact).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-xs mt-1 text-muted-foreground">
                USD/EUR movement since purchase
              </p>
            </CardContent>
          </Card>
        )}
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
                fxMode={fxMode}
                currentRates={currentRates}
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
          {accountSummaries.map(({ portfolio, value, cost: aCost, pricedCost: aPricedCost }) => {
            const pnl = value - aPricedCost
            const pnlPct = aCost > 0 ? (pnl / aCost) * 100 : 0
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
                    fxMode={fxMode}
                    currentRates={currentRates}
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
