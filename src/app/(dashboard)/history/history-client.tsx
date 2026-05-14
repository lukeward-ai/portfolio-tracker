'use client'

import { useState, useTransition, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrency } from '@/lib/currency-context'
import { savePortfolioSnapshot, getPortfolioSnapshots } from './actions'
import { toast } from 'sonner'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import {
  History, TrendingUp, TrendingDown, Save, Calendar,
  BarChart3, DatabaseZap, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react'
import { format as formatDate, parseISO } from 'date-fns'
import type { PortfolioSnapshot } from '@/lib/types'
import { cn } from '@/lib/utils'

type Range = '7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL'
const RANGES: Range[] = ['7D', '1M', '3M', '6M', '1Y', 'ALL']

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' }

interface EnrichedPoint {
  date: string
  portfolioValue: number
  netContributions: number
  investmentGain: number
  investmentReturnPct: number
  dailyChange: number
  depositAmount: number
  withdrawalAmount: number
}

function enrichSnapshots(snapshots: PortfolioSnapshot[]): EnrichedPoint[] {
  return snapshots.map((s, i) => {
    const prev = i > 0 ? snapshots[i - 1] : null
    const dailyChange = prev ? s.portfolio_value - prev.portfolio_value : 0
    const prevContrib = prev?.net_contributions ?? s.net_contributions
    const contribDelta = s.net_contributions - prevContrib
    const investmentGain = s.portfolio_value - s.net_contributions
    const investmentReturnPct =
      s.net_contributions > 0 ? (investmentGain / s.net_contributions) * 100 : 0
    return {
      date: s.snapshot_date,
      portfolioValue: s.portfolio_value,
      netContributions: s.net_contributions,
      investmentGain,
      investmentReturnPct,
      dailyChange,
      depositAmount: contribDelta > 1 ? contribDelta : 0,
      withdrawalAmount: contribDelta < -1 ? -contribDelta : 0,
    }
  })
}

function formatCompact(value: number, symbol: string): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(0)}K`
  return `${sign}${symbol}${abs.toFixed(0)}`
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: EnrichedPoint }>
  label?: string
  format: (n: number) => string
  performanceMode: boolean
}

function ChartTooltip({ active, payload, label, format, performanceMode }: TooltipProps) {
  if (!active || !payload?.length || !label) return null
  const d = payload[0].payload

  function Row({
    label: l, value, color,
  }: { label: string; value: string; color?: 'green' | 'red' | 'muted' }) {
    return (
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted-foreground">{l}</span>
        <span className={cn(
          'font-semibold tabular-nums',
          color === 'green' && 'text-green-600',
          color === 'red' && 'text-red-600',
          color === 'muted' && 'text-muted-foreground',
        )}>{value}</span>
      </div>
    )
  }

  const sign = (n: number) => (n >= 0 ? '+' : '')

  return (
    <div className="bg-white border border-border rounded-lg px-3.5 py-3 shadow-lg text-xs space-y-1.5 min-w-52">
      <p className="font-semibold text-foreground text-[13px] pb-1 border-b border-border/60">
        {formatDate(parseISO(label), 'd MMM yyyy')}
      </p>

      {!performanceMode && (
        <Row label="Portfolio Value" value={format(d.portfolioValue)} />
      )}
      {d.dailyChange !== 0 && (
        <Row
          label="Daily Change"
          value={`${sign(d.dailyChange)}${format(d.dailyChange)}`}
          color={d.dailyChange >= 0 ? 'green' : 'red'}
        />
      )}

      {(d.depositAmount > 0 || d.withdrawalAmount > 0) && (
        <div className="border-t border-border/60 pt-1.5 space-y-1.5">
          {d.depositAmount > 0 && (
            <Row label="Deposit" value={`+${format(d.depositAmount)}`} color="green" />
          )}
          {d.withdrawalAmount > 0 && (
            <Row label="Withdrawal" value={`-${format(d.withdrawalAmount)}`} color="red" />
          )}
        </div>
      )}

      <div className="border-t border-border/60 pt-1.5 space-y-1.5">
        <Row label="Net Contributions" value={format(d.netContributions)} color="muted" />
        <Row
          label="Investment Gain"
          value={`${sign(d.investmentGain)}${format(d.investmentGain)}`}
          color={d.investmentGain >= 0 ? 'green' : 'red'}
        />
        <Row
          label="Investment Return"
          value={`${sign(d.investmentReturnPct)}${d.investmentReturnPct.toFixed(2)}%`}
          color={d.investmentReturnPct >= 0 ? 'green' : 'red'}
        />
      </div>
    </div>
  )
}

function StatRow({ label, value, positive }: { label: string; value: string; positive?: boolean | null }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        'text-xs font-semibold tabular-nums',
        positive === true && 'text-green-600',
        positive === false && 'text-red-600',
      )}>{value}</span>
    </div>
  )
}

function Toggle({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
        active
          ? 'bg-foreground text-background border-foreground'
          : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
      )}
    >
      {children}
    </button>
  )
}

interface Props { initialSnapshots: PortfolioSnapshot[] }

export function HistoryClient({ initialSnapshots }: Props) {
  const { format, currency } = useCurrency()
  const symbol = CURRENCY_SYMBOLS[currency] ?? '£'

  const [snapshots, setSnapshots] = useState(initialSnapshots)
  const [range, setRange] = useState<Range>('1Y')
  const [selectedSnapshot, setSelectedSnapshot] = useState<PortfolioSnapshot | null>(
    initialSnapshots.length > 0 ? initialSnapshots[initialSnapshots.length - 1] : null,
  )
  const [isPending, startTransition] = useTransition()
  const [isBackfilling, setIsBackfilling] = useState(false)

  // Chart toggles
  const [showDeposits, setShowDeposits] = useState(true)
  const [showContributions, setShowContributions] = useState(false)
  const [performanceMode, setPerformanceMode] = useState(false)

  const enrichedData = useMemo(() => enrichSnapshots(snapshots), [snapshots])

  const depositDates = useMemo(
    () => enrichedData.filter((d) => d.depositAmount > 0).map((d) => d.date),
    [enrichedData],
  )
  const withdrawalDates = useMemo(
    () => enrichedData.filter((d) => d.withdrawalAmount > 0).map((d) => d.date),
    [enrichedData],
  )

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
    if (error) { toast.error(`Failed to save snapshot: ${error}`); return }
    toast.success('Snapshot saved successfully')
    if (data) {
      startTransition(async () => {
        const updated = await getPortfolioSnapshots(range)
        setSnapshots(updated)
        setSelectedSnapshot(data)
      })
    }
  }

  const latestSnapshot = snapshots[snapshots.length - 1]
  const latestEnriched = enrichedData[enrichedData.length - 1]
  const firstEnriched = enrichedData[0]
  const valueChange = firstEnriched && latestEnriched
    ? latestEnriched.portfolioValue - firstEnriched.portfolioValue : null
  const valueChangePct = firstEnriched && firstEnriched.portfolioValue > 0 && valueChange !== null
    ? (valueChange / firstEnriched.portfolioValue) * 100 : null

  // Empty state
  if (snapshots.length === 0 && initialSnapshots.length === 0) {
    return (
      <div className="space-y-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Portfolio History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track how your portfolio value changes over time.</p>
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
          <p className="text-sm text-muted-foreground mt-0.5">Track how your portfolio value changes over time.</p>
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
            {isPending ? 'Saving…' : "Save Today's Snapshot"}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {latestSnapshot && latestEnriched && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-[#2563EB]/20 bg-[#2563EB]/5">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="stat-label text-[#2563EB]">Portfolio Value</p>
              <p className="text-xl font-bold tracking-tight tabular-nums mt-1">
                {format(latestSnapshot.portfolio_value)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatDate(parseISO(latestSnapshot.snapshot_date), 'd MMM yyyy')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="stat-label">Investment Gain</p>
              <p className={cn('text-xl font-bold tracking-tight tabular-nums mt-1',
                latestEnriched.investmentGain >= 0 ? 'text-green-600' : 'text-red-600')}>
                {latestEnriched.investmentGain >= 0 ? '+' : ''}{format(latestEnriched.investmentGain)}
              </p>
              <p className={cn('text-[11px] font-medium mt-0.5',
                latestEnriched.investmentReturnPct >= 0 ? 'text-green-600' : 'text-red-600')}>
                {latestEnriched.investmentReturnPct >= 0 ? '+' : ''}
                {latestEnriched.investmentReturnPct.toFixed(2)}% return
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="stat-label">Net Contributions</p>
              <p className="text-xl font-bold tracking-tight tabular-nums mt-1">
                {format(latestSnapshot.net_contributions)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Total deployed</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="stat-label">Period Change</p>
              {valueChange !== null ? (
                <>
                  <p className={cn('text-xl font-bold tracking-tight tabular-nums mt-1',
                    valueChange >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {valueChange >= 0 ? '+' : ''}{format(valueChange)}
                  </p>
                  <p className={cn('text-[11px] font-medium mt-0.5',
                    valueChange >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {valueChangePct !== null ? `${valueChangePct >= 0 ? '+' : ''}${valueChangePct.toFixed(2)}%` : ''} ({range})
                  </p>
                </>
              ) : (
                <p className="text-xl font-bold tabular-nums mt-1 text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader className="pb-0 pt-5 px-5">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#2563EB]" />
              {performanceMode ? 'Investment Performance' : 'Portfolio Value Over Time'}
            </CardTitle>

            <div className="flex flex-wrap items-center gap-2">
              {/* Chart view toggles */}
              <div className="flex items-center gap-1.5">
                <Toggle active={showDeposits} onClick={() => setShowDeposits((v) => !v)}>
                  <ArrowDownLeft className="h-3 w-3" />
                  Cashflows
                </Toggle>
                <Toggle active={showContributions} onClick={() => setShowContributions((v) => !v)}>
                  Contributions
                </Toggle>
                <Toggle active={performanceMode} onClick={() => setPerformanceMode((v) => !v)}>
                  Performance Only
                </Toggle>
              </div>

              {/* Range selector */}
              <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-1">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRangeChange(r)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                      range === r ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-2 pt-4 pb-2">
          {snapshots.length < 2 ? (
            <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
              Not enough snapshots to draw a chart. Save more snapshots over time.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={enrichedData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gainGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16A34A" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.6} />

                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(d) => { try { return formatDate(parseISO(d), 'd MMM') } catch { return d } }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatCompact(v, performanceMode ? (v >= 0 ? `+${symbol}` : `-${symbol}`) : symbol)}
                    width={64}
                  />

                  <Tooltip
                    content={
                      <ChartTooltip
                        format={format}
                        performanceMode={performanceMode}
                        active={false}
                        payload={[]}
                        label=""
                      />
                    }
                  />

                  {/* Deposit reference lines */}
                  {showDeposits && depositDates.map((date) => (
                    <ReferenceLine
                      key={`dep-${date}`}
                      x={date}
                      stroke="#16A34A"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      strokeOpacity={0.55}
                    />
                  ))}

                  {/* Withdrawal reference lines */}
                  {showDeposits && withdrawalDates.map((date) => (
                    <ReferenceLine
                      key={`wit-${date}`}
                      x={date}
                      stroke="#DC2626"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      strokeOpacity={0.55}
                    />
                  ))}

                  {/* Cumulative contributions line */}
                  {showContributions && (
                    <Line
                      type="monotone"
                      dataKey="netContributions"
                      stroke="#16A34A"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={false}
                      name="Net Contributions"
                    />
                  )}

                  {/* Main value area — portfolio mode */}
                  {!performanceMode && (
                    <Area
                      type="monotone"
                      dataKey="portfolioValue"
                      stroke="#2563EB"
                      strokeWidth={2}
                      fill="url(#portfolioGradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#2563EB' }}
                      name="Portfolio Value"
                    />
                  )}

                  {/* Investment gain area — performance mode */}
                  {performanceMode && (
                    <Area
                      type="monotone"
                      dataKey="investmentGain"
                      stroke="#16A34A"
                      strokeWidth={2}
                      fill="url(#gainGradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#16A34A' }}
                      baseValue={0}
                      name="Investment Gain"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>

              {/* Legend / helper text */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-3 pt-2 pb-1">
                {!performanceMode && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-0.5 w-5 bg-[#2563EB] rounded-full" />
                    <span className="text-[11px] text-muted-foreground">Portfolio Value</span>
                  </div>
                )}
                {performanceMode && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-0.5 w-5 bg-green-600 rounded-full" />
                    <span className="text-[11px] text-muted-foreground">Investment Gain (excl. deposits)</span>
                  </div>
                )}
                {showContributions && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-px w-5 border-t border-dashed border-green-600" />
                    <span className="text-[11px] text-muted-foreground">Net Contributions</span>
                  </div>
                )}
                {showDeposits && depositDates.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-px border-l border-dashed border-green-600" />
                    <span className="text-[11px] text-muted-foreground">Deposit</span>
                  </div>
                )}
                {showDeposits && withdrawalDates.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-4 w-px border-l border-dashed border-red-600" />
                    <span className="text-[11px] text-muted-foreground">Withdrawal / sell</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground px-3 pb-3 leading-relaxed">
                {performanceMode
                  ? 'Performance Only removes cashflows to show your true investment growth — deposits and withdrawals no longer cause jumps in the chart.'
                  : 'Portfolio Value includes market movement plus deposits and withdrawals. Switch to Performance Only to isolate true investment growth.'}
              </p>
            </>
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
                const enriched = enrichedData.find((e) => e.date === s.snapshot_date)
                const isSelected = selectedSnapshot?.id === s.id
                const positive = s.total_return >= 0
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSnapshot(s)}
                    className={cn(
                      'w-full flex items-center justify-between px-5 py-3 text-left border-b border-border/60 last:border-0 transition-colors',
                      isSelected ? 'bg-[#2563EB]/5' : 'hover:bg-muted/40',
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-foreground">
                          {formatDate(parseISO(s.snapshot_date), 'd MMM yyyy')}
                        </p>
                        {enriched && enriched.depositAmount > 0 && (
                          <ArrowDownLeft className="h-3 w-3 text-green-600" />
                        )}
                        {enriched && enriched.withdrawalAmount > 0 && (
                          <ArrowUpRight className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {s.holdings_count} holding{s.holdings_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold tabular-nums">{format(s.portfolio_value)}</p>
                      <p className={cn('text-[11px] font-medium',
                        positive ? 'text-green-600' : 'text-red-600')}>
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
            ) : (() => {
              const enriched = enrichedData.find((e) => e.date === selectedSnapshot.snapshot_date)
              return (
                <div className="space-y-4">
                  {/* Hero */}
                  <div className="flex items-start justify-between pb-3 border-b border-border">
                    <div>
                      <p className="text-3xl font-bold tabular-nums">{format(selectedSnapshot.portfolio_value)}</p>
                      <div className={cn('flex items-center gap-1 mt-1',
                        selectedSnapshot.total_return >= 0 ? 'text-green-600' : 'text-red-600')}>
                        {selectedSnapshot.total_return >= 0
                          ? <TrendingUp className="h-3.5 w-3.5" />
                          : <TrendingDown className="h-3.5 w-3.5" />}
                        <span className="text-sm font-semibold">
                          {selectedSnapshot.total_return >= 0 ? '+' : ''}{format(selectedSnapshot.total_return)}&nbsp;
                          ({selectedSnapshot.total_return_percentage >= 0 ? '+' : ''}{selectedSnapshot.total_return_percentage.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                    {enriched && (enriched.depositAmount > 0 || enriched.withdrawalAmount > 0) && (
                      <div className="flex flex-col items-end gap-1">
                        {enriched.depositAmount > 0 && (
                          <div className="flex items-center gap-1.5 text-green-600 text-xs font-semibold">
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                            +{format(enriched.depositAmount)} deployed
                          </div>
                        )}
                        {enriched.withdrawalAmount > 0 && (
                          <div className="flex items-center gap-1.5 text-red-600 text-xs font-semibold">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                            -{format(enriched.withdrawalAmount)} withdrawn
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                    <div>
                      <StatRow label="Holdings Value" value={format(selectedSnapshot.holdings_value)} />
                      <StatRow label="Cash Balance" value={format(selectedSnapshot.cash_balance)} />
                      <StatRow label="Net Contributions" value={format(selectedSnapshot.net_contributions)} />
                      <StatRow label="Holdings Count" value={String(selectedSnapshot.holdings_count)} />
                    </div>
                    <div>
                      <StatRow
                        label="Investment Gain"
                        value={`${enriched && enriched.investmentGain >= 0 ? '+' : ''}${format(enriched?.investmentGain ?? selectedSnapshot.total_return)}`}
                        positive={(enriched?.investmentGain ?? selectedSnapshot.total_return) >= 0 ? true : false}
                      />
                      <StatRow
                        label="Investment Return"
                        value={`${enriched && enriched.investmentReturnPct >= 0 ? '+' : ''}${(enriched?.investmentReturnPct ?? selectedSnapshot.total_return_percentage).toFixed(2)}%`}
                        positive={(enriched?.investmentReturnPct ?? selectedSnapshot.total_return_percentage) >= 0 ? true : false}
                      />
                      <StatRow
                        label="Unrealised P&L"
                        value={`${selectedSnapshot.unrealised_gain_loss >= 0 ? '+' : ''}${format(selectedSnapshot.unrealised_gain_loss)}`}
                        positive={selectedSnapshot.unrealised_gain_loss >= 0 ? true : false}
                      />
                      <StatRow
                        label="Realised P&L"
                        value={`${selectedSnapshot.realised_gain_loss >= 0 ? '+' : ''}${format(selectedSnapshot.realised_gain_loss)}`}
                        positive={selectedSnapshot.realised_gain_loss >= 0 ? true : false}
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
                                <td className={cn('px-3 py-2 text-right tabular-nums font-medium',
                                  h.unrealised_gain_loss >= 0 ? 'text-green-600' : 'text-red-600')}>
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
              )
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
