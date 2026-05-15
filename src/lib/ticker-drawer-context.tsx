'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface TickerDrawerContextValue {
  selectedTicker: string | null
  openTicker: (ticker: string) => void
  closeTicker: () => void
}

const TickerDrawerContext = createContext<TickerDrawerContextValue>({
  selectedTicker: null,
  openTicker: () => {},
  closeTicker: () => {},
})

export function TickerDrawerProvider({ children }: { children: React.ReactNode }) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)

  const openTicker = useCallback((ticker: string) => {
    setSelectedTicker(ticker.toUpperCase())
  }, [])

  const closeTicker = useCallback(() => {
    setSelectedTicker(null)
  }, [])

  return (
    <TickerDrawerContext.Provider value={{ selectedTicker, openTicker, closeTicker }}>
      {children}
    </TickerDrawerContext.Provider>
  )
}

export const useTickerDrawer = () => useContext(TickerDrawerContext)
