import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { saveSnapshotForUser } from '@/lib/snapshot'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import { fetchAllTransactions } from '@/lib/fetch-transactions'

export const maxDuration = 60

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: YahooFinance } = require('yahoo-finance2')
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

/**
 * Daily cron (vercel.json): refreshes prices for every held ticker, then
 * saves a portfolio snapshot for every user — so history charts have no
 * gaps even when nobody opens the app.
 */
export async function GET(req: NextRequest) {
  // Vercel sends `Authorization: Bearer ${CRON_SECRET}` with cron invocations
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()

  const { data: profiles } = await db.from('profiles').select('id, tax_jurisdiction')
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ users: 0, error: 'No profiles' })
  }

  // Collect every currently-held ticker across all users
  const heldTickers = new Set<string>()
  const userTransactions: Record<string, Awaited<ReturnType<typeof fetchAllTransactions>>> = {}
  for (const p of profiles) {
    const txs = await fetchAllTransactions(db, p.id)
    userTransactions[p.id] = txs
    const { lots } = calculatePnL(txs, p.tax_jurisdiction ?? 'UK')
    for (const h of getHoldings(txs, lots)) heldTickers.add(h.ticker)
  }

  // Refresh price_cache for all held tickers in one Yahoo call, one upsert
  let pricesRefreshed = 0
  if (heldTickers.size > 0) {
    try {
      const quotes = await yf.quote([...heldTickers])
      const quotesArray = Array.isArray(quotes) ? quotes : [quotes]
      const rows = quotesArray
        .filter((q: { symbol?: string; regularMarketPrice?: number }) => q?.symbol && q.regularMarketPrice != null)
        .map((q: Record<string, unknown>) => ({
          ticker: q.symbol,
          price: q.regularMarketPrice,
          currency: q.currency ?? 'USD',
          change_percent: q.regularMarketChangePercent ?? 0,
          previous_close: q.regularMarketPreviousClose ?? 0,
          name: q.longName ?? q.shortName ?? null,
          market_cap: q.marketCap ?? null,
          week52_high: q.fiftyTwoWeekHigh ?? null,
          week52_low: q.fiftyTwoWeekLow ?? null,
          trailing_pe: q.trailingPE ?? null,
          dividend_yield: q.trailingAnnualDividendYield ?? null,
          beta: q.beta ?? null,
          updated_at: new Date().toISOString(),
        }))
      if (rows.length > 0) {
        await db.from('price_cache').upsert(rows, { onConflict: 'ticker' })
        pricesRefreshed = rows.length
      }
    } catch (err) {
      console.error('Cron price refresh failed:', err)
      // Continue — snapshots still work from the existing cache
    }
  }

  // Snapshot every user
  const results: Record<string, string | null> = {}
  for (const p of profiles) {
    try {
      const { error } = await saveSnapshotForUser(db, p.id)
      results[p.id] = error
    } catch (err) {
      results[p.id] = err instanceof Error ? err.message : 'unknown error'
    }
  }

  const failures = Object.entries(results).filter(([, e]) => e !== null)
  return NextResponse.json({
    users: profiles.length,
    pricesRefreshed,
    failures: failures.length > 0 ? Object.fromEntries(failures) : undefined,
  })
}
