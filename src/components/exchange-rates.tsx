'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

type Rate = {
  bid: number
  ask: number
  name: string
  pctChange: string
}

type ExchangeData = {
  rates: Record<string, Rate>
  updatedAt: string
}

const DISPLAY_CURRENCIES = [
  { key: 'USDBRL', flag: '🇺🇸', symbol: 'USD' },
  { key: 'EURBRL', flag: '🇪🇺', symbol: 'EUR' },
  { key: 'GBPBRL', flag: '🇬🇧', symbol: 'GBP' },
  { key: 'BTCBRL', flag: '₿', symbol: 'BTC' },
]

export function ExchangeRates() {
  const [data, setData] = useState<ExchangeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/exchange')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="exchange-widget">
        <div className="exchange-rate-chip" style={{ gap: 4 }}>
          <RefreshCw className="h-3 w-3 animate-spin opacity-50" />
          <span style={{ fontSize: 10 }}>Carregando câmbio...</span>
        </div>
      </div>
    )
  }

  if (!data?.rates) return null

  return (
    <div className="exchange-widget">
      {DISPLAY_CURRENCIES.map((c) => {
        const rate = data.rates[c.key]
        if (!rate) return null
        const pct = parseFloat(rate.pctChange)
        const isPositive = pct >= 0
        return (
          <div key={c.key} className="exchange-rate-chip">
            <span>{c.flag}</span>
            <span>{c.symbol}</span>
            <span className="rate-value">
              {c.symbol === 'BTC'
                ? `R$ ${rate.bid.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                : `R$ ${rate.bid.toFixed(2)}`}
            </span>
            <span className={`rate-change ${isPositive ? 'positive' : 'negative'}`}>
              {isPositive ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function useExchangeRates() {
  const [rates, setRates] = useState<Record<string, Rate>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/exchange')
      .then((r) => r.json())
      .then((d) => setRates(d.rates || {}))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const convertToReal = (amount: number, fromCurrency: string): number => {
    const currency = fromCurrency.toUpperCase()
    if (currency === 'BRL') return amount

    const key = `${currency}BRL`
    const rate = rates[key]
    if (rate) return amount * rate.bid

    return amount
  }

  return { rates, loading, convertToReal }
}
