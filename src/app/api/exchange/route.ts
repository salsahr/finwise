process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

export const runtime = 'nodejs'
export const revalidate = 300

export async function GET() {
  try {
    const res = await fetch(
      'https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,GBP-BRL,JPY-BRL,BTC-BRL',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        next: { revalidate: 300 },
      }
    )

    if (!res.ok) throw new Error('Failed to fetch exchange rates')

    const data = await res.json()

    const rates: Record<string, { bid: number; ask: number; name: string; pctChange: string }> = {}

    for (const [key, value] of Object.entries(data)) {
      const v = value as { bid: string; ask: string; name: string; pctChange: string }
      rates[key] = {
        bid: parseFloat(v.bid),
        ask: parseFloat(v.ask),
        name: v.name,
        pctChange: v.pctChange,
      }
    }

    return Response.json(
      { rates, updatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    )
  } catch (err) {
    console.error('[exchange/route] Error:', err)
    return Response.json(
      {
        rates: {
          USDBRL: { bid: 5.0, ask: 5.0, name: 'Dólar/Real', pctChange: '0' },
          EURBRL: { bid: 5.5, ask: 5.5, name: 'Euro/Real', pctChange: '0' },
          GBPBRL: { bid: 6.3, ask: 6.3, name: 'Libra/Real', pctChange: '0' },
        },
        updatedAt: new Date().toISOString(),
        fallback: true,
      },
      { status: 200 }
    )
  }
}
