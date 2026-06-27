"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates from 0 → target once on mount (or when target first becomes non-zero).
 * Uses a ref guard so it never re-fires on subsequent re-renders.
 */
export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    // Only fire once per component lifetime
    if (firedRef.current) return;
    if (target === 0) return; // wait until we have real data

    firedRef.current = true;

    // Skip animation for reduced-motion
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target);
      return;
    }

    const from = 0;
    let startTs: number | null = null;

    function step(ts: number) {
      if (!startTs) startTs = ts;
      const progress = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setValue(target); // ensure exact final value
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // target intentionally excluded: we only want the first non-zero value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // If target is 0 or animation hasn't fired, show target directly
  return firedRef.current ? value : target;
}
