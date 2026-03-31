# UI Theme Reviewer - Agent Memory

## Project Theme System
- CSS variables defined in `src/index.css` with multiple color schemes
- Semantic tokens: `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`
- NO `--success` token exists -- use `text-primary` for positive/connected status indicators
- `text-destructive` / `bg-destructive` are the correct semantic classes for danger/delete actions (NOT `text-red-500`)

## Known Exceptions
- Brand SVG icons (Google multicolor logo, Microsoft squares) use hardcoded `fill="#hex"` -- acceptable for trademarked brand identity
- `text-green-500` and `text-red-500` are widespread in older code (45+ occurrences across 20 files) -- always flag in new code

## Common Violations
- Service icon backgrounds using hardcoded colors like `bg-blue-500/10` instead of `bg-primary/10`
- Status indicators using `text-green-500` instead of `text-primary`
- Destructive buttons using `text-red-500` instead of `text-destructive`

## Key Files
- Theme CSS: `src/index.css`
- Settings page (~10k+ lines): `src/pages/SettingsPage.tsx`
- ConnectionsTab (reviewed & fixed 2026-03-02): `src/components/settings/ConnectionsTab.tsx`

## Correct Patterns
- Summary card: `border-2 border-primary/40 bg-card` with `bg-primary/10` + `text-primary` icon
- Category headers: `text-sm font-semibold uppercase tracking-wide text-primary`
- Connected badge: `text-xs text-primary` with Check icon
- Disconnect button: `text-destructive border-destructive/40 hover:bg-destructive/10`
- Trash hover: `text-muted-foreground hover:text-destructive hover:border-destructive/40`
- Service rows: `border border-border hover:bg-muted/30`
