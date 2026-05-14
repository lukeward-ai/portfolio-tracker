'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrency } from '@/lib/currency-context'
import { savePortfolioSnapshot, getPortfolioSnapshots } from './actions'
import { toast } from 'sonner'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { History, TrendingUp, TrendingDown, Save, Calendar, BarChart3, DatabaseZap } from 'lucide-react'
import { format as formatDate, parseISO } from 'date-fns'
import type { PortfolioSnapshot } from '@/lib/types'

type Range = '7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL'
const RANGES: Range[] = ['7D', '1M', '3M', '6M', '1Y', 'ALL']

interface Props {
  initialSnapshots: PortfolioSnapshot[]
}

function StatRow({ label, value, positive }: { label: string; value: string; positive?: boolean | null }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${positive === true ? 'text-green-600' : positive === false ? 'text-red-600' : ''}`}>
        {value}
      </span>
    </div>
  )
}

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
  format: (n: number) => string
}

function ChartTooltip({ active, payload, label, format }: ChartTooltipProps) {
  if (!active || !payload?.length || !label) return null
  const value = payload[0].value
  return (
    <div className="bg-white border border-border rounded-lg px-3 py-2.5 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-0.5">
        {formatDate(parseISO(label), 'd MMM yyyy')}
      </p>
      <p className="text-muted-foreground">Portfolio Value: <span className="font-semibold text-foreground">{format(value)}</span></p>
    </div>
  )
}

function formatCompact(value: number, symbol: string): string {
  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${symbol}${(value / 1_000).toFixed(0)}K`
  return `${symbol}${value.toFixed(0)}`
}

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }

