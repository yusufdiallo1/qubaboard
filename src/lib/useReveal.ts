"use client";

import { useEffect, useRef } from "react";

/**
 * useReveal — lightweight IntersectionObserver scroll-reveal.
 * Attach the returned ref to a container; all direct children with
 * className "reveal" get the "in" class once when they enter the viewport.
 * Runs once per element — no layout shift, no jank.
 */
export function useReveal(threshold = 0.08) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const targets = Array.from(el.querySelectorAll<HTMLElement>(".reveal"));
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
