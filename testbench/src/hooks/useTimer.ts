import { useState, useEffect } from 'react';
import { getRemainingMs, formatTime, getTimerSeverity } from '@/core/exam/timer';

export interface UseTimerResult {
  remainingMs: number;
  formatted: string;
  severity: 'normal' | 'warning' | 'danger';
  isExpired: boolean;
}

export function useTimer(endsAt: number, onExpire?: () => void): UseTimerResult {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt <= 0) return;

    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endsAt, onExpire]);

  const remainingMs = getRemainingMs(endsAt, now);
  const formatted = formatTime(remainingMs);
  const severity = getTimerSeverity(remainingMs);
  const isExpired = remainingMs === 0 && endsAt > 0;

  return {
    remainingMs,
    formatted,
    severity,
    isExpired,
  };
}

