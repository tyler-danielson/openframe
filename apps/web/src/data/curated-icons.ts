export interface IconCategory {
  id: string;
  label: string;
  icons: string[];
}

export const ICON_CATEGORIES: IconCategory[] = [
  {
    id: "general",
    label: "General",
    icons: [
      "Home", "Settings", "LayoutDashboard", "LayoutGrid", "Kanban", "PanelLeft",
      "Search", "Filter", "SlidersHorizontal", "Menu", "Grid3X3", "Layers",
      "Bookmark", "Hash", "Tag", "Archive", "FolderOpen", "FileText",
    ],
  },
  {
    id: "calendar",
    label: "Calendar & Time",
    icons: [
      "Calendar", "CalendarDays", "CalendarCheck", "CalendarClock", "CalendarRange",
      "Clock", "Timer", "TimerReset", "Hourglass", "AlarmClock",
    ],
  },
  {
    id: "tasks",
    label: "Tasks & Lists",
    icons: [
      "ListTodo", "ListChecks", "CheckSquare", "CheckCircle", "ClipboardList",
      "ClipboardCheck", "CircleDot", "SquareCheck", "ListOrdered", "List",
    ],
  },
  {
    id: "media",
    label: "Media",
    icons: [
      "Music", "Music2", "Play", "Pause", "SkipForward", "SkipBack", "Volume2",
      "Camera", "Image", "Video", "Film", "Tv", "Monitor", "Radio", "Headphones",
      "Mic", "Podcast",
    ],
  },
  {
    id: "communication",
    label: "Communication",
    icons: [
      "MessageCircle", "MessageSquare", "Mail", "MailOpen", "Bell", "BellRing",
      "Phone", "Send", "Inbox", "AtSign", "Megaphone",
    ],
  },
  {
    id: "navigation",
    label: "Navigation",
    icons: [
      "Map", "MapPin", "MapPinned", "Compass", "Globe", "Navigation",
      "Signpost", "Route", "Milestone",
    ],
  },
  {
    id: "weather",
    label: "Weather & Nature",
    icons: [
      "Sun", "Moon", "Cloud", "CloudRain", "CloudSnow", "CloudSun",
      "Snowflake", "Wind", "Thermometer", "Droplets", "Rainbow",
      "Leaf", "TreePine", "Trees", "Flower2", "Sprout", "Mountain",
    ],
  },
  {
    id: "objects",
    label: "Objects",
    icons: [
      "ShoppingCart", "ShoppingBag", "Key", "Lock", "Unlock", "Lightbulb",
      "Wrench", "Hammer", "Paintbrush", "Scissors", "Paperclip", "Gift",
      "Package", "Box", "Briefcase", "Wallet", "CreditCard", "Banknote",
    ],
  },
  {
    id: "people",
    label: "People",
    icons: [
      "Users", "User", "UserPlus", "UserCheck", "Heart", "HeartHandshake",
      "Star", "Award", "Trophy", "Crown", "ThumbsUp", "Smile", "Baby",
    ],
  },
  {
    id: "tech",
    label: "Tech",
    icons: [
      "Cpu", "Wifi", "Server", "Code", "Terminal", "Database", "HardDrive",
      "Smartphone", "Tablet", "Laptop", "Bluetooth", "Usb", "Plug", "Power",
      "QrCode", "Scan", "Binary",
    ],
  },
  {
    id: "food",
    label: "Food & Kitchen",
    icons: [
      "ChefHat", "UtensilsCrossed", "Coffee", "CupSoda", "Wine", "Beer",
      "Apple", "Cherry", "Citrus", "Sandwich", "Pizza", "Salad",
      "CookingPot", "Refrigerator", "Microwave",
    ],
  },
  {
    id: "transport",
    label: "Transport",
    icons: [
      "Car", "Bus", "Bike", "Plane", "Train", "Ship", "Truck",
      "Fuel", "ParkingCircle", "CircleParking",
    ],
  },
  {
    id: "fitness",
    label: "Fitness & Health",
    icons: [
      "Activity", "Dumbbell", "HeartPulse", "Footprints", "PersonStanding",
      "Bike", "Flame", "Stethoscope", "Pill", "Syringe", "Brain",
    ],
  },
  {
    id: "misc",
    label: "Misc",
    icons: [
      "Zap", "Flame", "Rocket", "Target", "Eye", "EyeOff", "Crosshair",
      "Shield", "Bug", "Puzzle", "Gamepad2", "Dice5", "Music4",
      "PenTool", "Palette", "Wand2", "Sparkles", "PartyPopper", "Gauge",
    ],
  },
];

export const ALL_CURATED_ICONS = ICON_CATEGORIES.flatMap((c) => c.icons);
