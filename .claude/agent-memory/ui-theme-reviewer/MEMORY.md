# UI Theme Reviewer Memory - OpenFrame

## Project Context
- **Path:** `C:\Claude Projects\My Calendar\openframe`
- **Components location:** `apps/web/src/components/homeassistant/`
- **Theme system:** Tailwind CSS with semantic color tokens and custom CSS variables for homio cards

## Semantic Color Classes (Required)
- `text-primary` / `text-primary-foreground` — primary text & foreground
- `bg-primary` / `bg-primary/10` / `bg-primary/20` — primary backgrounds with opacity
- `text-muted-foreground` — secondary/muted text ONLY (not for important labels)
- `text-destructive` — error states
- `text-green-600` / `text-amber-600` — completion/warning states (theme-aware variants)
- `border-border` — borders (semantic token)
- `bg-card` — modal/card backgrounds

## Homio Card Variables (Legacy - Still Used)
- `var(--homio-text-primary)` — primary text when active
- `var(--homio-text-secondary)` — secondary text when inactive
- `var(--homio-text-muted)` — muted status text
- `var(--theme-accent)` — accent color (used as `hsl(var(--theme-accent))`)
- `var(--background)` — background color

## Common Violations Found
1. **Hardcoded colors in state maps** — use semantic classes instead
   - Example: `text-amber-500`, `text-green-500`, `text-blue-500`
   - Fix: Use `text-primary`, `text-amber-600`, `text-green-600` for state-specific colors

2. **CSS variable references in non-homio contexts** — use semantic Tailwind classes
   - Example: `text-[hsl(var(--theme-accent))]` for status text outside icon circles
   - Fix: Use `text-primary` for consistency

3. **Icon circle backgrounds** — should use `bg-primary` + `text-primary-foreground` when active
   - Correct: `bg-primary text-primary-foreground`
   - Avoid: `bg-[hsl(var(--theme-accent))] text-[hsl(var(--background))]` (unless mimicking homio pattern)

4. **dark: variant pairs with hardcoded colors** — very common anti-pattern
   - Example: `bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200`
   - Fix: `bg-primary/5 border-primary/20 text-primary` (single class, works in all themes)
   - Warning variant: `bg-destructive/10 border-destructive/20 text-destructive`
   - Code blocks: `bg-muted border-border` instead of `bg-white dark:bg-gray-900`

## Reference Components
- **VacuumControlCard.tsx** — shows proper pattern:
  - Uses semantic state colors (text-primary, text-muted-foreground, text-destructive)
  - Hardcoded colors ONLY for specific states: text-amber-500 (paused), text-green-500 (battery full)
  - Icon circle: `bg-[hsl(var(--theme-accent))] text-[hsl(var(--background))]` when active
  - Quick action buttons: `bg-primary/20 hover:bg-primary/30 text-primary`

## Component Patterns
- **Card structure:** All cards inherit `.homio-card` class and use consistent layout
- **Status text:** Should match icon circle color (if active) or use `text-muted-foreground` (if inactive)
- **Progress bars:** Use `bg-primary` for consistency (or `bg-[hsl(var(--theme-accent))]` if following homio pattern)
- **Modal headers:** Icons use `text-primary` when active state detected, `text-muted-foreground` when inactive
- **State maps:** Keep structure consistent across all card components

## Settings Page Patterns
- **SettingsPage.tsx** is very large (~7600+ lines) with many sub-components
- Common anti-pattern: `dark:` variant pairs for success/error/warning states throughout
- Success states: use `bg-primary/10 text-primary` (not green-50/green-950 pairs)
- Error states: use `bg-destructive/10 text-destructive` (not red-50/red-950 pairs)
- Warning states: use `bg-amber-600/10 border-amber-600/20 text-amber-600 dark:text-amber-400` (no semantic warning token)
- Delete buttons: `text-destructive border-destructive/30 hover:bg-destructive/10`
- "Saved" status: `text-primary` (not green-600/green-400)
- Links: `hover:text-primary` (not hover:text-blue-600 dark:hover:text-blue-400)

## Files Recently Reviewed
- MotionSensorCard.tsx — fixed status text color (was using CSS variable, now text-primary)
- MotionSensorModal.tsx — PASS (properly semantic)
- SpeedtestCard.tsx — fixed icon circle, status text, and gauge bar colors
- SpeedtestModal.tsx — fixed hardcoded blue/amber colors in config, unified all gauges to bg-primary
- LaundryCard.tsx — fixed state map colors, icon circle, progress bar
- LaundryModal.tsx — fixed state map colors
- **SetupGuide.tsx** (ui/) — fixed 8 violations: redirect URI box, gotcha boxes, code block, copy button all had hardcoded blue/yellow/green/gray with dark: variants
- **SettingsPage.tsx** — fixed 19 violations across RemarkableSettingsCard (PASS), BackupRestoreCard (import status), SystemSettings/renderSection (location status, private IP warning, link hover, save status, error state), ApiKeysSettings (created key box, delete button)
