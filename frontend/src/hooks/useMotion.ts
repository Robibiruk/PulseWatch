import { useEffect, useLayoutEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Selectors of in-app surfaces that glide in the first time they appear. */
const APP_SURFACES =
  ".kpi-card, .bento-card, .chart-card, .info-card, .set-card, .fleet, .pub-row, .tl-item, .prf-card, .alert-demo, .empty";

/**
 * Monitoring pages: animates surfaces as they mount (data usually arrives async,
 * so a MutationObserver catches late arrivals). Each node animates once.
 */
export function useAppMotion(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReduced()) return;
    const seen = new WeakSet<Element>();
    const play = () => {
      const fresh = Array.from(root.querySelectorAll(APP_SURFACES)).filter((el) => !seen.has(el));
      if (!fresh.length) return;
      fresh.forEach((el) => seen.add(el));
      gsap.fromTo(fresh, { y: 18, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 0.55, ease: "power3.out", stagger: 0.06,
        clearProps: "transform,opacity,visibility",
      });
      // Bars grow in: response chart, uptime bar, KPI meters
      const bars = fresh.flatMap((el) => Array.from(el.querySelectorAll(".resp-chart > i, .uptime-bar > i, .kpi-bar > i, .spark > i")));
      if (bars.length) gsap.from(bars, { scaleY: 0, transformOrigin: "50% 100%", duration: 0.6, ease: "power2.out", stagger: { amount: 0.5, from: "start" }, delay: 0.15, clearProps: "transform" });
      // Table rows cascade
      const rows = fresh.flatMap((el) => Array.from(el.querySelectorAll(".fleet-grid tbody tr")));
      if (rows.length) gsap.from(rows, { x: -12, autoAlpha: 0, duration: 0.4, ease: "power2.out", stagger: 0.04, delay: 0.2, clearProps: "transform,opacity,visibility" });
    };
    play();
    const mo = new MutationObserver(() => requestAnimationFrame(play));
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [ref]);
}

/** Smooth count-up for landing stats. Text is written once per frame, outside React. */
export function countUp(el: HTMLElement, to: number, opts: { decimals?: number; suffix?: string; duration?: number } = {}) {
  const { decimals = 0, suffix = "", duration = 1.6 } = opts;
  const o = { v: 0 };
  return gsap.to(o, {
    v: to, duration, ease: "power2.out",
    onUpdate: () => { el.textContent = o.v.toFixed(decimals) + suffix; },
  });
}

export { gsap, ScrollTrigger, useLayoutEffect };
