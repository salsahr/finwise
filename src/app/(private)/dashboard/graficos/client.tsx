'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import {
  Search, Send, Bot, TrendingUp, TrendingDown, Minus,
  RefreshCw, BarChart2, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useExchangeRates } from '@/components/exchange-rates'

// ── Types ────────────────────────────────────────────────────────────────────

type PricePoint = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type ChartData = {
  ticker: string
  name: string
  currency: string
  currentPrice: number
  prices: PricePoint[]
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type UserAsset = { name: string; type: string }

// ── Constants ────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: '1 Sem', value: '1wk' },
  { label: '1 Mês', value: '1mo' },
  { label: '3 Meses', value: '3mo' },
  { label: '1 Ano', value: '1y' },
  { label: '5 Anos', value: '5y' },
  { label: 'Total', value: 'max' },
]

const SUGGESTED_QUESTIONS = [
  '📊 O que esse gráfico está me dizendo?',
  '📈 O ativo está em alta ou baixa?',
  '📉 Devo me preocupar com essa queda?',
  '💡 O que é tendência e como identificar?',
  '🔍 Como interpretar o volume de negociações?',
  '⚖️ O preço está alto ou baixo historicamente?',
]

const POPULAR_TICKERS = [
  { ticker: 'PETR4.SA', label: 'PETR4' },
  { ticker: 'VALE3.SA', label: 'VALE3' },
  { ticker: 'ITUB4.SA', label: 'ITUB4' },
  { ticker: 'BBDC4.SA', label: 'BBDC4' },
  { ticker: 'BTC-USD', label: 'Bitcoin' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildChartSummary(data: ChartData): string {
  const { prices } = data
  if (!prices.length) return ''
  const first = prices[0].close
  const last = prices[prices.length - 1].close
  const change = ((last - first) / first) * 100
  const direction = change > 0 ? 'alta' : change < 0 ? 'baixa' : 'estável'
  const maxPrice = Math.max(...prices.map((p) => p.high))
  const minPrice = Math.min(...prices.map((p) => p.low))
  const avgVol = prices.reduce((s, p) => s + p.volume, 0) / prices.length
  return `Ativo: ${data.ticker} (${data.name}). Período: ${prices[0].date} a ${prices[prices.length - 1].date}. Preço inicial: ${first.toFixed(2)}, atual: ${last.toFixed(2)}, variação: ${change.toFixed(2)}% (${direction}). Máxima: ${maxPrice.toFixed(2)}, Mínima: ${minPrice.toFixed(2)}. Volume médio diário: ${Math.round(avgVol).toLocaleString('pt-BR')}.`
}

function formatAxisDate(d: string, period: string) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  if (period === '5y' || period === 'max') {
    return dt.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  }
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function formatTooltipDate(d: string) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function uid() {
  return Math.random().toString(36).slice(2)
}

// ── Custom hook: streaming chat via fetch ─────────────────────────────────────

function useStreamingChat(apiPath: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (content: string, extra?: Record<string, unknown>) => {
    if (!content.trim() || isLoading) return

    const userMsg: Message = { id: uid(), role: 'user', content }
    const assistantId = uid()

    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    setIsLoading(true)

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }))

      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, ...extra }),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) throw new Error('Resposta inválida')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
        )
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Desculpe, ocorreu um erro. Tente novamente.' }
              : m
          )
        )
      }
    } finally {
      setIsLoading(false)
    }
  }, [apiPath, messages, isLoading])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setInput('')
    setIsLoading(false)
  }, [])

  return { messages, input, setInput, isLoading, sendMessage, reset }
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

type TooltipProps = {
  active?: boolean
  payload?: any
  label?: any
  prices: PricePoint[]
}

