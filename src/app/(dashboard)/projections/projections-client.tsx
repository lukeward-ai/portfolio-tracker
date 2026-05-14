'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrency } from '@/lib/currency-context'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, Info } from 'lucide-react'
import type { Profile, Transaction, CashPosition, Currency } from '@/lib/types'

interface Props {
  profile: Profile | null
  transactions: Transaction[]
  cashPositions: CashPosition[]
}

const SCENARIO_COLORS = {
  '4%': '#0EA5E9',
  '6%': '#16A34A',
  '8%': '#2563EB',
  '10%': '#7C3AED',
  custom: '#EA580C',
}

const MILESTONE_YEARS = [1, 3, 5, 10, 20, 30]

function projectValue(
  pv: number,
  annualRate: number,
  years: number,
  monthlyContribution: number
): number {
  if (annualRate === 0) return pv + monthlyContribution * 12 * years
  const r = annualRate / 12
  const n = years * 12
  const fvPortfolio = pv * Math.pow(1 + r, n)
  const fvContributions = monthlyContribution * ((Math.pow(1 + r, n) - 1) / r)
  return fvPortfolio + fvContributions
}

function buildChartData(
  pv: number,
  monthlyContribution: number,
  customRate: number | null
) {
  const rates = [0.04, 0.06, 0.08, 0.10]
  if (customRate !== null) rates.push(customRate / 100)

  return Array.from({ length: 31 }, (_, year) => {
    const point: Record<string, number | string> = { year }
    point['4%'] = Math.round(projectValue(pv, 0.04, year, monthlyContribution))
    point['6%'] = Math.round(projectValue(pv, 0.06, year, monthlyContribution))
    point['8%'] = Math.round(projectValue(pv, 0.08, year, monthlyContribution))
    point['10%'] = Math.round(projectValue(pv, 0.10, year, monthlyContribution))
    if (customRate !== null) {
      point['custom'] = Math.round(projectValue(pv, customRate / 100, year, monthlyContribution))
    }
    return point
  })
}

