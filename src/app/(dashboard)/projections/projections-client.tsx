'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrency } from '@/lib/currency-context'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import {
  AreaChart,
  Area,
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

const RATE_OPTIONS = [
  { label: '4%', value: 4 },
  { label: '6%', value: 6 },
  { label: '8%', value: 8 },
  { label: '10%', value: 10 },
]

const TIMEFRAME_OPTIONS = [
  { label: '10 years', value: 10 },
  { label: '20 years', value: 20 },
  { label: '30 years', value: 30 },
]

function projectValueMonthly(pv: number, annualRate: number, months: number, monthlyContribution: number): number {
  if (annualRate === 0) return pv + monthlyContribution * months
  const r = annualRate / 100 / 12
  return pv * Math.pow(1 + r, months) + monthlyContribution * ((Math.pow(1 + r, months) - 1) / r)
}

function buildBreakdownData(pv: number, monthly: number, annualRate: number, years: number) {
  return Array.from({ length: years + 1 }, (_, year) => {
    const months = year * 12
    const portfolioValue = Math.round(projectValueMonthly(pv, annualRate, months, monthly))
    const contributions = Math.round(pv + monthly * months)
    const gains = Math.max(0, portfolioValue - contributions)
    return { year, portfolioValue, contributions, gains }
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
  format: (n: number) => string
}

function CustomTooltip({ active, payload, label, format }: TooltipProps) {
  if (!active || !payload?.length) return null
  const labelMap: Record<string, string> = {
    portfolioValue: 'Portfolio Value',
    contributions: 'Contributions',
    gains: 'Projected Gains',
  }
  return (
    <div className="bg-white border border-border rounded-lg px-3 py-2.5 shadow-lg text-xs space-y-1 min-w-44">
      <p className="font-semibold text-foreground mb-1.5">Year {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{labelMap[p.name] ?? p.name}</span>
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
  const [selectedRate, setSelectedRate] = useState<number>(8)
  const [customRate, setCustomRate] = useState<string>('')
  const [showCustom, setShowCustom] = useState(false)
  const [timeframeYears, setTimeframeYears] = useState<number>(20)

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
  const activeRate = (showCustom && customRateNum && !isNaN(customRateNum) && customRateNum > 0)
    ? customRateNum
    : selectedRate

  const chartData = buildBreakdownData(pv, monthly, activeRate, timeframeYears)

  const liveValue = computePortfolioValue()
  const displayValue = loadingPrices ? null : liveValue

  const finalValue = chartData[chartData.length - 1]

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <label className="text-xs font-medium text-muted-foreground">Annual Growth Rate</label>
              {showCustom ? (
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={customRate}
                    onChange={(e) => setCustomRate(e.target.value)}
                    className="flex-1 h-9 px-3 text-sm tabular-nums rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                    placeholder="e.g. 12"
                    autoFocus
                  />
                  <button
                    onClick={() => { setShowCustom(false); setCustomRate('') }}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex gap-1">
                  {RATE_OPTIONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setSelectedRate(r.value)}
                      className={`flex-1 h-9 text-xs font-medium rounded-lg border transition-colors ${
                        selectedRate === r.value
                          ? 'bg-[#2563EB] text-white border-[#2563EB]'
                          : 'border-border text-muted-foreground hover:border-[#2563EB]/40 hover:text-foreground'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
              {!showCustom && (
                <button
                  onClick={() => setShowCustom(true)}
                  className="text-[11px] text-[#2563EB] hover:underline"
                >
                  Use custom rate
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Timeframe</label>
              <div className="flex gap-1">
                {TIMEFRAME_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTimeframeYears(t.value)}
                    className={`flex-1 h-9 text-xs font-medium rounded-lg border transition-colors ${
                      timeframeYears === t.value
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Projection horizon</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-0 pt-5 px-5">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-semibold">Projected Growth Breakdown</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Portfolio value, contributions and projected gains over {timeframeYears} years at {activeRate}% p.a.
              </p>
            </div>
            {finalValue && pv > 0 && (
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Projected value in {timeframeYears}y</p>
                <p className="text-sm font-bold text-[#2563EB]">{format(finalValue.portfolioValue)}</p>
                <p className="text-xs text-[#16A34A]">+{format(finalValue.gains)} gains</p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 pb-4">
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="gradPortfolio" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGains" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16A34A" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradContributions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748B" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#64748B" stopOpacity={0} />
                </linearGradient>
              </defs>
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
              <Tooltip content={<CustomTooltip format={format} active={false} payload={[]} label={0} />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                formatter={(value) => {
                  if (value === 'portfolioValue') return 'Portfolio Value'
                  if (value === 'contributions') return 'Contributions'
                  if (value === 'gains') return 'Projected Gains'
                  return value
                }}
              />
              <Area
                type="monotone"
                dataKey="portfolioValue"
                stroke="#2563EB"
                strokeWidth={2.5}
                fill="url(#gradPortfolio)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="contributions"
                stroke="#64748B"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                fill="url(#gradContributions)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="gains"
                stroke="#16A34A"
                strokeWidth={2}
                fill="url(#gradGains)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">Projections are estimates only</span> and do not guarantee future returns.
          Projected gains are estimated using the selected annual growth rate and monthly compounding.
          These calculations do not account for volatility, fees, taxes, currency changes, inflation, or market timing.
          Past performance is not indicative of future results. This is not financial advice.
        </p>
      </div>
    </div>
  )
}
