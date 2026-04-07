import { useRef, type ReactNode } from "react";
import { useAdaptiveModalLayout, type ModalLayout } from "../../hooks/useAdaptiveModalLayout";
import { cn } from "../../lib/utils";

interface AdaptiveModalContentProps {
  /** Primary column content (always left/top) */
  primary: ReactNode;
  /** Secondary column content (right in horizontal, below in vertical) */
  secondary: ReactNode;
  /** Optional: force a specific layout */
  forceLayout?: ModalLayout;
  /** Class overrides */
  className?: string;
}

/**
 * Adaptive two-column wrapper for modal content.
 *
 * On widescreen displays where the content would overflow vertically,
 * splits into a side-by-side grid layout. Otherwise stacks vertically.
 */
export function AdaptiveModalContent({
  primary,
  secondary,
  forceLayout,
  className,
}: AdaptiveModalContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const detectedLayout = useAdaptiveModalLayout(contentRef);
  const layout = forceLayout ?? detectedLayout;

  return (
    <div
      ref={contentRef}
      className={cn(
        "transition-all duration-200",
        layout === "horizontal"
          ? "grid grid-cols-2 gap-6"
          : "flex flex-col gap-4",
        className
      )}
    >
      <div className="space-y-4">
        {primary}
      </div>
      <div className={cn(
        "space-y-4",
        layout === "horizontal" && "border-l border-border pl-6"
      )}>
        {secondary}
      </div>
    </div>
  );
}

export { type ModalLayout };
