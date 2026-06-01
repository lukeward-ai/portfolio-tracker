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

  // Fetch SPY historical prices via Yahoo Finance
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: YahooFinance } = require('yahoo-finance2')
  const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })

  const firstDate = allSnapshots[0].snapshot_date
  const today = new Date().toISOString().slice(0, 10)

  let spyHistory: Array<{ date: string; price: number }> = []
  try {
    const raw = await yf.historical('SPY', { period1: firstDate, period2: today, interval: '1d' })
    spyHistory = (raw ?? [])
      .map((r: { date: Date; adjClose?: number; close?: number }) => ({
        date: new Date(r.date).toISOString().slice(0, 10),
        price: r.adjClose ?? r.close ?? 0,
      }))
      .filter((r: { date: string; price: number }) => r.price > 0)
  } catch {
    return NextResponse.json({ error: 'Could not fetch SPY data' }, { status: 500 })
  }

  // Build SPY price map: date → USD price
  const spyPriceMap: Record<string, number> = {}
  for (const row of spyHistory) spyPriceMap[row.date] = row.price

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

  // Simulate SPY portfolio: buy SPY on each date contributions increase
  // Contributions are in base currency already
  let totalSpyShares = 0
  let prevContributions = 0

  // Build contribution events
  const contributionEvents: Array<{ date: string; deltaBase: number }> = []
  for (let i = 0; i < allSnapshots.length; i++) {
    const s = allSnapshots[i]
    const delta = s.net_contributions - prevContributions
    if (delta > 1) {
      contributionEvents.push({ date: s.snapshot_date, deltaBase: delta })
    }
    prevContributions = s.net_contributions
  }

  // Pre-process: build SPY share purchases per contribution event
  const spySharePurchases: Array<{ date: string; shares: number }> = []
  let totalInvested = 0
  for (const event of contributionEvents) {
    const spyUsd = getSpyPrice(event.date)
    if (spyUsd == null || spyUsd === 0) continue
    const usdToBase = getUsdToBase(event.date, base)
    const spyInBase = spyUsd * usdToBase
    const sharesBought = event.deltaBase / spyInBase
    spySharePurchases.push({ date: event.date, shares: sharesBought })
    totalInvested += event.deltaBase
  }

  // For each snapshot date, calculate total SPY value
  // We need to know cumulative shares as of each date
  const result: Array<{ date: string; spyValue: number; spyReturn: number; spyReturnPct: number }> = []

  let cumulativeShares = 0
  let purchaseIdx = 0
  let cumulativeInvested = 0

  // Sort purchases by date
  spySharePurchases.sort((a, b) => a.date.localeCompare(b.date))

  for (const snap of allSnapshots) {
    // Add any purchases up to and including this date
    while (purchaseIdx < spySharePurchases.length && spySharePurchases[purchaseIdx].date <= snap.snapshot_date) {
      cumulativeShares += spySharePurchases[purchaseIdx].shares
      purchaseIdx++
    }
    // Rebuild cumulative invested up to this date
    const contribUpToHere = contributionEvents
      .filter((e) => e.date <= snap.snapshot_date)
      .reduce((s, e) => s + e.deltaBase, 0)

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
