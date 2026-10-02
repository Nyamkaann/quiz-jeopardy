"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * Host-only answer strip, so the host can judge CORRECT / WRONG.
 * - When the audience screen is connected, the host window isn't projected,
 *   so the answer is shown straight away (`auto`).
 * - Otherwise it's hidden behind a 👁 toggle, or press-and-hold the "A" key.
 * Remount it per question (key) so it closes again on the next clue.
 */
export default function HostAnswer({
  answer,
  images = [],
  auto,
}: {
  answer?: string;
  images?: string[];
  auto: boolean;
}) {
  const [peek, setPeek] = useState(false);
  const [held, setHeld] = useState(false);
  const open = auto || peek || held;

  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => {
      const t = (e.target as HTMLElement)?.tagName;
      return t === "INPUT" || t === "TEXTAREA";
    };
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "a" && !e.repeat && !isTyping(e)) setHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "a") setHeld(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const empty = !answer?.trim() && images.length === 0;

  return (
    <div
      className="rounded-xl px-3 py-2 flex items-center gap-3 min-h-[44px]"
      style={{
        background: open ? "rgba(80,220,150,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px dashed ${open ? "rgba(120,240,180,0.45)" : "var(--glass-border)"}`,
      }}
    >
      <button
        onClick={() => setPeek((v) => !v)}
        disabled={auto}
        title={auto ? "Үзэгчдийн дэлгэц холбогдсон тул автоматаар харагдаж байна" : "Хариулт харах / нуух (эсвэл A товчийг дарж барина)"}
        className="shrink-0 rounded-lg px-2.5 py-1.5 mono text-[0.6rem] transition-colors disabled:cursor-default"
        style={{ color: "#8ff3c0", background: "rgba(80,220,150,0.1)", border: "1px solid rgba(120,240,180,0.35)" }}
      >
        {open ? "👁" : "🙈"} ХАРИУЛТ
      </button>

      {open ? (
        <div className="flex-1 min-w-0 flex items-center gap-3">
          {images.slice(0, 3).map((src, i) => (
            <div key={i} className="relative w-12 h-9 rounded-md overflow-hidden shrink-0" style={{ border: "1px solid var(--glass-border-hi)" }}>
              <Image src={src} alt="" fill className="object-cover" unoptimized />
            </div>
          ))}
          <span className="title-mixed text-base sm:text-lg truncate" style={{ color: "#bff8da" }}>
            {empty ? "— хариулт оруулаагүй —" : answer}
          </span>
        </div>
      ) : (
        <span className="flex-1 mono text-[0.6rem]" style={{ color: "rgba(243,233,210,0.4)" }}>
          НУУГДСАН · 👁 ДАРАХ ЭСВЭЛ «A» ТОВЧИЙГ ДАРЖ БАРИНА
        </span>
      )}

      <span className="shrink-0 mono text-[0.55rem] hidden sm:inline" style={{ color: "rgba(243,233,210,0.35)" }}>
        🔒 ЗӨВХӨН ХӨТЛӨГЧИД
      </span>
    </div>
  );
}
