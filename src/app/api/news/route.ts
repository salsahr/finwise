process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

export const runtime = 'nodejs'
export const revalidate = 1800

const RSS_FEEDS = [
  'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FuQjBHZ0pDVWlnQVAB?hl=pt-BR&gl=BR&ceid=BR:pt-419',
  'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FuQjBHZ0pDVWlnQVAB?hl=pt-BR&gl=BR&ceid=BR:pt-419',
]

interface RssItem {
  title: string
  link: string
  source: string
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = []
  const itemBlocks = xml.split('<item>')

  for (let i = 1; i < itemBlocks.length; i++) {
    const block = itemBlocks[i].split('</item>')[0]

    const titleMatch = block.match(/<title>([^<]+)<\/title>/)
    const rawTitle = titleMatch?.[1] || ''

    let link = ''
    const linkMatch = block.match(/<link\/?>\s*(https?:\/\/[^\s<]+)/) || block.match(/<link>(https?:\/\/[^\s<]+)<\/link>/)
    if (linkMatch) {
      link = linkMatch[1]
    }

    const sourceMatch = block.match(/<source[^>]*>([^<]+)<\/source>/)
    const source = sourceMatch?.[1] || ''

    let title = rawTitle
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(` - ${source}`).length)
    }

    if (title.trim()) {
      items.push({
        title: title.trim(),
        link: link.trim(),
        source: source.trim(),
      })
    }
  }
  return items
}

const KEYWORDS_TO_CATEGORY: [RegExp, string][] = [
  [/guerra|conflito|ataque|míssil|bomb|militar|defesa|tropas|invasão|irã|iran/i, 'guerra'],
  [/petróleo|gás|opep|energia|renovável|eólica|solar|etanol|diesel/i, 'energia'],
  [/acordo|tratado|aliança|parceria|brics|g20|g7|cúpula/i, 'acordo'],
  [/lei|regulação|regulament|aprovação|congresso|senado|câmara|stf|supremo|anvisa/i, 'lei'],
  [/eleição|presidente|governo|ministro|política|partido|votação|lula|trump/i, 'política'],
  [/juros|selic|inflação|pib|fed|bce|banco central|dólar|câmbio|recessão|ibovespa|bolsa/i, 'economia'],
  [/tecnologia|ia|inteligência artificial|chip|semicondut|big tech|openai|musk/i, 'tecnologia'],
]

function categorize(title: string): string {
  for (const [regex, category] of KEYWORDS_TO_CATEGORY) {
    if (regex.test(title)) return category
  }
  return 'mercado'
}

function guessImpact(title: string): 'positivo' | 'negativo' | 'neutro' {
  const negative = /queda|cai|crise|guerra|conflito|ataque|recessão|inflação|alta do dólar|sanção|risco|tomba|desaba|piora|recua|perde/i
  const positive = /alta|sobe|cresce|acordo|avanço|recorde|melhora|aprovação|investimento|lucro|expansão/i
  if (negative.test(title)) return 'negativo'
  if (positive.test(title)) return 'positivo'
  return 'neutro'
}

function guessRegion(title: string, source: string): string {
  const regions: [RegExp, string][] = [
    [/brasil|selic|lula|real|ibovespa|bovespa|congresso nacional|stf|petrobras/i, 'Brasil'],
    [/eua|estados unidos|trump|biden|fed|wall street|nasdaq|s&p/i, 'EUA'],
    [/china|xi jinping|pequim|beijing|yuan|xangai/i, 'China'],
    [/rússia|russia|putin|moscou|kremlin|ucrânia/i, 'Rússia'],
    [/europa|ue|união europeia|bce|euro|alemanha|frança|bruxelas/i, 'Europa'],
    [/oriente médio|israel|gaza|irã|síria|líbano|hamas|hezbollah/i, 'Oriente Médio'],
    [/japão|tóquio|iene|nikkei/i, 'Japão'],
    [/índia|modi|rupee|mumbai/i, 'Índia'],
    [/argentina|peso argentino|milei/i, 'Argentina'],
    [/opep|brics|g20|g7/i, 'Global'],
  ]
  const combined = `${title} ${source}`
  for (const [regex, region] of regions) {
    if (regex.test(combined)) return region
  }
  return 'Global'
}

export async function GET() {
  try {
    const allItems: RssItem[] = []

    const results = await Promise.allSettled(
      RSS_FEEDS.map((url) =>
        fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          next: { revalidate: 1800 },
        }).then((r) => r.text())
      )
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...parseRssItems(result.value))
      }
    }

    const seen = new Set<string>()
    const unique = allItems.filter((item) => {
      const key = item.title.toLowerCase().slice(0, 50)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const headlines = unique.slice(0, 15).map((item, i) => ({
      id: String(i),
      title: item.title.length > 95 ? item.title.slice(0, 92) + '...' : item.title,
      category: categorize(item.title),
      region: guessRegion(item.title, item.source),
      impact: guessImpact(item.title),
      url: item.link,
      source: item.source,
    }))

    return Response.json(
      { headlines },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
        },
      }
    )
  } catch (err) {
    console.error('[news/route] Error:', err)
    return Response.json(
      { headlines: [], error: 'Failed to fetch news' },
      { status: 500 }
    )
  }
}
