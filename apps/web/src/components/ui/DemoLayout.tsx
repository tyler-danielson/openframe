import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Layout } from "./Layout";

export function DemoLayout() {
  return (
    <div className="flex flex-col h-dvh">
      {/* Demo banner */}
      <div className="h-10 bg-primary text-primary-foreground flex items-center justify-between px-4 z-[60] shrink-0">
        <span className="text-sm font-medium">
          Exploring Demo Mode
        </span>
        <Link
          to="/login"
          className="text-sm font-semibold hover:underline flex items-center gap-1"
        >
          Sign Up Free <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Main layout */}
      <div className="flex-1 min-h-0">
        <Layout className="!h-full" basePath="/demo" />
      </div>

      {/* Floating CTA */}
      <Link
        to="/login"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 shadow-lg hover:bg-primary/90 transition-colors font-medium text-sm"
      >
        Sign Up Free <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
