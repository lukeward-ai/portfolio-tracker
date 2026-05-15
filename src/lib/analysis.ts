import type {
  Transaction, PortfolioSnapshot, RealisedGain,
  PortfolioAnalysis, AnalysisDriver, Currency, WatchlistLabel,
} from './types'
import { calculatePnL, getHoldings } from './pnl'

interface PriceMap {
  price: number
  changePercent: number
  currency: string
  name: string | null
  week52High?: number | null
  week52Low?: number | null
  trailingPE?: number | null
  dividendYield?: number | null
}

interface AnalysisInput {
  transactions: Transaction[]
  prices: Record<string, PriceMap>
  realisedGains: RealisedGain[]
  snapshots: PortfolioSnapshot[]
  rates: Record<string, number>
  baseCurrency: Currency
  jurisdiction: string
  timeframeDays: number
}

function convert(amount: number, from: Currency, to: Currency, rates: Record<string, number>): number {
  if (from === to) return amount
  const rate = rates[`${from}_${to}`]
  return rate ? amount * rate : amount
}

export function generatePortfolioAnalysis(input: AnalysisInput): PortfolioAnalysis {
  const { transactions, prices, realisedGains, snapshots, rates, baseCurrency, timeframeDays } = input
  const jurisdiction = input.jurisdiction ?? 'UK'

  const { lots } = calculatePnL(transactions, jurisdiction as 'UK' | 'US' | 'EU' | 'OTHER')
  const holdings = getHoldings(transactions, lots)

  if (holdings.length === 0) {
    return {
      headline: 'No holdings to analyse',
      summary: 'Add transactions to your portfolio to unlock AI Portfolio Brief.',
      keyDrivers: [],
      biggestWinner: null,
      biggestLoser: null,
      fxExposurePct: 0,
      fxNote: '',
      realisedSummary: '',
      disclaimer: 'This analysis is generated from available portfolio data. It is not financial advice.',
      generatedAt: new Date().toISOString(),
      dataAvailable: false,
    }
  }

  // Calculate contribution of each holding to today's change
  const drivers: AnalysisDriver[] = []
  let totalValue = 0
  let totalDayChange = 0
  let nonBaseValue = 0

  for (const h of holdings) {
    const p = prices[h.ticker]
    if (!p) continue
    const pc = p.currency as Currency
    const cur = convert(p.price * h.quantity, pc, baseCurrency, rates)
    const prev = convert((p.price / (1 + p.changePercent / 100)) * h.quantity, pc, baseCurrency, rates)
    const dayImpact = cur - prev
    totalValue += cur
    totalDayChange += dayImpact
    if (pc !== baseCurrency) nonBaseValue += cur

    drivers.push({
      ticker: h.ticker,
      name: p.name ?? h.ticker,
      impactValue: dayImpact,
      impactPct: p.changePercent,
      direction: dayImpact > 0 ? 'positive' : dayImpact < 0 ? 'negative' : 'neutral',
    })
  }

  drivers.sort((a, b) => Math.abs(b.impactValue) - Math.abs(a.impactValue))

  const winners = drivers.filter((d) => d.direction === 'positive').sort((a, b) => b.impactValue - a.impactValue)
  const losers = drivers.filter((d) => d.direction === 'negative').sort((a, b) => a.impactValue - b.impactValue)

  const biggestWinner = winners[0] ?? null
  const biggestLoser = losers[0] ?? null

  const fxExposurePct = totalValue > 0 ? (nonBaseValue / totalValue) * 100 : 0

  // Snapshot-based comparison for the timeframe
  const snapshotSummary = buildSnapshotSummary(snapshots, timeframeDays, baseCurrency)

  // Realised gains summary
  const totalRealised = realisedGains.reduce(
    (s, g) => s + convert(g.gain, g.currency, baseCurrency, rates), 0
  )
  const realisedSummary = realisedGains.length === 0
    ? 'No closed positions yet.'
    : `${realisedGains.length} closed position${realisedGains.length !== 1 ? 's' : ''} with total realised ${totalRealised >= 0 ? 'gain' : 'loss'} of ${formatCurrency(Math.abs(totalRealised), baseCurrency)}.`

  // FX note
  let fxNote = ''
  if (fxExposurePct > 5) {
    const sym = baseCurrency === 'GBP' ? 'GBP' : baseCurrency === 'EUR' ? 'EUR' : 'USD'
    const otherCurs = [...new Set(holdings.map((h) => prices[h.ticker]?.currency ?? h.currency).filter((c) => c !== baseCurrency))]
    fxNote = `Approximately ${fxExposurePct.toFixed(0)}% of your portfolio is held in non-${sym} assets (${otherCurs.join(', ')}). Currency movements may affect your displayed returns.`
  }

  // Build headline
  const dayChangePct = totalValue > 0 ? (totalDayChange / (totalValue - totalDayChange)) * 100 : 0
  let headline = ''
  if (snapshotSummary) {
    const dir = snapshotSummary.change >= 0 ? 'up' : 'down'
    headline = `Portfolio ${dir} ${formatCurrency(Math.abs(snapshotSummary.change), baseCurrency)} over the selected period`
  } else {
    const dir = totalDayChange >= 0 ? 'up' : 'down'
    headline = `Portfolio ${dir} ${formatCurrency(Math.abs(totalDayChange), baseCurrency)} (${Math.abs(dayChangePct).toFixed(2)}%) today`
  }

  // Build narrative summary
  const summaryParts: string[] = []

  if (snapshotSummary) {
    const dir = snapshotSummary.change >= 0 ? 'increased' : 'decreased'
    summaryParts.push(
      `Over the selected period, your portfolio ${dir} by ${formatCurrency(Math.abs(snapshotSummary.change), baseCurrency)} (${Math.abs(snapshotSummary.changePct).toFixed(1)}%) from ${formatCurrency(snapshotSummary.startValue, baseCurrency)} to ${formatCurrency(snapshotSummary.endValue, baseCurrency)}.`
    )
  } else {
    summaryParts.push(`Your portfolio is currently valued at approximately ${formatCurrency(totalValue, baseCurrency)}.`)
  }

  const topDrivers = drivers.slice(0, 3)
  if (topDrivers.length > 0) {
    const driverText = topDrivers.map((d) => {
      const sign = d.impactPct >= 0 ? '+' : ''
      return `${d.ticker} (${sign}${d.impactPct.toFixed(1)}%)`
    }).join(', ')
    summaryParts.push(`Today\'s main contributors were ${driverText}.`)
  }

  if (biggestWinner) {
    summaryParts.push(`${biggestWinner.ticker} was the strongest performer, up ${biggestWinner.impactPct.toFixed(1)}%, contributing approximately ${formatCurrency(biggestWinner.impactValue, baseCurrency)}.`)
  }

  if (biggestLoser) {
    summaryParts.push(`${biggestLoser.ticker} was the weakest position, down ${Math.abs(biggestLoser.impactPct).toFixed(1)}%, impacting the portfolio by approximately ${formatCurrency(biggestLoser.impactValue, baseCurrency)}.`)
  }

  if (fxNote) {
    summaryParts.push(fxNote)
  }

  if (realisedGains.length > 0) {
    summaryParts.push(realisedSummary)
  }

  return {
    headline,
    summary: summaryParts.join(' '),
    keyDrivers: drivers.slice(0, 5),
    biggestWinner,
    biggestLoser,
    fxExposurePct,
    fxNote,
    realisedSummary,
    disclaimer: 'This analysis is generated from available portfolio, market and price data. It is not financial advice.',
    generatedAt: new Date().toISOString(),
    dataAvailable: true,
  }
}

