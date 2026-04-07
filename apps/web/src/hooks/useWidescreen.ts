import { useState, useEffect } from "react";

/**
 * Returns true when the viewport is "widescreen" — significantly wider than tall.
 * Threshold: width > 1.5× height (covers 16:9, 16:10, 21:9, 32:9)
 */
export function useIsWidescreen(): boolean {
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const check = () => {
      const ratio = window.innerWidth / window.innerHeight;
      setIsWide(ratio > 1.5);
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isWide;
}
