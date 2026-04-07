interface Badge {
  id?: string;
  badgeId?: string;
  name: string;
  icon: string;
  description: string;
  earnedAt?: Date | string;
}

interface Props {
  badges: Badge[];
  compact?: boolean;
}

export function BadgeDisplay({ badges, compact }: Props) {
  if (badges.length === 0) return null;

  if (compact) {
    const shown = badges.slice(0, 5);
    const remaining = badges.length - shown.length;
    return (
      <div className="flex items-center gap-1">
        {shown.map((badge, i) => (
          <span
            key={badge.badgeId || badge.id || i}
            title={`${badge.name}: ${badge.description}`}
            className="text-base"
          >
            {badge.icon}
          </span>
        ))}
        {remaining > 0 && (
          <span className="text-xs text-muted-foreground">
            +{remaining} badges
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {badges.map((badge, i) => (
        <div
          key={badge.badgeId || badge.id || i}
          className="flex flex-col items-center gap-1 p-3 bg-muted/30 rounded-xl"
          title={badge.description}
        >
          <span className="text-2xl">{badge.icon}</span>
          <span className="text-xs font-medium text-center leading-tight">
            {badge.name}
          </span>
        </div>
      ))}
    </div>
  );
}
