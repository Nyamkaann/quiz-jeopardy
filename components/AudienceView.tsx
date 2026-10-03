"use client";

import Image from "next/image";
import { DisplaySnapshot } from "@/lib/display";
import { getAnswerImages, getClueImages } from "@/lib/media";
import { CONNECT_PENALTY, CONNECT_POINTS, isConnectCategory, playableClues } from "@/lib/connect";
import { ClueCard, PointsLadder } from "@/components/ConnectRound";
import { AnimatedScore, Confetti, ScreenFlash, ShootingStars } from "@/components/Fx";
import { Player } from "@/types";

/**
 * Read-only "projector" view. Mirrors the host's state but never shows
 * host controls, the answer before it is revealed, or Final wagers.
 * Audio is NOT played here — it already plays from the host window.
 */
export default function AudienceView({ s, fx }: { s: DisplaySnapshot; fx: DisplaySnapshot["fx"] }) {
  const { players } = s;
  // `fx` is only passed for fresh events, so reconnecting doesn't replay old confetti
  const freshFx = fx;

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden select-none cursor-none">
      <div className="orbit-ring" />
      <ShootingStars />
      {freshFx && (
        <>
          {freshFx.kind === "good" && <Confetti key={`c${freshFx.k}`} />}
          <ScreenFlash key={`f${freshFx.k}`} kind={freshFx.kind} />
        </>
      )}

      {s.phase === "setup" && <Setup s={s} />}
      {s.phase === "board" && <Board s={s} />}
      {s.phase === "clue" && s.activeQ && <Clue s={s} />}
      {s.phase === "connect" && s.activeQ && <Connect s={s} />}
      {s.phase === "final" && <Final s={s} />}

      {/* score dock on every in-game screen */}
      {(s.phase === "board" || s.phase === "clue" || s.phase === "connect" || (s.phase === "final" && s.finalPhase !== "results")) &&
        players.length > 0 && <ScoreDock players={players} buzzed={s.buzzed} wrong={s.wrongPlayers} />}

    </div>
  );
}

/* ───────────── pieces ───────────── */

function Logo({ size = 380 }: { size?: number }) {
  return (
    <div className="relative floaty drop-in">
      <div className="absolute inset-0 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(95,195,195,0.35), transparent 65%)" }} />
      <div className="logo-orbit" />
      <div className="logo-orbit reverse" />
      <Image src="/astro-nots.png" width={size} height={size} alt="" priority
        className="relative h-auto drop-shadow-[0_20px_60px_rgba(0,0,0,0.6)]" style={{ width: `min(${size}px, 42vh)` }} />
    </div>
  );
}

