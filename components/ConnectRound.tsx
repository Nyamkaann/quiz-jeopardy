"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ConnectClue, ConnectData, Player } from "@/types";
import {
  CONNECT_PENALTY,
  CONNECT_POINTS,
  playableClues,
} from "@/lib/connect";
import { AnimatedScore } from "@/components/Fx";
import HostAnswer from "@/components/HostAnswer";
import { sfx } from "@/lib/timerAudio";

export interface ConnectState {
  qId: string | null; // which board tile this progress belongs to
  revealed: number; // how many clues are visible (1..5)
  buzzed: string | null; // selected player
  wrong: string[]; // players who already guessed wrong
  showAnswer: boolean;
  winner: string | null;
  winPoints?: number;
}

export const initialConnectState: ConnectState = {
  qId: null,
  revealed: 1,
  buzzed: null,
  wrong: [],
  showAnswer: false,
  winner: null,
};

interface Props {
  title: string; // e.g. "CONNECT · #2"
  data: ConnectData;
  players: Player[];
  state: ConnectState;
  setState: (s: ConnectState) => void;
  onScore: (playerId: string, delta: number) => void;
  onDone: () => void; // puzzle finished → mark the tile answered
  onExit: () => void; // back to the board
  onFx?: (kind: "good" | "bad") => void; // confetti / flash in the parent
  extra?: React.ReactNode; // e.g. the host "± ОНОО" button
  hostAnswerAuto?: boolean; // audience screen connected → show the answer to the host
}

