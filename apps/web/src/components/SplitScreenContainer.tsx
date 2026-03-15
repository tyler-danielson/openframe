import { type ReactNode } from "react";
import { useSplitScreenStore } from "../stores/split-screen";
import type { SplitScreenConfig } from "../stores/split-screen";

// Lazy imports for page components (dashboard source)
import { CalendarPage } from "../pages/CalendarPage";
import { DashboardPage } from "../pages/DashboardPage";
import { TasksPage } from "../pages/TasksPage";
import { PhotosPage } from "../pages/PhotosPage";
import { SpotifyPage } from "../pages/SpotifyPage";
import { IptvPage } from "../pages/IptvPage";
import { CamerasPage } from "../pages/CamerasPage";
import { HomeAssistantPage } from "../pages/HomeAssistantPage";
import { MapPage } from "../pages/MapPage";
import { KitchenPage } from "../pages/KitchenPage";

// Widget imports (widget source)
import { ClockWidget } from "./widgets/ClockWidget";
import { WeatherWidget } from "./widgets/WeatherWidget";
import { CalendarWidget } from "./widgets/CalendarWidget";
import { TasksWidget } from "./widgets/TasksWidget";
import { UpNextWidget } from "./widgets/UpNextWidget";
import { ForecastWidget } from "./widgets/ForecastWidget";
import { NewsWidget } from "./widgets/NewsWidget";
import { SportsWidget } from "./widgets/SportsWidget";
import { CountdownWidget } from "./widgets/CountdownWidget";
import { TextWidget } from "./widgets/TextWidget";

const DASHBOARD_COMPONENTS: Record<string, JSX.Element> = {
  calendar: <CalendarPage />,
  dashboard: <DashboardPage />,
  tasks: <TasksPage />,
  photos: <PhotosPage />,
  spotify: <SpotifyPage />,
  iptv: <IptvPage />,
  cameras: <CamerasPage />,
  homeassistant: <HomeAssistantPage />,
  map: <MapPage />,
  kitchen: <KitchenPage />,
};

function SecondaryPanel({ config }: { config: SplitScreenConfig }) {
  switch (config.sourceType) {
    case "dashboard": {
      const component = config.dashboardPath
        ? DASHBOARD_COMPONENTS[config.dashboardPath]
        : null;
      if (!component) {
        return (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Dashboard not found
          </div>
        );
      }
      return <div className="h-full overflow-y-auto">{component}</div>;
    }

    case "url":
      return (
        <iframe
          src={config.url}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Split screen content"
        />
      );

    case "text":
      return (
        <div className="h-full w-full overflow-y-auto">
          <TextWidget config={{ text: config.text || "", alignment: "center" }} />
        </div>
      );

    case "widget":
      return <WidgetPanel widgetType={config.widgetType} widgetConfig={config.widgetConfig} />;

    default:
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Unknown source type
        </div>
      );
  }
}

function WidgetPanel({ widgetType, widgetConfig }: { widgetType?: string; widgetConfig?: Record<string, unknown> }) {
  switch (widgetType) {
    case "clock":
      return <ClockWidget config={{ format: "12h", showSeconds: false, showDate: true, ...widgetConfig }} />;
    case "weather":
      return <WeatherWidget config={{ showIcon: true, showDescription: true, showHumidity: true, showWind: true, ...widgetConfig }} />;
    case "calendar":
      return <CalendarWidget config={{ maxItems: 8, showTime: true, showCalendarName: false, calendarIds: [], showUpcomingOnly: true, hideBlankEvents: true, hideDuplicates: true, headerMode: "default", ...widgetConfig }} />;
    case "tasks":
      return <TasksWidget config={{ maxItems: 8, showCompleted: false, headerMode: "default", ...widgetConfig }} />;
    case "up-next":
      return <UpNextWidget config={{ maxItems: 3, showTime: true, showCalendarName: true, headerMode: "default", ...widgetConfig }} />;
    case "forecast":
      return <ForecastWidget config={{ days: 5, showHigh: true, showLow: true, showIcon: true, ...widgetConfig }} />;
    case "news":
      return <NewsWidget config={{ maxItems: 6, showImages: true, headerMode: "default", ...widgetConfig }} />;
    case "sports":
      return <SportsWidget config={{ showScores: true, showLogos: true, headerMode: "default", ...widgetConfig }} />;
    case "countdown":
      return <CountdownWidget config={{ targetDate: "", label: "Countdown", showDays: true, showHours: true, showMinutes: true, showSeconds: true, ...widgetConfig }} />;
    default:
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Unknown widget type
        </div>
      );
  }
}

interface SplitScreenContainerProps {
  children: ReactNode;
}

export function SplitScreenContainer({ children }: SplitScreenContainerProps) {
  const isActive = useSplitScreenStore((s) => s.isActive);
  const config = useSplitScreenStore((s) => s.config);

  if (!isActive || !config) {
    return <>{children}</>;
  }

  const secondaryIsLeft = config.position === "left";
  const secondaryBasis = config.ratio === "half" ? "50%" : "33.333%";
  const primaryBasis = config.ratio === "half" ? "50%" : "66.667%";

  return (
    <div className="flex h-full w-full">
      {secondaryIsLeft && (
        <div
          className="h-full overflow-hidden border-r border-border"
          style={{ flexBasis: secondaryBasis, flexShrink: 0 }}
        >
          <SecondaryPanel config={config} />
        </div>
      )}
      <div
        className="h-full overflow-y-auto overflow-x-hidden"
        style={{ flexBasis: primaryBasis, flexShrink: 0 }}
      >
        {children}
      </div>
      {!secondaryIsLeft && (
        <div
          className="h-full overflow-hidden border-l border-border"
          style={{ flexBasis: secondaryBasis, flexShrink: 0 }}
        >
          <SecondaryPanel config={config} />
        </div>
      )}
    </div>
  );
}
