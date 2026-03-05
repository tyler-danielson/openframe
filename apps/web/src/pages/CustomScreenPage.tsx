import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { BuilderCanvas } from "../components/builder/BuilderCanvas";
import { BuilderProvider } from "../contexts/BuilderContext";
import { type ScreensaverLayoutConfig, DEFAULT_LAYOUT_CONFIG } from "../stores/screensaver";

export function CustomScreenPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: screen, isLoading, error } = useQuery({
    queryKey: ["custom-screen", slug],
    queryFn: () => api.getCustomScreenBySlug(slug!),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !screen) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Screen not found</p>
      </div>
    );
  }

  const layoutConfig: ScreensaverLayoutConfig = {
    ...DEFAULT_LAYOUT_CONFIG,
    ...(screen.layoutConfig as Partial<ScreensaverLayoutConfig>),
  };

  return (
    <div className="h-full w-full">
      <BuilderProvider initialConfig={layoutConfig}>
        <BuilderCanvas showGrid={false} previewMode={true} liveMode={true} />
      </BuilderProvider>
    </div>
  );
}