function ChartTooltip({ active, payload, label, prices }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = prices.find((p) => p.date === label)
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label ? formatTooltipDate(label) : ''}</p>
      <p className="text-muted-foreground">
        Fechamento: <span className="text-foreground font-medium">R$ {payload[0]?.value?.toFixed(2)}</span>
      </p>
      {d && (
        <>
          <p className="text-muted-foreground">Abertura: <span className="text-foreground">R$ {d.open?.toFixed(2)}</span></p>
          <p className="text-muted-foreground">Máx: <span className="text-emerald-500">R$ {d.high?.toFixed(2)}</span></p>
          <p className="text-muted-foreground">Mín: <span className="text-red-400">R$ {d.low?.toFixed(2)}</span></p>
          <p className="text-muted-foreground">Volume: <span className="text-foreground">{d.volume?.toLocaleString('pt-BR')}</span></p>
        </>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function GraficosClient({ userAssets }: { userAssets: UserAsset[] }) {
  const [tickerInput, setTickerInput] = useState('')
  const [period, setPeriod] = useState('3mo')
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(false)
  const [chartError, setChartError] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  const { messages, input, setInput, isLoading: aiLoading, sendMessage, reset: resetChat } = useStreamingChat(
    '/api/ai/chart-assistant'
  )

  const { convertToReal } = useExchangeRates()

  const chartSummary = chartData ? buildChartSummary(chartData) : ''

  const fetchChart = useCallback(async (ticker: string, p: string) => {
    if (!ticker) return
    setLoading(true)
    setChartError('')
    setChartData(null)
    resetChat()
    try {
      const res = await fetch(`/api/chart/${encodeURIComponent(ticker)}?period=${p}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido')
      setChartData(json)
    } catch (e: unknown) {
      setChartError(e instanceof Error ? e.message : 'Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }, [resetChat])

  // Re-fetch when period changes (only if a ticker is already loaded)
  const chartDataRef = useRef(chartData)
  chartDataRef.current = chartData
  useEffect(() => {
    if (chartDataRef.current) fetchChart(chartDataRef.current.ticker, period)
  }, [period, fetchChart])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tickerInput.trim()) return

    let formattedTicker = tickerInput.trim().toUpperCase()
    
    // Auto-append .SA for standard Brazilian B3 tickers (e.g., PETR4, WEGE3, AAPL34)
    // Matches 4 letters followed by 1 or 2 numbers, without any existing dot suffix
    if (/^[A-Z]{4}\d{1,2}$/.test(formattedTicker)) {
      formattedTicker += '.SA'
    }

    fetchChart(formattedTicker, period)
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !chartData) return
    sendMessage(input, { ticker: chartData.ticker, chartSummary })
    setInput('')
  }

  const handleSuggestedQuestion = (q: string) => {
    if (!chartData) return
    sendMessage(q, { ticker: chartData.ticker, chartSummary })
  }

  // Trend
  const trend = chartData && chartData.prices.length >= 2
    ? chartData.prices[chartData.prices.length - 1].close - chartData.prices[0].close
    : 0
  const trendPct = chartData && chartData.prices.length >= 2
    ? ((chartData.prices[chartData.prices.length - 1].close - chartData.prices[0].close) / chartData.prices[0].close) * 100
    : 0
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  const trendColor = trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-red-500' : 'text-muted-foreground'

  const firstClose = chartData?.prices[0]?.close

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Gráficos Históricos
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Visualize a evolução de qualquer ativo e conte com a IA para entender o que está acontecendo.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="ticker-search"
            className="pl-9 h-11 text-base"
            placeholder="Ex: PETR4.SA, VALE3.SA, BTC-USD"
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" disabled={loading} className="h-11 gap-2">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
          {loading ? 'Buscando...' : 'Ver Gráfico'}
        </Button>
      </form>

      {/* Quick access */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-muted-foreground font-medium">Populares:</span>
        {POPULAR_TICKERS.map((t) => (
          <button
            key={t.ticker}
            type="button"
            onClick={() => { setTickerInput(t.ticker); fetchChart(t.ticker, period) }}
            className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary hover:text-primary hover:bg-primary/5 transition-all duration-200 font-medium"
          >
            {t.label}
          </button>
        ))}
        {userAssets.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground font-medium ml-2">Sua carteira:</span>
            {userAssets.slice(0, 4).map((a) => (
              <button
                key={a.name}
                type="button"
                onClick={() => { setTickerInput(a.name); fetchChart(a.name, period) }}
                className="text-xs px-3 py-1.5 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-all duration-200 font-medium"
              >
                {a.name}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Chart + AI panel */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

        {/* ── Chart ── */}
        <div className="flex flex-col gap-4">
          {chartError && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4 text-destructive text-sm">{chartError}</CardContent>
            </Card>
          )}

          {!chartData && !loading && !chartError && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center h-72 text-center text-muted-foreground">
                <BarChart2 className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">Busque um ativo para começar</p>
                <p className="text-sm mt-1">Digite o ticker acima ou clique em um dos atalhos</p>
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-72 text-muted-foreground gap-3">
                <RefreshCw className="h-8 w-8 animate-spin opacity-40" />
                <p className="text-sm">Carregando dados do mercado...</p>
              </CardContent>
            </Card>
          )}

          {chartData && !loading && (
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-2xl font-bold">{chartData.ticker}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5 max-w-xs truncate">{chartData.name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold tracking-tight">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: chartData.currency === 'USD' ? 'USD' : 'BRL',
                      }).format(chartData.currentPrice)}
                    </div>
                    {chartData.currency === 'USD' && (
                      <div className="text-sm text-muted-foreground font-medium mt-0.5">
                        ≈ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(convertToReal(chartData.currentPrice, 'USD'))}
                      </div>
                    )}
                    <div className={`flex items-center justify-end gap-1 mt-1 font-semibold text-sm ${trendColor}`}>
                      <TrendIcon className="h-4 w-4" />
                      {trendPct >= 0 ? '+' : ''}{trendPct.toFixed(2)}% no período
                    </div>
                  </div>
                </div>

                {/* Period selector */}
                <div className="flex gap-2 mt-3">
                  {PERIODS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPeriod(p.value)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                        period === p.value
                          ? 'bg-primary text-primary-foreground shadow'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="pt-2 pb-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData.prices} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => formatAxisDate(val, period)}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={40}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      width={60}
                    />
                    <Tooltip content={(props) => <ChartTooltip {...props} prices={chartData.prices} />} />
                    {firstClose && (
                      <ReferenceLine y={firstClose} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" opacity={0.4} />
                    )}
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke={trend >= 0 ? '#10b981' : '#ef4444'}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── AI Panel ── */}
        <Card className="flex flex-col h-[560px] overflow-hidden border-primary/20">
          <CardHeader className="pb-3 border-b border-border bg-gradient-to-r from-primary/5 to-blue-500/5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Assistente IA</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Pergunte qualquer coisa sobre o gráfico</p>
              </div>
            </div>
          </CardHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-full bg-primary/10 shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-foreground/90 leading-relaxed max-w-[90%]">
                    {chartData
                      ? `Olá! 👋 Estou pronto para te ajudar a entender o gráfico do ${chartData.ticker}. Clique em uma pergunta abaixo ou escreva a sua!`
                      : 'Olá! 👋 Busque um ativo acima e eu te ajudo a entender o gráfico. Vou explicar tudo em linguagem simples!'}
                  </div>
                </div>

                {chartData && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs text-muted-foreground px-1">Sugestões de perguntas:</p>
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => handleSuggestedQuestion(q)}
                        disabled={aiLoading}
                        className="w-full text-left text-xs px-3 py-2.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all duration-200 leading-snug disabled:opacity-50"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex items-start gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="p-1.5 rounded-full bg-primary/10 shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[88%] whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted/60 text-foreground/90 rounded-tl-sm'
                  }`}
                >
                  {m.content || (m.role === 'assistant' && aiLoading ? (
                    <span className="flex gap-1.5 items-center h-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : '')}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border bg-background/50">
            <form onSubmit={handleSend} className="flex gap-2 items-center">
              <Input
                id="ai-chat-input"
                className="flex-1 h-10 text-sm rounded-xl bg-muted/40 border-border focus-visible:ring-primary/30"
                placeholder={chartData ? 'Pergunte sobre o gráfico...' : 'Busque um ativo primeiro...'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={aiLoading || !chartData}
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 rounded-xl shrink-0"
                disabled={aiLoading || !chartData || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              FinBot não oferece recomendações de investimento
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
