import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import fxRatesRaw from '@/lib/fx-rates.json'

export const maxDuration = 30

type FxRateMap = Record<string, { USD_EUR?: number; GBP_EUR?: number }>
const fxRates = fxRatesRaw as FxRateMap

// fx-rates.json stores USD_EUR = EUR per 1 USD
function getUsdToBase(date: string, base: string): number {
  if (base === 'USD') return 1
  if (base === 'GBP') {
    // USD → EUR → GBP: (EUR per USD) / (EUR per GBP)
    const usdEur = lookupRate(date, 'USD_EUR') ?? 0.92
    const gbpEur = lookupRate(date, 'GBP_EUR') ?? 1.17
    return gbpEur > 0 ? usdEur / gbpEur : 1
  }
  // EUR: just USD_EUR
  return lookupRate(date, 'USD_EUR') ?? 0.92
}

function lookupRate(date: string, key: 'USD_EUR' | 'GBP_EUR'): number | null {
  const dateStr = date.slice(0, 10)
  for (let i = 0; i <= 7; i++) {
    const d = new Date(dateStr + 'T12:00:00Z')
    d.setDate(d.getDate() - i)
    const k = d.toISOString().slice(0, 10)
    const r = fxRates[k]?.[key]
    if (r != null) return r
  }
  return null
}

type Range = '7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL'

// SPY prices are the same for every user — cache the Yahoo fetch per warm
// instance so range-tab clicks and other users don't refetch years of data.
let spyCache: { key: string; prices: Record<string, number> } | null = null

async function getSpyPrices(firstDate: string, today: string): Promise<Record<string, number>> {
  const key = `${firstDate}|${today}`
  if (spyCache?.key === key) return spyCache.prices

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: YahooFinance } = require('yahoo-finance2')
  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })
  const raw = await yf.historical('SPY', { period1: firstDate, period2: today, interval: '1d' })

  const prices: Record<string, number> = {}
  for (const r of raw ?? []) {
    const price = r.adjClose ?? r.close ?? 0
    if (price > 0) prices[new Date(r.date).toISOString().slice(0, 10)] = price
  }
  spyCache = { key, prices }
  return prices
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const range = (req.nextUrl.searchParams.get('range') ?? 'ALL') as Range

  // Fetch profile for base currency
  const { data: profile } = await supabase.from('profiles').select('base_currency').eq('id', user.id).single()
  const base = (profile?.base_currency ?? 'EUR').toUpperCase()

  // Fetch ALL snapshots (need full contribution history regardless of display range)
  const allSnapshots: Array<{ snapshot_date: string; net_contributions: number; portfolio_value: number }> = []
  let start = 0
  while (true) {
    const { data } = await supabase
      .from('portfolio_snapshots')
      .select('snapshot_date,net_contributions,portfolio_value')
      .eq('user_id', user.id)
      .order('snapshot_date', { ascending: true })
      .range(start, start + 999)
    if (!data || data.length === 0) break
    allSnapshots.push(...data)
    if (data.length < 1000) break
    start += 1000
  }

  if (allSnapshots.length === 0) return NextResponse.json({ data: [] })

  const firstDate = allSnapshots[0].snapshot_date
  const today = new Date().toISOString().slice(0, 10)

  let spyPriceMap: Record<string, number>
  try {
    spyPriceMap = await getSpyPrices(firstDate, today)
  } catch {
    return NextResponse.json({ error: 'Could not fetch SPY data' }, { status: 500 })
  }

  // Get nearest SPY price (look back up to 5 days)
  function getSpyPrice(date: string): number | null {
    for (let i = 0; i <= 5; i++) {
      const d = new Date(date + 'T12:00:00Z')
      d.setDate(d.getDate() - i)
      const k = d.toISOString().slice(0, 10)
      if (spyPriceMap[k] != null) return spyPriceMap[k]
    }
    return null
  }

  // Simulate SPY portfolio: buy SPY when contributions increase, sell when
  // they decrease (withdrawals) — same money, same timing, different asset.
  // Contributions are in base currency already.
  let prevContributions = 0

  const shareEvents: Array<{ date: string; sharesDelta: number; investedDelta: number }> = []
  for (const s of allSnapshots) {
    const delta = s.net_contributions - prevContributions
    prevContributions = s.net_contributions
    if (Math.abs(delta) <= 1) continue

    const spyUsd = getSpyPrice(s.snapshot_date)
    if (spyUsd == null || spyUsd === 0) continue
    const spyInBase = spyUsd * getUsdToBase(s.snapshot_date, base)
    shareEvents.push({ date: s.snapshot_date, sharesDelta: delta / spyInBase, investedDelta: delta })
  }

  // For each snapshot date, calculate total SPY value
  const result: Array<{ date: string; spyValue: number; spyReturn: number; spyReturnPct: number }> = []

  let cumulativeShares = 0
  let eventIdx = 0
  let contribUpToHere = 0

  for (const snap of allSnapshots) {
    // Apply any buy/sell events up to and including this date
    while (eventIdx < shareEvents.length && shareEvents[eventIdx].date <= snap.snapshot_date) {
      cumulativeShares = Math.max(0, cumulativeShares + shareEvents[eventIdx].sharesDelta)
      contribUpToHere = Math.max(0, contribUpToHere + shareEvents[eventIdx].investedDelta)
      eventIdx++
    }

    if (cumulativeShares === 0) {
      result.push({ date: snap.snapshot_date, spyValue: 0, spyReturn: 0, spyReturnPct: 0 })
      continue
    }

    const spyUsd = getSpyPrice(snap.snapshot_date)
    if (spyUsd == null) {
      // Use last result
      const last = result[result.length - 1]
      result.push(last ? { ...last, date: snap.snapshot_date } : { date: snap.snapshot_date, spyValue: 0, spyReturn: 0, spyReturnPct: 0 })
      continue
    }

    const usdToBase = getUsdToBase(snap.snapshot_date, base)
    const spyValue = cumulativeShares * spyUsd * usdToBase
    const spyReturn = spyValue - contribUpToHere
    const spyReturnPct = contribUpToHere > 0 ? (spyReturn / contribUpToHere) * 100 : 0

    result.push({ date: snap.snapshot_date, spyValue, spyReturn, spyReturnPct })
  }

  // Filter to requested range
  const now = new Date()
  let fromDate: string | null = null
  if (range === '7D') fromDate = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
  else if (range === '1M') fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10)
  else if (range === '3M') fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10)
  else if (range === '6M') fromDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().slice(0, 10)
  else if (range === '1Y') fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10)

  const filtered = fromDate ? result.filter((r) => r.date >= fromDate!) : result

  return NextResponse.json({ data: filtered })
}