export function HistoryClient({ initialSnapshots }: Props) {
  const { format, currency } = useCurrency()
  const symbol = CURRENCY_SYMBOLS[currency] ?? '£'

  const [snapshots, setSnapshots] = useState(initialSnapshots)
  const [range, setRange] = useState<Range>('1Y')
  const [selectedSnapshot, setSelectedSnapshot] = useState<PortfolioSnapshot | null>(
    initialSnapshots.length > 0 ? initialSnapshots[initialSnapshots.length - 1] : null
  )
  const [isPending, startTransition] = useTransition()
  const [isBackfilling, setIsBackfilling] = useState(false)

  function handleRangeChange(r: Range) {
    setRange(r)
    startTransition(async () => {
      const data = await getPortfolioSnapshots(r)
      setSnapshots(data)
      if (data.length > 0) setSelectedSnapshot(data[data.length - 1])
    })
  }

  async function handleBackfill() {
    setIsBackfilling(true)
    try {
      const res = await fetch('/api/portfolio-snapshots/backfill', { method: 'POST' })
      const json = await res.json()
      if (json.error) {
        toast.error(`Backfill failed: ${json.error}`)
      } else {
        toast.success(`Backfilled ${json.count} historical snapshots`)
        startTransition(async () => {
          const updated = await getPortfolioSnapshots('ALL')
          setSnapshots(updated)
          if (updated.length > 0) setSelectedSnapshot(updated[updated.length - 1])
        })
      }
    } catch {
      toast.error('Backfill failed — please try again')
    } finally {
      setIsBackfilling(false)
    }
  }

  async function handleSaveSnapshot() {
    const { data, error } = await savePortfolioSnapshot()
    if (error) {
      toast.error(`Failed to save snapshot: ${error}`)
      return
    }
    toast.success('Snapshot saved successfully')
    if (data) {
      startTransition(async () => {
        const updated = await getPortfolioSnapshots(range)
        setSnapshots(updated)
        setSelectedSnapshot(data)
      })
    }
  }

  const chartData = snapshots.map((s) => ({
    date: s.snapshot_date,
    value: s.portfolio_value,
  }))

  const firstSnapshot = snapshots[0]
  const latestSnapshot = snapshots[snapshots.length - 1]
  const valueChange = firstSnapshot && latestSnapshot
    ? latestSnapshot.portfolio_value - firstSnapshot.portfolio_value
    : null
  const valueChangePct = firstSnapshot && firstSnapshot.portfolio_value > 0 && valueChange !== null
    ? (valueChange / firstSnapshot.portfolio_value) * 100
    : null

  if (snapshots.length === 0 && initialSnapshots.length === 0) {
    return (
      <div className="space-y-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Portfolio History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track how your portfolio value changes over time.
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <History className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No portfolio history yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Save your first portfolio snapshot to start tracking how your portfolio changes over time.
              </p>
            </div>
            <button
              onClick={handleBackfill}
              disabled={isBackfilling || isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
            >
              <DatabaseZap className="h-4 w-4" />
              {isBackfilling ? 'Fetching historical prices…' : 'Populate History from Transactions'}
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-7">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Portfolio History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track how your portfolio value changes over time.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleBackfill}
            disabled={isBackfilling || isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors disabled:opacity-60"
          >
            <DatabaseZap className="h-3.5 w-3.5" />
            {isBackfilling ? 'Fetching…' : 'Backfill History'}
          </button>
          <button
            onClick={handleSaveSnapshot}
            disabled={isPending || isBackfilling}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {isPending ? 'Saving…' : 'Save Today\'s Snapshot'}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {latestSnapshot && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-[#2563EB]/20 bg-[#2563EB]/5">
            <CardContent className="pt-5 pb-4 px-5">
              <p className="stat-label text-[#2563EB]">Latest Portfolio Value</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums mt-1">
                {format(latestSnapshot.portfolio_value)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(parseISO(latestSnapshot.snapshot_date), 'd MMM yyyy')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <p className="stat-label">Total Return</p>
              <p className={`text-2xl font-bold tracking-tight tabular-nums mt-1 ${latestSnapshot.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {latestSnapshot.total_return >= 0 ? '+' : ''}{format(latestSnapshot.total_return)}
              </p>
              <p className={`text-xs font-medium mt-1 ${latestSnapshot.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {latestSnapshot.total_return_percentage >= 0 ? '+' : ''}{latestSnapshot.total_return_percentage.toFixed(2)}% all time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5 pb-4 px-5">
              <p className="stat-label">Period Change</p>
              {valueChange !== null ? (
                <>
                  <p className={`text-2xl font-bold tracking-tight tabular-nums mt-1 ${valueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {valueChange >= 0 ? '+' : ''}{format(valueChange)}
                  </p>
                  <p className={`text-xs font-medium mt-1 ${valueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {valueChangePct !== null ? `${valueChangePct >= 0 ? '+' : ''}${valueChangePct.toFixed(2)}%` : ''} ({range})
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold tabular-nums mt-1 text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader className="pb-0 pt-5 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#2563EB]" />
              Portfolio Value Over Time
            </CardTitle>
            {/* Range controls */}
            <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => handleRangeChange(r)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    range === r
                      ? 'bg-white text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 pt-4 pb-4">
          {snapshots.length < 2 ? (
            <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
              Not enough snapshots to draw a chart. Save more snapshots over time.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d) => {
                    try { return formatDate(parseISO(d), 'd MMM') } catch { return d }
                  }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCompact(v, symbol)}
                  width={60}
                />
                <Tooltip content={<ChartTooltip format={format} />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="url(#portfolioGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#2563EB' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Snapshot list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Snapshot selector */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#2563EB]" />
              Snapshots ({snapshots.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="max-h-80 overflow-y-auto">
              {[...snapshots].reverse().map((s) => {
                const isSelected = selectedSnapshot?.id === s.id
                const positive = s.total_return >= 0
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSnapshot(s)}
                    className={`w-full flex items-center justify-between px-5 py-3 text-left border-b border-border/60 last:border-0 transition-colors ${
                      isSelected ? 'bg-[#2563EB]/5' : 'hover:bg-muted/40'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        {formatDate(parseISO(s.snapshot_date), 'd MMM yyyy')}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {s.holdings_count} holding{s.holdings_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold tabular-nums">{format(s.portfolio_value)}</p>
                      <p className={`text-[11px] font-medium ${positive ? 'text-green-600' : 'text-red-600'}`}>
                        {positive ? '+' : ''}{s.total_return_percentage.toFixed(2)}%
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Snapshot detail */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-semibold">
              {selectedSnapshot
                ? `Snapshot — ${formatDate(parseISO(selectedSnapshot.snapshot_date), 'd MMMM yyyy')}`
                : 'Select a snapshot'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {!selectedSnapshot ? (
              <p className="text-sm text-muted-foreground">Click a snapshot on the left to view details.</p>
            ) : (
              <div className="space-y-4">
                {/* Hero value */}
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <div>
                    <p className="text-3xl font-bold tabular-nums">{format(selectedSnapshot.portfolio_value)}</p>
                    <div className={`flex items-center gap-1 mt-1 ${selectedSnapshot.total_return >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedSnapshot.total_return >= 0
                        ? <TrendingUp className="h-3.5 w-3.5" />
                        : <TrendingDown className="h-3.5 w-3.5" />
                      }
                      <span className="text-sm font-semibold">
                        {selectedSnapshot.total_return >= 0 ? '+' : ''}{format(selectedSnapshot.total_return)}&nbsp;
                        ({selectedSnapshot.total_return_percentage >= 0 ? '+' : ''}{selectedSnapshot.total_return_percentage.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <div>
                    <StatRow label="Holdings Value" value={format(selectedSnapshot.holdings_value)} />
                    <StatRow label="Cash Balance" value={format(selectedSnapshot.cash_balance)} />
                    <StatRow label="Amount Invested" value={format(selectedSnapshot.net_contributions)} />
                    <StatRow label="Holdings Count" value={String(selectedSnapshot.holdings_count)} />
                  </div>
                  <div>
                    <StatRow
                      label="Unrealised Gain/Loss"
                      value={`${selectedSnapshot.unrealised_gain_loss >= 0 ? '+' : ''}${format(selectedSnapshot.unrealised_gain_loss)}`}
                      positive={selectedSnapshot.unrealised_gain_loss >= 0 ? true : false}
                    />
                    <StatRow
                      label="Realised Gain/Loss"
                      value={`${selectedSnapshot.realised_gain_loss >= 0 ? '+' : ''}${format(selectedSnapshot.realised_gain_loss)}`}
                      positive={selectedSnapshot.realised_gain_loss >= 0 ? true : false}
                    />
                    <StatRow
                      label="Total Return"
                      value={`${selectedSnapshot.total_return >= 0 ? '+' : ''}${format(selectedSnapshot.total_return)}`}
                      positive={selectedSnapshot.total_return >= 0 ? true : false}
                    />
                    <StatRow
                      label="Return %"
                      value={`${selectedSnapshot.total_return_percentage >= 0 ? '+' : ''}${selectedSnapshot.total_return_percentage.toFixed(2)}%`}
                      positive={selectedSnapshot.total_return_percentage >= 0 ? true : false}
                    />
                  </div>
                </div>

                {/* Holdings breakdown */}
                {selectedSnapshot.metadata?.holdings && selectedSnapshot.metadata.holdings.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Holdings Breakdown</p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Symbol</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Qty</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Market Value</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">P&L</th>
                            <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Weight</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSnapshot.metadata.holdings.map((h, i) => (
                            <tr key={h.ticker} className={i < selectedSnapshot.metadata!.holdings!.length - 1 ? 'border-b border-border/60' : ''}>
                              <td className="px-3 py-2 font-semibold">{h.ticker}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{h.quantity.toFixed(4)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{format(h.market_value)}</td>
                              <td className={`px-3 py-2 text-right tabular-nums font-medium ${h.unrealised_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {h.unrealised_gain_loss >= 0 ? '+' : ''}{format(h.unrealised_gain_loss)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{h.allocation_pct.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
