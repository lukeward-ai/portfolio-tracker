'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCurrency } from '@/lib/currency-context'
import { toast } from 'sonner'
import { Wallet, ArrowUp, ArrowDown } from 'lucide-react'
import type { Portfolio, CashPosition, Currency } from '@/lib/types'

const CURRENCY_FLAGS: Record<Currency, string> = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧' }

interface Props {
  userId: string
  portfolios: Portfolio[]
  cashPositions: CashPosition[]
}

export function CashClient({ userId, portfolios, cashPositions: initial }: Props) {
  const [positions, setPositions] = useState(initial)
  const [adjustCurrency, setAdjustCurrency] = useState<Currency>('USD')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustType, setAdjustType] = useState<'add' | 'withdraw'>('add')
  const [portfolioId] = useState(portfolios[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const { format, convert } = useCurrency()

  const totalInBase = positions.reduce(
    (sum, p) => sum + convert(p.amount, p.currency as Currency),
    0
  )

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const amount = parseFloat(adjustAmount)
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); setLoading(false); return }

    const existing = positions.find((p) => p.portfolio_id === portfolioId && p.currency === adjustCurrency)
    const delta = adjustType === 'add' ? amount : -amount
    const newAmount = (existing?.amount ?? 0) + delta

    if (newAmount < 0) { toast.error('Insufficient cash balance'); setLoading(false); return }

    const { data, error } = existing
      ? await supabase
          .from('cash_positions')
          .update({ amount: newAmount, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select().single()
      : await supabase
          .from('cash_positions')
          .insert({ portfolio_id: portfolioId, user_id: userId, currency: adjustCurrency, amount: newAmount })
          .select().single()

    if (error) {
      toast.error(error.message)
    } else {
      setPositions(positions.map((p) => p.id === data.id ? data : p).concat(existing ? [] : [data]))
      toast.success(`Cash ${adjustType === 'add' ? 'deposited' : 'withdrawn'}: ${format(amount, adjustCurrency)}`)
      setAdjustAmount('')
    }
    setLoading(false)
  }

  const byCurrency = (['USD', 'EUR', 'GBP'] as Currency[]).map((cur) => {
    const pos = positions.filter((p) => p.currency === cur)
    const total = pos.reduce((s, p) => s + p.amount, 0)
    return { currency: cur, amount: total }
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Cash Positions</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {byCurrency.map(({ currency: cur, amount }) => (
          <Card key={cur}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <span>{CURRENCY_FLAGS[cur]}</span> {cur} Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{format(amount, cur)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                ≈ {format(convert(amount, cur))} in display currency
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Total Cash
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{format(totalInBase)}</p>
          <p className="text-sm text-muted-foreground mt-1">Across all currencies</p>
        </CardContent>
      </Card>

      {/* Adjust cash */}
      <Card>
        <CardHeader>
          <CardTitle>Deposit / Withdraw Cash</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdjust} className="flex flex-wrap gap-3 items-end">
            <div className="space-y-2">
              <Label>Action</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={adjustType === 'add' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAdjustType('add')}
                  className="flex items-center gap-1"
                >
                  <ArrowUp className="h-3 w-3" /> Deposit
                </Button>
                <Button
                  type="button"
                  variant={adjustType === 'withdraw' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setAdjustType('withdraw')}
                  className="flex items-center gap-1"
                >
                  <ArrowDown className="h-3 w-3" /> Withdraw
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={adjustCurrency} onValueChange={(v) => v && setAdjustCurrency(v as Currency)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">🇺🇸 USD</SelectItem>
                  <SelectItem value="EUR">🇪🇺 EUR</SelectItem>
                  <SelectItem value="GBP">🇬🇧 GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                className="w-40"
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Confirm'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