function buildSnapshotSummary(
  snapshots: PortfolioSnapshot[],
  timeframeDays: number,
  _baseCurrency: Currency
): { startValue: number; endValue: number; change: number; changePct: number } | null {
  if (snapshots.length < 2) return null

  const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  const end = sorted[sorted.length - 1]

  let start = sorted[0]
  if (timeframeDays > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - timeframeDays)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const idx = sorted.findIndex((s) => s.snapshot_date >= cutoffStr)
    if (idx >= 0) start = sorted[idx]
  }

  if (start.snapshot_date === end.snapshot_date) return null

  const startValue = start.portfolio_value
  const endValue = end.portfolio_value
  const change = endValue - startValue
  const changePct = startValue > 0 ? (change / startValue) * 100 : 0

  return { startValue, endValue, change, changePct }
}

function formatCurrency(amount: number, currency: Currency): string {
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'
  return `${sym}${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// For timeframe-based snapshot analysis (used by AI Analysis page)
export function analyseSnapshotRange(
  snapshots: PortfolioSnapshot[],
  timeframeDays: number
): {
  startSnapshot: PortfolioSnapshot | null
  endSnapshot: PortfolioSnapshot | null
  change: number
  changePct: number
  topContributors: Array<{ ticker: string; name: string | null; startValue: number; endValue: number; change: number }>
  hasEnoughData: boolean
} {
  if (snapshots.length < 2) {
    return { startSnapshot: null, endSnapshot: null, change: 0, changePct: 0, topContributors: [], hasEnoughData: false }
  }

  const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  const end = sorted[sorted.length - 1]

  let start = sorted[0]
  if (timeframeDays > 0) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - timeframeDays)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const idx = sorted.findIndex((s) => s.snapshot_date >= cutoffStr)
    if (idx >= 0) start = sorted[idx]
  }

  if (start.snapshot_date === end.snapshot_date) {
    return { startSnapshot: start, endSnapshot: end, change: 0, changePct: 0, topContributors: [], hasEnoughData: false }
  }

  const change = end.portfolio_value - start.portfolio_value
  const changePct = start.portfolio_value > 0 ? (change / start.portfolio_value) * 100 : 0

  // Compare per-holding values between start and end snapshots
  const startHoldings = new Map<string, { value: number; name: string | null }>(
    (start.metadata?.holdings ?? []).map((h) => [h.ticker, { value: h.market_value, name: h.name }])
  )
  const endHoldings = new Map<string, { value: number; name: string | null }>(
    (end.metadata?.holdings ?? []).map((h) => [h.ticker, { value: h.market_value, name: h.name }])
  )

  const allTickers = new Set([...startHoldings.keys(), ...endHoldings.keys()])
  const contributors = [...allTickers].map((ticker) => {
    const sv = startHoldings.get(ticker)?.value ?? 0
    const ev = endHoldings.get(ticker)?.value ?? 0
    const name = endHoldings.get(ticker)?.name ?? startHoldings.get(ticker)?.name ?? null
    return { ticker, name, startValue: sv, endValue: ev, change: ev - sv }
  }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change))

  return {
    startSnapshot: start,
    endSnapshot: end,
    change,
    changePct,
    topContributors: contributors.slice(0, 5),
    hasEnoughData: true,
  }
}

// Derives a watchlist label from available fundamentals + price data
export function deriveWatchlistLabel(data: {
  price: number
  changePercent: number
  week52High: number | null
  week52Low: number | null
  trailingPE: number | null
  dividendYield: number | null
}): WatchlistLabel {
  const { price, week52High, week52Low, trailingPE, dividendYield } = data

  if (!week52High && !week52Low && trailingPE == null) return 'Insufficient Data'

  if (week52High && price / week52High > 0.96) return 'Near 52W High'

  if (dividendYield != null && dividendYield > 3) return 'High Yield'

  if (trailingPE != null && trailingPE > 0 && trailingPE < 15) return 'Value Range'

  if (trailingPE != null && trailingPE > 40) return 'Appears Elevated'

  const recentMomentum = data.changePercent
  if (week52High && week52Low) {
    const range = week52High - week52Low
    const posInRange = range > 0 ? (price - week52Low) / range : 0
    if (posInRange > 0.8 && recentMomentum > 0) return 'Momentum Strong'
    if (posInRange < 0.3) return 'Worth Watching'
  }

  return 'Worth Watching'
}

export const LABEL_STYLES: Record<WatchlistLabel, { bg: string; text: string }> = {
  'Momentum Strong':   { bg: 'bg-green-100 dark:bg-green-950', text: 'text-green-700 dark:text-green-400' },
  'Near 52W High':     { bg: 'bg-blue-100 dark:bg-blue-950',   text: 'text-blue-700 dark:text-blue-400' },
  'High Yield':        { bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-300' },
  'Value Range':       { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-400' },
  'Worth Watching':    { bg: 'bg-slate-100 dark:bg-slate-800',  text: 'text-slate-600 dark:text-slate-400' },
  'Appears Elevated':  { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400' },
  'Insufficient Data': { bg: 'bg-muted',                        text: 'text-muted-foreground' },
}
