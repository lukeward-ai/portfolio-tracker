'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { useCurrency } from '@/lib/currency-context'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Info } from 'lucide-react'
import { format as formatDate, getYear } from 'date-fns'
import type { Profile, Transaction, Currency, RealisedGain } from '@/lib/types'

interface Props {
  profile: Profile | null
  transactions: Transaction[]
}

export function PnLClient({ profile, transactions }: Props) {
  const { format, convert } = useCurrency()
  const [prices, setPrices] = useState<Record<string, { price: number; changePercent: number; currency: string }>>({})
  const [loading, setLoading] = useState(true)

  const jurisdiction = profile?.tax_jurisdiction ?? 'UK'
  const { lots, realisedGains } = calculatePnL(transactions, jurisdiction)
  const holdings = getHoldings(transactions, lots)
  const tickers = holdings.map((h) => h.ticker)

  useEffect(() => {
    if (tickers.length === 0) { setLoading(false); return }
    fetch(`/api/prices?tickers=${tickers.join(',')}`)
      .then((r) => r.json())
      .then((d) => { setPrices(d.prices ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tickers.join(',')])

  // Unrealised P&L
  let totalUnrealised = 0
  let totalCost = 0
  const unrealisedRows = holdings.map((h) => {
    const p = prices[h.ticker]
    const priceCur = (p?.currency ?? h.currency) as Currency
    const currentValue = p ? convert(p.price * h.quantity, priceCur) : null
    const cost = convert(h.costBasis, h.currency)
    const pnl = currentValue !== null ? currentValue - cost : null
    const pnlPct = cost > 0 && pnl !== null ? (pnl / cost) * 100 : null
    if (currentValue !== null) totalUnrealised += currentValue - cost
    totalCost += cost
    return { ...h, p, currentValue, cost, pnl, pnlPct, priceCur }
  })

  // Realised P&L in display currency
  const realisedInDisplay: RealisedGain[] = realisedGains.map((g) => ({
    ...g,
    gain: convert(g.gain, g.currency),
    proceeds: convert(g.proceeds, g.currency),
    costBasis: convert(g.costBasis, g.currency),
  }))

  const totalRealised = realisedInDisplay.reduce((s, g) => s + g.gain, 0)
  const totalGains = realisedInDisplay.filter((g) => g.gain > 0).reduce((s, g) => s + g.gain, 0)
  const totalLosses = realisedInDisplay.filter((g) => g.gain < 0).reduce((s, g) => s + g.gain, 0)

  // Group realised by year
  const byYear = realisedInDisplay.reduce((acc, g) => {
    const year = g.soldAt ? getYear(new Date(g.soldAt)) : 0
    if (!acc[year]) acc[year] = { gains: 0, losses: 0, net: 0 }
    if (g.gain > 0) acc[year].gains += g.gain
    else acc[year].losses += g.gain
    acc[year].net += g.gain
    return acc
  }, {} as Record<number, { gains: number; losses: number; net: number }>)

  const yearChartData = Object.entries(byYear).sort(([a], [b]) => Number(a) - Number(b)).map(([year, data]) => ({
    year,
    Gains: parseFloat(data.gains.toFixed(2)),
    Losses: parseFloat(Math.abs(data.losses).toFixed(2)),
    Net: parseFloat(data.net.toFixed(2)),
  }))

  // UK CGT annual exempt amount (2024/25: £3,000)
  const CGT_ALLOWANCE = { UK: 3000, US: 0, EU: 0, OTHER: 0 }
  const currentYear = new Date().getFullYear()
  const thisYearNet = byYear[currentYear]?.net ?? 0
  const allowance = CGT_ALLOWANCE[jurisdiction] ?? 0
  const taxableGain = Math.max(0, thisYearNet - allowance)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">P&L & Tax</h1>
        <Badge variant="outline">{jurisdiction} Tax Rules</Badge>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Unrealised P&L', value: loading ? null : format(totalUnrealised), positive: totalUnrealised >= 0 },
          { label: 'Realised P&L (All Time)', value: format(totalRealised), positive: totalRealised >= 0 },
          { label: 'Total Gains', value: format(totalGains), positive: true },
          { label: 'Total Losses', value: format(totalLosses), positive: false },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {s.value === null ? <Skeleton className="h-7 w-24" /> : (
                <p className={`text-xl font-bold flex items-center gap-1 ${s.positive ? 'text-green-600' : 'text-red-500'}`}>
                  {s.positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {s.value}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tax estimate */}
      {jurisdiction === 'UK' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              UK CGT Estimate {currentYear}/{String(currentYear + 1).slice(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Net Gains This Year</p>
                <p className={`font-semibold text-lg ${thisYearNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {format(thisYearNet)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Annual Exempt Amount</p>
                <p className="font-semibold text-lg">{format(allowance, 'GBP')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Estimated Taxable Gain</p>
                <p className={`font-semibold text-lg ${taxableGain > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {format(taxableGain)}
                </p>
              </div>
            </div>
            {allowance > 0 && thisYearNet > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Annual exempt used</span>
                  <span>{Math.min(100, (thisYearNet / allowance) * 100).toFixed(0)}%</span>
                </div>
                <Progress value={Math.min(100, (thisYearNet / allowance) * 100)} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              * Estimate only. Uses Section 104 pool method. Consult a tax advisor for official filings.
              CGT rates: 18% (basic rate) / 24% (higher rate) for residential property; 10% / 20% for other assets.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="unrealised">
        <TabsList>
          <TabsTrigger value="unrealised">Unrealised P&L</TabsTrigger>
          <TabsTrigger value="realised">Realised Gains</TabsTrigger>
          <TabsTrigger value="chart">Annual Chart</TabsTrigger>
        </TabsList>

        <TabsContent value="unrealised">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Avg Cost</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Market Value</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead className="text-right">% P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>)}</TableRow>
                    ))
                  ) : unrealisedRows.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No open positions</TableCell></TableRow>
                  ) : (
                    unrealisedRows.map((r) => (
                      <TableRow key={r.ticker}>
                        <TableCell className="font-medium">{r.ticker}</TableCell>
                        <TableCell className="text-right">{r.quantity.toFixed(4)}</TableCell>
                        <TableCell className="text-right">{format(r.avgCost, r.currency)}</TableCell>
                        <TableCell className="text-right">{r.p ? format(r.p.price, r.priceCur) : '—'}</TableCell>
                        <TableCell className="text-right">{r.currentValue !== null ? format(r.currentValue) : '—'}</TableCell>
                        <TableCell className={`text-right font-medium ${r.pnl !== null ? (r.pnl >= 0 ? 'text-green-600' : 'text-red-500') : ''}`}>
                          {r.pnl !== null ? `${r.pnl >= 0 ? '+' : ''}${format(r.pnl)}` : '—'}
                        </TableCell>
                        <TableCell className={`text-right ${r.pnlPct !== null ? (r.pnlPct >= 0 ? 'text-green-600' : 'text-red-500') : ''}`}>
                          {r.pnlPct !== null ? `${r.pnlPct >= 0 ? '+' : ''}${r.pnlPct.toFixed(2)}%` : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="realised">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Sold</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Proceeds</TableHead>
                    <TableHead className="text-right">Cost Basis</TableHead>
                    <TableHead className="text-right">Gain / Loss</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                    {jurisdiction === 'US' && <TableHead>Term</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {realisedInDisplay.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No realised gains/losses yet</TableCell></TableRow>
                  ) : (
                    [...realisedInDisplay].reverse().map((g, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{g.ticker}</TableCell>
                        <TableCell className="text-sm">{g.soldAt ? formatDate(new Date(g.soldAt), 'dd MMM yyyy') : '—'}</TableCell>
                        <TableCell className="text-right">{g.quantity.toFixed(4)}</TableCell>
                        <TableCell className="text-right">{format(g.proceeds)}</TableCell>
                        <TableCell className="text-right">{format(g.costBasis)}</TableCell>
                        <TableCell className={`text-right font-medium ${g.gain >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {g.gain >= 0 ? '+' : ''}{format(g.gain)}
                        </TableCell>
                        <TableCell className={`text-right ${g.gainPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {g.gainPct >= 0 ? '+' : ''}{g.gainPct.toFixed(2)}%
                        </TableCell>
                        {jurisdiction === 'US' && (
                          <TableCell>
                            <Badge variant={g.isShortTerm ? 'destructive' : 'default'}>
                              {g.isShortTerm ? 'Short' : 'Long'}
                            </Badge>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart">
          <Card>
            <CardHeader><CardTitle>Annual Realised Gains & Losses</CardTitle></CardHeader>
            <CardContent>
              {yearChartData.length === 0 ? (
                <p className="text-center text-muted-foreground py-16">No realised gains data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={yearChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip formatter={(v) => format(Number(v))} />
                    <Legend />
                    <Bar dataKey="Gains" fill="#22c55e" />
                    <Bar dataKey="Losses" fill="#ef4444" />
                    <Bar dataKey="Net" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
