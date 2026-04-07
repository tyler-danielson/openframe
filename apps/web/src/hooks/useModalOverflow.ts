import { useState, useEffect, type RefObject } from "react";

/**
 * Monitors a modal content ref and returns true if its natural height
 * exceeds the available viewport space (accounting for modal chrome).
 *
 * Evaluates once on mount + 500ms after mount, then locks the result
 * for the session to avoid disorienting layout shifts mid-interaction.
 */
export function useModalOverflow(
  contentRef: RefObject<HTMLElement | null>,
  enabled: boolean = true
): boolean {
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    if (!enabled || !contentRef.current) return;

    let locked = false;

    const check = () => {
      // Once overflow is detected, don't re-evaluate — switching to horizontal
      // makes content shorter, which would falsely flip it back to vertical
      if (locked) return;

      const el = contentRef.current;
      if (!el) return;

      // Dialog uses max-h-[90vh], then subtract chrome:
      // ~48px padding (p-6 top+bottom), ~44px header, ~52px footer actions
      const availableHeight = window.innerHeight * 0.9 - 160;
      const contentHeight = el.scrollHeight;

      if (contentHeight > availableHeight) {
        setOverflows(true);
        locked = true;
      }
    };

    // Check immediately
    check();

    // Re-check after 500ms to catch initial data loads that expand content
    const timer = setTimeout(check, 500);

    return () => clearTimeout(timer);
  }, [enabled, contentRef]);

  return overflows;
}
