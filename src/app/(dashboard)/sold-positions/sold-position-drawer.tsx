'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useCurrency } from '@/lib/currency-context'
import { format as formatDate, differenceInDays } from 'date-fns'
import { TrendingUp, TrendingDown, X, ArrowRight, Calendar, Hash, Wallet } from 'lucide-react'
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
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`
  if (days < 365) {
    const m = Math.floor(days / 30)
    const d = days % 30
    return d > 0 ? `${m}mo ${d}d` : `${m} month${m !== 1 ? 's' : ''}`
  }
  const y = Math.floor(days / 365)
  const m = Math.floor((days % 365) / 30)
  return m > 0 ? `${y}y ${m}mo` : `${y} year${y !== 1 ? 's' : ''}`
}

export function SoldPositionDrawer({ event, transactions, portfolios, onClose }: Props) {
  const { format, convert } = useCurrency()

  if (!event) return null

  const positive = event.totalGain >= 0
  const portfolioMap = Object.fromEntries(portfolios.map((p) => [p.id, p]))

  const sellTxs = transactions.filter(
    (t) => t.type === 'SELL' && t.ticker === event.ticker &&
      t.executed_at.slice(0, 10) === event.soldAt.slice(0, 10)
  )

  const buyTxsForTicker = transactions
    .filter((t) => t.type === 'BUY' && t.ticker === event.ticker)
    .sort((a, b) => a.executed_at.localeCompare(b.executed_at))

  const isUKPool = event.jurisdiction === 'UK'
  const avgBuyPrice = event.totalQuantity > 0 ? event.totalCostBasis / event.totalQuantity : 0
  const avgSellPrice = event.totalQuantity > 0 ? event.totalProceeds / event.totalQuantity : 0
  const totalFees = sellTxs.reduce((s, t) => s + (t.fees ?? 0), 0)
  const grossProceeds = sellTxs.reduce((s, t) => s + t.price * t.quantity, 0)

  // Build timeline: buys then sells in date order
  type TimelineEntry = { date: string; type: 'buy' | 'sell'; qty: number; price: number; label: string }
  const timeline: TimelineEntry[] = []

  if (isUKPool) {
    for (const tx of buyTxsForTicker) {
      const txPortfolio = portfolioMap[tx.portfolio_id]
      timeline.push({ date: tx.executed_at, type: 'buy', qty: tx.quantity, price: tx.price, label: txPortfolio ? accountLabel(txPortfolio) : 'Buy' })
    }
  } else {
    for (const lot of event.lots) {
      const matchingBuy = buyTxsForTicker.find((t) => t.executed_at.slice(0, 10) === lot.acquiredAt.slice(0, 10))
      const txPortfolio = matchingBuy ? portfolioMap[matchingBuy.portfolio_id] : null
      timeline.push({ date: lot.acquiredAt, type: 'buy', qty: lot.quantity, price: lot.costBasis / lot.quantity, label: txPortfolio ? accountLabel(txPortfolio) : 'Buy' })
    }
  }
  for (const tx of sellTxs) {
    const txPortfolio = portfolioMap[tx.portfolio_id]
    timeline.push({ date: tx.executed_at, type: 'sell', qty: tx.quantity, price: tx.price, label: txPortfolio ? accountLabel(txPortfolio) : 'Sell' })
  }
  timeline.sort((a, b) => a.date.localeCompare(b.date))

  const buyEntries = timeline.filter((t) => t.type === 'buy')
  const sellEntries = timeline.filter((t) => t.type === 'sell')

  return (
    <Dialog open={!!event} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-full h-[92vh] flex flex-col p-0 gap-0 overflow-hidden" showCloseButton={false}>

        {/* Header */}
        <div className={cn(
          'flex items-start justify-between gap-4 px-7 py-5 border-b border-border shrink-0',
          positive ? 'bg-green-50/60 dark:bg-green-950/20' : 'bg-red-50/60 dark:bg-red-950/20'
        )}>
          <div className="flex items-start gap-5 min-w-0">
            {/* Ticker badge */}
            <div className="shrink-0">
              <div className="h-14 w-14 rounded-2xl bg-background border border-border flex items-center justify-center shadow-sm">
                <span className="text-base font-black tracking-tight text-foreground">{event.ticker.slice(0, 4)}</span>
              </div>
            </div>
            {/* Title + meta */}
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold text-foreground leading-tight">
                {event.ticker}
                {event.companyName && <span className="font-normal text-muted-foreground ml-2 text-base">{event.companyName}</span>}
              </DialogTitle>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Sold {formatDate(new Date(event.soldAt), 'd MMM yyyy')}
                </span>
                {event.holdingDays != null && (
                  <span className="text-xs text-muted-foreground">· Held {holdingLabel(event.holdingDays)}</span>
                )}
                {event.portfolioName && (
                  <span className="text-xs text-muted-foreground">· {event.portfolioName}</span>
                )}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {isUKPool ? 'UK Section 104' : 'FIFO'}
                </Badge>
              </div>
            </div>
          </div>

          {/* P&L result */}
          <div className="flex items-center gap-6 shrink-0">
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Realised P&L</p>
              <p className={cn('text-3xl font-black tabular-nums mt-0.5 leading-none', positive ? 'text-green-700' : 'text-red-600')}>
                {positive ? '+' : ''}{format(convert(event.totalGain, event.currency))}
              </p>
              <div className="flex items-center justify-end gap-1.5 mt-1">
                {positive ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                <span className={cn('text-sm font-bold', positive ? 'text-green-700' : 'text-red-600')}>
                  {positive ? '+' : ''}{event.gainPct.toFixed(2)}%
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* Summary stat strip */}
          <div className="grid grid-cols-4 divide-x divide-border border-b border-border bg-muted/30">
            {[
              { label: 'Qty Sold', value: event.totalQuantity.toFixed(4), icon: Hash },
              { label: 'Avg Buy Price', value: format(avgBuyPrice, event.currency), icon: Wallet },
              { label: 'Avg Sell Price', value: format(avgSellPrice, event.currency), icon: Wallet },
              { label: 'Net Proceeds', value: format(convert(event.totalProceeds, event.currency)), icon: Wallet },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="px-5 py-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className="text-sm font-semibold tabular-nums mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Main two-column layout */}
          <div className="grid grid-cols-2 divide-x divide-border min-h-0">

            {/* Left: Purchase History */}
            <div className="px-6 py-5 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {isUKPool ? 'Purchase History (Section 104 Pool)' : 'Purchase Lots (FIFO)'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isUKPool
                    ? 'All buy transactions averaged into a shared pool'
                    : 'Individual lots matched first-in, first-out to this sale'}
                </p>
              </div>

              {isUKPool ? (
                <div className="space-y-2">
                  {buyTxsForTicker.map((tx, i) => (
                    <div key={i} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
                            <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">
                              {formatDate(new Date(tx.executed_at), 'd MMM yyyy')}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {portfolioMap[tx.portfolio_id] ? accountLabel(portfolioMap[tx.portfolio_id]) : 'Buy'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold tabular-nums">{format(convert(tx.price * tx.quantity, tx.currency as Currency))}</p>
                          <p className="text-[11px] text-muted-foreground tabular-nums">{tx.quantity.toFixed(4)} × {tx.currency} {tx.price.toFixed(4)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-blue-800">Pool avg cost basis</p>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-blue-800">{format(convert(event.totalCostBasis, event.currency))}</p>
                        <p className="text-[11px] text-blue-600 tabular-nums">{event.currency} {avgBuyPrice.toFixed(4)} avg · {event.totalQuantity.toFixed(4)} shares</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {event.lots.map((lot, i) => {
                    const pricePerShare = lot.quantity > 0 ? lot.costBasis / lot.quantity : 0
                    const lotGain = lot.gain
                    const lotPositive = lotGain >= 0
                    return (
                      <div key={i} className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-blue-700">
                              L{i + 1}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground">
                                {lot.acquiredAt ? formatDate(new Date(lot.acquiredAt), 'd MMM yyyy') : '—'}
                              </p>
                              <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                                {lot.quantity.toFixed(4)} shares @ {event.currency} {pricePerShare.toFixed(4)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold tabular-nums">{format(convert(lot.costBasis, event.currency))}</p>
                            <p className={cn('text-[11px] tabular-nums font-medium mt-0.5', lotPositive ? 'text-green-600' : 'text-red-500')}>
                              lot P&L {lotPositive ? '+' : ''}{format(convert(lotGain, event.currency))}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {/* Total cost */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-blue-800">Total cost basis</p>
                      <div className="text-right">
                        <p className="text-sm font-bold tabular-nums text-blue-800">{format(convert(event.totalCostBasis, event.currency))}</p>
                        <p className="text-[11px] text-blue-600 tabular-nums">{event.currency} {avgBuyPrice.toFixed(4)} avg · {event.totalQuantity.toFixed(4)} shares</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Sale Details */}
            <div className="px-6 py-5 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-foreground">Sale Details</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {sellTxs.length} sell transaction{sellTxs.length !== 1 ? 's' : ''} on {formatDate(new Date(event.soldAt), 'd MMM yyyy')}
                </p>
              </div>

              <div className="space-y-2">
                {sellTxs.length === 0 ? (
                  <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
                    <p className="text-xs text-muted-foreground">Sell transaction not found in history</p>
                  </div>
                ) : (
                  sellTxs.map((tx, i) => {
                    const netProceeds = tx.price * tx.quantity - (tx.fees ?? 0)
                    return (
                      <div key={i} className="rounded-xl border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center shrink-0">
                              <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-foreground">
                                {formatDate(new Date(tx.executed_at), 'd MMM yyyy')}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {portfolioMap[tx.portfolio_id] ? accountLabel(portfolioMap[tx.portfolio_id]) : 'Sell'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold tabular-nums">{format(convert(netProceeds, tx.currency as Currency))}</p>
                            <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                              {tx.quantity.toFixed(4)} × {tx.currency} {tx.price.toFixed(4)}
                            </p>
                          </div>
                        </div>
                        {(tx.fees ?? 0) > 0 && (
                          <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                            <p className="text-[11px] text-muted-foreground">Gross proceeds</p>
                            <p className="text-[11px] tabular-nums text-muted-foreground">{format(convert(tx.price * tx.quantity, tx.currency as Currency))}</p>
                          </div>
                        )}
                        {(tx.fees ?? 0) > 0 && (
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-[11px] text-muted-foreground">Fees deducted</p>
                            <p className="text-[11px] tabular-nums text-muted-foreground">−{format(convert(tx.fees ?? 0, tx.currency as Currency))}</p>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}

                {/* Net proceeds summary */}
                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-orange-800">Net proceeds</p>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-orange-800">{format(convert(event.totalProceeds, event.currency))}</p>
                      {totalFees > 0 && (
                        <p className="text-[11px] text-orange-600 tabular-nums">after {format(convert(totalFees, event.currency))} fees</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* P&L breakdown */}
              <div className={cn('rounded-xl border p-4 mt-2', positive ? 'border-green-200 bg-green-50/60' : 'border-red-200 bg-red-50/60')}>
                <p className={cn('text-xs font-bold mb-3', positive ? 'text-green-800' : 'text-red-700')}>P&L Calculation</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Net proceeds</span>
                    <span className="tabular-nums font-medium">{format(convert(event.totalProceeds, event.currency))}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cost basis</span>
                    <span className="tabular-nums font-medium">−{format(convert(event.totalCostBasis, event.currency))}</span>
                  </div>
                  <div className={cn('flex items-center justify-between pt-2 border-t font-bold text-sm', positive ? 'border-green-200 text-green-700' : 'border-red-200 text-red-600')}>
                    <span>Realised P&L</span>
                    <span className="tabular-nums">{positive ? '+' : ''}{format(convert(event.totalGain, event.currency))} ({positive ? '+' : ''}{event.gainPct.toFixed(2)}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline — full width */}
          <div className="border-t border-border px-6 py-5">
            <h3 className="text-sm font-bold text-foreground mb-5">Trade Timeline</h3>
            <div className="flex items-start gap-0 overflow-x-auto pb-2">
              {/* Buy entries */}
              {buyEntries.map((entry, i) => (
                <div key={i} className="flex items-start gap-0 min-w-0">
                  <div className="flex flex-col items-center">
                    <div className="h-10 w-10 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center shrink-0">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                    </div>
                    <div className="text-center mt-2 w-28">
                      <p className="text-[11px] font-semibold text-foreground">Bought</p>
                      <p className="text-[11px] text-blue-600 font-medium tabular-nums">{entry.qty.toFixed(4)} shares</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">{event.currency} {entry.price.toFixed(4)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(new Date(entry.date), 'd MMM yyyy')}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{entry.label}</p>
                    </div>
                  </div>
                  {/* Connector */}
                  <div className="flex flex-col items-center self-start mt-4 mx-1">
                    <div className="w-12 h-px bg-border" />
                  </div>
                </div>
              ))}

              {/* Arrow to sell */}
              <div className="flex flex-col items-center self-start mt-4 mx-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Sell entries */}
              {sellEntries.map((entry, i) => (
                <div key={i} className="flex items-start gap-0 min-w-0">
                  {i > 0 && (
                    <div className="flex flex-col items-center self-start mt-4 mx-1">
                      <div className="w-6 h-px bg-border" />
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    <div className="h-10 w-10 rounded-full bg-orange-100 border-2 border-orange-300 flex items-center justify-center shrink-0">
                      <div className="h-3 w-3 rounded-full bg-orange-500" />
                    </div>
                    <div className="text-center mt-2 w-28">
                      <p className="text-[11px] font-semibold text-foreground">Sold</p>
                      <p className="text-[11px] text-orange-600 font-medium tabular-nums">{entry.qty.toFixed(4)} shares</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">{event.currency} {entry.price.toFixed(4)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(new Date(entry.date), 'd MMM yyyy')}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{entry.label}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Final result */}
              <div className="flex flex-col items-center self-start mt-4 mx-1">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col items-center">
                <div className={cn(
                  'h-10 w-10 rounded-full border-2 flex items-center justify-center shrink-0',
                  positive ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'
                )}>
                  {positive
                    ? <TrendingUp className="h-4 w-4 text-green-600" />
                    : <TrendingDown className="h-4 w-4 text-red-500" />
                  }
                </div>
                <div className="text-center mt-2 w-28">
                  <p className={cn('text-[11px] font-bold tabular-nums', positive ? 'text-green-700' : 'text-red-600')}>
                    {positive ? '+' : ''}{format(convert(event.totalGain, event.currency))}
                  </p>
                  <p className={cn('text-[11px] font-semibold', positive ? 'text-green-600' : 'text-red-500')}>
                    {positive ? '+' : ''}{event.gainPct.toFixed(2)}%
                  </p>
                  {event.holdingDays != null && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{holdingLabel(event.holdingDays)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-6 py-3 bg-muted/20">
            <p className="text-[11px] text-muted-foreground text-center">
              Values in display currency at current exchange rates · Cost basis method: <span className="font-medium">{isUKPool ? 'UK Section 104 pool' : 'FIFO (First In, First Out)'}</span> · Consult a tax adviser for official filings
            </p>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
