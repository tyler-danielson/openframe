import type { WidgetConfigProps } from "./types";

export function StockQuoteConfig({ config, onChange }: WidgetConfigProps) {
  return (
    <>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Symbols</span>
        <input
          type="text"
          value={config.symbols as string ?? "AAPL,GOOGL,MSFT"}
          onChange={(e) => onChange("symbols", e.target.value)}
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
          placeholder="AAPL,GOOGL,MSFT,AMZN"
        />
      </div>
      <p className="text-xs text-muted-foreground ml-32">Comma-separated stock ticker symbols</p>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Layout</span>
        <select
          value={config.layout as string ?? "list"}
          onChange={(e) => onChange("layout", e.target.value)}
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="list">List (rows with details)</option>
          <option value="card">Cards (grid with prices)</option>
          <option value="ticker">Scrolling Ticker</option>
        </select>
      </div>
    </>
  );
}
