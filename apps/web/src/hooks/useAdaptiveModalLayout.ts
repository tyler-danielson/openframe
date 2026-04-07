import { type RefObject } from "react";
import { useIsWidescreen } from "./useWidescreen";
import { useModalOverflow } from "./useModalOverflow";

export type ModalLayout = "vertical" | "horizontal";

/**
 * Returns "horizontal" when BOTH conditions are true:
 * 1. The viewport is widescreen (width > 1.5× height)
 * 2. The modal content would overflow vertically
 *
 * Otherwise returns "vertical" (the default single-column layout).
 */
export function useAdaptiveModalLayout(
  contentRef: RefObject<HTMLElement | null>
): ModalLayout {
  const isWidescreen = useIsWidescreen();
  const overflows = useModalOverflow(contentRef, isWidescreen);

  if (isWidescreen && overflows) return "horizontal";
  return "vertical";
}
