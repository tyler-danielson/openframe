export interface WidgetConfigProps {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  widgetId: string;
  openEntityBrowser?: (configKey: string) => void;
  openAlbumPicker?: () => void;
}
