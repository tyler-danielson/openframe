import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface ExchangeRateWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

// Currency symbols/flags for common currencies
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CAD: "C$", AUD: "A$",
  CHF: "Fr", CNY: "¥", INR: "₹", KRW: "₩", BRL: "R$", MXN: "Mex$",
  SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł", CZK: "Kč", HUF: "Ft",
  THB: "฿", SGD: "S$", HKD: "HK$", NZD: "NZ$", ZAR: "R", TRY: "₺",
  RUB: "₽", ILS: "₪", AED: "د.إ", SAR: "﷼", PHP: "₱", TWD: "NT$",
  BTC: "₿", ETH: "Ξ",
};

export function ExchangeRateWidget({ config, style, isBuilder }: ExchangeRateWidgetProps) {
  const base = (config.baseCurrency as string) || "USD";
  const targetsStr = (config.targetCurrencies as string) || "EUR,GBP,JPY,CAD,AUD,CHF";
  const targets = targetsStr.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);

  const { data: rates = [] } = useQuery({
    queryKey: ["exchange-rates", base, targetsStr],
    queryFn: () => api.getExchangeRates(base, targets),
    refetchInterval: 15 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    enabled: !isBuilder && targets.length > 0,
  });

  const { isCustom, customValue } = getFontSizeConfig(style);

  if (isBuilder) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}>
        <ArrowRightLeft className="h-10 w-10 opacity-50 mb-2" />
        <span className="text-sm opacity-70">Exchange Rates</span>
        <span className="text-xs opacity-50 mt-1">{base} → {targets.join(", ")}</span>
      </div>
    );
  }

  if (rates.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}>
        <span className="text-sm opacity-50">Loading rates...</span>
      </div>
    );
  }

  const formatRate = (rate: number) => {
    if (rate >= 100) return rate.toFixed(2);
    if (rate >= 1) return rate.toFixed(4);
    return rate.toFixed(6);
  };

  return (
    <div
      className="flex flex-col h-full rounded-lg bg-black/40 backdrop-blur-sm overflow-hidden"
      style={{
        color: style?.textColor || "#ffffff",
        ...(isCustom && customValue ? { fontSize: customValue } : {}),
      }}
    >
      {/* Header with base currency */}
      <div className="px-3 pt-3 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
            {CURRENCY_SYMBOLS[base] || base.slice(0, 1)}
          </div>
          <div>
            <div className="font-semibold text-sm">1 {base}</div>
            <div className="text-xs opacity-40">Base currency</div>
          </div>
        </div>
      </div>

      {/* Rates list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {rates.map((r) => (
          <div key={r.target} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-medium opacity-40 w-5 text-center">
                {CURRENCY_SYMBOLS[r.target] || ""}
              </span>
              <span className="font-medium text-sm">{r.target}</span>
            </div>
            <span className="font-mono tabular-nums text-sm">{formatRate(r.rate)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
