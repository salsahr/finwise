"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";

interface Headline {
  id: string;
  title: string;
  category: string;
  region: string;
  impact: "positivo" | "negativo" | "neutro";
  url?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  guerra: "#ef4444",
  política: "#a78bfa",
  economia: "#60a5fa",
  acordo: "#34d399",
  lei: "#fbbf24",
  mercado: "#f97316",
  energia: "#06b6d4",
  tecnologia: "#ec4899",
};

const CATEGORY_LABELS: Record<string, string> = {
  guerra: "GUERRA",
  política: "POLÍTICA",
  economia: "ECONOMIA",
  acordo: "ACORDO",
  lei: "LEI",
  mercado: "MERCADO",
  energia: "ENERGIA",
  tecnologia: "TECH",
};

function ImpactIcon({ impact }: { impact: Headline["impact"] }) {
  if (impact === "positivo")
    return <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  if (impact === "negativo")
    return <TrendingDown className="h-3.5 w-3.5 text-red-400 shrink-0" />;
  return <Minus className="h-3.5 w-3.5 text-zinc-400 shrink-0" />;
}

export function NewsCarousel() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const posRef = useRef(0);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((data) => {
        setHeadlines(data.headlines || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || headlines.length === 0) return;

    const track = trackRef.current;
    if (!track) return;

    let lastTime = 0;
    const speed = 40;

    function tick(time: number) {
      if (lastTime === 0) lastTime = time;
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      if (!paused) {
        posRef.current += speed * delta;
        const halfWidth = track!.scrollWidth / 2;
        if (posRef.current >= halfWidth) {
          posRef.current -= halfWidth;
        }
        track!.style.transform = `translateX(-${posRef.current}px)`;
      }

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [loading, headlines, paused]);

  const items = [...headlines, ...headlines];

  return (
    <div
      className="news-ticker-container"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Left label */}
      <div className="news-ticker-label">
        <Zap className="h-3.5 w-3.5" />
        <span>AO VIVO</span>
      </div>

      {/* Scrolling content */}
      <div className="news-ticker-viewport">
        {loading ? (
          <div className="news-ticker-loading">
            <span className="news-ticker-dot" />
            <span
              className="news-ticker-dot"
              style={{ animationDelay: "0.2s" }}
            />
            <span
              className="news-ticker-dot"
              style={{ animationDelay: "0.4s" }}
            />
            <span className="text-xs text-zinc-400 ml-2">
              Carregando notícias...
            </span>
          </div>
        ) : (
          <div ref={trackRef} className="news-ticker-track">
            {items.map((h, i) => {
              const catColor = CATEGORY_COLORS[h.category] || "#60a5fa";
              const catLabel =
                CATEGORY_LABELS[h.category] || h.category.toUpperCase();
              return (
                <a
                  key={`${h.id}-${i}`}
                  className="news-ticker-item"
                  href={
                    h.url ||
                    `https://news.google.com/search?q=${encodeURIComponent(h.title)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  title={h.title}
                >
                  <span
                    className="news-ticker-badge"
                    style={{
                      backgroundColor: catColor + "22",
                      color: catColor,
                      borderColor: catColor + "44",
                    }}
                  >
                    {catLabel}
                  </span>
                  <Globe className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  <span className="news-ticker-region">{h.region}</span>
                  <ImpactIcon impact={h.impact} />
                  <span className="news-ticker-title">{h.title}</span>
                  <span className="news-ticker-sep">◆</span>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Fade edges */}
      <div className="news-ticker-fade-left" />
      <div className="news-ticker-fade-right" />
    </div>
  );
}
