import type { ComponentType } from "react";
import type { BuilderWidgetType } from "../../../stores/screensaver";
import type { WidgetConfigProps } from "./types";
import { ClockConfig } from "./ClockConfig";
import { CountdownConfig } from "./CountdownConfig";
import { WeatherConfig } from "./WeatherConfig";
import { ForecastConfig } from "./ForecastConfig";
import { CalendarConfig } from "./CalendarConfig";
import { UpNextConfig } from "./UpNextConfig";
import { TasksConfig } from "./TasksConfig";
import { SportsConfig } from "./SportsConfig";
import { SpotifyConfig } from "./SpotifyConfig";
import { HAEntityConfig } from "./HAEntityConfig";
import { HAMapConfig } from "./HAMapConfig";
import { HAWidgetConfig } from "./HAWidgetConfig";
import { TextConfig } from "./TextConfig";
import { ImageConfig } from "./ImageConfig";
import { PhotoAlbumConfig } from "./PhotoAlbumConfig";
import { FullscreenToggleConfig } from "./FullscreenToggleConfig";
import { DayScheduleConfig } from "./DayScheduleConfig";
import { WeekScheduleConfig } from "./WeekScheduleConfig";
import { NewsConfig } from "./NewsConfig";
import { IptvConfig } from "./IptvConfig";
import { YouTubeConfig } from "./YouTubeConfig";
import { PlexConfig } from "./PlexConfig";
import { PlexAmpConfig } from "./PlexAmpConfig";
import { AudiobookshelfConfig } from "./AudiobookshelfConfig";
import { PhotoFeedConfig } from "./PhotoFeedConfig";
import { SupportConfig } from "./SupportConfig";
import { CountdownHolderConfig } from "./CountdownHolderConfig";
import { MultiClockConfig } from "./MultiClockConfig";
import { NotesConfig } from "./NotesConfig";
import { StockQuoteConfig } from "./StockQuoteConfig";
import { ExchangeRateConfig } from "./ExchangeRateConfig";
import { AtmosphericMapConfig } from "./AtmosphericMapConfig";
import { WeatherAlertsConfig } from "./WeatherAlertsConfig";
import { OceanTidesConfig } from "./OceanTidesConfig";
import { AirQualityConfig } from "./AirQualityConfig";
import { ChoresConfig } from "./ChoresConfig";
import { StickyNotesConfig } from "./StickyNotesConfig";
import { PackageTrackingConfig } from "./PackageTrackingConfig";

export type { WidgetConfigProps } from "./types";

export const WIDGET_CONFIG_REGISTRY: Partial<
  Record<BuilderWidgetType, ComponentType<WidgetConfigProps>>
> = {
  clock: ClockConfig,
  countdown: CountdownConfig,
  weather: WeatherConfig,
  forecast: ForecastConfig,
  calendar: CalendarConfig,
  "up-next": UpNextConfig,
  tasks: TasksConfig,
  sports: SportsConfig,
  spotify: SpotifyConfig,
  ha: HAWidgetConfig,
  "ha-entity": HAEntityConfig,
  "ha-gauge": HAEntityConfig,
  "ha-graph": HAEntityConfig,
  "ha-camera": HAEntityConfig,
  "ha-map": HAMapConfig,
  text: TextConfig,
  image: ImageConfig,
  "photo-album": PhotoAlbumConfig,
  "fullscreen-toggle": FullscreenToggleConfig,
  "day-schedule": DayScheduleConfig,
  "week-schedule": WeekScheduleConfig,
  news: NewsConfig,
  iptv: IptvConfig,
  youtube: YouTubeConfig,
  plex: PlexConfig,
  plexamp: PlexAmpConfig,
  audiobookshelf: AudiobookshelfConfig,
  "photo-feed": PhotoFeedConfig,
  support: SupportConfig,
  "countdown-holder": CountdownHolderConfig,
  "multi-clock": MultiClockConfig,
  notes: NotesConfig,
  "stock-quote": StockQuoteConfig,
  "exchange-rate": ExchangeRateConfig,
  "atmospheric-map": AtmosphericMapConfig,
  "weather-alerts": WeatherAlertsConfig,
  "ocean-tides": OceanTidesConfig,
  "air-quality": AirQualityConfig,
  chores: ChoresConfig,
  "sticky-notes": StickyNotesConfig,
  "package-tracking": PackageTrackingConfig,
};
