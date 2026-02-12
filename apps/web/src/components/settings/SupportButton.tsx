import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Heart, Beer, ExternalLink, X } from "lucide-react";

export function SupportButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-6 right-6 z-50">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:ring-offset-2"
            aria-label="Support OpenFrame"
          >
            <Heart
              className={`h-5 w-5 fill-current ${open ? "" : "animate-pulse-heart"}`}
            />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="top"
            align="end"
            sideOffset={12}
            className="w-72 rounded-xl border border-border bg-card p-4 shadow-xl animate-fade-in"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <Heart className="h-5 w-5 text-red-500 fill-current" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary">
                  Enjoying OpenFrame?
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your support helps keep development going and new features
                  coming!
                </p>
              </div>
              <Popover.Close asChild>
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </Popover.Close>
            </div>

            <a
              href="https://buymeacoffee.com/pfro7xl"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Beer className="h-4 w-4" />
              Buy me a beer
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>

            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground text-center">
                Premium hosted API connectors coming soon
              </p>
            </div>

            <Popover.Arrow className="fill-card" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
