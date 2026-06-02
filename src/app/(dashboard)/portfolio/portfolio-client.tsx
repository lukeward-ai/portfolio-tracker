'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCurrency } from '@/lib/currency-context'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import { computeAllHoldingsFX, computePortfolioFxImpact } from '@/lib/fx-utils'
import { accountLabel } from '@/lib/portfolio-utils'
import { useTickerDrawer } from '@/lib/ticker-drawer-context'
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Building2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import type { Profile, Portfolio, Transaction, Currency } from '@/lib/types'

interface Props {
  profile: Profile | null
  portfolios: Portfolio[]
  transactions: Transaction[]
}

type PriceMap = Record<string, { price: number; changePercent: number; currency: string; name: string | null }>
type SortKey = 'ticker' | 'valueNative' | 'valueBase' | 'pnl' | 'pnlPct' | 'weight' | 'change' | 'dayChange'
type SortDir = 'asc' | 'desc'

function fmt(symbol: string, v: number) {
  return symbol + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function HoldingsTable({ transactions, prices, loading, profile, totalValue, currentRates }: {
  transactions: Transaction[]
  prices: PriceMap
  loading: boolean
  profile: Profile | null
  totalValue?: number
  currentRates: Record<string, number>
}) {
  const { convert, format } = useCurrency()
  const { openTicker } = useTickerDrawer()
  const [sortKey, setSortKey] = useState<SortKey>('valueBase')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const jurisdiction = profile?.tax_jurisdiction ?? 'UK'
  const { lots } = calculatePnL(transactions, jurisdiction)
  const holdings = getHoldings(transactions, lots)

  const baseCurrency = profile?.base_currency ?? 'GBP'
  const baseSymbol = baseCurrency === 'GBP' ? '£' : baseCurrency === 'USD' ? '$' : '€'

  const fxData = useMemo(() => {
    if (Object.keys(prices).length === 0) return {}
    const arr = computeAllHoldingsFX(
      lots,
      transactions as Parameters<typeof computeAllHoldingsFX>[1],
      Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, { price: v.price, currency: v.currency }])),
      currentRates,
      jurisdiction,
      baseCurrency,
    )
    return Object.fromEntries(arr.map((d) => [d.ticker, d]))
  }, [lots, transactions, prices, currentRates, jurisdiction, baseCurrency])

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

  const rawRows = holdings.map((h) => {
    const p = prices[h.ticker]
    const fx = fxData[h.ticker]
    const nativeCurrency = fx?.nativeCurrency ?? (p?.currency ?? h.currency).toUpperCase()
    const nativeSym = nativeCurrency === 'GBP' ? '£' : nativeCurrency === 'EUR' ? '€' : '$'

    const currentValueNative = fx?.currentValueNative ?? (p ? p.price * h.quantity : null)
    const currentValueBase = fx?.currentValueBase ?? null
    const costBasisBase = fx?.costBasisBase ?? convert(h.costBasis, h.currency)
    const basePnl = currentValueBase !== null ? currentValueBase - costBasisBase : null
    const basePnlPct = costBasisBase > 0 && basePnl !== null ? (basePnl / costBasisBase) * 100 : null

    // 24h change calculations
    const priceChangeNative = p ? p.price - p.price / (1 + p.changePercent / 100) : null
    const positionChangeNative = priceChangeNative !== null ? priceChangeNative * h.quantity : null
    const positionChangeBase = positionChangeNative !== null
      ? convert(positionChangeNative, nativeCurrency as Currency)
      : null

    return {
      ...h,
      p,
      nativeCurrency,
      nativeSym,
      currentValueNative,
      currentValueBase,
      costBasisBase,
      basePnl,
      basePnlPct,
      fxImpact: fx?.fxImpact ?? null,
      priceChangeNative,
      positionChangeNative,
      positionChangeBase,
    }
  })

  const tv = totalValue ?? rawRows.reduce((s, r) => s + (r.currentValueBase ?? 0), 0)

  const rows = [...rawRows].sort((a, b) => {
    let diff = 0
    if (sortKey === 'ticker') diff = a.ticker.localeCompare(b.ticker)
    else if (sortKey === 'valueNative') diff = (a.currentValueNative ?? 0) - (b.currentValueNative ?? 0)
    else if (sortKey === 'valueBase') diff = (a.currentValueBase ?? 0) - (b.currentValueBase ?? 0)
    else if (sortKey === 'pnl') diff = (a.basePnl ?? 0) - (b.basePnl ?? 0)
    else if (sortKey === 'pnlPct') diff = (a.basePnlPct ?? 0) - (b.basePnlPct ?? 0)
    else if (sortKey === 'weight') diff = (a.currentValueBase ?? 0) - (b.currentValueBase ?? 0)
    else if (sortKey === 'change') diff = (a.p?.changePercent ?? 0) - (b.p?.changePercent ?? 0)
    else if (sortKey === 'dayChange') diff = (a.positionChangeBase ?? 0) - (b.positionChangeBase ?? 0)
    return sortDir === 'asc' ? diff : -diff
  })

  // Footer totals
  const totalValueNative = rows.reduce((s, r) => s + (r.currentValueNative ?? 0), 0)
  const totalValueBase = rows.reduce((s, r) => s + (r.currentValueBase ?? 0), 0)
  const totalCostBase = rows.reduce((s, r) => s + r.costBasisBase, 0)
  const totalBasePnl = rows.reduce((s, r) => s + (r.basePnl ?? 0), 0)
  const totalBasePnlPct = totalCostBase > 0 ? (totalBasePnl / totalCostBase) * 100 : 0

  // Determine native currency label for header (mixed = "$" fallback)
  const nativeCurrencies = [...new Set(rows.map((r) => r.nativeCurrency))]
  const nativeLabel = nativeCurrencies.length === 1
    ? (nativeCurrencies[0] === 'GBP' ? '£' : nativeCurrencies[0] === 'EUR' ? '€' : '$')
    : '$'

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
          <TableHead className="pl-6 cursor-pointer hover:text-foreground" onClick={() => handleSort('ticker')}>
            Symbol <SortIcon col="ticker" />
          </TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('dayChange')}>
            Today <SortIcon col="dayChange" />
          </TableHead>
          <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('valueNative')}>
            Value {nativeLabel} <SortIcon col="valueNative" />
          </TableHead>
          <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('valueBase')}>
            Value {baseSymbol} <SortIcon col="valueBase" />
          </TableHead>
          <TableHead className="text-right">
            Cost {baseSymbol} (hist.)
          </TableHead>
          <TableHead className="text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('pnl')}>
            Profit {baseSymbol} <SortIcon col="pnl" />
          </TableHead>
          <TableHead className="text-right pr-6 cursor-pointer hover:text-foreground" onClick={() => handleSort('weight')}>
            Weight <SortIcon col="weight" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <TableRow key={i} className="border-border">
              {Array.from({ length: 8 }).map((_, j) => (
                <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          rows.map((row) => {
            const weight = tv > 0 && row.currentValueBase ? (row.currentValueBase / tv) * 100 : 0
            const pnlPos = (row.basePnl ?? 0) >= 0
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
                {/* Price — clean, no badge */}
                <TableCell className="text-right">
                  {row.p
                    ? <span className="text-sm tabular-nums">{fmt(row.nativeSym, row.p.price)}</span>
                    : <span className="text-muted-foreground text-sm">—</span>}
                </TableCell>

                {/* Today: % | $/share | position $ */}
                <TableCell className="text-right">
                  {row.p && row.priceChangeNative !== null ? (
                    <div className="flex flex-col items-end gap-0.5">
                      {/* Market % */}
                      <span className={`text-xs font-bold tabular-nums ${row.p.changePercent >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {row.p.changePercent >= 0 ? '+' : ''}{row.p.changePercent.toFixed(2)}%
                      </span>
                      {/* Per-share change */}
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {row.priceChangeNative >= 0 ? '+' : ''}{fmt(row.nativeSym, row.priceChangeNative)}/sh
                      </span>
                      {/* Position change in base currency */}
                      {row.positionChangeBase !== null && (
                        <span className={`text-xs font-semibold tabular-nums ${row.positionChangeBase >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {row.positionChangeBase >= 0 ? '+' : ''}{fmt(baseSymbol, row.positionChangeBase)}
                        </span>
                      )}
                    </div>
                  ) : <span className="text-muted-foreground text-sm">—</span>}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums font-medium">
                  {row.currentValueNative !== null ? fmt(row.nativeSym, row.currentValueNative) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums font-medium">
                  {row.currentValueBase !== null ? fmt(baseSymbol, row.currentValueBase) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                  {fmt(baseSymbol, row.costBasisBase)}
                </TableCell>
                <TableCell className="text-right">
                  {row.basePnl !== null ? (
                    <div className={`flex flex-col items-end gap-0.5 ${pnlPos ? 'text-positive' : 'text-negative'}`}>
                      <div className="flex items-center gap-0.5 text-sm font-medium tabular-nums">
                        {pnlPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {pnlPos ? '+' : ''}{fmt(baseSymbol, row.basePnl)}
                      </div>
                      <p className="text-[11px]">{row.basePnlPct !== null ? (row.basePnlPct >= 0 ? '+' : '') + row.basePnlPct.toFixed(2) + '%' : ''}</p>
                    </div>
                  ) : <span className="text-muted-foreground text-sm">—</span>}
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
      {!loading && rows.length > 0 && (
        <tfoot>
          <TableRow className="border-t-2 border-border bg-muted/30 font-semibold hover:bg-muted/30">
            <TableCell className="pl-6 text-sm" colSpan={3}>Total</TableCell>
            <TableCell className="text-right text-sm tabular-nums" colSpan={1} />
            <TableCell className="text-right text-sm tabular-nums">{fmt(nativeLabel, totalValueNative)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums">{fmt(baseSymbol, totalValueBase)}</TableCell>
            <TableCell className="text-right text-sm tabular-nums text-muted-foreground">{fmt(baseSymbol, totalCostBase)}</TableCell>
            <TableCell className="text-right">
              <div className={`flex flex-col items-end gap-0.5 ${totalBasePnl >= 0 ? 'text-positive' : 'text-negative'}`}>
                <div className="flex items-center gap-0.5 text-sm font-semibold tabular-nums">
                  {totalBasePnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {totalBasePnl >= 0 ? '+' : ''}{fmt(baseSymbol, totalBasePnl)}
                </div>
                <p className="text-[11px]">{totalBasePnlPct >= 0 ? '+' : ''}{totalBasePnlPct.toFixed(2)}%</p>
              </div>
            </TableCell>
            <TableCell className="text-right text-sm pr-6">100%</TableCell>
          </TableRow>
        </tfoot>
      )}
    </Table>
  )
}

export function PortfolioClient({ profile, portfolios, transactions }: Props) {
  const { convert, format } = useCurrency()
  const [prices, setPrices] = useState<PriceMap>({})
  const [loading, setLoading] = useState(true)
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
        setCurrentRates(d.rates ?? {})
      })
      .catch(() => {})
  }, [])

  const baseCurrencyOuter = profile?.base_currency ?? 'GBP'
  const baseSymbolOuter = baseCurrencyOuter === 'GBP' ? '£' : baseCurrencyOuter === 'USD' ? '$' : '€'

  const fxBreakdown = useMemo(() => {
    if (Object.keys(prices).length === 0) return []
    return computeAllHoldingsFX(
      lots,
      transactions as Parameters<typeof computeAllHoldingsFX>[1],
      Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, { price: v.price, currency: v.currency }])),
      currentRates,
      jurisdiction,
      baseCurrencyOuter,
    )
  }, [lots, transactions, prices, currentRates, jurisdiction, baseCurrencyOuter])

  const totalFxImpact = computePortfolioFxImpact(fxBreakdown)

  // Overall totals
  let totalValue = 0
  let totalCost = 0
  let pricedCost = 0
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Portfolio</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your holdings across all accounts</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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

        <Card className="border-border">
          <CardContent className="pt-5 pb-4 px-5">
            <p className="stat-label">Currency Appreciation</p>
            {loading ? <Skeleton className="h-7 w-28 mt-2 mb-1" /> : (
              <p className={`stat-value mt-1.5 ${totalFxImpact >= 0 ? 'text-positive' : 'text-negative'}`}>
                {totalFxImpact >= 0 ? '+' : ''}{baseSymbolOuter + Math.abs(totalFxImpact).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
            <p className="text-xs mt-1 text-muted-foreground">
              FX movement since purchase
            </p>
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
                currentRates={currentRates}
              />
              {/* Summary panel */}
              {!loading && (
                <div className="border-t-2 border-border grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
                  {/* Today's change */}
                  <div className={`px-6 py-4 ${totalDayChange >= 0 ? 'bg-green-50/50' : 'bg-red-50/50'}`}>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Today</p>
                    <p className={`text-xl font-bold tabular-nums ${totalDayChange >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {totalDayChange >= 0 ? '+' : ''}{format(totalDayChange)}
                    </p>
                    <p className={`text-xs font-semibold mt-0.5 ${totalDayChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}% on open
                    </p>
                  </div>

                  {/* Unrealised P&L */}
                  <div className="px-6 py-4">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Unrealised P&L</p>
                    <p className={`text-xl font-bold tabular-nums ${totalPnL >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {totalPnL >= 0 ? '+' : ''}{format(totalPnL)}
                    </p>
                    <p className={`text-xs font-semibold mt-0.5 ${totalPnL >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}% on cost
                    </p>
                  </div>

                  {/* FX impact */}
                  <div className="px-6 py-4">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Currency Impact</p>
                    <p className={`text-xl font-bold tabular-nums ${totalFxImpact >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {totalFxImpact >= 0 ? '+' : ''}{baseSymbolOuter}{Math.abs(totalFxImpact).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">FX movement since purchase</p>
                  </div>

                  {/* Net total gain */}
                  {(() => {
                    const net = totalPnL + totalFxImpact
                    const netPct = totalCost > 0 ? (net / totalCost) * 100 : 0
                    return (
                      <div className={`px-6 py-4 ${net >= 0 ? 'bg-green-50/30' : 'bg-red-50/30'}`}>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Net Total Gain</p>
                        <p className={`text-xl font-bold tabular-nums ${net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {net >= 0 ? '+' : ''}{format(net)}
                        </p>
                        <p className={`text-xs font-semibold mt-0.5 ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {netPct >= 0 ? '+' : ''}{netPct.toFixed(2)}% incl. FX
                        </p>
                      </div>
                    )
                  })()}
                </div>
              )}
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
