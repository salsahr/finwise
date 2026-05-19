import { type NextRequest } from 'next/server'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

export const dynamic = 'force-dynamic'

type PricePoint = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type YahooQuoteResult = {
  meta: {
    symbol: string
    currency: string
    regularMarketPrice: number
    longName?: string
    shortName?: string
  }
  quotes: Array<{
    date: number
    open: number | null
    high: number | null
    low: number | null
    close: number | null
    volume: number | null
  }>
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const period = request.nextUrl.searchParams.get('period') ?? '3mo'

  const actualRange = period === 'max' ? '25y' : period
  const interval = period === 'max' ? '1wk' : '1d'

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${actualRange}&interval=${interval}&includePrePost=false`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; finwise/1.0)',
      },
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      return Response.json(
        { error: `Ticker '${ticker}' não encontrado ou sem dados disponíveis.` },
        { status: 404 }
      )
    }

    const json = await res.json()
    const result: YahooQuoteResult = json?.chart?.result?.[0]

    if (!result) {
      return Response.json(
        { error: `Nenhum dado encontrado para '${ticker}'.` },
        { status: 404 }
      )
    }

    const timestamps: number[] = json.chart.result[0].timestamp ?? []
    const ohlcv = json.chart.result[0].indicators?.quote?.[0]

    if (!timestamps.length || !ohlcv) {
      return Response.json(
        { error: `Dados históricos indisponíveis para '${ticker}'.` },
        { status: 404 }
      )
    }

    const prices: PricePoint[] = timestamps
      .map((ts: number, i: number) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        open: ohlcv.open?.[i] ?? null,
        high: ohlcv.high?.[i] ?? null,
        low: ohlcv.low?.[i] ?? null,
        close: ohlcv.close?.[i] ?? null,
        volume: ohlcv.volume?.[i] ?? 0,
      }))
      .filter((p) => p.close !== null) as PricePoint[]

    return Response.json({
      ticker: result.meta.symbol,
      name: result.meta.longName ?? result.meta.shortName ?? ticker,
      currency: result.meta.currency,
      currentPrice: result.meta.regularMarketPrice,
      prices,
    })
  } catch (err) {
    console.error('[chart-api]', err)
    return Response.json(
      { error: 'Erro ao buscar dados. Tente novamente.' },
      { status: 500 }
    )
  }
}
