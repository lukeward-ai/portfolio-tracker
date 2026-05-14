'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrency } from '@/lib/currency-context'
import { calculatePnL, getHoldings } from '@/lib/pnl'
import { PortfolioChart } from '@/components/portfolio-chart'
import { TrendingUp, TrendingDown, Wallet, DollarSign, BarChart2, Activity } from 'lucide-react'
import type { Profile, Portfolio, Transaction, CashPosition, Currency } from '@/lib/types'

interface Props {
  profile: Profile | null
  portfolios: Portfolio[]
  transactions: Transaction[]
  cashPositions: CashPosition[]
}

export function DashboardClient({ profile, transactions, cashPositions }: Props) {
  const { currency, convert, format } = useCurrency()
  const [prices, setPrices] = useState<Record<string, { price: number; changePercent: number; currency: string }>>({})
  const [loadingPrices, setLoadingPrices] = useState(true)

  const { lots, realisedGains } = calculatePnL(transactions, profile?.tax_jurisdiction ?? 'UK')
  const holdings = getHoldings(transactions, lots)

  const tickers = holdings.map((h) => h.ticker)

  useEffect(() => {
    if (tickers.length === 0) {
      setLoadingPrices(false)
      return
    }
    fetch(`/api/prices?tickers=${tickers.join(',')}`)
      .then((r) => r.json())
      .then((data) => {
        setPrices(data.prices ?? {})
        setLoadingPrices(false)
      })
      .catch(() => setLoadingPrices(false))
  }, [tickers.join(',')])

  // Portfolio value
  let totalValue = 0
  let totalCost = 0
  let dayChange = 0

  for (const h of holdings) {
    const priceData = prices[h.ticker]
    if (!priceData) continue
    const priceCurrency = priceData.currency as Currency
    const currentValue = convert(priceData.price * h.quantity, priceCurrency)
    const cost = convert(h.costBasis, h.currency)
    const prevPrice = priceData.price / (1 + priceData.changePercent / 100)
    const prevValue = convert(prevPrice * h.quantity, priceCurrency)

    totalValue += currentValue
    totalCost += cost
    dayChange += currentValue - prevValue
  }

  // Cash
  let totalCash = 0
  for (const cash of cashPositions) {
    totalCash += convert(cash.amount, cash.currency as Currency)
  }

  const totalUnrealisedPnL = totalValue - totalCost
  const totalUnrealisedPnLPct = totalCost > 0 ? (totalUnrealisedPnL / totalCost) * 100 : 0
  const dayChangePct = (totalValue - dayChange) > 0 ? (dayChange / (totalValue - dayChange)) * 100 : 0

  const totalRealisedGain = realisedGains.reduce((sum, g) => sum + convert(g.gain, g.currency), 0)

  const statCards = [
    {
      title: 'Portfolio Value',
      value: loadingPrices ? null : format(totalValue),
      sub: loadingPrices ? null : `${dayChange >= 0 ? '+' : ''}${format(dayChange)} today (${dayChangePct >= 0 ? '+' : ''}${dayChangePct.toFixed(2)}%)`,
      positive: dayChange >= 0,
      icon: DollarSign,
    },
    {
      title: 'Unrealised P&L',
      value: loadingPrices ? null : format(totalUnrealisedPnL),
      sub: `${totalUnrealisedPnLPct >= 0 ? '+' : ''}${totalUnrealisedPnLPct.toFixed(2)}%`,
      positive: totalUnrealisedPnL >= 0,
      icon: totalUnrealisedPnL >= 0 ? TrendingUp : TrendingDown,
    },
    {
      title: 'Realised P&L',
      value: format(totalRealisedGain),
      sub: `${realisedGains.length} closed positions`,
      positive: totalRealisedGain >= 0,
      icon: BarChart2,
    },
    {
      title: 'Cash Balance',
      value: format(totalCash),
      sub: `${cashPositions.filter((c) => c.amount > 0).length} currencies`,
      positive: true,
      icon: Wallet,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Good morning{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-muted-foreground">Here&apos;s your portfolio overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {card.value === null ? (
                <Skeleton className="h-7 w-28 mb-1" />
              ) : (
                <p className="text-2xl font-bold">{card.value}</p>
              )}
              {card.sub && (
                <p className={`text-xs mt-1 ${card.positive ? 'text-green-600' : 'text-red-500'}`}>
                  {card.sub}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Portfolio Composition</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPrices ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <PortfolioChart holdings={holdings} prices={prices} currency={currency} convert={convert} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Top Holdings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {holdings.slice(0, 6).map((h) => {
                const priceData = prices[h.ticker]
                const change = priceData?.changePercent ?? 0
                return (
                  <div key={h.ticker} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{h.ticker}</p>
                      <p className="text-xs text-muted-foreground">{h.quantity.toFixed(2)} shares</p>
                    </div>
                    <div className="text-right">
                      {priceData && (
                        <p className="text-sm font-medium">
                          {format(convert(priceData.price * h.quantity, priceData.currency as Currency))}
                        </p>
                      )}
                      <Badge variant={change >= 0 ? 'default' : 'destructive'} className="text-xs">
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                      </Badge>
                    </div>
                  </div>
                )
              })}
              {holdings.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No holdings yet. Add your first transaction.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