export default function ConnectRound({
  title,
  data,
  players,
  state,
  setState,
  onScore,
  onDone,
  onExit,
  onFx,
  extra,
  hostAnswerAuto = false,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const clues = playableClues(data);
  const total = clues.length;
  const points = CONNECT_POINTS[Math.min(Math.max(state.revealed, 1), CONNECT_POINTS.length) - 1];
  const done = state.showAnswer;

  function next() {
    if (done || state.revealed >= total) return;
    sfx.next();
    setState({ ...state, revealed: state.revealed + 1, buzzed: null });
  }

  function correct() {
    if (!state.buzzed) return;
    onScore(state.buzzed, points);
    onFx?.("good");
    onDone();
    setState({ ...state, winner: state.buzzed, winPoints: points, buzzed: null, showAnswer: true, revealed: total });
  }

  function wrong() {
    if (!state.buzzed) return;
    onScore(state.buzzed, -CONNECT_PENALTY);
    onFx?.("bad");
    gridRef.current?.animate(
      [
        { transform: "translateX(0)" }, { transform: "translateX(-14px)" }, { transform: "translateX(12px)" },
        { transform: "translateX(-8px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" },
      ],
      { duration: 500, easing: "ease-out" },
    );
    setState({ ...state, wrong: [...state.wrong, state.buzzed], buzzed: null });
  }

  function reveal() {
    sfx.reveal();
    onDone();
    setState({ ...state, showAnswer: true, buzzed: null, revealed: total });
  }

  /* → arrow / N key = next clue */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "n") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const eligible = players.filter((p) => !state.wrong.includes(p.id));
  const winner = players.find((p) => p.id === state.winner);
  const q = data;

  if (total === 0) {
    return (
      <div className="h-dvh w-full flex flex-col overflow-hidden">
        <TopBar onExit={onExit} title={title} />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <p className="retro-title text-2xl text-[var(--teal)]">ЭНЭ CONNECT ХООСОН БАЙНА</p>
          <button onClick={() => { onDone(); onExit(); }} className="btn-blue px-6 py-3 rounded-xl">← САМБАР РУУ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden">
      <div className="orbit-ring" />
      <TopBar onExit={onExit} title={title}>
        {extra}
        {!done && (
          <div className="flex items-center gap-3">
            <span className="mono text-[0.6rem] hidden sm:inline" style={{ color: "rgba(243,233,210,0.5)" }}>
              ОДООГИЙН ОНОО
            </span>
            <span key={points} className="flip-in retro-title text-2xl sm:text-4xl font-black text-gradient">
              {points}
            </span>
          </div>
        )}
      </TopBar>

      {/* clue grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 flex flex-col gap-3">
        <div className="hidden md:block">
          <PointsLadder current={done ? -1 : state.revealed - 1} max={total} compact />
        </div>
        {/* on md+ one column per clue, so all 5 sit side by side */}
        <style>{`@media (min-width: 768px){.connect-grid{grid-template-columns:repeat(${Math.max(total, 1)},minmax(0,1fr)) !important}}`}</style>
        <div ref={gridRef} className="connect-grid flex-1 min-h-0 grid gap-3 grid-cols-1 sm:grid-cols-2">
          {clues.map((c, i) => (
            <ClueCard
              key={c.id}
              clue={c}
              index={i}
              points={CONNECT_POINTS[i]}
              visible={i < state.revealed}
              latest={!done && i === state.revealed - 1}
              showNote={done}
            />
          ))}
        </div>

        {done && (
          <div className="flip-in glass rounded-3xl px-6 py-5 flex flex-col sm:flex-row items-center justify-center gap-5 text-center shrink-0"
            style={{ borderColor: "rgba(255,165,82,0.5)" }}>
            {q.answerImage && (
              <div className="relative w-28 h-20 rounded-xl overflow-hidden shrink-0" style={{ border: "1px solid var(--glass-border-hi)" }}>
                <Image src={q.answerImage} alt="answer" fill className="object-cover" unoptimized />
              </div>
            )}
            <div>
              <p className="mono text-[0.65rem] mb-1" style={{ color: "var(--teal)" }}>ХОЛБООС</p>
              <p className="title-mixed text-gradient" style={{ fontSize: "clamp(1.6rem, 4vw, 3.2rem)", lineHeight: 1.15 }}>
                {q.answer || "—"}
              </p>
              {q.explanation && (
                <p className="mt-2 text-[var(--cream)] max-w-4xl" style={{ fontSize: "clamp(0.9rem, 1.6vw, 1.3rem)", lineHeight: 1.4, opacity: 0.85 }}>
                  <span className="mono" style={{ color: "var(--teal)", marginRight: "0.5em" }}>ЯАГААД?</span>
                  {q.explanation}
                </p>
              )}
              {winner && (
                <p className="mono text-xs mt-2" style={{ color: "var(--gold)" }}>
                  🏆 {winner.name} +{state.winPoints ?? 0}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* controls */}
      <div className="glass-bar shrink-0 px-3 sm:px-6 py-3 space-y-3" style={{ borderTop: "1px solid var(--glass-border)", borderBottom: "none" }}>
        {!done && (
          <HostAnswer answer={data.answer} images={data.answerImage ? [data.answerImage] : []} auto={hostAnswerAuto} />
        )}
        {done ? (
          <div className="flex justify-center gap-3">
            <button onClick={onExit} className="btn-gold px-8 py-3 rounded-xl text-base">
              ← САМБАР РУУ
            </button>
          </div>
        ) : (
          <>
            {state.wrong.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {state.wrong.map((id) => {
                  const p = players.find((pl) => pl.id === id);
                  if (!p) return null;
                  return (
                    <span key={id} className="px-3 py-1 rounded-lg text-sm title-mixed"
                      style={{ background: "rgba(242,72,63,0.12)", border: "1px solid rgba(242,72,63,0.45)", color: "#ff8a83" }}>
                      {p.name} ✗ −{CONNECT_PENALTY}
                    </span>
                  );
                })}
              </div>
            )}

            {eligible.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {eligible.map((p) => {
                  const on = state.buzzed === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (!on) sfx.buzz();
                        setState({ ...state, buzzed: on ? null : p.id });
                      }}
                      className="px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontWeight: 700,
                        background: on ? "var(--gold)" : "rgba(95,195,195,0.12)",
                        color: on ? "#1a0b04" : "var(--cream)",
                        border: on ? "1px solid rgba(255,214,170,0.8)" : "1px solid rgba(95,195,195,0.4)",
                        boxShadow: on ? "0 0 20px rgba(255,138,61,0.45)" : "none",
                      }}
                    >
                      {p.name}
                      <AnimatedScore id={`c-${p.id}`} value={p.score} className="mono text-[0.65rem] opacity-70" />
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 sm:gap-3 justify-center flex-wrap">
              {state.buzzed && (
                <>
                  <button onClick={correct} className="px-6 py-3 rounded-xl text-base"
                    style={{
                      fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.06em",
                      background: "linear-gradient(135deg,rgba(80,220,150,0.35),rgba(40,160,110,0.25))",
                      border: "1px solid rgba(120,240,180,0.6)", color: "#eafff3",
                    }}>
                    ЗӨВ +{points}
                  </button>
                  <button onClick={wrong} className="px-6 py-3 rounded-xl text-base"
                    style={{
                      fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "0.06em",
                      background: "linear-gradient(135deg,rgba(242,72,63,0.35),rgba(180,40,40,0.25))",
                      border: "1px solid rgba(255,130,120,0.6)", color: "#fff0ee",
                    }}>
                    БУРУУ −{CONNECT_PENALTY}
                  </button>
                </>
              )}
              <button
                onClick={next}
                disabled={state.revealed >= total}
                className="btn-gold px-8 py-3 rounded-xl text-base disabled:opacity-30"
              >
                NEXT → {state.revealed < total ? CONNECT_POINTS[state.revealed] : ""}
              </button>
              <button onClick={reveal} className="btn-blue px-6 py-3 rounded-xl text-base">
                ХАРИУЛТ
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── pieces ── */

function TopBar({ title, onExit, children }: { title: string; onExit: () => void; children?: React.ReactNode }) {
  return (
    <div className="glass-bar flex items-center gap-3 px-3 sm:px-5 py-2 shrink-0">
      <button onClick={onExit} className="flex items-center gap-2 shrink-0 transition-opacity hover:opacity-80" title="Самбар руу">
        <Image src="/astro-nots.png" width={40} height={40} alt="" className="w-9 h-9 sm:w-10 sm:h-10" />
        <span className="mono text-[0.6rem] hidden sm:inline" style={{ color: "rgba(243,233,210,0.6)" }}>← BOARD</span>
      </button>
      <h1 className="retro-title text-sm sm:text-xl text-[var(--cream)] flex-1 min-w-0 truncate text-center">{title}</h1>
      <div className="shrink-0 min-w-[60px] flex items-center justify-end gap-3">{children}</div>
    </div>
  );
}

export function PointsLadder({ current, max = CONNECT_POINTS.length, compact }: { current: number; max?: number; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-2 ${compact ? "" : "mt-6"}`}>
      {CONNECT_POINTS.slice(0, max).map((pt, i) => {
        const active = i === current;
        const past = current >= 0 && i < current;
        return (
          <div key={pt} className="flex items-center gap-2">
            <span
              className={`retro-title rounded-lg px-3 py-1 text-sm sm:text-base transition-all ${active ? "pill-pulse" : ""}`}
              style={{
                color: active ? "#1a0b04" : past ? "rgba(243,233,210,0.25)" : "var(--gold)",
                background: active ? "linear-gradient(135deg,#ffb066,var(--orange))" : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? "rgba(255,214,170,0.7)" : "var(--glass-border)"}`,
                textDecoration: past ? "line-through" : "none",
                boxShadow: active ? "0 0 20px rgba(255,138,61,0.35)" : "none",
              }}
            >
              {pt}
            </span>
            {i < max - 1 && <span style={{ color: "rgba(243,233,210,0.25)" }}>›</span>}
          </div>
        );
      })}
    </div>
  );
}

export function ClueCard({
  clue,
  index,
  points,
  visible,
  latest,
  silent,
  showNote,
}: {
  clue: ConnectClue;
  index: number;
  points: number;
  visible: boolean;
  latest: boolean;
  silent?: boolean; // audience screen: show an icon instead of a second audio player
  showNote?: boolean; // round over: reveal how this clue links to the answer
}) {
  if (!visible) {
    return (
      <div className="board-tile rounded-2xl flex flex-col items-center justify-center gap-2 min-h-32" style={{ opacity: 0.55 }}>
        <span className="retro-title text-5xl" style={{ color: "rgba(243,233,210,0.18)" }}>?</span>
        <span className="mono text-[0.6rem]" style={{ color: "rgba(243,233,210,0.35)" }}>#{index + 1} · {points}</span>
      </div>
    );
  }

  const hasImage = !!clue.image;
  const hasText = !!clue.text?.trim();

  return (
    <div
      className="card-flip relative rounded-2xl overflow-hidden flex flex-col min-h-32"
      style={{
        background: "linear-gradient(160deg, rgba(255,255,255,0.09), rgba(255,255,255,0.025))",
        border: `1px solid ${latest ? "rgba(255,165,82,0.7)" : "var(--glass-border-hi)"}`,
        backdropFilter: "var(--blur)",
        WebkitBackdropFilter: "var(--blur)",
        boxShadow: latest ? "0 0 0 1px rgba(255,165,82,0.25), 0 12px 48px rgba(255,138,61,0.22)" : "0 10px 40px rgba(0,0,0,0.3)",
      }}
    >
      <span
        className="absolute top-2 left-2 z-10 retro-title text-xs rounded-md px-2 py-0.5"
        style={{ background: "rgba(5,13,22,0.7)", border: "1px solid var(--glass-border)", color: latest ? "var(--gold)" : "var(--cream)" }}
      >
        {index + 1}
      </span>

      {hasImage && (
        <div className="relative flex-1 min-h-40">
          <Image src={clue.image!} alt={`clue-${index + 1}`} fill className="object-contain p-2" unoptimized />
        </div>
      )}

      {hasText && (
        <div className={`${hasImage ? "shrink-0 px-3 pb-3 pt-1" : "flex-1 px-4 py-8"} flex items-center justify-center text-center`}>
          <p
            className="title-mixed"
            style={{
              color: "var(--cream)",
              fontSize: hasImage ? "clamp(0.95rem, 1.4vw, 1.4rem)" : "clamp(1.3rem, 2.3vw, 2.6rem)",
              lineHeight: 1.2,
              wordBreak: "break-word",
            }}
          >
            {clue.text}
          </p>
        </div>
      )}

      {clue.audio && (
        <div className={`${!hasImage && !hasText ? "flex-1" : "shrink-0"} flex flex-col items-center justify-center gap-2 px-3 pb-3`}>
          {!hasImage && !hasText && <span className="text-5xl">🔊</span>}
          {silent ? (
            (hasImage || hasText) && <span className="text-2xl">🔊</span>
          ) : (
            <audio key={clue.audio} controls autoPlay={latest} src={clue.audio} className="w-full" style={{ height: 34 }} />
          )}
        </div>
      )}

      {showNote && clue.note && (
        <div className="flip-in shrink-0 px-3 py-2 text-center" style={{ background: "rgba(95,195,195,0.12)", borderTop: "1px solid rgba(95,195,195,0.35)" }}>
          <p style={{ color: "var(--teal)", fontSize: "clamp(0.8rem, 1.1vw, 1.15rem)", lineHeight: 1.3 }}>{clue.note}</p>
        </div>
      )}
    </div>
  );
}