function ScoreDock({ players, buzzed, wrong }: { players: Player[]; buzzed: string | null; wrong: string[] }) {
  const top = Math.max(...players.map((p) => p.score));
  return (
    <div className="glass-bar shrink-0 px-3 py-2.5" style={{ borderTop: "1px solid var(--glass-border)", borderBottom: "none" }}>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
        {players.map((p) => {
          const on = buzzed === p.id;
          const out = wrong.includes(p.id);
          const leader = p.score === top && p.score > 0;
          return (
            <div key={p.id} className="score-chip rounded-2xl px-4 py-2 flex items-center justify-between gap-3 min-w-0 transition-all"
              style={{
                borderColor: on ? "rgba(255,165,82,0.9)" : undefined,
                boxShadow: on ? "0 0 30px rgba(255,138,61,0.45)" : undefined,
                opacity: out ? 0.45 : 1,
              }}>
              <span className="truncate title-mixed" style={{ color: "var(--cream)", fontSize: "clamp(0.9rem, 1.6vw, 1.6rem)" }}>
                {leader ? "🏆 " : ""}{p.name}
              </span>
              <AnimatedScore id={`aud-${p.id}`} value={p.score} className="retro-title shrink-0"
                style={{ fontSize: "clamp(1.3rem, 2.6vw, 2.8rem)", color: p.score < 0 ? "#ff6a62" : "var(--gold)" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Setup({ s }: { s: DisplaySnapshot }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-6">
      <Logo />
      <h1 className="retro-title title-mixed text-gradient" style={{ fontSize: "clamp(2.5rem, 6vw, 6rem)" }}>{s.game.title}</h1>
      <div className="star-divider w-[min(480px,70vw)]" />
      <p className="mono text-sm" style={{ color: "rgba(243,233,210,0.6)" }}>ТОГЛООМ УДАХГҮЙ ЭХЭЛНЭ</p>
      {s.players.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          {s.players.map((p, i) => (
            <span key={p.id} className="glass rise-in rounded-2xl px-5 py-2.5 title-mixed text-xl text-[var(--cream)]" style={{ animationDelay: `${i * 80}ms` }}>
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Board({ s }: { s: DisplaySnapshot }) {
  const cats = s.game.categories;
  const rows = Math.max(...cats.map((c) => c.questions.length), 1);
  return (
    <>
      <div className="glass-bar flex items-center gap-4 px-5 py-2.5 shrink-0">
        <Image src="/astro-nots.png" width={44} height={44} alt="" />
        <h1 className="retro-title title-mixed text-[var(--cream)] truncate" style={{ fontSize: "clamp(1rem, 2vw, 2rem)" }}>{s.game.title}</h1>
      </div>
      <div className="flex-1 min-h-0 p-3">
        <div className="grid gap-2.5 h-full"
          style={{ gridTemplateColumns: `repeat(${cats.length}, minmax(0, 1fr))`, gridTemplateRows: `minmax(60px, auto) repeat(${rows}, minmax(0, 1fr))` }}>
          {cats.map((cat, ci) => (
            <div key={cat.id} className="cat-header drop-in rounded-xl flex items-center justify-center gap-1.5 px-2 py-3 text-center"
              style={{
                animationDelay: `${ci * 60}ms`,
                fontSize: "clamp(0.7rem, 1.3vw, 1.4rem)",
                ...(isConnectCategory(cat) && { borderBottomColor: "var(--teal)", background: "linear-gradient(180deg, rgba(95,195,195,0.22), rgba(255,255,255,0.03))" }),
              }}>
              {isConnectCategory(cat) && <span style={{ color: "var(--teal)" }}>✦</span>}
              {cat.name.toUpperCase()}
            </div>
          ))}
          {Array.from({ length: rows }).map((_, ri) =>
            cats.map((cat) => {
              const q = [...cat.questions].sort((a, b) => a.value - b.value)[ri];
              if (!q) return <div key={`${cat.id}-${ri}`} />;
              const live = s.activeQ?.q.id === q.id;
              return (
                <div key={q.id} className="board-tile rounded-xl flex items-center justify-center"
                  style={q.answered ? { background: "rgba(255,255,255,0.015)", borderColor: "rgba(243,233,210,0.05)", boxShadow: "none" } : live ? { borderColor: "var(--gold)" } : undefined}>
                  {!q.answered && (isConnectCategory(cat) ? (
                    <span className="flex flex-col items-center leading-none gap-1">
                      <span className="retro-title font-black" style={{ fontSize: "clamp(1.4rem, min(3.2vw, 6vh), 4rem)", color: "var(--teal)" }}>✦{ri + 1}</span>
                      <span className="mono" style={{ fontSize: "clamp(0.55rem, 0.9vw, 0.9rem)", color: "rgba(243,233,210,0.55)" }}>CONNECT</span>
                    </span>
                  ) : (
                    <span className="retro-title font-black" style={{ fontSize: "clamp(1.4rem, min(3.8vw, 7vh), 4.5rem)", color: "var(--gold)" }}>{q.value}</span>
                  ))}
                </div>
              );
            }),
          )}
        </div>
      </div>
    </>
  );
}

function TimerRing({ left, total, state }: { left: number; total: number; state: DisplaySnapshot["timerState"] }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const color = left <= 10 ? "#ff4422" : left <= 20 ? "#ffaa00" : "var(--teal)";
  return (
    <div className={`relative flex items-center justify-center ${state === "running" && left > 0 && left <= 10 ? "urgent" : ""}`}
      style={{ width: 76, height: 76, opacity: state === "idle" ? 0.45 : 1 }}>
      <svg width="76" height="76" viewBox="0 0 64 64" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(95,195,195,0.2)" strokeWidth="4" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - left / Math.max(total, 1))}
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }} />
      </svg>
      <span className="retro-title text-3xl z-10" style={{ color: left <= 10 ? "#ff4422" : "var(--gold)" }}>{left}</span>
    </div>
  );
}

function Clue({ s }: { s: DisplaySnapshot }) {
  const { q, catId } = s.activeQ!;
  const cat = s.game.categories.find((c) => c.id === catId);
  const buzzed = s.players.find((p) => p.id === s.buzzed);
  const clueImgs = getClueImages(q);
  const ansImgs = getAnswerImages(q);
  const big = { fontSize: "clamp(2rem, min(4.6vw, 8vh), 5.5rem)", lineHeight: 1.2 };

  return (
    <>
      <div className="glass-bar drop-in grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-3 shrink-0">
        <span className="retro-title text-[var(--sp-blue-glow)] truncate" style={{ fontSize: "clamp(1rem, 2vw, 2rem)" }}>{cat?.name.toUpperCase()}</span>
        <TimerRing left={s.timeLeft} total={s.timerTotal} state={s.timerState} />
        <span className="retro-title text-gradient text-right" style={{ fontSize: "clamp(1.5rem, 3vw, 3.2rem)" }}>{q.value}</span>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8">
        <div key={q.id} className="glass zoom-in rounded-3xl w-full max-w-7xl h-full flex flex-col items-center justify-center gap-6 px-8 py-8 text-center overflow-hidden">
          {!s.showAnswer ? (
            <>
              {q.clue && <p className="flip-in title-mixed text-[var(--cream)]" style={big}>{q.clue}</p>}
              <Pics images={clueImgs} />
              {q.clueAudio && !q.clue && clueImgs.length === 0 && <span className="text-8xl">🔊</span>}
            </>
          ) : (
            <>
              <p className="mono text-sm" style={{ color: "var(--teal)" }}>ХАРИУЛТ</p>
              {q.answer && <p className="flip-in title-mixed text-gradient" style={big}>{q.answer}</p>}
              <Pics images={ansImgs} />
              {q.explanation && (
                <p className="flip-in max-w-5xl text-[var(--cream)]" style={{ fontSize: "clamp(1.1rem, min(2.4vw, 4vh), 2.4rem)", lineHeight: 1.35, opacity: 0.85 }}>
                  <span className="mono" style={{ color: "var(--teal)", marginRight: "0.5em" }}>ЯАГААД?</span>
                  {q.explanation}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {(buzzed || s.wrongPlayers.length > 0) && (
        <div className="shrink-0 flex flex-wrap justify-center gap-3 pb-3">
          {buzzed && !s.showAnswer && (
            <span className="rise-in rounded-2xl px-6 py-2.5 title-mixed text-2xl pill-pulse"
              style={{ background: "var(--gold)", color: "#1a0b04" }}>🔔 {buzzed.name}</span>
          )}
          {s.wrongPlayers.map((id) => {
            const p = s.players.find((x) => x.id === id);
            return p ? (
              <span key={id} className="rounded-2xl px-4 py-2 title-mixed text-lg"
                style={{ background: "rgba(242,72,63,0.14)", border: "1px solid rgba(242,72,63,0.5)", color: "#ff8a83" }}>
                {p.name} ✗ −{Math.floor(q.value / 2)}
              </span>
            ) : null;
          })}
        </div>
      )}
    </>
  );
}

function Pics({ images }: { images: string[] }) {
  if (images.length === 0) return null;
  const single = images.length === 1;
  return (
    <div className="flip-in w-full flex gap-4 justify-center min-h-0 flex-1" style={{ maxHeight: single ? "60vh" : "48vh" }}>
      {images.map((src, i) => (
        <div key={i} className="relative flex-1 rounded-2xl overflow-hidden" style={{ maxWidth: single ? "70vw" : undefined, border: "1px solid var(--glass-border-hi)" }}>
          <Image src={src} alt="" fill className="object-contain" unoptimized />
        </div>
      ))}
    </div>
  );
}

function Connect({ s }: { s: DisplaySnapshot }) {
  const { q, catId } = s.activeQ!;
  const cat = s.game.categories.find((c) => c.id === catId);
  const row = [...(cat?.questions ?? [])].sort((a, b) => a.value - b.value).findIndex((x) => x.id === q.id);
  const data = q.connect ?? { clues: [], answer: "" };
  const clues = playableClues(data);
  const st = s.connectState.qId === q.id ? s.connectState : { ...s.connectState, revealed: 1, showAnswer: false, winner: null, wrong: [] as string[], buzzed: null };
  const done = st.showAnswer;
  const points = CONNECT_POINTS[Math.min(Math.max(st.revealed, 1), CONNECT_POINTS.length) - 1];
  const winner = s.players.find((p) => p.id === st.winner);
  const buzzed = s.players.find((p) => p.id === st.buzzed);

  return (
    <>
      <div className="glass-bar drop-in flex items-center justify-between gap-4 px-6 py-3 shrink-0">
        <span className="retro-title text-[var(--cream)] truncate" style={{ fontSize: "clamp(1rem, 2vw, 2rem)" }}>
          {(cat?.name ?? "CONNECT").toUpperCase()} · ✦ #{row + 1}
        </span>
        {!done && <span key={points} className="flip-in retro-title text-gradient font-black" style={{ fontSize: "clamp(2rem, 4vw, 4.5rem)" }}>{points}</span>}
      </div>
      <div className="flex-1 min-h-0 p-4 flex flex-col gap-3">
        <PointsLadder current={done ? -1 : st.revealed - 1} max={clues.length} compact />
        <div className="flex-1 min-h-0 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(clues.length, 1)}, minmax(0, 1fr))` }}>
          {clues.map((c, i) => (
            <ClueCard key={c.id} clue={c} index={i} points={CONNECT_POINTS[i]} visible={i < st.revealed} latest={!done && i === st.revealed - 1} silent showNote={done} />
          ))}
        </div>
        {done && (
          <div className="flip-in glass rounded-3xl px-6 py-5 flex items-center justify-center gap-6 text-center shrink-0" style={{ borderColor: "rgba(255,165,82,0.5)" }}>
            {data.answerImage && (
              <div className="relative w-36 h-24 rounded-xl overflow-hidden shrink-0" style={{ border: "1px solid var(--glass-border-hi)" }}>
                <Image src={data.answerImage} alt="" fill className="object-cover" unoptimized />
              </div>
            )}
            <div>
              <p className="mono text-xs mb-1" style={{ color: "var(--teal)" }}>ХОЛБООС</p>
              <p className="title-mixed text-gradient" style={{ fontSize: "clamp(2rem, 4.5vw, 4.5rem)", lineHeight: 1.1 }}>{data.answer || "—"}</p>
              {data.explanation && (
                <p className="mt-2 text-[var(--cream)]" style={{ fontSize: "clamp(1rem, 1.8vw, 1.8rem)", lineHeight: 1.35, opacity: 0.85 }}>
                  <span className="mono" style={{ color: "var(--teal)", marginRight: "0.5em" }}>ЯАГААД?</span>
                  {data.explanation}
                </p>
              )}
              {winner && <p className="mono text-base mt-2" style={{ color: "var(--gold)" }}>🏆 {winner.name} +{st.winPoints ?? 0}</p>}
            </div>
          </div>
        )}
        {!done && (buzzed || st.wrong.length > 0) && (
          <div className="shrink-0 flex flex-wrap justify-center gap-3">
            {buzzed && <span className="rounded-2xl px-6 py-2 title-mixed text-2xl pill-pulse" style={{ background: "var(--gold)", color: "#1a0b04" }}>🔔 {buzzed.name}</span>}
            {st.wrong.map((id) => {
              const p = s.players.find((x) => x.id === id);
              return p ? (
                <span key={id} className="rounded-2xl px-4 py-2 title-mixed text-lg" style={{ background: "rgba(242,72,63,0.14)", border: "1px solid rgba(242,72,63,0.5)", color: "#ff8a83" }}>
                  {p.name} ✗ −{CONNECT_PENALTY}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Final({ s }: { s: DisplaySnapshot }) {
  if (s.finalPhase === "results") {
    const sorted = [...s.players].sort((a, b) => b.score - a.score);
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        <Confetti count={140} />
        <Logo size={200} />
        <h1 className="retro-title drop-in text-gradient" style={{ fontSize: "clamp(2.5rem, 6vw, 6rem)" }}>FINAL SCORES</h1>
        <div className="w-full max-w-3xl space-y-3">
          {sorted.map((p, i) => (
            <div key={p.id} className={`rise-in flex items-center gap-5 rounded-2xl px-8 py-4 glass ${i === 0 ? "winner-glow" : ""}`}
              style={{ animationDelay: i === 0 ? `${(sorted.length - 1) * 0.4 + 0.3}s, ${(sorted.length - 1) * 0.4 + 0.8}s` : `${(sorted.length - 1 - i) * 0.4}s` }}>
              <span className="retro-title text-4xl w-12 text-center" style={{ color: i === 0 ? "var(--gold)" : "rgba(243,233,210,0.5)" }}>{i + 1}</span>
              <span className="flex-1 title-mixed text-3xl text-[var(--cream)] truncate">{p.name}</span>
              <span className="retro-title text-4xl" style={{ color: p.score < 0 ? "#ff6a62" : "var(--gold)" }}>{p.score}</span>
              {i === 0 && <span className="text-3xl">🏆</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center px-8">
      <p className="retro-title text-[var(--teal)]" style={{ fontSize: "clamp(1.2rem, 2.4vw, 2.4rem)" }}>FINAL JEOPARDY!</p>
      {s.finalPhase === "wager" && (
        <>
          <Logo size={260} />
          <p className="title-mixed text-[var(--cream)]" style={{ fontSize: "clamp(1.5rem, 3vw, 3rem)" }}>Багууд бооцоогоо тавьж байна…</p>
        </>
      )}
      {s.finalPhase === "clue" && (
        <p key="fc" className="zoom-in title-mixed text-[var(--cream)] max-w-6xl" style={{ fontSize: "clamp(2rem, 5vw, 5.5rem)", lineHeight: 1.2 }}>{s.finalClue}</p>
      )}
      {s.finalPhase === "answer" && (
        <>
          <p className="mono text-sm" style={{ color: "var(--teal)" }}>ХАРИУЛТ</p>
          <p key="fa" className="flip-in title-mixed text-gradient max-w-6xl" style={{ fontSize: "clamp(2rem, 5vw, 5.5rem)", lineHeight: 1.2 }}>{s.finalAnswer}</p>
        </>
      )}
    </div>
  );
}
