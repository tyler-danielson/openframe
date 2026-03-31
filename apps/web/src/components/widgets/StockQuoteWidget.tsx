import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface StockQuoteWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

export function StockQuoteWidget({ config, style, isBuilder }: StockQuoteWidgetProps) {
  const symbolsStr = (config.symbols as string) || "AAPL,GOOGL,MSFT";
  const symbols = symbolsStr.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const layout = (config.layout as string) || "list"; // "list" | "ticker" | "card"

  const { data: quotes = [] } = useQuery({
    queryKey: ["stock-quotes", symbolsStr],
    queryFn: () => api.getStockQuotes(symbols),
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
    staleTime: 60 * 1000,
    enabled: !isBuilder && symbols.length > 0,
  });

  const { isCustom, customValue } = getFontSizeConfig(style);

  if (isBuilder) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}>
        <TrendingUp className="h-10 w-10 opacity-50 mb-2" />
        <span className="text-sm opacity-70">Stock Quotes</span>
        <span className="text-xs opacity-50 mt-1">{symbols.join(", ")}</span>
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}>
        <span className="text-sm opacity-50">Loading quotes...</span>
      </div>
    );
  }

  const formatPrice = (price: number) => price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatChange = (change: number) => (change >= 0 ? "+" : "") + change.toFixed(2);
  const formatPercent = (pct: number) => (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";

  return (
    <div
      className="flex flex-col h-full rounded-lg bg-black/40 backdrop-blur-sm overflow-hidden"
      style={{
        color: style?.textColor || "#ffffff",
        ...(isCustom && customValue ? { fontSize: customValue } : {}),
      }}
    >
      {layout === "ticker" ? (
        /* Scrolling ticker */
        <div className="flex-1 flex items-center overflow-hidden">
          <div className="whitespace-nowrap animate-[ticker-scroll_30s_linear_infinite] flex items-center gap-6 px-4">
            {[...quotes, ...quotes].map((q, i) => (
              <span key={`${q.symbol}-${i}`} className="inline-flex items-center gap-2 text-sm">
                <span className="font-bold">{q.symbol}</span>
                <span>${formatPrice(q.price)}</span>
                <span className={cn(q.change >= 0 ? "text-green-400" : "text-red-400")}>
                  {formatChange(q.change)} ({formatPercent(q.changePercent)})
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : layout === "card" ? (
        /* Card grid */
        <div className="flex-1 grid auto-rows-fr gap-2 p-3" style={{
          gridTemplateColumns: `repeat(${Math.min(quotes.length, 3)}, 1fr)`,
        }}>
          {quotes.map((q) => (
            <div key={q.symbol} className="rounded-lg bg-white/5 p-3 flex flex-col justify-between">
              <div>
                <div className="text-xs opacity-50">{q.name}</div>
                <div className="font-bold text-lg">{q.symbol}</div>
              </div>
              <div>
                <div className="text-xl font-light tabular-nums">${formatPrice(q.price)}</div>
                <div className={cn("text-sm flex items-center gap-1", q.change >= 0 ? "text-green-400" : "text-red-400")}>
                  {q.change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {formatChange(q.change)} ({formatPercent(q.changePercent)})
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List view (default) */
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {quotes.map((q) => (
            <div key={q.symbol} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded flex items-center justify-center",
                  q.change > 0 ? "bg-green-500/20" : q.change < 0 ? "bg-red-500/20" : "bg-white/10"
                )}>
                  {q.change > 0 ? <TrendingUp className="h-4 w-4 text-green-400" /> :
                   q.change < 0 ? <TrendingDown className="h-4 w-4 text-red-400" /> :
                   <Minus className="h-4 w-4 text-white/40" />}
                </div>
                <div>
                  <div className="font-semibold text-sm">{q.symbol}</div>
                  <div className="text-xs opacity-40 truncate max-w-[120px]">{q.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium tabular-nums">${formatPrice(q.price)}</div>
                <div className={cn("text-xs tabular-nums", q.change >= 0 ? "text-green-400" : "text-red-400")}>
                  {formatChange(q.change)} ({formatPercent(q.changePercent)})
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
