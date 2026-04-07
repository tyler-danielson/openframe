import { useState, useEffect } from "react";

interface Props {
  badge: {
    name: string;
    icon: string;
    description: string;
  };
  profileName: string;
  onDismiss: () => void;
}

export function BadgeCelebration({ badge, profileName, onDismiss }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onDismiss}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 text-center animate-in zoom-in-50 duration-500">
        {/* Badge icon — large */}
        <div className="text-8xl mb-4 animate-bounce">{badge.icon}</div>

        {/* Badge name */}
        <h2 className="text-3xl font-bold text-white mb-2">{badge.name}</h2>

        {/* Description */}
        <p className="text-lg text-white/80 mb-1">{badge.description}</p>

        {/* Profile name */}
        <p className="text-primary font-semibold text-xl mt-4">
          {profileName}
        </p>

        {/* Sparkle particles (CSS-only) */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-primary rounded-full animate-ping"
              style={{
                left: `${20 + Math.random() * 60}%`,
                top: `${10 + Math.random() * 80}%`,
                animationDelay: `${Math.random() * 1}s`,
                animationDuration: `${1 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
