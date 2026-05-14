'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Currency } from '@/lib/types'

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6']

interface Holding {
  ticker: string
  quantity: number
  currency: Currency
}

interface Props {
  holdings: Holding[]
  prices: Record<string, { price: number; currency: string }>
  currency: Currency
  convert: (amount: number, from: Currency) => number
}

export function PortfolioChart({ holdings, prices, convert }: Props) {
  const data = holdings
    .map((h) => {
      const priceData = prices[h.ticker]
      if (!priceData) return null
      return {
        name: h.ticker,
        value: convert(priceData.price * h.quantity, priceData.currency as Currency),
      }
    })
    .filter(Boolean)
    .filter((d) => d!.value > 0)
    .sort((a, b) => b!.value - a!.value) as { name: string; value: number }[]

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
        No holdings to display
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [`$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, 'Value']}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
