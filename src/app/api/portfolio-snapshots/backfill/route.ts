import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { DEMO_USER_ID } from '@/lib/demo-user'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import type { Currency, RealisedGain } from '@/lib/types'

export const maxDuration = 60

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: YahooFinance } = require('yahoo-finance2')
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

function buildRates(rows: Array<{ base: string; target: string; rate: number }>): Record<string, number> {
  const rates: Record<string, number> = {}
  for (const r of rows) rates[`${r.base}_${r.target}`] = r.rate
  return rates
}

function convertAmount(amount: number, from: Currency, to: Currency, rates: Record<string, number>): number {
  if (from === to) return amount
  const rate = rates[`${from}_${to}`]
  return rate ? amount * rate : amount
}

function getPriceOnDate(priceMap: Record<string, number>, date: string): number | null {
  for (let i = 0; i <= 5; i++) {
    const d = new Date(date + 'T12:00:00Z')
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (priceMap[key] !== undefined) return priceMap[key]
  }
  return null
}

export async function POST() {
  const db = createAdminClient()

  const [
    { data: profile },
    { data: transactions },
    { data: rateRows },
    { data: priceCacheRows },
    { data: lastSnapshotRow },
  ] = await Promise.all([
    db.from('profiles').select('*').eq('id', DEMO_USER_ID).single(),
    db.from('transactions').select('*').eq('user_id', DEMO_USER_ID).order('executed_at', { ascending: true }),
    db.from('exchange_rate_cache').select('base, target, rate'),
    db.from('price_cache').select('ticker, currency'),
    db.from('portfolio_snapshots').select('snapshot_date').eq('user_id', DEMO_USER_ID)
      .order('snapshot_date', { ascending: false }).limit(1).maybeSingle(),
  ])

  if (!profile || !transactions || transactions.length === 0) {
    return NextResponse.json({ count: 0, error: 'No transactions found' }, { status: 400 })
  }

  const baseCurrency = (profile.base_currency ?? 'GBP') as Currency
  const rates = buildRates(rateRows ?? [])
  const jurisdiction = profile.tax_jurisdiction ?? 'UK'

  const firstTxDate = transactions[0].executed_at.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  const tickerCurrencyFromCache: Record<string, string> = {}
  for (const row of priceCacheRows ?? []) {
    tickerCurrencyFromCache[row.ticker] = row.currency
  }

  const tickers = [...new Set(transactions.map((tx) => tx.ticker))]

  // Fetch from 7 days before the last snapshot (for overlap), or from the very beginning
  const lastSnapshotDate = lastSnapshotRow?.snapshot_date ?? null
  const fetchFrom = lastSnapshotDate
    ? new Date(new Date(lastSnapshotDate + 'T12:00:00Z').getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
    : firstTxDate

  // Fetch historical price series only for the incremental window
  const historicalResults = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const history = await yf.historical(ticker, {
        period1: fetchFrom,
        period2: today,
        interval: '1d',
      })
      return { ticker, history }
    })
  )

  // Build price maps: priceMap[ticker][date] = closingPrice
  const priceMaps: Record<string, Record<string, number>> = {}
  const tickerCurrencies: Record<string, Currency> = {}
  const tradingDays = new Set<string>()

  for (const result of historicalResults) {
    if (result.status !== 'fulfilled') continue
    const { ticker, history } = result.value
    if (!history || history.length === 0) continue

    priceMaps[ticker] = {}
    const txCurrency = (transactions.find((tx) => tx.ticker === ticker)?.currency ?? baseCurrency) as Currency
    tickerCurrencies[ticker] = (tickerCurrencyFromCache[ticker] ?? txCurrency) as Currency

    for (const row of history) {
      const date = new Date(row.date).toISOString().slice(0, 10)
      const price = row.adjClose ?? row.close
      if (price != null && price > 0) {
        priceMaps[ticker][date] = price
        tradingDays.add(date)
      }
    }
  }

  if (tradingDays.size === 0) {
    return NextResponse.json({ count: 0, error: 'No historical price data found' }, { status: 400 })
  }

  // Precompute holdings state at each unique transaction date (avoid recalculating for every day)
  const txDates = [...new Set(transactions.map((tx) => tx.executed_at.slice(0, 10)))].sort()

  interface HoldingsState {
    date: string
    holdings: ReturnType<typeof getHoldings>
    realisedGains: RealisedGain[]
  }

  const holdingsStates: HoldingsState[] = txDates.map((txDate) => {
    const txUpTo = transactions.filter((tx) => tx.executed_at.slice(0, 10) <= txDate)
    const { lots, realisedGains } = calculatePnL(txUpTo, jurisdiction)
    return { date: txDate, holdings: getHoldings(txUpTo, lots), realisedGains }
  })

  function getStateForDate(date: string): HoldingsState | null {
    let state: HoldingsState | null = null
    for (const s of holdingsStates) {
      if (s.date <= date) state = s
      else break
    }
    return state
  }

  // Only process dates we don't already have (or overlap window for corrections)
  const processFrom = lastSnapshotDate ?? firstTxDate
  const sortedTradingDays = [...tradingDays].sort().filter((d) => d >= processFrom && d <= today)

  const snapshotsToUpsert = []

  for (const date of sortedTradingDays) {
    const state = getStateForDate(date)
    if (!state || state.holdings.length === 0) continue

    let holdingsValue = 0
    let netContributions = 0
    let unrealisedGainLoss = 0
    const holdingsMeta = []

    for (const h of state.holdings) {
      const costInBase = convertAmount(h.costBasis, h.currency, baseCurrency, rates)
      netContributions += costInBase

      const price = getPriceOnDate(priceMaps[h.ticker] ?? {}, date)
      if (price == null) continue

      const tickerCur = tickerCurrencies[h.ticker] ?? h.currency
      const mv = convertAmount(price * h.quantity, tickerCur, baseCurrency, rates)
      const pnl = mv - costInBase
      holdingsValue += mv
      unrealisedGainLoss += pnl

      holdingsMeta.push({
        ticker: h.ticker,
        name: h.name,
        quantity: h.quantity,
        avg_cost: h.avgCost,
        market_value: mv,
        unrealised_gain_loss: pnl,
        allocation_pct: 0,
        currency: h.currency,
      })
    }

    if (holdingsValue === 0) continue

    const realisedGainLoss = state.realisedGains.reduce(
      (sum, g) => sum + convertAmount(g.gain, g.currency, baseCurrency, rates),
      0
    )
    const totalReturn = unrealisedGainLoss + realisedGainLoss
    const totalReturnPct = netContributions > 0 ? (totalReturn / netContributions) * 100 : 0

    for (const h of holdingsMeta) {
      h.allocation_pct = holdingsValue > 0 ? (h.market_value / holdingsValue) * 100 : 0
    }

    snapshotsToUpsert.push({
      user_id: DEMO_USER_ID,
      snapshot_date: date,
      portfolio_value: holdingsValue,
      holdings_value: holdingsValue,
      cash_balance: 0,
      net_contributions: netContributions,
      total_return: totalReturn,
      total_return_percentage: totalReturnPct,
      unrealised_gain_loss: unrealisedGainLoss,
      realised_gain_loss: realisedGainLoss,
      dividends_earned: 0,
      holdings_count: state.holdings.length,
      metadata: { holdings: holdingsMeta },
      updated_at: new Date().toISOString(),
    })
  }

  // Upsert in batches of 200
  const BATCH_SIZE = 200
  let saved = 0
  for (let i = 0; i < snapshotsToUpsert.length; i += BATCH_SIZE) {
    const batch = snapshotsToUpsert.slice(i, i + BATCH_SIZE)
    const { error } = await db
      .from('portfolio_snapshots')
      .upsert(batch, { onConflict: 'user_id,snapshot_date' })
    if (error) return NextResponse.json({ count: saved, error: error.message }, { status: 500 })
    saved += batch.length
  }

  return NextResponse.json({ count: saved, error: null })
}
