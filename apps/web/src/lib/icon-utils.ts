import * as LucideIcons from "lucide-react";
import { LayoutDashboard } from "lucide-react";

export function isCustomIcon(icon: string): boolean {
  return icon.startsWith("custom:");
}

export function getCustomIconUrl(icon: string, authParam?: string): string {
  const path = icon.slice("custom:".length);
  const base = `/api/v1/icons/files/${path}`;
  return authParam ? `${base}?${authParam}` : base;
}

function isReactComponent(value: unknown): boolean {
  if (typeof value === "function") return true;
  // forwardRef components are objects with $$typeof and render
  if (value && typeof value === "object" && "$$typeof" in value) return true;
  return false;
}

export function resolveLucideIcon(
  name: string
): React.ComponentType<{ className?: string }> {
  const icons = LucideIcons as Record<string, unknown>;
  if (icons[name] && isReactComponent(icons[name])) {
    return icons[name] as React.ComponentType<{ className?: string }>;
  }
  return LayoutDashboard;
}

export { isReactComponent };
