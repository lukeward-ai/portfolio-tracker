'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCurrency } from '@/lib/currency-context'
import { calculatePnL } from '@/lib/pnl'
import { accountLabel } from '@/lib/portfolio-utils'
import { useTickerDrawer } from '@/lib/ticker-drawer-context'
import { SoldPositionDrawer, type SellEvent } from './sold-position-drawer'
import {
  TrendingUp, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown,
  DollarSign, Package, ChevronRight,
} from 'lucide-react'
import { format as formatDate, differenceInDays } from 'date-fns'
import type { Profile, Portfolio, Transaction, Currency, TaxJurisdiction } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  profile: Profile | null
  transactions: Transaction[]
  portfolios: Portfolio[]
}

type SortKey = 'gain' | 'gainPct' | 'proceeds' | 'soldAt' | 'ticker'
type SortDir = 'asc' | 'desc'

function holdingLabel(days: number | null): string {
  if (days == null || days < 0) return '—'
  if (days === 0) return 'Same day'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${(days / 365).toFixed(1)}y`
}

export function SoldPositionsClient({ profile, transactions, portfolios }: Props) {
  const { format, convert } = useCurrency()
  const { openTicker } = useTickerDrawer()
  const [sortKey, setSortKey] = useState<SortKey>('soldAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterPortfolio, setFilterPortfolio] = useState<string>('ALL')
  const [filterWin, setFilterWin] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL')
  const [selectedEvent, setSelectedEvent] = useState<SellEvent | null>(null)

  const jurisdiction = (profile?.tax_jurisdiction ?? 'UK') as TaxJurisdiction
  const { realisedGains } = calculatePnL(transactions, jurisdiction)

  const portfolioMap = Object.fromEntries(portfolios.map((p) => [p.id, p]))

  // Group individual FIFO lot matches by ticker + soldAt to create sell events
  const sellEventMap = new Map<string, SellEvent>()

  for (const g of realisedGains) {
    const key = `${g.ticker}::${g.soldAt}`
    const existing = sellEventMap.get(key)

    // Find the sell transaction for portfolio lookup
    const sellTx = transactions.find(
      (t) => t.type === 'SELL' && t.ticker === g.ticker &&
        t.executed_at.slice(0, 10) === g.soldAt.slice(0, 10)
    )
    const portfolio = sellTx ? portfolioMap[sellTx.portfolio_id] : null

    // Find company name from any buy transaction
    const nameTx = transactions.find((t) => t.ticker === g.ticker && t.name)

    // Compute holding days from earliest lot acquiredAt in this group
    const holdingDays = g.acquiredAt && g.soldAt
      ? differenceInDays(new Date(g.soldAt), new Date(g.acquiredAt))
      : null

    if (!existing) {
      sellEventMap.set(key, {
        ticker: g.ticker,
        companyName: nameTx?.name ?? null,
        soldAt: g.soldAt,
        currency: g.currency,
        portfolioId: sellTx?.portfolio_id ?? null,
        portfolioName: portfolio ? accountLabel(portfolio) : null,
        totalQuantity: g.quantity,
        totalProceeds: g.proceeds,
        totalCostBasis: g.costBasis,
        totalGain: g.gain,
        gainPct: 0, // recalculated below
        holdingDays,
        lots: [{ acquiredAt: g.acquiredAt, quantity: g.quantity, costBasis: g.costBasis, proceeds: g.proceeds, gain: g.gain }],
        jurisdiction,
      })
    } else {
      existing.totalQuantity += g.quantity
      existing.totalProceeds += g.proceeds
      existing.totalCostBasis += g.costBasis
      existing.totalGain += g.gain
      existing.lots.push({ acquiredAt: g.acquiredAt, quantity: g.quantity, costBasis: g.costBasis, proceeds: g.proceeds, gain: g.gain })
      // Use earliest acquired date for holding period
      if (holdingDays != null && (existing.holdingDays == null || holdingDays < existing.holdingDays)) {
        existing.holdingDays = holdingDays
      }
    }
  }

  // Recalculate gainPct for each event
  for (const ev of sellEventMap.values()) {
    ev.gainPct = ev.totalCostBasis > 0 ? (ev.totalGain / ev.totalCostBasis) * 100 : 0
  }

  const sellEvents = Array.from(sellEventMap.values())

  // Totals
  const totalRealised = sellEvents.reduce((s, g) => s + convert(g.totalGain, g.currency), 0)
  const totalGains = sellEvents.filter((g) => g.totalGain > 0).reduce((s, g) => s + convert(g.totalGain, g.currency), 0)
  const totalLosses = sellEvents.filter((g) => g.totalGain < 0).reduce((s, g) => s + convert(g.totalGain, g.currency), 0)
  const winRate = sellEvents.length > 0
    ? (sellEvents.filter((g) => g.totalGain > 0).length / sellEvents.length) * 100
    : 0

  // Filter
  const portfolioNames = [...new Set(sellEvents.map((g) => g.portfolioName).filter(Boolean))] as string[]
  const filtered = sellEvents.filter((g) => {
    if (filterPortfolio !== 'ALL' && g.portfolioName !== filterPortfolio) return false
    if (filterWin === 'WIN' && g.totalGain <= 0) return false
    if (filterWin === 'LOSS' && g.totalGain >= 0) return false
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let diff = 0
    if (sortKey === 'gain') diff = convert(a.totalGain, a.currency) - convert(b.totalGain, b.currency)
    else if (sortKey === 'gainPct') diff = a.gainPct - b.gainPct
    else if (sortKey === 'proceeds') diff = convert(a.totalProceeds, a.currency) - convert(b.totalProceeds, b.currency)
    else if (sortKey === 'soldAt') diff = a.soldAt.localeCompare(b.soldAt)
    else if (sortKey === 'ticker') diff = a.ticker.localeCompare(b.ticker)
    return sortDir === 'asc' ? diff : -diff
  })

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-30" />
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 inline ml-1 text-[#2563EB]" />
      : <ArrowDown className="h-3 w-3 inline ml-1 text-[#2563EB]" />
  }

  if (sellEvents.length === 0) {
    return (
      <div className="space-y-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sold Positions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your closed trade history and realised P&L</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-20 text-center">
            <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No sold positions yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Once you sell holdings, Trackfolio will show your realised profit and loss here.
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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Sold Positions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your closed trade history and realised P&L</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Realised P&L',
            value: `${totalRealised >= 0 ? '+' : ''}${format(totalRealised)}`,
            positive: totalRealised >= 0,
            sub: `${sellEvents.length} closed trade${sellEvents.length !== 1 ? 's' : ''}`,
          },
          {
            label: 'Total Gains',
            value: `+${format(totalGains)}`,
            positive: true,
            sub: `${sellEvents.filter((g) => g.totalGain > 0).length} winners`,
          },
          {
            label: 'Total Losses',
            value: format(totalLosses),
            positive: false,
            sub: `${sellEvents.filter((g) => g.totalGain < 0).length} losers`,
          },
          {
            label: 'Win Rate',
            value: `${winRate.toFixed(0)}%`,
            positive: winRate >= 50,
            sub: `${sellEvents.filter((g) => g.totalGain > 0).length}W / ${sellEvents.filter((g) => g.totalGain < 0).length}L`,
          },
        ].map((s) => (
          <Card key={s.label} className="border-border">
            <CardContent className="pt-5 pb-4 px-5">
              <p className="stat-label">{s.label}</p>
              <p className={cn('stat-value mt-1.5', s.positive ? 'text-positive' : 'text-negative')}>
                {s.positive ? <TrendingUp className="h-4 w-4 inline mr-1" /> : <TrendingDown className="h-4 w-4 inline mr-1" />}
                {s.value}
              </p>
              <p className="text-xs mt-1 text-muted-foreground">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterWin} onValueChange={(v) => setFilterWin(v as 'ALL' | 'WIN' | 'LOSS')}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All trades</SelectItem>
            <SelectItem value="WIN">Winners only</SelectItem>
            <SelectItem value="LOSS">Losers only</SelectItem>
          </SelectContent>
        </Select>

        {portfolioNames.length > 1 && (
          <Select value={filterPortfolio} onValueChange={(v) => v && setFilterPortfolio(v)}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All accounts</SelectItem>
              {portfolioNames.map((n) => (
                <SelectItem key={n} value={n}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <p className="text-xs text-muted-foreground ml-auto">
          {sorted.length} trade{sorted.length !== 1 ? 's' : ''} · {jurisdiction} tax rules · click row for breakdown
        </p>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead
                  className="pl-6 cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('ticker')}
                >
                  Symbol <SortIcon col="ticker" />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('soldAt')}
                >
                  Date Sold <SortIcon col="soldAt" />
                </TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Avg Buy</TableHead>
                <TableHead className="text-right">Avg Sell</TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('proceeds')}
                >
                  Proceeds <SortIcon col="proceeds" />
                </TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('gain')}
                >
                  P&L <SortIcon col="gain" />
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('gainPct')}
                >
                  Return <SortIcon col="gainPct" />
                </TableHead>
                <TableHead className="pr-4 w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground text-sm">
                    No matching trades
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((g, i) => {
                  const gainInBase = convert(g.totalGain, g.currency)
                  const proceedsInBase = convert(g.totalProceeds, g.currency)
                  const costInBase = convert(g.totalCostBasis, g.currency)
                  const avgBuy = g.totalQuantity > 0 ? g.totalCostBasis / g.totalQuantity : 0
                  const avgSell = g.totalQuantity > 0 ? g.totalProceeds / g.totalQuantity : 0
                  const positive = gainInBase >= 0

                  return (
                    <TableRow
                      key={i}
                      className="border-border cursor-pointer hover:bg-muted/40 transition-colors group"
                      onClick={() => setSelectedEvent(g)}
                    >
                      <TableCell className="pl-6">
                        <div>
                          <button
                            className="font-semibold text-sm text-foreground hover:text-[#2563EB] transition-colors"
                            onClick={(e) => { e.stopPropagation(); openTicker(g.ticker) }}
                          >
                            {g.ticker}
                          </button>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {g.portfolioName && (
                              <span className="text-[10px] text-muted-foreground">{g.portfolioName}</span>
                            )}
                            {g.holdingDays != null && (
                              <>
                                {g.portfolioName && <span className="text-[10px] text-muted-foreground">·</span>}
                                <span className="text-[10px] text-muted-foreground">{holdingLabel(g.holdingDays)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {g.soldAt ? formatDate(new Date(g.soldAt), 'd MMM yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{g.totalQuantity.toFixed(4)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {format(avgBuy, g.currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {format(avgSell, g.currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums font-medium">
                        {format(proceedsInBase)}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {format(costInBase)}
                      </TableCell>
                      <TableCell className={cn('text-right text-sm font-semibold tabular-nums', positive ? 'text-positive' : 'text-negative')}>
                        {positive ? '+' : ''}{format(gainInBase)}
                      </TableCell>
                      <TableCell className={cn('text-right text-sm', positive ? 'text-positive' : 'text-negative')}>
                        <Badge
                          className={cn(
                            'text-[10px] font-semibold',
                            positive
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400'
                              : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400'
                          )}
                          variant="outline"
                        >
                          {positive ? '+' : ''}{g.gainPct.toFixed(2)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                          onClick={(e) => { e.stopPropagation(); setSelectedEvent(g) }}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tax note */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
        <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Realised gains shown in display currency at current rates.
          {jurisdiction === 'UK' && ' UK Section 104 pool method used.'}
          {jurisdiction === 'US' && ' FIFO method used.'}
          {' '}Consult a tax adviser for official filings.
        </p>
      </div>

      {/* Breakdown drawer */}
      <SoldPositionDrawer
        event={selectedEvent}
        transactions={transactions}
        portfolios={portfolios}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  )
}
