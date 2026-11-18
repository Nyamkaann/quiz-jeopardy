"use client";

import { useEffect, useRef } from "react";

/**
 * Purely decorative winter layer: falling snow (canvas), a soft aurora,
 * snow-covered pines and drifts along the bottom. Fixed behind every page,
 * ignores clicks, pauses when the tab is hidden, and stays still for
 * prefers-reduced-motion.
 */

type Flake = { x: number; y: number; r: number; vy: number; sway: number; phase: number; a: number };

function Snowfall() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, dpr = 1;
    const flakes: Flake[] = [];
    let raf = 0;
    let last = performance.now();

    const make = (anyY: boolean): Flake => {
      const r = Math.random() < 0.15 ? 2.2 + Math.random() * 1.8 : 0.7 + Math.random() * 1.6; // a few big near flakes
      return {
        x: Math.random() * w,
        y: anyY ? Math.random() * h : -10,
        r,
        vy: 18 + r * 16 + Math.random() * 10, // px/s — bigger falls faster (parallax)
        sway: 10 + Math.random() * 22,
        phase: Math.random() * Math.PI * 2,
        a: 0.35 + Math.min(r / 4, 1) * 0.55,
      };
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // density scales with screen area: ~60 on a phone, ~180 on a big display
      const target = Math.round(Math.min(200, Math.max(50, (w * h) / 11000)));
      while (flakes.length < target) flakes.push(make(true));
      flakes.length = target;
      if (reduce) draw(0);
    };

    const draw = (dt: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#f4f9ff"; // canvas resize resets context state, so set it every frame
      const t = performance.now() / 1000;
      for (const f of flakes) {
        f.y += f.vy * dt;
        const x = f.x + Math.sin(t * 0.6 + f.phase) * f.sway;
        if (f.y - f.r > h) Object.assign(f, make(false));
        ctx.globalAlpha = f.a;
        ctx.beginPath();
        ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(loop);
    };

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="snow-canvas" />;
}

// simple layered pine: three stacked triangles with snow on each tier
function Pine({ x, s, tone }: { x: number; s: number; tone: string }) {
  return (
    <g transform={`translate(${x} ${200 - 122 * s}) scale(${s})`}>
      <rect x="-4" y="104" width="8" height="18" fill={tone} />
      <path d="M0 0 L22 34 L12 34 L34 66 L20 66 L44 104 L-44 104 L-20 66 L-34 66 L-12 34 L-22 34 Z" fill={tone} />
      <path d="M0 0 L9 14 L4 16 L0 12 L-4 16 L-9 14 Z M-12 34 L-4 38 L4 35 L12 34 L16 40 L4 42 L-6 41 L-16 40 Z M-20 66 L-6 71 L8 68 L20 66 L26 74 L6 76 L-10 75 L-26 74 Z"
        fill="#eaf3fb" opacity="0.85" />
    </g>
  );
}

export default function WinterDecor() {
  return (
    <div className="winter-decor" aria-hidden>
      <div className="aurora" />
      {/* far ridge + snow drifts stretch to any width */}
      <svg className="winter-hills" viewBox="0 0 1200 200" preserveAspectRatio="none">
        <path d="M0 150 C 150 110, 260 135, 400 118 C 560 98, 700 140, 860 112 C 1000 90, 1100 120, 1200 108 L1200 200 L0 200 Z" fill="#14294a" opacity="0.9" />
        <path d="M0 172 C 200 150, 380 178, 600 166 C 820 154, 1000 180, 1200 160 L1200 200 L0 200 Z" fill="#cfe2f3" opacity="0.16" />
      </svg>
      {/* pine clusters anchored to the corners, never cropped on phones */}
      <svg className="pines pines-left" viewBox="0 0 200 200">
        <Pine x={120} s={0.6} tone="#0e2038" />
        <Pine x={45} s={1.05} tone="#081426" />
        <Pine x={165} s={0.42} tone="#0e2038" />
      </svg>
      <svg className="pines pines-right" viewBox="0 0 200 200">
        <Pine x={70} s={0.7} tone="#0e2038" />
        <Pine x={150} s={0.95} tone="#081426" />
        <Pine x={20} s={0.45} tone="#0e2038" />
      </svg>
      <svg className="winter-drift" viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0 30 C 260 12, 460 38, 700 24 C 900 14, 1060 36, 1200 20 L1200 60 L0 60 Z" fill="#e6f1fb" opacity="0.3" />
      </svg>
      <Snowfall />
    </div>
  );
}
