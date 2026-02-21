import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/Card";
import {
  Server,
  Monitor,
  Plug,
  Box,
  Database,
  Globe,
  Tv,
  Smartphone,
  Radio,
  Cpu,
  Music,
  Film,
  Home,
  MessageCircle,
  Cloud,
  HardDrive,
  Bot,
  Video,
  Search,
  Brain,
  Mail,
  Calendar,
  FileText,
  Image,
  Rss,
  Shield,
} from "lucide-react";

// ─── Node & Connection Data ──────────────────────────────────────────────────

interface TopoNode {
  id: string;
  label: string;
  subtitle?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  dashed?: boolean;
  group?: boolean;
}

interface TopoConnection {
  from: string;
  to: string;
}

const NODES: TopoNode[] = [
  // Clients (col 1)
  { id: "web-browser", label: "Web Browser", subtitle: "React SPA", x: 40, y: 80, w: 150, h: 50 },
  { id: "tizen-tv", label: "Tizen TV", subtitle: "Samsung", x: 40, y: 150, w: 150, h: 50 },
  { id: "android-tv", label: "Android TV", subtitle: "Google TV", x: 40, y: 220, w: 150, h: 50 },
  { id: "mobile-app", label: "Mobile App", subtitle: "Companion", x: 40, y: 290, w: 150, h: 50 },
  { id: "echo-show", label: "Echo Show", subtitle: "Alexa", x: 40, y: 360, w: 150, h: 50 },
  { id: "rpi-kiosk", label: "RPi Kiosk", subtitle: "Raspberry Pi", x: 40, y: 430, w: 150, h: 50 },

  // Web Tier (col 2)
  { id: "nginx", label: "Nginx + SPA", subtitle: ":8080", x: 330, y: 225, w: 160, h: 60 },

  // Core Services (col 3)
  { id: "api-server", label: "API Server", subtitle: ":3001", x: 620, y: 180, w: 160, h: 60 },
  { id: "bot", label: "Bot Service", subtitle: "Optional", x: 620, y: 290, w: 160, h: 50, dashed: true },
  { id: "mediamtx", label: "MediaMTX", subtitle: "Optional / RTSP", x: 620, y: 365, w: 160, h: 50, dashed: true },

  // Data & Integrations (col 4)
  { id: "postgres", label: "PostgreSQL 16", subtitle: ":5432", x: 920, y: 115, w: 160, h: 55 },
  { id: "redis", label: "Redis 7", subtitle: ":6379", x: 920, y: 195, w: 160, h: 55 },
  { id: "integrations", label: "Integrations", subtitle: "", x: 920, y: 310, w: 200, h: 210, group: true },
];

const CONNECTIONS: TopoConnection[] = [
  // Clients → Nginx
  { from: "web-browser", to: "nginx" },
  { from: "tizen-tv", to: "nginx" },
  { from: "android-tv", to: "nginx" },
  { from: "mobile-app", to: "nginx" },
  { from: "echo-show", to: "nginx" },
  { from: "rpi-kiosk", to: "nginx" },
  // Nginx → API
  { from: "nginx", to: "api-server" },
  // API → Data
  { from: "api-server", to: "postgres" },
  { from: "api-server", to: "redis" },
  // API → Optional
  { from: "api-server", to: "bot" },
  { from: "api-server", to: "mediamtx" },
  // API → Integrations
  { from: "api-server", to: "integrations" },
];

const INTEGRATION_PILLS = [
  "Google Calendar",
  "Google Photos",
  "Gmail",
  "MS Outlook",
  "OneDrive",
  "Spotify",
  "Plex",
  "Home Assistant",
  "Telegram",
  "OpenAI",
  "News APIs",
  "Weather",
  "IPTV",
];

// Column headers
const COLUMN_HEADERS = [
  { label: "CLIENTS", x: 115, y: 50 },
  { label: "WEB TIER", x: 410, y: 50 },
  { label: "CORE SERVICES", x: 700, y: 50 },
  { label: "DATA / INTEGRATIONS", x: 1020, y: 50 },
];

// ─── Helper: connection path between two nodes ──────────────────────────────

function getNodeById(id: string) {
  return NODES.find((n) => n.id === id)!;
}

