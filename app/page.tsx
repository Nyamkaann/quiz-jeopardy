"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { ShootingStars } from "@/components/Fx";
import QuizExplorer from "@/components/QuizExplorer";

const RULES = [
  { icon: "🎯", title: "Асуулт сонгох", body: "Багууд сэдэв болон оноогоо сонгож асуултад хариулна. Сонгосон асуултандаа заавал хариулах шаардлагатай ба бусад багийн асуултад хариулж болно." },
  { icon: "✅", title: "Зөв хариулт", body: "Зөв хариулсан баг сонгосон оноогоо бүтнээр авна." },
  { icon: "❌", title: "Буруу хариулт", body: "Буруу хариулбал сонгосон онооны тал хасагдана." },
  { icon: "👥", title: "Бусад багийн боломж", body: "Асуулт нээлттэй хэвээр үлдэж, бусад баг хариулах боломжтой." },
  { icon: "🏁", title: "Эцсийн үе", body: "Үндсэн асуултууд дууссаны дараа эцсийн 2 үе эхэлнэ." },
  { icon: "🏆", title: "Ялагч", body: "Хамгийн өндөр оноотой баг тоглоомын ялагч болно." },
];

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(3,8,14,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="retro-frame rounded-2xl w-full max-w-lg overflow-hidden" style={{ background: "var(--bg-card)" }}>
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--sp-blue)" }}>
          <div className="flex items-center gap-3">
            <Image src="/astro-nots.png" width={24} height={24} alt="" />
            <h2 className="retro-title text-xl text-[var(--gold)] tracking-wider">ТОГЛООМЫН ДҮРЭМ</h2>
          </div>
          <button onClick={onClose} className="text-[var(--teal)] hover:text-[var(--cream)] text-2xl leading-none transition-colors">×</button>
        </div>

        {/* rules list */}
        <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: "70vh" }}>
          {RULES.map((r, i) => (
            <div key={i} className="flex gap-4 rounded-xl px-4 py-3"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(95,195,195,0.25)" }}>
              <span className="text-2xl shrink-0 mt-0.5">{r.icon}</span>
              <div>
                <p className="retro-title title-mixed text-base text-[var(--gold)] tracking-wide mb-1">{r.title}</p>
                <p style={{ fontFamily: "var(--font-body)", color: "rgba(243,233,210,0.85)", fontSize: "0.95rem", lineHeight: "1.5" }}>
                  {r.body}
                </p>
              </div>
            </div>
          ))}

          <div className="mt-2 rounded-xl px-4 py-3 text-center"
            style={{ background: "linear-gradient(90deg,rgba(95,195,195,0.1),rgba(255,138,61,0.08))", border: "1px solid rgba(255,138,61,0.2)" }}>
            <p style={{ fontFamily: "var(--font-mono)", color: "rgba(243,233,210,0.5)", fontSize: "0.7rem", letterSpacing: "0.15em" }}>
              ASTRO JEOPARDY — ШИЛДЭГ БАГИЙГ ТОДРУУЛЪЯ!
            </p>
          </div>
        </div>

        <div className="px-6 pb-5">
          <button onClick={onClose} className="btn-gold w-full py-3 rounded text-xl">
            ОЙЛГОСОН!
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col">
      <div className="orbit-ring" />
      <ShootingStars />
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 lg:gap-6 p-4 lg:p-6 overflow-y-auto lg:overflow-hidden">
        {/* ── HERO ── */}
        <section className="relative flex flex-col items-center justify-center text-center gap-4 lg:gap-6 py-4">
          <div className="relative floaty drop-in">
            <div className="absolute inset-0 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(95,195,195,0.35), transparent 65%)" }} />
            <div className="logo-orbit" />
            <div className="logo-orbit reverse" />
            <Image src="/astro-nots.png" width={520} height={520} priority alt="Astro-Nots"
              className="relative w-[44vw] max-w-[220px] lg:max-w-none lg:w-[min(30vw,52vh)] h-auto drop-shadow-[0_20px_60px_rgba(0,0,0,0.6)]" />
          </div>
          <div className="flex flex-col items-center gap-3 rise-in" style={{ animationDelay: "150ms" }}>
            <h1 className="retro-title text-gradient text-4xl sm:text-5xl xl:text-7xl font-black">JEOPARDY</h1>
            <div className="star-divider w-56 sm:w-80 max-w-full" />
            <p className="mono text-[0.7rem] sm:text-xs" style={{ color: "rgba(243,233,210,0.6)" }}>
              THE ULTIMATE QUIZ CHALLENGE
            </p>
          </div>
          <button onClick={() => setShowRules(true)}
            className="glass rounded-full px-5 py-2 mono text-[0.7rem] transition-all hover:border-[var(--teal)]"
            style={{ color: "var(--cream)" }}>
            📋 ДҮРЭМТЭЙ ТАНИЛЦАХ
          </button>
        </section>

        {/* ── QUIZ EXPLORER (folders + games) ── */}
        {/* useSearchParams (?f=folder) needs a Suspense boundary */}
        <Suspense fallback={<section className="glass rounded-3xl min-h-0" />}>
          <QuizExplorer />
        </Suspense>
      </div>
    </div>
  );
}
