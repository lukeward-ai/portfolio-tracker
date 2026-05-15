'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { useCurrency } from '@/lib/currency-context'
import { format as formatDate, differenceInDays } from 'date-fns'
import { TrendingUp, TrendingDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Currency, Transaction, Portfolio, TaxJurisdiction } from '@/lib/types'
import { accountLabel } from '@/lib/portfolio-utils'

export interface SellEvent {
  ticker: string
  companyName: string | null
  soldAt: string
  currency: Currency
  portfolioId: string | null
  portfolioName: string | null
  totalQuantity: number
  totalProceeds: number
  totalCostBasis: number
  totalGain: number
  gainPct: number
  holdingDays: number | null
  lots: LotMatch[]
  jurisdiction: TaxJurisdiction
}

export interface LotMatch {
  acquiredAt: string
  quantity: number
  costBasis: number
  proceeds: number
  gain: number
}

interface Props {
  event: SellEvent | null
  transactions: Transaction[]
  portfolios: Portfolio[]
  onClose: () => void
}

function holdingLabel(days: number | null): string {
  if (days == null || days < 0) return '—'
  if (days === 0) return 'Same day'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}mo ${days % 30}d`
  const y = Math.floor(days / 365)
  const m = Math.floor((days % 365) / 30)
  return m > 0 ? `${y}y ${m}mo` : `${y}y`
}

function StatRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-semibold tabular-nums', className)}>{value}</span>
    </div>
  )
}

export function SoldPositionDrawer({ event, transactions, portfolios, onClose }: Props) {
  const { format, convert } = useCurrency()

  if (!event) return null

  const positive = event.totalGain >= 0
  const portfolioMap = Object.fromEntries(portfolios.map((p) => [p.id, p]))

  // Find the sell transaction(s) for this event
  const sellTxs = transactions.filter(
    (t) => t.type === 'SELL' && t.ticker === event.ticker &&
      t.executed_at.slice(0, 10) === event.soldAt.slice(0, 10)
  )

  // For FIFO: find buy transactions that could match each lot
  const buyTxsForTicker = transactions
    .filter((t) => t.type === 'BUY' && t.ticker === event.ticker)
    .sort((a, b) => a.executed_at.localeCompare(b.executed_at))

  const isUKPool = event.jurisdiction === 'UK'
  const avgBuyPrice = event.totalQuantity > 0 ? event.totalCostBasis / event.totalQuantity : 0
  const avgSellPrice = event.totalQuantity > 0 ? event.totalProceeds / event.totalQuantity : 0
  const totalFees = sellTxs.reduce((s, t) => s + (t.fees ?? 0), 0)
  const grossProceeds = sellTxs.reduce((s, t) => s + t.price * t.quantity, 0)

  // Build timeline entries
  const timeline: { date: string; type: 'buy' | 'sell'; qty: number; price: number; label: string }[] = []

  if (isUKPool) {
    // For UK pool: show all buys for this ticker then the sell
    for (const tx of buyTxsForTicker) {
      const txPortfolio = portfolioMap[tx.portfolio_id]
      timeline.push({
        date: tx.executed_at,
        type: 'buy',
        qty: tx.quantity,
        price: tx.price,
        label: txPortfolio ? accountLabel(txPortfolio) : 'Buy',
      })
    }
  } else {
    // For FIFO: show matched lots then sell
    for (const lot of event.lots) {
      const matchingBuy = buyTxsForTicker.find((t) => t.executed_at.slice(0, 10) === lot.acquiredAt.slice(0, 10))
      const txPortfolio = matchingBuy ? portfolioMap[matchingBuy.portfolio_id] : null
      timeline.push({
        date: lot.acquiredAt,
        type: 'buy',
        qty: lot.quantity,
        price: lot.costBasis / lot.quantity,
        label: txPortfolio ? accountLabel(txPortfolio) : 'Buy',
      })
    }
  }

  for (const tx of sellTxs) {
    const txPortfolio = portfolioMap[tx.portfolio_id]
    timeline.push({
      date: tx.executed_at,
      type: 'sell',
      qty: tx.quantity,
      price: tx.price,
      label: txPortfolio ? accountLabel(txPortfolio) : 'Sell',
    })
  }

  timeline.sort((a, b) => a.date.localeCompare(b.date))

  return (
    <Sheet open={!!event} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0" side="right">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border sticky top-0 bg-background z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-base font-bold">
                {event.ticker} — Sold Position Breakdown
              </SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Buy and sell lots used to calculate your realised P&L
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

        <div className="px-5 py-5 space-y-6">

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground">Ticker</p>
              <p className="text-sm font-bold mt-0.5">{event.ticker}</p>
              {event.companyName && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{event.companyName}</p>}
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-[11px] text-muted-foreground">Date Sold</p>
              <p className="text-sm font-bold mt-0.5">
                {formatDate(new Date(event.soldAt), 'd MMM yyyy')}
              </p>
              {event.holdingDays != null && (
                <p className="text-[11px] text-muted-foreground mt-0.5">Held {holdingLabel(event.holdingDays)}</p>
              )}
            </div>
            <div className={cn('rounded-xl border p-3 col-span-2', positive ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground">Realised P&L</p>
                  <p className={cn('text-xl font-bold mt-0.5 tabular-nums', positive ? 'text-green-700' : 'text-red-600')}>
                    {positive ? '+' : ''}{format(convert(event.totalGain, event.currency))}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={cn(
                    'text-xs font-bold px-2 py-1',
                    positive
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-red-100 text-red-600 border-red-300'
                  )} variant="outline">
                    {positive ? '+' : ''}{event.gainPct.toFixed(2)}%
                  </Badge>
                  {positive
                    ? <TrendingUp className="h-5 w-5 text-green-600 mt-1 ml-auto" />
                    : <TrendingDown className="h-5 w-5 text-red-500 mt-1 ml-auto" />
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Trade summary */}
          <div className="rounded-xl border border-border bg-card">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-foreground">Trade Summary</p>
            </div>
            <div className="px-4 py-2">
              <StatRow label="Quantity sold" value={event.totalQuantity.toFixed(4)} />
              <StatRow label="Average buy price" value={format(avgBuyPrice, event.currency)} />
              <StatRow label="Average sell price" value={format(avgSellPrice, event.currency)} />
              <StatRow label="Total cost basis" value={format(convert(event.totalCostBasis, event.currency))} />
              <StatRow label="Gross proceeds" value={format(convert(grossProceeds, event.currency))} />
              {totalFees > 0 && (
                <StatRow label="Sell fees" value={`−${format(convert(totalFees, event.currency))}`} className="text-muted-foreground" />
              )}
              <StatRow label="Net proceeds" value={format(convert(event.totalProceeds, event.currency))} />
              <StatRow
                label="Realised P&L"
                value={`${positive ? '+' : ''}${format(convert(event.totalGain, event.currency))}`}
                className={positive ? 'text-green-700' : 'text-red-600'}
              />
              <StatRow
                label="Return"
                value={`${positive ? '+' : ''}${event.gainPct.toFixed(2)}%`}
                className={positive ? 'text-green-700' : 'text-red-600'}
              />
              {event.portfolioName && (
                <StatRow label="Account" value={event.portfolioName} />
              )}
            </div>
          </div>

          {/* Buy lots */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">
                {isUKPool ? 'Buy History (Section 104 Pool)' : 'Buy Lots Used (FIFO)'}
              </p>
              {isUKPool && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Pool avg cost</span>
              )}
            </div>
            {isUKPool ? (
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  UK Section 104 pool method averages all buy costs across the position.
                  Individual lot matching is not applicable.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 font-medium text-muted-foreground">Date</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Qty</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Price</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buyTxsForTicker.slice(0, 20).map((tx, i) => (
                        <tr key={i} className="border-b border-border/30 last:border-0">
                          <td className="py-2 text-muted-foreground">{formatDate(new Date(tx.executed_at), 'd MMM yy')}</td>
                          <td className="py-2 text-right tabular-nums">{tx.quantity.toFixed(4)}</td>
                          <td className="py-2 text-right tabular-nums">{tx.currency} {tx.price.toFixed(2)}</td>
                          <td className="py-2 text-right tabular-nums">{tx.currency} {(tx.price * tx.quantity).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Acquired</th>
                      <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Qty Used</th>
                      <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Buy Price</th>
                      <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Cost Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.lots.map((lot, i) => {
                      const pricePerShare = lot.quantity > 0 ? lot.costBasis / lot.quantity : 0
                      return (
                        <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {lot.acquiredAt
                              ? formatDate(new Date(lot.acquiredAt), 'd MMM yyyy')
                              : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium">{lot.quantity.toFixed(4)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {event.currency} {pricePerShare.toFixed(4)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                            {format(convert(lot.costBasis, event.currency))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="border-t border-border bg-muted/20">
                    <tr>
                      <td className="px-4 py-2.5 text-xs font-semibold">Total</td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold tabular-nums">{event.totalQuantity.toFixed(4)}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-muted-foreground">
                        avg {event.currency} {avgBuyPrice.toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums">
                        {format(convert(event.totalCostBasis, event.currency))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Sell transactions */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-foreground">Sell Transaction{sellTxs.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Date</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Qty</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Sell Price</th>
                    <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Fees</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Net Proceeds</th>
                  </tr>
                </thead>
                <tbody>
                  {sellTxs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">
                        Sell transaction not found in history
                      </td>
                    </tr>
                  ) : (
                    sellTxs.map((tx, i) => {
                      const netProceeds = tx.price * tx.quantity - (tx.fees ?? 0)
                      return (
                        <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {formatDate(new Date(tx.executed_at), 'd MMM yyyy')}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium">{tx.quantity.toFixed(4)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {tx.currency} {tx.price.toFixed(4)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {(tx.fees ?? 0) > 0 ? `${tx.currency} ${tx.fees?.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                            {format(convert(netProceeds, tx.currency as Currency))}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Calculation breakdown */}
          <div className="rounded-xl border border-border bg-card">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-foreground">Calculation</p>
            </div>
            <div className="px-4 py-3 space-y-4 text-xs">
              <div>
                <p className="font-semibold text-muted-foreground mb-1.5">Cost Basis:</p>
                {isUKPool ? (
                  <p className="text-muted-foreground">Pool avg {event.currency} {avgBuyPrice.toFixed(4)} × {event.totalQuantity.toFixed(4)} = <span className="font-semibold text-foreground">{format(convert(event.totalCostBasis, event.currency))}</span></p>
                ) : (
                  <>
                    {event.lots.map((lot, i) => (
                      <p key={i} className="text-muted-foreground">
                        {lot.quantity.toFixed(4)} × {event.currency} {(lot.costBasis / lot.quantity).toFixed(4)} = <span className="font-medium text-foreground">{format(convert(lot.costBasis, event.currency))}</span>
                      </p>
                    ))}
                    <p className="font-semibold text-foreground mt-1">Total cost basis = {format(convert(event.totalCostBasis, event.currency))}</p>
                  </>
                )}
              </div>

              <div>
                <p className="font-semibold text-muted-foreground mb-1.5">Proceeds:</p>
                {sellTxs.map((tx, i) => (
                  <p key={i} className="text-muted-foreground">
                    {tx.quantity.toFixed(4)} × {tx.currency} {tx.price.toFixed(4)} = <span className="font-medium text-foreground">{format(convert(tx.price * tx.quantity, tx.currency as Currency))}</span>
                  </p>
                ))}
                {totalFees > 0 && (
                  <p className="text-muted-foreground">Less fees = {format(convert(totalFees, event.currency))}</p>
                )}
                <p className="font-semibold text-foreground mt-1">Net proceeds = {format(convert(event.totalProceeds, event.currency))}</p>
              </div>

              <div className={cn('rounded-lg px-3 py-2.5', positive ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100')}>
                <p className={cn('font-semibold mb-1', positive ? 'text-green-800' : 'text-red-700')}>Realised P&L:</p>
                <p className={cn('text-muted-foreground', positive ? 'text-green-700' : 'text-red-600')}>
                  {format(convert(event.totalProceeds, event.currency))} − {format(convert(event.totalCostBasis, event.currency))} = <span className="font-bold">{positive ? '+' : ''}{format(convert(event.totalGain, event.currency))}</span>
                </p>
                <p className={cn('mt-0.5', positive ? 'text-green-700' : 'text-red-600')}>
                  Return: {format(convert(event.totalGain, event.currency))} / {format(convert(event.totalCostBasis, event.currency))} = <span className="font-bold">{positive ? '+' : ''}{event.gainPct.toFixed(2)}%</span>
                </p>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Cost basis method: <span className="font-medium">{event.jurisdiction === 'UK' ? 'UK Section 104 pool' : 'FIFO'}</span>
                {event.jurisdiction !== 'UK' && ' — First In, First Out'}
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-border bg-card">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-foreground">Timeline</p>
            </div>
            <div className="px-4 py-3">
              <div className="relative">
                {timeline.map((t, i) => (
                  <div key={i} className="flex items-start gap-3 pb-4 last:pb-0 relative">
                    {i < timeline.length - 1 && (
                      <div className="absolute left-3 top-6 bottom-0 w-px bg-border" />
                    )}
                    <div className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center shrink-0 z-10',
                      t.type === 'buy' ? 'bg-blue-100 border border-blue-200' : 'bg-orange-100 border border-orange-200'
                    )}>
                      <div className={cn('h-2 w-2 rounded-full', t.type === 'buy' ? 'bg-blue-500' : 'bg-orange-500')} />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">
                          {t.type === 'buy' ? 'Bought' : 'Sold'} {t.qty.toFixed(4)} {event.ticker}
                        </p>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {formatDate(new Date(t.date), 'd MMM yyyy')}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        at {event.currency} {t.price.toFixed(4)} · {t.label}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="flex items-start gap-3 pt-2 mt-2 border-t border-border/50">
                  <div className={cn(
                    'h-6 w-6 rounded-full flex items-center justify-center shrink-0',
                    positive ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'
                  )}>
                    {positive
                      ? <TrendingUp className="h-3 w-3 text-green-600" />
                      : <TrendingDown className="h-3 w-3 text-red-500" />
                    }
                  </div>
                  <p className={cn('text-xs font-semibold pt-0.5', positive ? 'text-green-700' : 'text-red-600')}>
                    Result: {positive ? '+' : ''}{format(convert(event.totalGain, event.currency))} realised {positive ? 'profit' : 'loss'}
                    {event.holdingDays != null && ` over ${holdingLabel(event.holdingDays)}`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center pb-2">
            Values shown in display currency at current exchange rates. Consult a tax adviser for official filings.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