function connectionPath(conn: TopoConnection): string {
  const from = getNodeById(conn.from);
  const to = getNodeById(conn.to);
  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;
  const dx = (x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// ─── Detail card data ────────────────────────────────────────────────────────

const DOCKER_SERVICES = [
  { icon: Database, name: "PostgreSQL 16", desc: "Primary data store — users, events, media metadata" },
  { icon: Database, name: "Redis 7", desc: "Session cache, pub/sub, real-time sync" },
  { icon: Server, name: "API Server", desc: "Node.js Express backend on :3001 — REST + WebSocket" },
  { icon: Globe, name: "Web Server (Nginx)", desc: "Serves React SPA + reverse proxies API on :8080" },
  { icon: Bot, name: "Bot Service", desc: "Optional — Telegram & notification worker" },
  { icon: Video, name: "MediaMTX", desc: "Optional — RTSP/WebRTC camera proxy" },
];

const CLIENT_APPS = [
  { icon: Globe, name: "Web Browser", desc: "Primary React SPA — full feature set" },
  { icon: Tv, name: "Samsung Tizen TV", desc: "Tizen Web App — kiosk mode display" },
  { icon: Tv, name: "Android TV", desc: "Google TV — kiosk mode display" },
  { icon: Smartphone, name: "Mobile Companion", desc: "PWA companion — calendar, tasks, kiosk control" },
  { icon: Radio, name: "Amazon Echo Show", desc: "Alexa Web App — kiosk mode display" },
  { icon: Cpu, name: "Raspberry Pi Kiosk", desc: "Chromium kiosk — dedicated hardware display" },
];

const INTEGRATION_GROUPS = [
  {
    group: "Google Suite",
    items: [
      { icon: Calendar, name: "Google Calendar", desc: "Bi-directional calendar sync" },
      { icon: Image, name: "Google Photos", desc: "Album display & screensaver source" },
      { icon: Mail, name: "Gmail", desc: "Email notifications & digests" },
      { icon: FileText, name: "Google Tasks", desc: "Task sync" },
      { icon: Search, name: "Google Search", desc: "Web search integration" },
      { icon: Globe, name: "Google Maps", desc: "Location & traffic widgets" },
    ],
  },
  {
    group: "Microsoft",
    items: [
      { icon: Calendar, name: "Outlook Calendar", desc: "Calendar sync via MS Graph" },
      { icon: Cloud, name: "OneDrive", desc: "File & photo access" },
    ],
  },
  {
    group: "Media",
    items: [
      { icon: Music, name: "Spotify", desc: "Playback control & now playing" },
      { icon: Film, name: "Plex", desc: "Media library browsing" },
      { icon: Tv, name: "IPTV", desc: "M3U live TV streaming" },
      { icon: FileText, name: "reMarkable", desc: "E-ink tablet document sync" },
    ],
  },
  {
    group: "Smart Home",
    items: [
      { icon: Home, name: "Home Assistant", desc: "Device control & automations" },
      { icon: Shield, name: "Matter", desc: "Smart home protocol (via HA)" },
    ],
  },
  {
    group: "Info & AI",
    items: [
      { icon: Rss, name: "News APIs", desc: "RSS & news feed aggregation" },
      { icon: Cloud, name: "Weather", desc: "Forecast widgets" },
      { icon: MessageCircle, name: "Telegram", desc: "Bot notifications & commands" },
      { icon: Brain, name: "OpenAI / Claude", desc: "AI chat & smart features" },
    ],
  },
];

const DEPLOYMENT_MODELS = [
  { icon: HardDrive, name: "Docker Compose", desc: "Self-hosted — full stack in a single docker-compose.yml" },
  { icon: Cloud, name: "Cloud SaaS", desc: "openframe.us — managed multi-tenant with federated instances" },
  { icon: Cpu, name: "Raspberry Pi Image", desc: "Pre-built SD card image — plug and play kiosk hardware" },
  { icon: Home, name: "Home Assistant Add-on", desc: "HA Supervisor add-on — one-click install from HA dashboard" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function AdminTopologyPage() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Which nodes are "related" to the hovered node (connected via any edge)
  const relatedNodes = new Set<string>();
  if (hoveredNode) {
    relatedNodes.add(hoveredNode);
    for (const c of CONNECTIONS) {
      if (c.from === hoveredNode) relatedNodes.add(c.to);
      if (c.to === hoveredNode) relatedNodes.add(c.from);
    }
  }

  const nodeOpacity = (id: string) => {
    if (!hoveredNode) return 1;
    return relatedNodes.has(id) ? 1 : 0.2;
  };

  const edgeHighlighted = (c: TopoConnection) => {
    if (!hoveredNode) return false;
    return c.from === hoveredNode || c.to === hoveredNode;
  };

  const edgeOpacity = (c: TopoConnection) => {
    if (!hoveredNode) return 0.5;
    return edgeHighlighted(c) ? 1 : 0.08;
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-primary">System Topology</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Interactive architecture diagram of the OpenFrame platform
        </p>
      </div>

      {/* SVG Diagram */}
      <Card>
        <CardContent className="p-4 overflow-x-auto">
          <svg
            viewBox="0 0 1160 560"
            width="100%"
            className="min-w-[800px]"
            style={{ fontFamily: "inherit" }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 8 3, 0 6"
                  fill="hsl(var(--primary))"
                  opacity="0.6"
                />
              </marker>
              <marker
                id="arrowhead-hi"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
              >
                <polygon
                  points="0 0, 8 3, 0 6"
                  fill="hsl(var(--primary))"
                />
              </marker>
            </defs>

            {/* Column headers */}
            {COLUMN_HEADERS.map((h) => (
              <text
                key={h.label}
                x={h.x}
                y={h.y}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                letterSpacing="0.05em"
                fill="hsl(var(--muted-foreground))"
              >
                {h.label}
              </text>
            ))}

            {/* Connections */}
            {CONNECTIONS.map((c) => (
              <path
                key={`${c.from}-${c.to}`}
                d={connectionPath(c)}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={edgeHighlighted(c) ? 2.5 : 1.5}
                opacity={edgeOpacity(c)}
                markerEnd={
                  edgeHighlighted(c)
                    ? "url(#arrowhead-hi)"
                    : "url(#arrowhead)"
                }
                style={{ transition: "opacity 0.2s, stroke-width 0.2s" }}
              />
            ))}

            {/* Nodes */}
            {NODES.map((node) => {
              if (node.group) {
                // Integration group box
                return (
                  <g
                    key={node.id}
                    opacity={nodeOpacity(node.id)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ transition: "opacity 0.2s", cursor: "pointer" }}
                  >
                    <rect
                      x={node.x}
                      y={node.y}
                      width={node.w}
                      height={node.h}
                      rx={10}
                      fill="hsl(var(--card))"
                      stroke="hsl(var(--primary))"
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                    />
                    <text
                      x={node.x + node.w / 2}
                      y={node.y + 22}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="600"
                      fill="hsl(var(--primary))"
                    >
                      {node.label}
                    </text>
                    {/* Integration pills */}
                    {INTEGRATION_PILLS.map((pill, i) => {
                      const col = i % 2;
                      const row = Math.floor(i / 2);
                      const px = node.x + 10 + col * 96;
                      const py = node.y + 38 + row * 22;
                      return (
                        <g key={pill}>
                          <rect
                            x={px}
                            y={py}
                            width={88}
                            height={18}
                            rx={9}
                            fill="hsl(var(--primary) / 0.1)"
                          />
                          <text
                            x={px + 44}
                            y={py + 12.5}
                            textAnchor="middle"
                            fontSize="9"
                            fill="hsl(var(--primary))"
                          >
                            {pill}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              }

              return (
                <g
                  key={node.id}
                  opacity={nodeOpacity(node.id)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{ transition: "opacity 0.2s", cursor: "pointer" }}
                >
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.w}
                    height={node.h}
                    rx={8}
                    fill="hsl(var(--card))"
                    stroke="hsl(var(--primary))"
                    strokeWidth={
                      hoveredNode === node.id ? 2.5 : 1.5
                    }
                    strokeDasharray={node.dashed ? "6 3" : undefined}
                  />
                  <text
                    x={node.x + node.w / 2}
                    y={
                      node.subtitle
                        ? node.y + node.h / 2 - 4
                        : node.y + node.h / 2 + 4
                    }
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="600"
                    fill="hsl(var(--card-foreground))"
                  >
                    {node.label}
                  </text>
                  {node.subtitle && (
                    <text
                      x={node.x + node.w / 2}
                      y={node.y + node.h / 2 + 12}
                      textAnchor="middle"
                      fontSize="10"
                      fill="hsl(var(--muted-foreground))"
                    >
                      {node.subtitle}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </CardContent>
      </Card>

      {/* Detail cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core Docker Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Server className="h-4 w-4 text-primary" />
              </div>
              Core Docker Services
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DOCKER_SERVICES.map((svc) => {
              const Icon = svc.icon;
              return (
                <div key={svc.name} className="flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-primary/10 shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{svc.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {svc.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Client Applications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Monitor className="h-4 w-4 text-primary" />
              </div>
              Client Applications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {CLIENT_APPS.map((app) => {
              const Icon = app.icon;
              return (
                <div key={app.name} className="flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-primary/10 shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{app.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {app.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* External Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Plug className="h-4 w-4 text-primary" />
              </div>
              External Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {INTEGRATION_GROUPS.map((grp) => (
              <div key={grp.group}>
                <div className="text-xs font-semibold text-primary/80 uppercase tracking-wider mb-2">
                  {grp.group}
                </div>
                <div className="space-y-2">
                  {grp.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.name}
                        className="flex items-start gap-3"
                      >
                        <div className="p-1.5 rounded-md bg-primary/10 shrink-0 mt-0.5">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {item.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Deployment Models */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-primary/10">
                <Box className="h-4 w-4 text-primary" />
              </div>
              Deployment Models
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {DEPLOYMENT_MODELS.map((model) => {
              const Icon = model.icon;
              return (
                <div key={model.name} className="flex items-start gap-3">
                  <div className="p-1.5 rounded-md bg-primary/10 shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{model.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {model.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
