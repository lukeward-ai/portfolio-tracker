import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: YahooFinance } = require('yahoo-finance2')
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tickers = searchParams.get('tickers')?.split(',').filter(Boolean) ?? []

  if (tickers.length === 0) {
    return NextResponse.json({ prices: {} })
  }

  const supabase = createAdminClient()

  // Check cache (max 5 min old)
  const { data: cached } = await supabase
    .from('price_cache')
    .select('*')
    .in('ticker', tickers)
    .gt('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())

  const cachedTickers = new Set(cached?.map((c) => c.ticker) ?? [])
  const staleTickers = tickers.filter((t) => !cachedTickers.has(t))

  const prices: Record<string, {
    price: number
    currency: string
    changePercent: number
    previousClose: number
    name: string | null
    marketCap: number | null
    week52High: number | null
    week52Low: number | null
    trailingPE: number | null
    dividendYield: number | null
    beta: number | null
  }> = {}

  for (const row of cached ?? []) {
    prices[row.ticker] = {
      price: row.price,
      currency: row.currency,
      changePercent: row.change_percent,
      previousClose: row.previous_close,
      name: row.name,
      marketCap: row.market_cap,
      // These may be null if the DB row predates this feature
      week52High: row.week52_high ?? null,
      week52Low: row.week52_low ?? null,
      trailingPE: row.trailing_pe ?? null,
      dividendYield: row.dividend_yield ?? null,
      beta: row.beta ?? null,
    }
  }

  if (staleTickers.length > 0) {
    try {
      const quotes = await yf.quote(staleTickers)
      const quotesArray = Array.isArray(quotes) ? quotes : [quotes]

      for (const quote of quotesArray) {
        if (!quote?.symbol) continue
        const data = {
          price: quote.regularMarketPrice ?? 0,
          currency: quote.currency ?? 'USD',
          changePercent: quote.regularMarketChangePercent ?? 0,
          previousClose: quote.regularMarketPreviousClose ?? 0,
          name: quote.longName ?? quote.shortName ?? null,
          marketCap: quote.marketCap ?? null,
          week52High: (quote as Record<string, unknown>).fiftyTwoWeekHigh as number | null ?? null,
          week52Low: (quote as Record<string, unknown>).fiftyTwoWeekLow as number | null ?? null,
          trailingPE: (quote as Record<string, unknown>).trailingPE as number | null ?? null,
          dividendYield: (quote as Record<string, unknown>).trailingAnnualDividendYield as number | null ?? null,
          beta: (quote as Record<string, unknown>).beta as number | null ?? null,
        }
        prices[quote.symbol] = data

        // Upsert — extra columns are stored if the DB schema has them, silently ignored otherwise
        await supabase.from('price_cache').upsert({
          ticker: quote.symbol,
          price: data.price,
          currency: data.currency,
          change_percent: data.changePercent,
          previous_close: data.previousClose,
          name: data.name,
          market_cap: data.marketCap,
          updated_at: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error('Yahoo Finance error:', err)
    }
  }

  return NextResponse.json({ prices })
}
