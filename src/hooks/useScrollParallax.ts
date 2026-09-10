import { useState, useEffect, useCallback } from 'react';

interface ScrollParallaxResult {
  earthTransform: { scale: number; y: number };
  headingStyle: { blur: number; opacity: number };
}

export function useScrollParallax(): ScrollParallaxResult {
  const [scrollY, setScrollY] = useState(0);

  const handleScroll = useCallback(() => {
    setScrollY(window.scrollY);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scale = Math.max(0.5 - scrollY * 0.0005, 0.3);
  const y = scrollY * 0.3;
  const blur = Math.min(scrollY * 0.04, 10);
  const opacity = Math.max(1 - scrollY * 0.003, 0);

  return {
    earthTransform: { scale, y },
    headingStyle: { blur, opacity },
  };
}
