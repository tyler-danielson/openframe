import { Home, Settings } from "lucide-react";
import { cn } from "../../lib/utils";
import { appPath } from "../../lib/cloud";
import { ClockDisplay } from "./ClockDisplay";
import type { HomeAssistantRoom } from "@openframe/shared";

interface RoomSidebarProps {
  rooms: HomeAssistantRoom[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
}

export function RoomSidebar({
  rooms,
  selectedRoomId,
  onSelectRoom,
}: RoomSidebarProps) {
  return (
    <div className="homio-sidebar flex flex-col h-full w-64 py-6">
      {/* Logo / Header */}
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--theme-accent))]/10">
            <Home className="h-5 w-5 text-[hsl(var(--theme-accent))]" />
          </div>
          <span className="text-lg font-medium text-[var(--homio-text-primary)] tracking-wider">
            SMART HOME
          </span>
        </div>
      </div>

      {/* Room List */}
      <nav className="flex-1 px-3">
        {/* All Devices */}
        <button
          onClick={() => onSelectRoom(null)}
          className={cn(
            "homio-sidebar-item w-full text-left px-4 py-3 rounded-lg mb-1 text-sm font-medium",
            selectedRoomId === null && "active"
          )}
        >
          ALL DEVICES
        </button>

        {/* Rooms */}
        {rooms.map((room) => (
          <button
            key={room.id}
            onClick={() => onSelectRoom(room.id)}
            className={cn(
              "homio-sidebar-item w-full text-left px-4 py-3 rounded-lg mb-1 text-sm font-medium",
              selectedRoomId === room.id && "active"
            )}
          >
            {room.name.toUpperCase()}
          </button>
        ))}
      </nav>

      {/* Bottom Section - Clock */}
      <div className="px-6 pt-6 border-t border-[var(--homio-card-border)]">
        <ClockDisplay />
      </div>

      {/* Settings Link */}
      <div className="px-6 pt-4">
        <button
          onClick={() => window.location.href = appPath("/settings?tab=homeassistant")}
          className="homio-sidebar-item flex items-center gap-2 text-sm opacity-60 hover:opacity-100"
        >
          <Settings className="h-4 w-4" />
          SETTINGS
        </button>
      </div>
    </div>
  );
}
