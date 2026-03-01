import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useKiosk } from "../contexts/KioskContext";
import { useBlockNavStore, type NavigableBlock } from "../stores/block-nav";
import { ClockWidget } from "../components/home-assistant/ClockWidget";
import { WeatherCard } from "../components/card-view/WeatherCard";
import { CalendarCard } from "../components/card-view/CalendarCard";
import { TasksCard } from "../components/card-view/TasksCard";
import { CamerasCard } from "../components/card-view/CamerasCard";
import { SmartHomeCard } from "../components/card-view/SmartHomeCard";

interface CardDef {
  id: string;
  component: React.ComponentType<{ onClick: () => void; blockNavId: string }>;
  navigateTo: string;
  label: string;
}

export function CardViewPage() {
  const navigate = useNavigate();
  const { displayType, enabledFeatures } = useKiosk();
  const registerBlocks = useBlockNavStore((s) => s.registerBlocks);
  const clearBlocks = useBlockNavStore((s) => s.clearBlocks);

  // Build card list based on enabled features
  const cards = useMemo(() => {
    const list: CardDef[] = [];
    // Weather is always shown (no separate feature flag)
    list.push({ id: "weather", component: WeatherCard, navigateTo: "dashboard", label: "Weather" });
    if (enabledFeatures.calendar !== false) {
      list.push({ id: "calendar", component: CalendarCard, navigateTo: "calendar", label: "Calendar" });
    }
    if (enabledFeatures.tasks !== false) {
      list.push({ id: "tasks", component: TasksCard, navigateTo: "tasks", label: "Tasks" });
    }
    if (enabledFeatures.cameras !== false) {
      list.push({ id: "cameras", component: CamerasCard, navigateTo: "cameras", label: "Cameras" });
    }
    if (enabledFeatures.homeassistant !== false) {
      list.push({ id: "smarthome", component: SmartHomeCard, navigateTo: "homeassistant", label: "Smart Home" });
    }
    return list;
  }, [enabledFeatures]);

  // Register TV block navigation
  useEffect(() => {
    if (displayType !== "tv") return;

    const cols = cards.length >= 3 ? 3 : 2;
    const blocks: NavigableBlock[] = cards.map((card, i) => ({
      id: `cv-${card.id}`,
      x: i % cols,
      y: Math.floor(i / cols),
      width: 1,
      height: 1,
      label: card.label,
    }));
    registerBlocks(blocks, "page");
    return () => clearBlocks("page");
  }, [displayType, cards, registerBlocks, clearBlocks]);

  return (
    <div className="flex h-full flex-col p-6">
      {/* Header with clock */}
      <div className="mb-6 flex items-center justify-between">
        <ClockWidget />
      </div>

      {/* Card Grid */}
      <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr min-h-0">
        {cards.map(({ id, component: CardComponent, navigateTo }) => (
          <CardComponent
            key={id}
            onClick={() => navigate(navigateTo)}
            blockNavId={`cv-${id}`}
          />
        ))}
      </div>
    </div>
  );
}
