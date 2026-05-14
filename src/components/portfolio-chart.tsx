'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Currency } from '@/lib/types'

const PALETTE = [
  '#2563EB', '#16A34A', '#0EA5E9', '#7C3AED',
  '#EA580C', '#D97706', '#0891B2', '#4F46E5',
  '#BE185D', '#065F46',
]

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

interface CustomLabelProps {
  cx: number
  cy: number
  midAngle: number
  innerRadius: number
  outerRadius: number
  percent: number
  name: string
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-white border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground">{item.name}</p>
      <p className="text-muted-foreground">
        {item.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
      </p>
    </div>
  )
}

export function PortfolioChart({ holdings, prices, convert }: Props) {
  const data = holdings
    .map((h) => {
      const p = prices[h.ticker]
      if (!p) return null
      return {
        name: h.ticker,
        value: convert(p.price * h.quantity, p.currency as Currency),
      }
    })
    .filter((d): d is { name: string; value: number } => d !== null && d.value > 0)
    .sort((a, b) => b.value - a.value)

  const total = data.reduce((s, d) => s + d.value, 0)

  if (data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
        <div className="w-16 h-16 rounded-full border-4 border-dashed border-border" />
        <p className="text-sm">No holdings to display</p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-6">
      <div className="shrink-0" style={{ width: 220, height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-2 min-w-0">
        {data.slice(0, 8).map((item, i) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0
          return (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="text-xs font-semibold text-foreground w-12 shrink-0">{item.name}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
                {pct.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
