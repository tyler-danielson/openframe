import { useQuery } from "@tanstack/react-query";
import { Home, Lightbulb, Thermometer, ToggleRight } from "lucide-react";
import { api } from "../../services/api";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { useCardBlockNav } from "./useCardBlockNav";
import { cn } from "../../lib/utils";
import type { CardViewCardProps } from "./types";

export function SmartHomeCard({ onClick, blockNavId }: CardViewCardProps) {
  const { blockNavClasses } = useCardBlockNav(blockNavId);

  const { data: states = [], isLoading } = useQuery({
    queryKey: ["homeassistant", "states"],
    queryFn: () => api.getHomeAssistantStates(),
    refetchInterval: 30000,
    retry: false,
  });

  const lights = states.filter((s) => s.entity_id.startsWith("light."));
  const lightsOn = lights.filter((s) => s.state === "on").length;
  const switches = states.filter((s) => s.entity_id.startsWith("switch."));
  const switchesOn = switches.filter((s) => s.state === "on").length;

  const thermostat = states.find(
    (s) => s.entity_id.startsWith("climate.") && s.attributes.current_temperature
  );
  const currentTemp = thermostat?.attributes.current_temperature as number | undefined;

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-accent/50 transition-all duration-300 flex flex-col",
        blockNavClasses
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5 text-primary" />
          Smart Home
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        {isLoading ? (
          <div className="animate-pulse grid grid-cols-2 gap-4 w-full">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        ) : states.length === 0 ? (
          <div className="flex flex-col items-center text-muted-foreground">
            <Home className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">Not configured</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="flex flex-col items-center p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Lightbulb className={cn("h-8 w-8 mb-1", lightsOn > 0 ? "text-primary" : "text-muted-foreground")} />
              <span className="text-lg font-semibold">{lightsOn}</span>
              <span className="text-xs text-muted-foreground">Lights On</span>
            </div>
            {currentTemp !== undefined ? (
              <div className="flex flex-col items-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Thermometer className="h-8 w-8 text-primary mb-1" />
                <span className="text-lg font-semibold">{currentTemp}°</span>
                <span className="text-xs text-muted-foreground">Inside</span>
              </div>
            ) : (
              <div className="flex flex-col items-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                <ToggleRight className={cn("h-8 w-8 mb-1", switchesOn > 0 ? "text-primary" : "text-muted-foreground")} />
                <span className="text-lg font-semibold">{switchesOn}</span>
                <span className="text-xs text-muted-foreground">Switches On</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
