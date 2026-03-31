---
name: Theme color patterns
description: Semantic color tokens used in this project and common violation patterns found during reviews
type: feedback
---

## Semantic tokens confirmed in use
- `text-primary`, `text-primary/80`, `text-primary/60` -- primary text and labels
- `bg-primary/10`, `bg-primary/5` -- subtle primary backgrounds (icon containers, hover states, selected items)
- `border-primary/10`, `border-primary/20`, `border-primary/30` -- borders at varying visibility
- `text-muted-foreground` -- secondary info (timestamps, host details, table column headers)
- `text-foreground` -- default body text
- `text-destructive`, `bg-destructive/10` -- error/delete states (replaces hardcoded red)
- `hover:bg-primary/10` -- standard hover state for interactive elements
- `ring-primary/30` -- focus rings on inputs

## Status feedback pattern
The project does NOT have a dedicated `text-success` semantic token. For success states, use `text-primary` / `bg-primary/10`. For error states, use `text-destructive` / `bg-destructive/10`.

## Common violations found
1. **File-type icons** using hardcoded colors (`text-blue-500`, `text-purple-500`, etc.) -- should use `text-primary` with opacity variants to differentiate
2. **Delete/remove buttons** using `text-red-500` -- should use `text-destructive`
3. **Status banners** using `text-green-600` / `text-red-500` -- should use `text-primary` / `text-destructive`

## Files that are good examples of correct styling
- `StorageServerConfig.tsx` (after fixes) -- modal dialog, form inputs, test results
- `FilesPage.tsx` (after fixes) -- file browser, sidebar, table, breadcrumbs
- `ConnectionsTab.tsx` -- storage service entries use `bg-primary/10` correctly

**How to apply:** When reviewing new components, check `getFileIcon`-style functions and status feedback messages first -- these are the most common places for hardcoded colors.
