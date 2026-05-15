import { NextRequest, NextResponse } from 'next/server'
import type { TickerDetail, TickerNews } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: YahooFinance } = require('yahoo-finance2')
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const ticker = symbol.toUpperCase()

  try {
    const [summaryResult, searchResult] = await Promise.allSettled([
      yf.quoteSummary(
        ticker,
        { modules: ['price', 'summaryDetail', 'assetProfile', 'recommendationTrend'] },
        { validateResult: false }
      ),
      yf.search(ticker, {}, { validateResult: false }),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: any = summaryResult.status === 'fulfilled' ? summaryResult.value : {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchData: any = searchResult.status === 'fulfilled' ? searchResult.value : {}

    const price = s.price ?? {}
    const detail = s.summaryDetail ?? {}
    const profile = s.assetProfile ?? {}
    const reco = s.recommendationTrend?.trend?.[0] ?? {}

    const news: TickerNews[] = ((searchData.news ?? []) as Record<string, unknown>[])
      .slice(0, 8)
      .map((n) => ({
        title: (n.title as string) ?? '',
        url: (n.link as string) ?? '',
        publishedAt: n.providerPublishTime
          ? new Date((n.providerPublishTime as number) * 1000).toISOString()
          : '',
        source: (n.publisher as string) ?? null,
      }))
      .filter((n) => n.title)

    const result: TickerDetail = {
      ticker,
      name: price.longName ?? price.shortName ?? null,
      price: price.regularMarketPrice ?? 0,
      change: price.regularMarketChange ?? 0,
      changePercent: price.regularMarketChangePercent ?? 0,
      previousClose: price.regularMarketPreviousClose ?? 0,
      currency: price.currency ?? 'USD',
      marketCap: price.marketCap ?? null,
      week52High: detail.fiftyTwoWeekHigh ?? null,
      week52Low: detail.fiftyTwoWeekLow ?? null,
      trailingPE: detail.trailingPE ?? null,
      forwardPE: detail.forwardPE ?? null,
      dividendYield: detail.dividendYield != null ? detail.dividendYield * 100 : null,
      dividendRate: detail.dividendRate ?? null,
      beta: detail.beta ?? null,
      sector: profile.sector ?? null,
      industry: profile.industry ?? null,
      description: profile.longBusinessSummary ?? null,
      recommendationKey: reco.period ? null : (s.recommendationTrend?.trend?.[0]?.strongBuy != null ? deriveRecoKey(reco) : null),
      recommendationMean: null,
      numberOfAnalystOpinions: reco.strongBuy != null
        ? (reco.strongBuy + reco.buy + reco.hold + reco.sell + reco.strongSell)
        : null,
      news,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Ticker detail error:', ticker, err)
    return NextResponse.json({ error: 'Failed to fetch ticker detail' }, { status: 500 })
  }
}

function deriveRecoKey(reco: Record<string, number>): string {
  const total = (reco.strongBuy ?? 0) + (reco.buy ?? 0) + (reco.hold ?? 0) + (reco.sell ?? 0) + (reco.strongSell ?? 0)
  if (total === 0) return 'none'
  const bullish = (reco.strongBuy ?? 0) + (reco.buy ?? 0)
  const ratio = bullish / total
  if (ratio > 0.6) return 'buy'
  if (ratio > 0.4) return 'hold'
  return 'sell'
}
