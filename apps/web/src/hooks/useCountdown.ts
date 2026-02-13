import { useState, useEffect, useRef } from "react";

interface CountdownResult {
  minutes: number;
  seconds: number;
  totalRemaining: number;
  isComplete: boolean;
}

export function useCountdown(
  targetSeconds: number,
  isRunning: boolean
): CountdownResult {
  const [totalRemaining, setTotalRemaining] = useState(targetSeconds);
  const remainingRef = useRef(targetSeconds);

  // Sync when targetSeconds changes (e.g. from server refetch)
  useEffect(() => {
    setTotalRemaining(targetSeconds);
    remainingRef.current = targetSeconds;
  }, [targetSeconds]);

  useEffect(() => {
    if (!isRunning || remainingRef.current <= 0) return;

    const interval = setInterval(() => {
      remainingRef.current = Math.max(0, remainingRef.current - 1);
      setTotalRemaining(remainingRef.current);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  return {
    minutes: Math.floor(totalRemaining / 60),
    seconds: totalRemaining % 60,
    totalRemaining,
    isComplete: totalRemaining <= 0,
  };
}
