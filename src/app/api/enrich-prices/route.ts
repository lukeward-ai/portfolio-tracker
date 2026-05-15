import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: YahooFinance } = require('yahoo-finance2')
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

// Fetch closing price for a ticker on or just before a given date.
// Looks back up to 7 days to handle weekends/holidays.
async function getHistoricalClose(ticker: string, dateStr: string): Promise<{ price: number; currency: string } | null> {
  const date = new Date(dateStr)
  const from = new Date(date)
  from.setDate(from.getDate() - 7)
  const to = new Date(date)
  to.setDate(to.getDate() + 1) // inclusive upper bound

  try {
    const rows = await yf.historical(ticker, {
      period1: from.toISOString().slice(0, 10),
      period2: to.toISOString().slice(0, 10),
    }, { validateResult: false })

    if (!rows || rows.length === 0) return null

    // Take the row closest to (but not after) the trade date
    const target = date.getTime()
    const sorted = rows
      .filter((r: { date: Date; close: number }) => r.date.getTime() <= target + 86400000)
      .sort((a: { date: Date }, b: { date: Date }) => b.date.getTime() - a.date.getTime())

    if (sorted.length === 0 || sorted[0].close == null) return null

    // Get the currency for this ticker
    let currency = 'USD'
    try {
      const quote = await yf.quote(ticker, {}, { validateResult: false })
      if (quote?.currency) currency = quote.currency
    } catch {
      // Default to USD if quote fails
    }

    return { price: sorted[0].close, currency }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { importBatchId } = await request.json()
  if (!importBatchId) return NextResponse.json({ error: 'importBatchId required' }, { status: 400 })

  // Verify batch belongs to user
  const { data: batch } = await supabase
    .from('import_batches')
    .select('id')
    .eq('id', importBatchId)
    .eq('user_id', user.id)
    .single()

  if (!batch) return NextResponse.json({ error: 'Import not found' }, { status: 404 })

  // Fetch all transactions in this batch that haven't been enriched yet
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id, ticker, executed_at, currency, native_price')
    .eq('import_id', importBatchId)
    .eq('user_id', user.id)
    .is('native_price', null)

  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })
  if (!transactions || transactions.length === 0) {
    return NextResponse.json({ enriched: 0, failed: 0 })
  }

  // Deduplicate ticker+date combos to avoid redundant Yahoo calls
  const cache = new Map<string, { price: number; currency: string } | null>()

  async function lookup(ticker: string, date: string) {
    const key = `${ticker}::${date.slice(0, 10)}`
    if (cache.has(key)) return cache.get(key)!
    const result = await getHistoricalClose(ticker, date)
    cache.set(key, result)
    return result
  }

  let enriched = 0
  let failed = 0

  // Process in small batches to avoid hammering Yahoo
  for (let i = 0; i < transactions.length; i += 5) {
    const chunk = transactions.slice(i, i + 5)
    await Promise.all(chunk.map(async (tx) => {
      const result = await lookup(tx.ticker, tx.executed_at)
      if (result) {
        await supabase
          .from('transactions')
          .update({ native_price: result.price, native_currency: result.currency, price_lookup_failed: false })
          .eq('id', tx.id)
        enriched++
      } else {
        await supabase
          .from('transactions')
          .update({ price_lookup_failed: true })
          .eq('id', tx.id)
        failed++
      }
    }))
    // Small delay between chunks to be polite to Yahoo
    if (i + 5 < transactions.length) await new Promise((r) => setTimeout(r, 300))
  }

  return NextResponse.json({ enriched, failed })
}
