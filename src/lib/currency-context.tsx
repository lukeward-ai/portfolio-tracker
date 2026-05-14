'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Currency } from '@/lib/types'

interface ExchangeRates {
  [key: string]: number
}

interface CurrencyContextValue {
  currency: Currency
  setCurrency: (c: Currency) => void
  rates: ExchangeRates
  convert: (amount: number, from: Currency, to?: Currency) => number
  format: (amount: number, from?: Currency) => string
  loading: boolean
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD',
  setCurrency: () => {},
  rates: {},
  convert: (a) => a,
  format: (a) => a.toString(),
  loading: true,
})

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
}

export function CurrencyProvider({
  children,
  defaultCurrency = 'USD',
}: {
  children: React.ReactNode
  defaultCurrency?: Currency
}) {
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)
  const [rates, setRates] = useState<ExchangeRates>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/exchange-rates')
      .then((r) => r.json())
      .then((data) => {
        setRates(data.rates ?? {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const convert = useCallback(
    (amount: number, from: Currency, to?: Currency): number => {
      const target = to ?? currency
      if (from === target) return amount
      const key = `${from}_${target}`
      const rate = rates[key]
      if (!rate) return amount
      return amount * rate
    },
    [currency, rates]
  )

  const format = useCallback(
    (amount: number, from?: Currency): string => {
      const value = from ? convert(amount, from) : amount
      return `${CURRENCY_SYMBOLS[currency]}${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    },
    [currency, convert]
  )

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, convert, format, loading }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => useContext(CurrencyContext)
