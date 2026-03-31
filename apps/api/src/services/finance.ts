// Finance service: stock quotes and exchange rates using free APIs

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  marketCap?: number;
  currency: string;
  exchange: string;
  updatedAt: string;
}

export interface ExchangeRate {
  base: string;
  target: string;
  rate: number;
  updatedAt: string;
}

// ─── Stock Quotes (Yahoo Finance) ────────────────────────────────────────────

interface YahooQuoteResult {
  symbol: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketPreviousClose: number;
  regularMarketOpen: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  marketCap?: number;
  currency: string;
  fullExchangeName: string;
  regularMarketTime: number;
}

// Cache stock quotes for 2 minutes
const stockCache = new Map<string, { data: StockQuote; timestamp: number }>();
const STOCK_CACHE_MS = 2 * 60 * 1000;

export async function getStockQuotes(symbols: string[]): Promise<StockQuote[]> {
  const now = Date.now();
  const uncached = symbols.filter((s) => {
    const cached = stockCache.get(s.toUpperCase());
    return !cached || now - cached.timestamp > STOCK_CACHE_MS;
  });

  if (uncached.length > 0) {
    try {
      const symbolList = uncached.join(",");
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolList)}&fields=symbol,shortName,longName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketVolume,marketCap,currency,fullExchangeName,regularMarketTime`;

      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (res.ok) {
        const json = (await res.json()) as { quoteResponse?: { result?: YahooQuoteResult[] } };
        const results = json.quoteResponse?.result || [];

        for (const q of results) {
          const quote: StockQuote = {
            symbol: q.symbol,
            name: q.longName || q.shortName || q.symbol,
            price: q.regularMarketPrice,
            change: q.regularMarketChange,
            changePercent: q.regularMarketChangePercent,
            previousClose: q.regularMarketPreviousClose,
            open: q.regularMarketOpen,
            dayHigh: q.regularMarketDayHigh,
            dayLow: q.regularMarketDayLow,
            volume: q.regularMarketVolume,
            marketCap: q.marketCap,
            currency: q.currency,
            exchange: q.fullExchangeName,
            updatedAt: new Date(q.regularMarketTime * 1000).toISOString(),
          };
          stockCache.set(q.symbol.toUpperCase(), { data: quote, timestamp: now });
        }
      }
    } catch (err) {
      console.error("[Finance] Stock quote fetch error:", err);
    }
  }

  return symbols
    .map((s) => stockCache.get(s.toUpperCase())?.data)
    .filter((q): q is StockQuote => !!q);
}

// ─── Exchange Rates ──────────────────────────────────────────────────────────

// Cache FX rates for 15 minutes
let fxCache: { data: Record<string, number>; base: string; timestamp: number } | null = null;
const FX_CACHE_MS = 15 * 60 * 1000;

export async function getExchangeRates(
  base: string,
  targets: string[]
): Promise<ExchangeRate[]> {
  const now = Date.now();

  // Refetch if cache expired or base changed
  if (!fxCache || fxCache.base !== base || now - fxCache.timestamp > FX_CACHE_MS) {
    try {
      // Use exchangerate-api.com free tier (no key needed for open access)
      const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;
      const res = await fetch(url);

      if (res.ok) {
        const json = (await res.json()) as { result: string; rates: Record<string, number> };
        if (json.result === "success") {
          fxCache = { data: json.rates, base, timestamp: now };
        }
      }
    } catch (err) {
      console.error("[Finance] FX rate fetch error:", err);
    }
  }

  if (!fxCache) return [];

  return targets
    .map((target) => {
      const rate = fxCache!.data[target.toUpperCase()];
      if (rate === undefined) return null;
      return {
        base,
        target: target.toUpperCase(),
        rate,
        updatedAt: new Date(fxCache!.timestamp).toISOString(),
      };
    })
    .filter((r): r is ExchangeRate => !!r);
}
