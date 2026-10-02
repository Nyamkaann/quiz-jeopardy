"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const LEN = 4;

/**
 * Asks for the play code before a game can start.
 * The code is checked on the server (PLAY_CODE in .env.local) and remembered
 * in an httpOnly cookie for 12 h, so it's asked once per browser session.
 */
export default function PlayCodeGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "locked" | "open">("checking");
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/play", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setState(d.authed ? "open" : "locked"))
      .catch(() => setState("locked"));
  }, []);

  async function submit(code: string) {
    setBusy(true);
    const res = await fetch("/api/auth/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setBusy(false);
    if (res.ok) {
      setState("open");
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(res.status === 500 ? body.error : "Код буруу байна");
    setDigits("");
    boxRef.current?.animate(
      [
        { transform: "translateX(0)" }, { transform: "translateX(-12px)" }, { transform: "translateX(10px)" },
        { transform: "translateX(-6px)" }, { transform: "translateX(0)" },
      ],
      { duration: 420, easing: "ease-out" },
    );
  }

  function press(d: string) {
    if (busy) return;
    setError(null);
    const next = (digits + d).slice(0, LEN);
    setDigits(next);
    if (next.length === LEN) submit(next);
  }

  function back() {
    if (busy) return;
    setDigits((v) => v.slice(0, -1));
  }

  /* physical keyboard: digits, Backspace */
  useEffect(() => {
    if (state !== "locked") return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (state === "open") return <>{children}</>;
  if (state === "checking") return <div className="min-h-dvh" />;

  return (
    <div className="h-dvh w-full flex items-center justify-center p-4">
      <div className="orbit-ring" />
      <div ref={boxRef} className="retro-frame zoom-in rounded-3xl w-full max-w-sm px-6 py-7 flex flex-col items-center gap-5">
        <div className="relative">
          <div className="logo-orbit" />
          <Image src="/astro-nots.png" width={84} height={84} alt="" className="relative" />
        </div>
        <div className="text-center">
          <p className="mono text-[0.6rem]" style={{ color: "var(--teal)" }}>ТОГЛООМ ЭХЛҮҮЛЭХ</p>
          <h1 className="retro-title title-mixed text-2xl text-[var(--cream)] mt-1">Кодоо оруулна уу</h1>
        </div>

        {/* code boxes */}
        <div className="flex gap-3">
          {Array.from({ length: LEN }).map((_, i) => {
            const filled = i < digits.length;
            const active = i === digits.length && !busy;
            return (
              <div
                key={i}
                className="w-14 h-16 rounded-2xl flex items-center justify-center retro-title text-3xl transition-all"
                style={{
                  background: filled ? "linear-gradient(160deg,rgba(255,138,61,0.22),rgba(255,255,255,0.04))" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${error ? "rgba(242,72,63,0.7)" : active ? "var(--gold)" : "var(--glass-border-hi)"}`,
                  boxShadow: active ? "0 0 18px rgba(255,138,61,0.35)" : "none",
                  color: "var(--gold)",
                }}
              >
                {filled ? "●" : ""}
              </div>
            );
          })}
        </div>

        <p className="mono text-[0.65rem] h-4" style={{ color: error ? "#ff8a83" : "rgba(243,233,210,0.4)" }}>
          {busy ? "ШАЛГАЖ БАЙНА…" : error ?? "4 ОРОНТОЙ КОД"}
        </p>

        {/* keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-full">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Key key={d} onClick={() => press(d)}>{d}</Key>
          ))}
          <Link href="/" className="rounded-2xl h-14 flex items-center justify-center mono text-[0.6rem] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
            style={{ color: "rgba(243,233,210,0.55)", textDecoration: "none" }}>
            ← БУЦАХ
          </Link>
          <Key onClick={() => press("0")}>0</Key>
          <button onClick={back} aria-label="Устгах"
            className="rounded-2xl h-14 flex items-center justify-center text-xl transition-colors hover:bg-[rgba(255,255,255,0.06)]"
            style={{ color: "var(--cream)" }}>
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}

function Key({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl h-14 retro-title text-2xl transition-all active:scale-95 hover:border-[rgba(255,165,82,0.6)]"
      style={{
        color: "var(--cream)",
        background: "linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))",
        border: "1px solid var(--glass-border)",
      }}
    >
      {children}
    </button>
  );
}
