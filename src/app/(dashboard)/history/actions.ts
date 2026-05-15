'use server'

import { createClient } from '@/lib/supabase/server'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import type { Currency, PortfolioSnapshot } from '@/lib/types'

function buildRates(rows: Array<{ base: string; target: string; rate: number }>): Record<string, number> {
  const rates: Record<string, number> = {}
  for (const r of rows) rates[`${r.base}_${r.target}`] = r.rate
  return rates
}

function convert(amount: number, from: Currency, to: Currency, rates: Record<string, number>): number {
  if (from === to) return amount
  const key = `${from}_${to}`
  const rate = rates[key]
  return rate ? amount * rate : amount
}

export async function savePortfolioSnapshot(): Promise<{ data: PortfolioSnapshot | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Not authenticated' }

  const [
    { data: profile },
    { data: transactions },
    { data: cashPositions },
    { data: rateRows },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('transactions').select('*').eq('user_id', user.id).order('executed_at', { ascending: true }),
    supabase.from('cash_positions').select('*').eq('user_id', user.id),
    supabase.from('exchange_rate_cache').select('base, target, rate'),
  ])

  if (!profile) return { data: null, error: 'Profile not found' }

  const baseCurrency = (profile.base_currency ?? 'GBP') as Currency
  const rates = buildRates(rateRows ?? [])
  const jurisdiction = profile.tax_jurisdiction ?? 'UK'

  const { lots, realisedGains } = calculatePnL(transactions ?? [], jurisdiction)
  const holdings = getHoldings(transactions ?? [], lots)

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

  const holdingsMeta = holdings.map((h) => {
    const p = priceMap[h.ticker]
    const costInBase = convert(h.costBasis, h.currency, baseCurrency, rates)
    netContributions += costInBase

    if (p) {
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
    (sum, g) => sum + convert(g.gain, g.currency, baseCurrency, rates),
    0
  )
  const totalReturn = unrealisedGainLoss + realisedGainLoss
  const totalReturnPct = netContributions > 0 ? (totalReturn / netContributions) * 100 : 0

  if (portfolioValue > 0) {
    for (const h of holdingsMeta) {
      h.allocation_pct = (h.market_value / portfolioValue) * 100
    }
  }

  const snapshotDate = new Date().toISOString().slice(0, 10)

  const payload = {
    user_id: user.id,
    snapshot_date: snapshotDate,
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
  }

  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .upsert(payload, { onConflict: 'user_id,snapshot_date' })
    .select()
    .single()

  return { data: data as PortfolioSnapshot | null, error: error?.message ?? null }
}

export async function getPortfolioSnapshots(
  range: '7D' | '1M' | '3M' | '6M' | '1Y' | 'ALL' = '1Y'
): Promise<PortfolioSnapshot[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let fromDate: string | null = null
  const now = new Date()

  if (range === '7D') fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  else if (range === '1M') fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().slice(0, 10)
  else if (range === '3M') fromDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10)
  else if (range === '6M') fromDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().slice(0, 10)
  else if (range === '1Y') fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10)

  let query = supabase
    .from('portfolio_snapshots')
    .select('*')
    .eq('user_id', user.id)
    .order('snapshot_date', { ascending: true })
    .limit(10000)

  if (fromDate) query = query.gte('snapshot_date', fromDate)

  const { data } = await query
  return (data ?? []) as PortfolioSnapshot[]
}
