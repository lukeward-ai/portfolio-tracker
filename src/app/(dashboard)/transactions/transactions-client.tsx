'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useCurrency } from '@/lib/currency-context'
import { toast } from 'sonner'
import { Plus, Search, Trash2 } from 'lucide-react'
import { format as formatDate } from 'date-fns'
import type { Portfolio, Transaction, Currency } from '@/lib/types'

interface SearchResult { ticker: string; name: string; exchange: string }

interface Props {
  userId: string
  portfolios: Portfolio[]
  transactions: Transaction[]
}

export function TransactionsClient({ userId, portfolios, transactions: initial }: Props) {
  const [transactions, setTransactions] = useState(initial)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedTicker, setSelectedTicker] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [fees, setFees] = useState('0')
  const [notes, setNotes] = useState('')
  const [executedAt, setExecutedAt] = useState(new Date().toISOString().slice(0, 16))
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.id ?? '')
  const [filterType, setFilterType] = useState<'ALL' | 'BUY' | 'SELL'>('ALL')

  const { format } = useCurrency()
  const router = useRouter()

  const searchTickers = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return }
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setSearchResults(data.results ?? [])
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTicker) { toast.error('Please select a stock'); return }
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.from('transactions').insert({
      portfolio_id: portfolioId,
      user_id: userId,
      type,
      ticker: selectedTicker,
      name: selectedName,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      currency,
      fees: parseFloat(fees) || 0,
      notes: notes || null,
      executed_at: new Date(executedAt).toISOString(),
    }).select().single()

    if (error) {
      toast.error(error.message)
    } else {
      setTransactions([data, ...transactions])
      toast.success(`${type} order logged`)
      setOpen(false)
      resetForm()
      router.refresh()
    }
    setLoading(false)
  }

  function resetForm() {
    setSelectedTicker(''); setSelectedName(''); setSearchQuery(''); setSearchResults([])
    setQuantity(''); setPrice(''); setFees('0'); setNotes('')
    setExecutedAt(new Date().toISOString().slice(0, 16))
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setTransactions(transactions.filter((t) => t.id !== id))
    toast.success('Transaction deleted')
    router.refresh()
  }

  const filtered = transactions.filter((t) => filterType === 'ALL' || t.type === filterType)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Log Trade</Button>
        <Dialog open={open} onOpenChange={(v) => setOpen(v)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Log a Trade</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Buy/Sell toggle */}
              <div className="grid grid-cols-2 gap-2">
                {(['BUY', 'SELL'] as const).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={type === t ? 'default' : 'outline'}
                    onClick={() => setType(t)}
                    className={type === t && t === 'SELL' ? 'bg-red-500 hover:bg-red-600' : ''}
                  >
                    {t}
                  </Button>
                ))}
              </div>

              {/* Ticker search */}
              <div className="space-y-2">
                <Label>Stock / ETF</Label>
                {selectedTicker ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md">
                    <span className="font-medium">{selectedTicker}</span>
                    <span className="text-sm text-muted-foreground flex-1">{selectedName}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedTicker(''); setSelectedName('') }}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-8"
                        placeholder="Search ticker or company name..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); searchTickers(e.target.value) }}
                      />
                    </div>
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 bg-background border rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
                        {searchResults.map((r) => (
                          <button
                            key={r.ticker}
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left"
                            onClick={() => { setSelectedTicker(r.ticker); setSelectedName(r.name); setSearchResults([]) }}
                          >
                            <span className="font-medium text-sm">{r.ticker}</span>
                            <span className="text-xs text-muted-foreground flex-1 truncate">{r.name}</span>
                            <span className="text-xs text-muted-foreground">{r.exchange}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" step="any" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Price per share</Label>
                  <Input type="number" step="any" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={(v) => v && setCurrency(v as Currency)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fees</Label>
                  <Input type="number" step="any" min="0" value={fees} onChange={(e) => setFees(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Date & Time</Label>
                <Input type="datetime-local" value={executedAt} onChange={(e) => setExecutedAt(e.target.value)} required />
              </div>

              {portfolios.length > 1 && (
                <div className="space-y-2">
                  <Label>Portfolio</Label>
                  <Select value={portfolioId} onValueChange={(v) => v && setPortfolioId(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {portfolios.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input placeholder="Reason for trade..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : `Log ${type}`}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Trade History</CardTitle>
            <div className="flex gap-1">
              {(['ALL', 'BUY', 'SELL'] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filterType === f ? 'default' : 'outline'}
                  onClick={() => setFilterType(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Fees</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No transactions yet
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">{formatDate(new Date(tx.executed_at), 'dd MMM yyyy HH:mm')}</TableCell>
                    <TableCell>
                      <Badge variant={tx.type === 'BUY' ? 'default' : 'destructive'}>{tx.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{tx.ticker}</p>
                        <p className="text-xs text-muted-foreground">{tx.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{tx.quantity}</TableCell>
                    <TableCell className="text-right">{format(tx.price, tx.currency as Currency)}</TableCell>
                    <TableCell className="text-right font-medium">{format(tx.price * tx.quantity, tx.currency as Currency)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{format(tx.fees ?? 0, tx.currency as Currency)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{tx.notes ?? '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(tx.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
