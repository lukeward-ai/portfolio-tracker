'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCurrency } from '@/lib/currency-context'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { Profile, Transaction, Currency } from '@/lib/types'

interface Props {
  profile: Profile | null
  transactions: Transaction[]
}

export function PortfolioClient({ profile, transactions }: Props) {
  const { convert, format } = useCurrency()
  const [prices, setPrices] = useState<Record<string, { price: number; changePercent: number; currency: string; name: string | null }>>({})
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

  let totalValue = 0
  let totalCost = 0
  let totalDayChange = 0

  const rows = holdings.map((h) => {
    const p = prices[h.ticker]
    const priceCur = (p?.currency ?? h.currency) as Currency
    const currentValue = p ? convert(p.price * h.quantity, priceCur) : null
    const cost = convert(h.costBasis, h.currency)
    const unrealisedPnL = currentValue !== null ? currentValue - cost : null
    const unrealisedPnLPct = cost > 0 && unrealisedPnL !== null ? (unrealisedPnL / cost) * 100 : null
    const prevPrice = p ? p.price / (1 + p.changePercent / 100) : null
    const dayChange = p && prevPrice ? convert((p.price - prevPrice) * h.quantity, priceCur) : null

    if (currentValue !== null) totalValue += currentValue
    totalCost += cost
    if (dayChange !== null) totalDayChange += dayChange

    return { ...h, p, currentValue, cost, unrealisedPnL, unrealisedPnLPct, dayChange, priceCur }
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Portfolio</h1>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Value', value: loading ? null : format(totalValue) },
          {
            label: 'Total P&L',
            value: loading ? null : format(totalValue - totalCost),
            pct: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
            positive: totalValue >= totalCost,
          },
          {
            label: "Today's Change",
            value: loading ? null : format(totalDayChange),
            pct: (totalValue - totalDayChange) > 0 ? (totalDayChange / (totalValue - totalDayChange)) * 100 : 0,
            positive: totalDayChange >= 0,
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {s.value === null ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <p className={`text-xl font-bold ${s.positive === false ? 'text-red-500' : s.positive === true ? 'text-green-600' : ''}`}>
                  {s.value}
                </p>
              )}
              {s.pct !== undefined && s.value !== null && (
                <p className={`text-xs mt-1 ${s.positive ? 'text-green-600' : 'text-red-500'}`}>
                  {s.pct >= 0 ? '+' : ''}{s.pct.toFixed(2)}%
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead className="text-right">Current Price</TableHead>
                <TableHead className="text-right">Market Value</TableHead>
                <TableHead className="text-right">Unrealised P&L</TableHead>
                <TableHead className="text-right">Day Change</TableHead>
                <TableHead className="text-right">Weight</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No holdings. Add your first buy transaction.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const weight = totalValue > 0 && row.currentValue ? (row.currentValue / totalValue) * 100 : 0
                  return (
                    <TableRow key={row.ticker}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{row.ticker}</p>
                          <p className="text-xs text-muted-foreground">{row.p?.name ?? row.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{row.quantity.toFixed(4)}</TableCell>
                      <TableCell className="text-right">{format(row.avgCost, row.currency)}</TableCell>
                      <TableCell className="text-right">
                        {row.p ? (
                          <div>
                            <span>{format(row.p.price, row.priceCur)}</span>
                            <Badge variant={row.p.changePercent >= 0 ? 'default' : 'destructive'} className="ml-2 text-xs">
                              {row.p.changePercent >= 0 ? '+' : ''}{row.p.changePercent.toFixed(2)}%
                            </Badge>
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {row.currentValue !== null ? format(row.currentValue) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.unrealisedPnL !== null ? (
                          <div className={row.unrealisedPnL >= 0 ? 'text-green-600' : 'text-red-500'}>
                            <div className="flex items-center justify-end gap-1">
                              {row.unrealisedPnL >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {format(row.unrealisedPnL)}
                            </div>
                            <p className="text-xs">{row.unrealisedPnLPct?.toFixed(2)}%</p>
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className={`text-right text-sm ${row.dayChange !== null ? (row.dayChange >= 0 ? 'text-green-600' : 'text-red-500') : ''}`}>
                        {row.dayChange !== null ? `${row.dayChange >= 0 ? '+' : ''}${format(row.dayChange)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">{weight.toFixed(1)}%</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
