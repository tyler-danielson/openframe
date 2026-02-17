import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface CompanionPageHeaderProps {
  title: string;
  backTo?: string;
  rightAction?: React.ReactNode;
}

export function CompanionPageHeader({ title, backTo, rightAction }: CompanionPageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
      <button
        onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
        className="p-2 -ml-2 rounded-lg hover:bg-primary/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <ArrowLeft className="h-5 w-5 text-primary" />
      </button>
      <h1 className="text-lg font-semibold truncate flex-1">{title}</h1>
      {rightAction && <div className="shrink-0">{rightAction}</div>}
    </header>
  );
}