function formatCompact(value: number, symbol: string): string {
  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${symbol}${(value / 1_000).toFixed(0)}K`
  return `${symbol}${value.toFixed(0)}`
}

const CURRENCY_SYMBOLS: Record<Currency, string> = { GBP: '£', USD: '$', EUR: '€' }

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: number
  symbol: string
  format: (n: number) => string
}

function CustomTooltip({ active, payload, label, format }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-lg px-3 py-2.5 shadow-lg text-xs space-y-1 min-w-36">
      <p className="font-semibold text-foreground mb-1.5">Year {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name === 'custom' ? 'Custom' : p.name}</span>
          </div>
          <span className="font-semibold tabular-nums">{format(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function ProjectionsClient({ profile, transactions, cashPositions }: Props) {
  const { convert, format, currency } = useCurrency()
  const symbol = CURRENCY_SYMBOLS[currency]

  const [loadingPrices, setLoadingPrices] = useState(true)
  const [prices, setPrices] = useState<Record<string, { price: number; currency: string }>>({})

  const [startingValue, setStartingValue] = useState<string>('')
  const [monthlyContribution, setMonthlyContribution] = useState<string>('0')
  const [customRate, setCustomRate] = useState<string>('')
  const [showCustom, setShowCustom] = useState(false)

  const { lots } = calculatePnL(transactions, profile?.tax_jurisdiction ?? 'UK')
  const holdings = getHoldings(transactions, lots)
  const tickers = holdings.map((h) => h.ticker)

  useEffect(() => {
    if (tickers.length === 0) { setLoadingPrices(false); return }
    fetch(`/api/prices?tickers=${tickers.join(',')}`)
      .then((r) => r.json())
      .then((d) => setPrices(d.prices ?? {}))
      .catch(() => {})
      .finally(() => setLoadingPrices(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.join(',')])

  const computePortfolioValue = useCallback(() => {
    let total = 0
    for (const h of holdings) {
      const p = prices[h.ticker]
      if (!p) continue
      total += convert(p.price * h.quantity, p.currency as Currency)
    }
    for (const cp of cashPositions) {
      total += convert(cp.amount, cp.currency as Currency)
    }
    return total
  }, [holdings, prices, cashPositions, convert])

  useEffect(() => {
    if (!loadingPrices && startingValue === '') {
      const v = computePortfolioValue()
      if (v > 0) setStartingValue(v.toFixed(2))
    }
  }, [loadingPrices, computePortfolioValue, startingValue])

  const pv = parseFloat(startingValue) || 0
  const monthly = parseFloat(monthlyContribution) || 0
  const customRateNum = showCustom && customRate !== '' ? parseFloat(customRate) : null
  const hasCustom = customRateNum !== null && !isNaN(customRateNum) && customRateNum > 0

  const chartData = buildChartData(pv, monthly, hasCustom ? customRateNum : null)

  const liveValue = computePortfolioValue()
  const displayValue = loadingPrices ? null : liveValue

  return (
    <div className="space-y-7">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Portfolio Projections</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Model how your portfolio could grow over time based on different return assumptions.
        </p>
      </div>

      {/* Current value hero */}
      <Card className="border-[#2563EB]/20 bg-[#2563EB]/5">
        <CardContent className="pt-5 pb-4 px-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-[#2563EB]" />
            <p className="stat-label text-[#2563EB]">Current Portfolio Value</p>
          </div>
          {loadingPrices ? (
            <div className="h-9 w-40 bg-[#2563EB]/10 rounded-md animate-pulse mt-1" />
          ) : (
            <p className="text-3xl font-bold tracking-tight tabular-nums">
              {displayValue !== null ? format(displayValue) : '—'}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Holdings + cash at current prices</p>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader className="pb-3 pt-5 px-5">
          <CardTitle className="text-sm font-semibold">Projection Settings</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Starting Value ({symbol})
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={startingValue}
                onChange={(e) => setStartingValue(e.target.value)}
                className="w-full h-9 px-3 text-sm tabular-nums rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                placeholder="0.00"
              />
              <p className="text-[11px] text-muted-foreground">Pre-filled from your portfolio</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Monthly Contribution ({symbol})
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={monthlyContribution}
                onChange={(e) => setMonthlyContribution(e.target.value)}
                className="w-full h-9 px-3 text-sm tabular-nums rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                placeholder="0.00"
              />
              <p className="text-[11px] text-muted-foreground">Optional regular investment</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Custom Rate (%)</label>
                <button
                  onClick={() => setShowCustom((v) => !v)}
                  className="text-[11px] font-medium text-[#2563EB] hover:underline"
                >
                  {showCustom ? 'Remove' : 'Add custom'}
                </button>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                disabled={!showCustom}
                className="w-full h-9 px-3 text-sm tabular-nums rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed"
                placeholder="e.g. 12"
              />
              <p className="text-[11px] text-muted-foreground">Your own return assumption</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-sm font-semibold">Growth Projections</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pt-4 pb-4">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                label={{ value: 'Year', position: 'insideBottom', offset: -2, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCompact(v, symbol)}
                width={60}
              />
              <Tooltip content={<CustomTooltip symbol={symbol} format={format} active={false} payload={[]} label={0} />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                formatter={(value) => value === 'custom' && customRateNum ? `${customRateNum}% (custom)` : value}
              />
              <Line type="monotone" dataKey="4%" stroke={SCENARIO_COLORS['4%']} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="6%" stroke={SCENARIO_COLORS['6%']} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="8%" stroke={SCENARIO_COLORS['8%']} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="10%" stroke={SCENARIO_COLORS['10%']} strokeWidth={2} dot={false} />
              {hasCustom && (
                <Line
                  type="monotone"
                  dataKey="custom"
                  stroke={SCENARIO_COLORS.custom}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Milestone table */}
      <Card>
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-sm font-semibold">Milestone Projections</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0 mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left pl-5 pr-3 py-2.5 text-xs font-semibold text-muted-foreground">Year</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold" style={{ color: SCENARIO_COLORS['4%'] }}>4% p.a.</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold" style={{ color: SCENARIO_COLORS['6%'] }}>6% p.a.</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold" style={{ color: SCENARIO_COLORS['8%'] }}>8% p.a.</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold" style={{ color: SCENARIO_COLORS['10%'] }}>10% p.a.</th>
                  {hasCustom && (
                    <th className="text-right px-3 py-2.5 pr-5 text-xs font-semibold" style={{ color: SCENARIO_COLORS.custom }}>
                      {customRateNum}% p.a.
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {MILESTONE_YEARS.map((year, idx) => {
                  const row = chartData[year]
                  const isLast = idx === MILESTONE_YEARS.length - 1
                  return (
                    <tr key={year} className={`${!isLast ? 'border-b border-border/60' : ''} hover:bg-muted/20 transition-colors`}>
                      <td className="pl-5 pr-3 py-3 font-semibold">
                        <span className="text-foreground">Year {year}</span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">{format(Number(row['4%']))}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">{format(Number(row['6%']))}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">{format(Number(row['8%']))}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">{format(Number(row['10%']))}</td>
                      {hasCustom && (
                        <td className="px-3 py-3 pr-5 text-right tabular-nums font-medium">
                          {format(Number(row['custom']))}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Projections are estimates only</span> and do not guarantee future returns.
          These calculations are based on fixed annual return assumptions using compound growth and do not account for
          volatility, fees, taxes, currency changes, inflation, or market timing. Past performance is not indicative of future results.
          This is not financial advice.
        </p>
      </div>
    </div>
  )
}
