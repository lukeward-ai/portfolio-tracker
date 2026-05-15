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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { TrendingUp, TrendingDown, Info, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useTickerDrawer } from '@/lib/ticker-drawer-context'
import { format as formatDate, getYear } from 'date-fns'
import type { Profile, Transaction, Currency, RealisedGain } from '@/lib/types'

interface Props {
  profile: Profile | null
  transactions: Transaction[]
}

function CustomBarTooltip({ active, payload, label, formatFn }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; fill: string }>
  label?: string
  formatFn: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-lg px-3 py-2 shadow-lg text-xs dark:bg-card">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.fill }} className="font-medium">
          {item.name}: {formatFn(item.value)}
        </p>
      ))}
    </div>
  )
}

export function PnLClient({ profile, transactions }: Props) {
  const { format, convert } = useCurrency()
  const { openTicker } = useTickerDrawer()
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

  const realisedInDisplay: RealisedGain[] = realisedGains.map((g) => ({
    ...g,
    gain: convert(g.gain, g.currency),
    proceeds: convert(g.proceeds, g.currency),
    costBasis: convert(g.costBasis, g.currency),
  }))

  const totalRealised = realisedInDisplay.reduce((s, g) => s + g.gain, 0)
  const totalGains = realisedInDisplay.filter((g) => g.gain > 0).reduce((s, g) => s + g.gain, 0)
  const totalLosses = realisedInDisplay.filter((g) => g.gain < 0).reduce((s, g) => s + g.gain, 0)

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

  const CGT_ALLOWANCE = { UK: 3000, US: 0, EU: 0, OTHER: 0 }
  const currentYear = new Date().getFullYear()
  const thisYearNet = byYear[currentYear]?.net ?? 0
  const allowance = CGT_ALLOWANCE[jurisdiction] ?? 0
  const taxableGain = Math.max(0, thisYearNet - allowance)

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">P&L & Tax</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Performance analysis and tax estimates</p>
        </div>
        <Badge variant="outline" className="text-xs font-semibold">
          {jurisdiction} Tax Rules
        </Badge>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: 'Unrealised P&L',
            value: loading ? null : `${totalUnrealised >= 0 ? '+' : ''}${format(totalUnrealised)}`,
            positive: totalUnrealised >= 0,
            sub: totalCost > 0 ? `${((totalUnrealised / totalCost) * 100).toFixed(2)}%` : null,
          },
          {
            label: 'Realised P&L',
            value: `${totalRealised >= 0 ? '+' : ''}${format(totalRealised)}`,
            positive: totalRealised >= 0,
            sub: `${realisedGains.length} closed trade${realisedGains.length !== 1 ? 's' : ''}`,
          },
          {
            label: 'Total Gains',
            value: `+${format(totalGains)}`,
            positive: true,
            sub: `${realisedInDisplay.filter((g) => g.gain > 0).length} winning trades`,
          },
          {
            label: 'Total Losses',
            value: format(totalLosses),
            positive: false,
            sub: `${realisedInDisplay.filter((g) => g.gain < 0).length} losing trades`,
          },
        ].map((s) => (
          <Card key={s.label} className="border-border">
            <CardContent className="pt-5 pb-4 px-5">
              <p className="stat-label">{s.label}</p>
              {s.value === null ? (
                <Skeleton className="h-7 w-24 mt-2" />
              ) : (
                <p className={`stat-value mt-1.5 flex items-center gap-1 ${s.positive ? 'text-positive' : 'text-negative'}`}>
                  {s.positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {s.value}
                </p>
              )}
              {s.sub && s.value !== null && (
                <p className="text-xs mt-1 text-muted-foreground">{s.sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* UK CGT estimate */}
      {jurisdiction === 'UK' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              UK CGT Estimate {currentYear}/{String(currentYear + 1).slice(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="stat-label">Net Gains This Year</p>
                <p className={`text-xl font-bold mt-1.5 tabular-nums ${thisYearNet >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {format(thisYearNet)}
                </p>
              </div>
              <div>
                <p className="stat-label">Annual Exempt Amount</p>
                <p className="text-xl font-bold mt-1.5 tabular-nums">{format(allowance, 'GBP')}</p>
              </div>
              <div>
                <p className="stat-label">Estimated Taxable Gain</p>
                <p className={`text-xl font-bold mt-1.5 tabular-nums ${taxableGain > 0 ? 'text-[#F59E0B]' : 'text-positive'}`}>
                  {format(taxableGain)}
                </p>
              </div>
            </div>
            {allowance > 0 && thisYearNet > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Annual exempt used</span>
                  <span className="font-medium">{Math.min(100, (thisYearNet / allowance) * 100).toFixed(0)}%</span>
                </div>
                <Progress value={Math.min(100, (thisYearNet / allowance) * 100)} className="h-1.5" />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Estimate only. Uses Section 104 pool method. CGT rates: 10% (basic) / 20% (higher) for shares.
              Consult a tax advisor for official filings.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="unrealised">
        <TabsList className="h-9">
          <TabsTrigger value="unrealised" className="text-xs">Unrealised P&L</TabsTrigger>
          <TabsTrigger value="realised" className="text-xs">Realised Gains</TabsTrigger>
          <TabsTrigger value="chart" className="text-xs">Annual Chart</TabsTrigger>
        </TabsList>

        <TabsContent value="unrealised" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="pl-6">Symbol</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Avg Cost</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Market Value</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead className="text-right pr-6">% P&L</TableHead>
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
                  ) : unrealisedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                        No open positions
                      </TableCell>
                    </TableRow>
                  ) : (
                    unrealisedRows.map((r) => (
                      <TableRow key={r.ticker} className="border-border">
                        <TableCell className="pl-6"><button className="font-semibold text-sm hover:text-[#2563EB] transition-colors" onClick={() => openTicker(r.ticker)}>{r.ticker}</button></TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{r.quantity.toFixed(4)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{format(r.avgCost, r.currency)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {r.p ? format(r.p.price, r.priceCur) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {r.currentValue !== null ? format(r.currentValue) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className={`text-right text-sm font-medium tabular-nums ${r.pnl !== null ? (r.pnl >= 0 ? 'text-positive' : 'text-negative') : 'text-muted-foreground'}`}>
                          {r.pnl !== null ? `${r.pnl >= 0 ? '+' : ''}${format(r.pnl)}` : '—'}
                        </TableCell>
                        <TableCell className={`text-right text-sm pr-6 ${r.pnlPct !== null ? (r.pnlPct >= 0 ? 'text-positive' : 'text-negative') : 'text-muted-foreground'}`}>
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

        <TabsContent value="realised" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="pl-6">Symbol</TableHead>
                    <TableHead>Sold</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Proceeds</TableHead>
                    <TableHead className="text-right">Cost Basis</TableHead>
                    <TableHead className="text-right">Gain / Loss</TableHead>
                    <TableHead className={`text-right ${jurisdiction === 'US' ? '' : 'pr-6'}`}>Return</TableHead>
                    {jurisdiction === 'US' && <TableHead className="pr-6">Term</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {realisedInDisplay.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                        No realised gains or losses yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...realisedInDisplay].reverse().map((g, i) => (
                      <TableRow key={i} className="border-border">
                        <TableCell className="pl-6"><button className="font-semibold text-sm hover:text-[#2563EB] transition-colors" onClick={() => openTicker(g.ticker)}>{g.ticker}</button></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {g.soldAt ? formatDate(new Date(g.soldAt), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{g.quantity.toFixed(4)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{format(g.proceeds)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{format(g.costBasis)}</TableCell>
                        <TableCell className={`text-right text-sm font-medium tabular-nums ${g.gain >= 0 ? 'text-positive' : 'text-negative'}`}>
                          {g.gain >= 0 ? '+' : ''}{format(g.gain)}
                        </TableCell>
                        <TableCell className={`text-right text-sm ${jurisdiction === 'US' ? '' : 'pr-6'} ${g.gainPct >= 0 ? 'text-positive' : 'text-negative'}`}>
                          {g.gainPct >= 0 ? '+' : ''}{g.gainPct.toFixed(2)}%
                        </TableCell>
                        {jurisdiction === 'US' && (
                          <TableCell className="pr-6">
                            <Badge
                              className={`text-xs ${g.isShortTerm
                                ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400'
                                : 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400'
                              }`}
                              variant="outline"
                            >
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

        <TabsContent value="chart" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Annual Realised Gains &amp; Losses</CardTitle>
            </CardHeader>
            <CardContent>
              {yearChartData.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-muted-foreground">No realised gains data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={yearChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => format(v)} width={70} />
                    <Tooltip content={<CustomBarTooltip formatFn={format} />} />
                    <Bar dataKey="Gains" fill="#16A34A" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Losses" fill="#DC2626" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Net" fill="#2563EB" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="flex gap-4 mt-3 justify-center">
                {[['#16A34A', 'Gains'], ['#DC2626', 'Losses'], ['#2563EB', 'Net']].map(([color, label]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
