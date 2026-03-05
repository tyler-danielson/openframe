import { isCustomIcon, getCustomIconUrl, resolveLucideIcon } from "../../lib/icon-utils";
import { useAuthStore } from "../../stores/auth";

interface DashboardIconProps {
  icon: string;
  className?: string;
}

export function DashboardIcon({ icon, className }: DashboardIconProps) {
  if (isCustomIcon(icon)) {
    const { accessToken, apiKey } = useAuthStore.getState();
    const authParam = accessToken
      ? `token=${encodeURIComponent(accessToken)}`
      : apiKey
        ? `apiKey=${encodeURIComponent(apiKey)}`
        : "";
    const url = getCustomIconUrl(icon, authParam);
    return <img src={url} alt="" className={className} style={{ objectFit: "contain" }} />;
  }

  const Icon = resolveLucideIcon(icon);
  return <Icon className={className} />;
}
