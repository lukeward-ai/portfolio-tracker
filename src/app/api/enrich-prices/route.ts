import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: YahooFinance } = require('yahoo-finance2')
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

// ─── Ticker resolution ────────────────────────────────────────────────────────

// Strip Davy description suffixes to get a clean search query
// e.g. "SPLUNK INC COM USD0.001" → "SPLUNK INC"
//      "BOOHOO GROUP PLC ORD GBP0.01" → "BOOHOO GROUP"
function cleanDescription(desc: string): string {
  return desc
    .replace(/\b(COM|ORD|INC\.?|PLC|LTD|CORP|CLASS\s+[A-Z]|[A-Z]{3}[0-9]+\.[0-9]+)\b.*/i, '')
    .trim()
}

// Exchanges preferred by settlement currency
const PREFERRED_EXCHANGES: Record<string, string[]> = {
  USD: ['NMS', 'NYQ', 'NGM', 'PCX', 'ASE'],
  EUR: ['NMS', 'NYQ', 'NGM', 'FRA', 'PAR', 'AMS'],
  GBP: ['LSE', 'AIM', 'IOB'],
}

async function resolveTickerSymbol(
  rawTicker: string,
  description: string | null,
  settlementCurrency: string,
): Promise<{ symbol: string; nativeCurrency: string } | null> {
  const query = description ? cleanDescription(description) : rawTicker
  const firstWord = query.split(/\s+/)[0].toUpperCase()
  const preferredExchanges = PREFERRED_EXCHANGES[settlementCurrency] ?? PREFERRED_EXCHANGES['USD']

  const candidates: string[] = [firstWord]
  if (settlementCurrency === 'GBP') candidates.push(`${firstWord}.L`)
  if (query !== firstWord) candidates.push(query)

  // 1. Try direct quote on candidate tickers
  for (const candidate of candidates) {
    try {
      const quote = await yf.quote(candidate, {}, { validateResult: false })
      if (quote?.symbol && quote?.currency) {
        return { symbol: quote.symbol, nativeCurrency: quote.currency }
      }
    } catch { /* try next */ }
  }

  // 2. Fall back to search
  try {
    const results = await yf.search(query, { quotesCount: 8, newsCount: 0 }, { validateResult: false })
    const equities = (results?.quotes ?? []).filter((q: { quoteType: string; symbol: string; currency?: string }) =>
      q.quoteType === 'EQUITY' && q.symbol
    )
    if (equities.length === 0) return null

    // Prefer results on the right exchange for the settlement currency
    const preferred = equities.find((q: { exchange?: string }) =>
      preferredExchanges.some((ex) => q.exchange?.toUpperCase().includes(ex))
    ) ?? equities[0]

    // Fetch currency from a full quote
    try {
      const quote = await yf.quote(preferred.symbol, {}, { validateResult: false })
      if (quote?.currency) return { symbol: preferred.symbol, nativeCurrency: quote.currency }
    } catch { /* fall through */ }

    return { symbol: preferred.symbol, nativeCurrency: settlementCurrency }
  } catch {
    return null
  }
}

// ─── FX rate lookup ───────────────────────────────────────────────────────────

const fxCache = new Map<string, number>()

async function getFxRate(from: string, to: string, dateStr: string): Promise<number | null> {
  if (from === to) return 1
  const key = `${from}${to}::${dateStr.slice(0, 10)}`
  if (fxCache.has(key)) return fxCache.get(key)!

  const pair = `${from}${to}=X`
  const date = new Date(dateStr)
  const from7 = new Date(date); from7.setDate(from7.getDate() - 7)
  const to1 = new Date(date); to1.setDate(to1.getDate() + 1)

  try {
    const rows = await yf.historical(pair, {
      period1: from7.toISOString().slice(0, 10),
      period2: to1.toISOString().slice(0, 10),
    }, { validateResult: false })

    if (!rows?.length) return null

    const target = date.getTime()
    const sorted = rows
      .filter((r: { date: Date }) => r.date.getTime() <= target + 86400000)
      .sort((a: { date: Date }, b: { date: Date }) => b.date.getTime() - a.date.getTime())

    const rate = sorted[0]?.close ?? null
    if (rate) fxCache.set(key, rate)
    return rate
  } catch {
    return null
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { importBatchId } = await request.json()
  if (!importBatchId) return NextResponse.json({ error: 'importBatchId required' }, { status: 400 })

  const { data: batch } = await supabase
    .from('import_batches')
    .select('id')
    .eq('id', importBatchId)
    .eq('user_id', user.id)
    .single()

  if (!batch) return NextResponse.json({ error: 'Import not found' }, { status: 404 })

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('id, ticker, name, executed_at, price, currency')
    .eq('import_id', importBatchId)
    .eq('user_id', user.id)
    .is('native_price', null)

  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })
  if (!transactions?.length) return NextResponse.json({ enriched: 0, failed: 0, tickerUpdates: 0 })

  let enriched = 0, failed = 0, tickerUpdates = 0

  // Cache resolved tickers within this batch
  const tickerCache = new Map<string, { symbol: string; nativeCurrency: string } | null>()

  async function resolveCached(ticker: string, name: string | null, currency: string) {
    const key = `${ticker}::${currency}`
    if (tickerCache.has(key)) return tickerCache.get(key)!
    const result = await resolveTickerSymbol(ticker, name, currency)
    tickerCache.set(key, result)
    return result
  }

  // Process in small parallel batches
  for (let i = 0; i < transactions.length; i += 5) {
    const chunk = transactions.slice(i, i + 5)

    await Promise.all(chunk.map(async (tx) => {
      const resolved = await resolveCached(tx.ticker, tx.name, tx.currency)

      if (!resolved) {
        await supabase
          .from('transactions')
          .update({ price_lookup_failed: true })
          .eq('id', tx.id)
        failed++
        return
      }

      const fxRate = await getFxRate(tx.currency, resolved.nativeCurrency, tx.executed_at)

      if (!fxRate) {
        await supabase
          .from('transactions')
          .update({ price_lookup_failed: true })
          .eq('id', tx.id)
        failed++
        return
      }

      const nativePrice = +(tx.price * fxRate).toFixed(6)
      const updates: Record<string, unknown> = {
        native_price: nativePrice,
        native_currency: resolved.nativeCurrency,
        price_lookup_failed: false,
      }

      // Update ticker if we found a better symbol
      if (resolved.symbol !== tx.ticker) {
        updates.ticker = resolved.symbol
        tickerUpdates++
      }

      await supabase.from('transactions').update(updates).eq('id', tx.id)
      enriched++
    }))

    if (i + 5 < transactions.length) await new Promise((r) => setTimeout(r, 250))
  }

  return NextResponse.json({ enriched, failed, tickerUpdates })
}
