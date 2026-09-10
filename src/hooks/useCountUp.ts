import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  end: number;
  delay?: number;
  duration?: number;
  digits?: number;
  suffix?: string;
}

export function useCountUp({
  end,
  delay = 0,
  duration = 1200,
  digits,
  suffix = '',
}: UseCountUpOptions): string {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let startTime: number | null = null;

    const delayTimer = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (startTime === null) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(eased * end);
        setCount(current);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(delayTimer);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [end, delay, duration]);

  const formatted =
    digits != null ? String(count).padStart(digits, '0') : String(count);
  return formatted + suffix;
}
