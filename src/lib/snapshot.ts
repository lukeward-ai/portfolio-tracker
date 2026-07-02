import type { SupabaseClient } from '@supabase/supabase-js'
import { calculatePnL, getHoldings } from './pnl'
import { getHistoricalRate } from './fx-utils'
import { fetchAllTransactions } from './fetch-transactions'
import type { Currency } from './types'

function buildRates(rows: Array<{ base: string; target: string; rate: number }>): Record<string, number> {
  const rates: Record<string, number> = {}
  for (const r of rows) rates[`${r.base}_${r.target}`] = r.rate
  return rates
}

function convert(amount: number, from: Currency, to: Currency, rates: Record<string, number>): number {
  if (from === to) return amount
  const rate = rates[`${from}_${to}`]
  return rate ? amount * rate : amount
}

/**
 * Computes and upserts today's portfolio snapshot for one user.
 * Works with either the session client (server action) or the admin client
 * (cron) — all queries are explicitly scoped to userId.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveSnapshotForUser(supabase: SupabaseClient<any>, userId: string): Promise<{ error: string | null }> {
  const [
    { data: profile },
    transactions,
    { data: cashPositions },
    { data: rateRows },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    fetchAllTransactions(supabase, userId),
    supabase.from('cash_positions').select('*').eq('user_id', userId),
    supabase.from('exchange_rate_cache').select('base, target, rate'),
  ])

  if (!profile) return { error: 'Profile not found' }
  if (transactions.length === 0) return { error: 'No transactions' }

  const baseCurrency = (profile.base_currency ?? 'GBP') as Currency
  const rates = buildRates(rateRows ?? [])
  const jurisdiction = profile.tax_jurisdiction ?? 'UK'

  const { lots, realisedGains } = calculatePnL(transactions, jurisdiction)
  const holdings = getHoldings(transactions, lots)

  const tickers = holdings.map((h) => h.ticker)
  const { data: priceRows } = tickers.length > 0
    ? await supabase.from('price_cache').select('*').in('ticker', tickers)
    : { data: [] }

  const priceMap: Record<string, { price: number; currency: string }> = {}
  for (const row of priceRows ?? []) {
    priceMap[row.ticker] = { price: row.price, currency: row.currency }
  }

  let holdingsValue = 0
  let netContributions = 0
  let unrealisedGainLoss = 0

  const today = new Date().toISOString().slice(0, 10)

  const holdingsMeta = holdings.map((h) => {
    const p = priceMap[h.ticker]

    // Cost basis in base at acquisition-date FX rates (matches the backfill);
    // UK pool lots carry no acquisition date — use today's rate.
    const tickerLots = lots.filter((l) => l.ticker === h.ticker)
    const costInBase = tickerLots.reduce(
      (s, l) => s + l.costBasis * getHistoricalRate(l.acquiredAt || today, l.currency, baseCurrency),
      0
    )

    if (p) {
      // Unpriced tickers are excluded from contributions too, matching the backfill
      netContributions += costInBase
      const mv = convert(p.price * h.quantity, p.currency as Currency, baseCurrency, rates)
      const pnl = mv - costInBase
      holdingsValue += mv
      unrealisedGainLoss += pnl
      return {
        ticker: h.ticker, name: h.name, quantity: h.quantity, avg_cost: h.avgCost,
        market_value: mv, unrealised_gain_loss: pnl, allocation_pct: 0, currency: h.currency,
      }
    }
    return {
      ticker: h.ticker, name: h.name, quantity: h.quantity, avg_cost: h.avgCost,
      market_value: 0, unrealised_gain_loss: 0, allocation_pct: 0, currency: h.currency,
    }
  })

  let cashBalance = 0
  for (const cp of cashPositions ?? []) {
    cashBalance += convert(cp.amount, cp.currency as Currency, baseCurrency, rates)
  }

  const portfolioValue = holdingsValue + cashBalance
  const realisedGainLoss = (realisedGains ?? []).reduce(
    (sum, g) => sum + g.gain * getHistoricalRate(g.soldAt, g.currency, baseCurrency),
    0
  )
  const totalReturn = unrealisedGainLoss + realisedGainLoss
  const totalReturnPct = netContributions > 0 ? (totalReturn / netContributions) * 100 : 0

  if (portfolioValue > 0) {
    for (const h of holdingsMeta) {
      h.allocation_pct = (h.market_value / portfolioValue) * 100
    }
  }

  const { error } = await supabase
    .from('portfolio_snapshots')
    .upsert({
      user_id: userId,
      snapshot_date: today,
      portfolio_value: portfolioValue,
      holdings_value: holdingsValue,
      cash_balance: cashBalance,
      net_contributions: netContributions,
      total_return: totalReturn,
      total_return_percentage: totalReturnPct,
      unrealised_gain_loss: unrealisedGainLoss,
      realised_gain_loss: realisedGainLoss,
      dividends_earned: 0,
      holdings_count: holdings.filter((h) => h.quantity > 0).length,
      metadata: { holdings: holdingsMeta },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,snapshot_date' })

  return { error: error?.message ?? null }
}
