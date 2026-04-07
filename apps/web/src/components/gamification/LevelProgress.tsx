interface Props {
  level: number;
  levelName: string;
  progress: number; // 0-1
  compact?: boolean;
}

export function LevelProgress({ level, levelName, progress, compact }: Props) {
  if (compact) {
    return (
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">
          Level {level} · {levelName}
        </span>
        <span className="text-xs text-muted-foreground">
          {Math.round(progress * 100)}%
        </span>
      </div>
      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
