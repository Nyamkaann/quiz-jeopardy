"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const COLORS = ["#ff8a3d", "#ffa552", "#f2483f", "#5fc3c3", "#a6e6e3", "#f3e9d2"];

/** One-shot confetti burst. Re-mount (change `key`) to fire again. */
export function Confetti({ count = 90 }: { count?: number }) {
  const [alive, setAlive] = useState(true);
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // deterministic pseudo-random so render stays pure
        const r = (n: number) => {
          const x = Math.sin(i * 9301 + n * 49297) * 233280;
          return x - Math.floor(x);
        };
        return {
          left: r(1) * 100,
          dx: (r(2) - 0.5) * 30,
          rot: (r(3) - 0.5) * 1440,
          dur: 1.8 + r(4) * 1.6,
          delay: r(5) * 0.35,
          w: 6 + r(6) * 6,
          h: 8 + r(7) * 10,
          round: r(8) > 0.7,
          color: COLORS[i % COLORS.length],
        };
      }),
    [count],
  );

  useEffect(() => {
    const t = setTimeout(() => setAlive(false), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!alive) return null;
  return (
    <div aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}vw`,
              width: p.w,
              height: p.round ? p.w : p.h,
              borderRadius: p.round ? "50%" : 2,
              background: p.color,
              "--dx": `${p.dx}vw`,
              "--rot": `${p.rot}deg`,
              "--dur": `${p.dur}s`,
              "--delay": `${p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Brief red/green radial flash over the whole screen. Re-mount to fire again. */
export function ScreenFlash({ kind }: { kind: "good" | "bad" }) {
  return <div aria-hidden className={`screen-flash ${kind}`} />;
}

// Last value each score showed, so a chip that re-mounts (e.g. coming back to
// the board after a clue) still animates from the old number to the new one.
const lastShown = new Map<string, number>();

/** Number that counts toward its new value, pops, and shows a floating +/- delta. */
export function AnimatedScore({
  id,
  value,
  className,
  style,
}: {
  id: string;
  value: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [start] = useState(() => lastShown.get(id) ?? value);
  const [shown, setShown] = useState(start);
  const [delta, setDelta] = useState<{ v: number; k: number } | null>(null);
  const prev = useRef(start);
  const shownRef = useRef(start);

  useEffect(() => {
    const from = shownRef.current;
    const to = value;
    if (from === to) {
      lastShown.set(id, to);
      return;
    }
    // update `prev` inside the frame so a StrictMode double-run can't swallow the delta
    const raf0 = requestAnimationFrame(() => {
      const diff = to - prev.current;
      prev.current = to;
      if (diff !== 0) setDelta({ v: diff, k: Date.now() });
    });
    const start = performance.now();
    const dur = 650;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      const n = Math.round(from + (to - from) * eased);
      shownRef.current = n;
      lastShown.set(id, n);
      setShown(n);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); cancelAnimationFrame(raf0); };
  }, [value, id]);

  return (
    <span className="relative inline-block">
      <span key={delta?.k ?? 0} className={`${delta ? "score-pop" : ""} ${className ?? ""}`} style={style}>
        {shown}
      </span>
      {delta && delta.v !== 0 && (
        <span
          key={`d${delta.k}`}
          className="float-delta text-sm sm:text-lg"
          style={{ color: delta.v > 0 ? "#7cf0b4" : "#ff7a72" }}
        >
          {delta.v > 0 ? `+${delta.v}` : `−${Math.abs(delta.v)}`}
        </span>
      )}
    </span>
  );
}

/** A few shooting stars streaking across the backdrop. */
export function ShootingStars() {
  const stars = [
    { top: "8%", left: "92%", delay: "0s" },
    { top: "22%", left: "70%", delay: "3.2s" },
    { top: "4%", left: "55%", delay: "6.1s" },
  ];
  return (
    <div aria-hidden>
      {stars.map((s, i) => (
        <span key={i} className="shooting-star" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
      ))}
    </div>
  );
}
