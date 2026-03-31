import type { WidgetConfigProps } from "./types";

export function ExchangeRateConfig({ config, onChange }: WidgetConfigProps) {
  return (
    <>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Base Currency</span>
        <select
          value={config.baseCurrency as string ?? "USD"}
          onChange={(e) => onChange("baseCurrency", e.target.value)}
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
        >
          {["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", "INR", "KRW", "BRL", "MXN", "SEK", "NOK"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Target Currencies</span>
        <input
          type="text"
          value={config.targetCurrencies as string ?? "EUR,GBP,JPY,CAD,AUD,CHF"}
          onChange={(e) => onChange("targetCurrencies", e.target.value)}
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
          placeholder="EUR,GBP,JPY,CAD,AUD"
        />
      </div>
      <p className="text-xs text-muted-foreground ml-32">Comma-separated currency codes</p>
    </>
  );
}
