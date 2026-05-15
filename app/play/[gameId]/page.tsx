"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { Game, Question, Player } from "@/types";

const VALUES = [100, 200, 300, 400, 500];
type Phase = "setup" | "board" | "clue" | "final";

export default function PlayPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [phase, setPhase] = useState<Phase>("setup");
  const [activeQ, setActiveQ] = useState<{ catId: string; q: Question } | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [buzzed, setBuzzed] = useState<string | null>(null);
  const [wrongPlayers, setWrongPlayers] = useState<Set<string>>(new Set());
  const [finalWagers, setFinalWagers] = useState<Record<string, string>>({});
  const [finalClue, setFinalClue] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [finalPhase, setFinalPhase] = useState<"wager" | "clue" | "answer" | "results">("wager");
  const [finalCorrect, setFinalCorrect] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/games/${gameId}`).then((r) => r.json()).then(setGame);
  }, [gameId]);

  const allAnswered = game?.categories.every((cat) => cat.questions.every((q) => q.answered)) ?? false;

  function addPlayer() {
    const name = newPlayerName.trim();
    if (!name) return;
    setPlayers((prev) => [...prev, { id: crypto.randomUUID(), name, score: 0 }]);
    setNewPlayerName("");
  }

  function removePlayer(id: string) {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  function markAnswered(catId: string, qId: string) {
    if (!game) return;
    setGame({
      ...game,
      categories: game.categories.map((c) =>
        c.id === catId
          ? { ...c, questions: c.questions.map((q) => q.id === qId ? { ...q, answered: true } : q) }
          : c
      ),
    });
  }

  function adjustScore(playerId: string, delta: number) {
    setPlayers((prev) => prev.map((p) => p.id === playerId ? { ...p, score: p.score + delta } : p));
  }

  function openQuestion(catId: string, q: Question) {
    if (q.answered) return;
    setActiveQ({ catId, q });
    setShowAnswer(false);
    setBuzzed(null);
    setActivePlayer(null);
    setWrongPlayers(new Set());
    setPhase("clue");
  }

  function markWrong() {
    if (!activeQ || !activePlayer) return;
    adjustScore(activePlayer, -Math.floor(activeQ.q.value / 2));
    setWrongPlayers((prev) => new Set(prev).add(activePlayer));
    setBuzzed(null);
    setActivePlayer(null);
    setShowAnswer(false);
  }

  function closeQuestion(correct: boolean) {
    if (!activeQ) return;
    if (activePlayer && correct) {
      adjustScore(activePlayer, activeQ.q.value);
    }
    markAnswered(activeQ.catId, activeQ.q.id);
    setActiveQ(null);
    setPhase("board");
    setBuzzed(null);
    setActivePlayer(null);
    setWrongPlayers(new Set());
  }

  function skipQuestion() {
    if (!activeQ) return;
    markAnswered(activeQ.catId, activeQ.q.id);
    setActiveQ(null);
    setPhase("board");
    setBuzzed(null);
    setActivePlayer(null);
    setWrongPlayers(new Set());
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-deep)" }}>
        <div className="flex flex-col items-center gap-4">
          <Image src="/sp-logo.svg" width={56} height={56} alt="" className="animate-pulse opacity-60" />
          <p className="retro-title text-3xl text-blue-400 tracking-widest">LOADING...</p>
        </div>
      </div>
    );
  }

  /* ─────────────────── SETUP ─────────────────── */
  if (phase === "setup") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "var(--bg-deep)" }}>
        <Image src="/sp-logo.svg" width={64} height={64} alt="StorePay" className="mb-4" />
        <h1 className="retro-title text-5xl text-[var(--gold)] mb-1">{game.title}</h1>
        <div className="star-divider w-80 mb-2" />
        <p className="retro-title text-2xl sp-glow text-white tracking-widest mb-8">JEOPARDY!</p>

        <div className="retro-panel rounded-2xl p-8 w-full max-w-md">
          <h2 className="retro-title text-xl text-[var(--sp-blue-glow)] tracking-widest mb-5 text-center">ADD PLAYERS</h2>

          <div className="flex gap-2 mb-4">
            <input
              autoFocus
              type="text"
              placeholder="Player / team name..."
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              className="flex-1 px-4 py-2 rounded text-white placeholder-blue-800 focus:outline-none"
              style={{ background: "#07102a", border: "2px solid var(--sp-blue)", fontFamily: "'Oswald',sans-serif", fontSize: "1rem" }}
            />
            <button onClick={addPlayer} className="btn-gold px-5 py-2 rounded text-base">ADD</button>
          </div>

          {players.length > 0 && (
            <div className="space-y-2 mb-6">
              {players.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2 rounded"
                  style={{ background: "#07102a", border: "1px solid rgba(0,84,255,0.4)" }}>
                  <div className="flex items-center gap-3">
                    <span className="retro-title text-lg text-[var(--gold)]">{i + 1}</span>
                    <span className="font-semibold text-white" style={{ fontFamily: "'Oswald',sans-serif" }}>{p.name}</span>
                  </div>
                  <button onClick={() => removePlayer(p.id)}
                    className="text-xs tracking-wider transition-colors hover:text-red-300"
                    style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(255,80,60,0.6)" }}>
                    REMOVE
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => setPhase("board")}
            disabled={players.length === 0}
            className="btn-gold w-full py-4 rounded text-2xl disabled:opacity-30"
          >
            START GAME!
          </button>

          <Link href="/" className="block text-center mt-4"
            style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(100,130,255,0.5)", fontSize: "0.7rem", letterSpacing: "0.15em", textDecoration: "none" }}>
            ← BACK TO HOME
          </Link>
        </div>
      </div>
    );
  }

  /* ─────────────────── BOARD ─────────────────── */
  if (phase === "board") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-deep)" }}>
        {/* top nav */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ background: "linear-gradient(180deg,#060d3a,#04051a)", borderBottom: "2px solid var(--sp-blue)", boxShadow: "0 0 16px rgba(0,84,255,0.3)" }}>
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-70" style={{ textDecoration: "none" }}>
            <Image src="/sp-logo.svg" width={22} height={22} alt="" />
            <span style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(120,160,255,0.6)", fontSize: "0.65rem", letterSpacing: "0.15em" }}>HOME</span>
          </Link>

          <h1 className="retro-title text-xl text-[var(--gold)] tracking-wider">{game.title}</h1>

          <div className="flex gap-2 items-center">
            <Link href={`/admin/${game.id}`}
              style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(120,160,255,0.6)", fontSize: "0.65rem", letterSpacing: "0.15em", textDecoration: "none" }}>
              EDIT
            </Link>
            {allAnswered && (
              <button onClick={() => { setFinalPhase("wager"); setPhase("final"); }}
                className="btn-gold px-4 py-1 rounded text-sm ml-2">
                FINAL!
              </button>
            )}
          </div>
        </div>

        {/* score bar */}
        <div className="flex gap-2 px-3 py-2 shrink-0"
          style={{ background: "#04051a", borderBottom: "1px solid rgba(0,84,255,0.2)" }}>
          {players.map((p) => (
            <div key={p.id} className="score-chip flex-1 rounded px-2 py-1 text-center">
              <div className="text-xs truncate" style={{ color: "rgba(150,190,255,0.8)", fontFamily: "'Oswald',sans-serif", letterSpacing: "0.05em" }}>{p.name}</div>
              <div className="retro-title text-lg" style={{ color: p.score < 0 ? "#ff5544" : "var(--gold)" }}>
                {p.score < 0 ? `-$${Math.abs(p.score)}` : `$${p.score}`}
              </div>
            </div>
          ))}
        </div>

        {/* board */}
        <div className="flex-1 p-3 overflow-auto">
          <div className="grid gap-2 h-full"
            style={{ gridTemplateColumns: `repeat(${game.categories.length}, 1fr)` }}>

            {game.categories.map((cat) => (
              <div key={cat.id} className="cat-header rounded flex items-center justify-center px-1 py-3 text-center text-white text-xs min-h-14">
                {cat.name.toUpperCase()}
              </div>
            ))}

            {VALUES.map((val) =>
              game.categories.map((cat) => {
                const q = cat.questions.find((q) => q.value === val);
                if (!q) return <div key={`${cat.id}-${val}`} />;
                return (
                  <button
                    key={`${cat.id}-${val}`}
                    onClick={() => openQuestion(cat.id, q)}
                    disabled={q.answered}
                    className="board-tile rounded min-h-16 flex items-center justify-center"
                  >
                    <span className="retro-title text-3xl" style={{ color: q.answered ? "transparent" : "var(--gold)" }}>
                      ${val}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────── CLUE ─────────────────── */
  if (phase === "clue" && activeQ) {
    const catName = game.categories.find((c) => c.id === activeQ.catId)?.name ?? "";
    const q = activeQ.q;

    return (
      <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#060d3a 0%,var(--bg-deep) 100%)" }}>
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "2px solid var(--sp-blue)", background: "rgba(6,13,58,0.8)" }}>
          <span className="retro-title text-lg text-[var(--sp-blue-glow)] tracking-wider">{catName.toUpperCase()}</span>
          <span className="retro-title text-2xl text-[var(--gold)]">${q.value}</span>
          <button onClick={skipQuestion}
            style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(100,130,255,0.5)", fontSize: "0.7rem", letterSpacing: "0.15em" }}>
            SKIP
          </button>
        </div>

        {/* clue / answer display */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6 py-6">
          {!showAnswer ? (
            <>
              {q.clue && (
                <p className="flip-in font-bold text-white leading-relaxed"
                  style={{ fontFamily: "'Oswald',sans-serif", fontSize: "clamp(1.5rem,4vw,3.5rem)" }}>
                  {q.clue}
                </p>
              )}
              {q.clueImage && (
                <div className="relative w-full max-w-2xl rounded-xl overflow-hidden flip-in"
                  style={{ height: "min(50vh,380px)", border: "3px solid var(--sp-blue)", boxShadow: "0 0 24px rgba(0,84,255,0.4)" }}>
                  <Image src={q.clueImage} alt="clue" fill className="object-contain" />
                </div>
              )}
              {q.clueAudio && (
                <div className="w-full max-w-sm">
                  <audio key={q.clueAudio} autoPlay controls src={q.clueAudio}
                    className="w-full" style={{ filter: "hue-rotate(220deg)" }} />
                </div>
              )}
              {!q.clue && !q.clueImage && !q.clueAudio && (
                <p className="retro-title text-3xl text-blue-800 tracking-widest">(NO CLUE SET)</p>
              )}
            </>
          ) : (
            <>
              {q.answer && (
                <p className="flip-in font-bold leading-relaxed"
                  style={{ fontFamily: "'Oswald',sans-serif", fontSize: "clamp(1.5rem,4vw,3.5rem)", color: "var(--gold)", textShadow: "0 0 20px rgba(255,215,0,0.4)" }}>
                  {q.answer}
                </p>
              )}
              {q.answerImage && (
                <div className="relative w-full max-w-2xl rounded-xl overflow-hidden flip-in"
                  style={{ height: "min(50vh,380px)", border: "3px solid var(--gold)", boxShadow: "0 0 24px rgba(255,215,0,0.3)" }}>
                  <Image src={q.answerImage} alt="answer" fill className="object-contain" />
                </div>
              )}
              {q.answerAudio && (
                <div className="w-full max-w-sm">
                  <audio key={q.answerAudio} autoPlay controls src={q.answerAudio} className="w-full" />
                </div>
              )}
              {!q.answer && !q.answerImage && !q.answerAudio && (
                <p className="retro-title text-3xl tracking-widest" style={{ color: "rgba(255,215,0,0.3)" }}>(NO ANSWER SET)</p>
              )}
            </>
          )}
        </div>

        {/* bottom controls */}
        <div className="px-6 pb-6 pt-4 space-y-4 shrink-0" style={{ borderTop: "1px solid rgba(0,84,255,0.2)" }}>

          {/* wrong-player badges */}
          {wrongPlayers.size > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {[...wrongPlayers].map((id) => {
                const p = players.find((pl) => pl.id === id);
                if (!p) return null;
                return (
                  <span key={id} className="px-3 py-1 rounded text-sm"
                    style={{ fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.08em", background: "#3a0800", border: "1px solid #cc2200", color: "#ff7755" }}>
                    {p.name} ✗ (-${Math.floor(q.value / 2)})
                  </span>
                );
              })}
            </div>
          )}

          {/* buzz-in buttons — hide players who already answered wrong */}
          {players.filter((p) => !wrongPlayers.has(p.id)).length > 0 && (
            <div>
              <p className="text-center mb-2" style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(120,160,255,0.6)", fontSize: "0.7rem", letterSpacing: "0.15em" }}>
                WHO ANSWERED?
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {players.filter((p) => !wrongPlayers.has(p.id)).map((p) => (
                  <button key={p.id}
                    onClick={() => { setBuzzed(p.id); setActivePlayer(p.id); }}
                    className="px-5 py-2 rounded font-bold transition-all"
                    style={{
                      fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.08em", fontSize: "1rem",
                      background: buzzed === p.id ? "var(--gold)" : "linear-gradient(180deg,#1a6aff,var(--sp-blue-dark))",
                      color: buzzed === p.id ? "#1a0a00" : "white",
                      border: buzzed === p.id ? "2px solid #ffec6e" : "2px solid #5599ff",
                      boxShadow: buzzed === p.id ? "0 0 16px rgba(255,215,0,0.5)" : "0 0 8px rgba(0,84,255,0.3)",
                    }}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* action buttons */}
          <div className="flex gap-3 justify-center flex-wrap">
            {/* CORRECT — always visible when someone is selected */}
            {activePlayer && (
              <button onClick={() => closeQuestion(true)}
                className="px-8 py-3 rounded font-black text-xl"
                style={{ fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.08em", background: "linear-gradient(180deg,#00cc44,#008822)", border: "2px solid #00ff66", boxShadow: "0 4px 0 #004411, 0 0 12px rgba(0,204,68,0.4)", color: "white" }}>
                CORRECT ✓
              </button>
            )}

            {/* WRONG — deducts half, keeps question open */}
            {activePlayer && (
              <button onClick={markWrong}
                className="px-8 py-3 rounded font-black text-xl"
                style={{ fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.08em", background: "linear-gradient(180deg,#cc2200,#880000)", border: "2px solid #ff4422", boxShadow: "0 4px 0 #440000, 0 0 12px rgba(204,34,0,0.4)", color: "white" }}>
                WRONG ✗
              </button>
            )}

            {/* REVEAL ANSWER */}
            {!showAnswer && (
              <button onClick={() => setShowAnswer(true)}
                className="btn-gold px-8 py-3 rounded text-xl">
                REVEAL ANSWER
              </button>
            )}

            {/* NO ONE / close */}
            <button onClick={skipQuestion}
              className="btn-blue px-6 py-3 rounded text-xl text-white">
              NO ONE
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────── FINAL JEOPARDY ─────────────────── */
  if (phase === "final") {
    if (finalPhase === "wager") {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: "var(--bg-deep)" }}>
          <Image src="/sp-logo.svg" width={56} height={56} alt="" className="mb-4" />
          <h1 className="retro-title text-6xl text-[var(--gold)] mb-1">FINAL</h1>
          <h2 className="retro-title text-4xl sp-glow text-white tracking-widest mb-2">JEOPARDY!</h2>
          <div className="star-divider w-80 mb-8" />

          <div className="retro-panel rounded-2xl p-8 w-full max-w-lg space-y-5">
            <div>
              <label className="retro-title text-sm tracking-widest text-[var(--sp-blue-glow)] block mb-2">FINAL CLUE</label>
              <textarea rows={3} placeholder="Enter the final clue..."
                value={finalClue} onChange={(e) => setFinalClue(e.target.value)}
                className="w-full px-4 py-2 rounded text-white placeholder-blue-800 focus:outline-none resize-none"
                style={{ background: "#07102a", border: "2px solid var(--sp-blue)", fontFamily: "'Oswald',sans-serif", fontSize: "1rem" }} />
            </div>
            <div>
              <label className="retro-title text-sm tracking-widest text-[var(--gold)] block mb-2">FINAL ANSWER</label>
              <input type="text" placeholder="Enter the answer..."
                value={finalAnswer} onChange={(e) => setFinalAnswer(e.target.value)}
                className="w-full px-4 py-2 rounded text-white placeholder-blue-800 focus:outline-none"
                style={{ background: "#07102a", border: "2px solid rgba(255,215,0,0.5)", fontFamily: "'Oswald',sans-serif", fontSize: "1rem" }} />
            </div>

            <div>
              <label className="retro-title text-sm tracking-widest text-[var(--sp-blue-glow)] block mb-3">PLAYER WAGERS</label>
              {players.map((p) => (
                <div key={p.id} className="flex items-center gap-3 mb-2">
                  <span className="font-bold text-white w-32 truncate" style={{ fontFamily: "'Oswald',sans-serif" }}>{p.name}</span>
                  <span className="text-sm w-20 shrink-0" style={{ fontFamily: "'Share Tech Mono',monospace", color: "var(--gold)" }}>
                    MAX ${Math.max(0, p.score)}
                  </span>
                  <input type="number" min={0} max={Math.max(0, p.score)} placeholder="0"
                    value={finalWagers[p.id] ?? ""}
                    onChange={(e) => setFinalWagers((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded text-white focus:outline-none"
                    style={{ background: "#07102a", border: "2px solid rgba(0,84,255,0.4)", fontFamily: "'Share Tech Mono',monospace" }} />
                </div>
              ))}
            </div>

            <button onClick={() => setFinalPhase("clue")}
              disabled={!finalClue.trim() || !finalAnswer.trim()}
              className="btn-gold w-full py-4 rounded text-2xl disabled:opacity-30">
              SHOW FINAL CLUE!
            </button>
          </div>
        </div>
      );
    }

    if (finalPhase === "clue") {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-8"
          style={{ background: "linear-gradient(180deg,#060d3a,var(--bg-deep))" }}>
          <p className="retro-title text-lg text-[var(--sp-blue-glow)] tracking-widest mb-6">FINAL JEOPARDY!</p>
          <p className="flip-in font-bold text-white leading-relaxed mb-12"
            style={{ fontFamily: "'Oswald',sans-serif", fontSize: "clamp(1.8rem,5vw,4rem)", maxWidth: "800px" }}>
            {finalClue}
          </p>
          <button onClick={() => setFinalPhase("answer")} className="btn-gold px-12 py-4 rounded text-2xl">
            REVEAL ANSWER
          </button>
        </div>
      );
    }

    if (finalPhase === "answer") {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-8 py-12"
          style={{ background: "linear-gradient(180deg,#060d3a,var(--bg-deep))" }}>
          <p className="flip-in font-bold mb-10"
            style={{ fontFamily: "'Oswald',sans-serif", fontSize: "clamp(2rem,5vw,4rem)", color: "var(--gold)", textShadow: "0 0 24px rgba(255,215,0,0.4)" }}>
            {finalAnswer}
          </p>

          <p className="retro-title text-lg text-[var(--sp-blue-glow)] tracking-widest mb-6">WHO GOT IT RIGHT?</p>

          <div className="space-y-3 w-full max-w-md mb-8">
            {players.map((p) => (
              <div key={p.id} className="retro-panel rounded-xl px-5 py-3 flex items-center gap-3">
                <span className="flex-1 font-bold text-white" style={{ fontFamily: "'Oswald',sans-serif" }}>{p.name}</span>
                <span style={{ fontFamily: "'Share Tech Mono',monospace", color: "var(--gold)", fontSize: "0.75rem" }}>
                  WAGER ${finalWagers[p.id] ?? 0}
                </span>
                <button onClick={() => setFinalCorrect((prev) => ({ ...prev, [p.id]: true }))}
                  className="px-3 py-1 rounded text-sm font-black transition-colors"
                  style={{ fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em", background: finalCorrect[p.id] === true ? "#00cc44" : "#1a3a1a", border: "1px solid #00cc44", color: "white" }}>
                  CORRECT
                </button>
                <button onClick={() => setFinalCorrect((prev) => ({ ...prev, [p.id]: false }))}
                  className="px-3 py-1 rounded text-sm font-black transition-colors"
                  style={{ fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em", background: finalCorrect[p.id] === false ? "#cc2200" : "#3a1a1a", border: "1px solid #cc2200", color: "white" }}>
                  WRONG
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setPlayers((prev) => prev.map((p) => {
                const wager = parseInt(finalWagers[p.id] ?? "0") || 0;
                const correct = finalCorrect[p.id];
                if (correct === undefined) return p;
                return { ...p, score: p.score + (correct ? wager : -wager) };
              }));
              setFinalPhase("results");
            }}
            className="btn-gold px-12 py-4 rounded text-2xl">
            SEE FINAL SCORES!
          </button>
        </div>
      );
    }

    /* RESULTS */
    const sorted = [...players].sort((a, b) => b.score - a.score);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: "var(--bg-deep)" }}>
        <Image src="/sp-logo.svg" width={64} height={64} alt="" className="mb-4" />
        <h1 className="retro-title text-6xl text-[var(--gold)] mb-1">FINAL SCORES</h1>
        <div className="star-divider w-80 mb-8" />

        <div className="w-full max-w-md space-y-3 mb-10">
          {sorted.map((p, i) => (
            <div key={p.id} className="flex items-center gap-4 rounded-xl px-6 py-4"
              style={{
                background: i === 0 ? "linear-gradient(90deg,#0054ff22,#ffd70022)" : "var(--bg-card)",
                border: i === 0 ? "2px solid var(--gold)" : "2px solid var(--sp-blue)",
                boxShadow: i === 0 ? "0 0 24px rgba(255,215,0,0.2), 0 0 8px rgba(0,84,255,0.3)" : "0 0 8px rgba(0,84,255,0.15)",
              }}>
              <span className="retro-title text-3xl w-10 text-center"
                style={{ color: i === 0 ? "var(--gold)" : "rgba(100,130,255,0.6)" }}>
                {i + 1}
              </span>
              <span className="flex-1 font-bold text-white text-xl" style={{ fontFamily: "'Oswald',sans-serif" }}>{p.name}</span>
              <span className="retro-title text-2xl" style={{ color: p.score < 0 ? "#ff5544" : "var(--gold)" }}>
                {p.score < 0 ? `-$${Math.abs(p.score)}` : `$${p.score}`}
              </span>
              {i === 0 && <span className="text-xl">🏆</span>}
            </div>
          ))}
        </div>

        <Link href="/" className="btn-blue px-10 py-3 rounded text-xl text-white" style={{ textDecoration: "none" }}>
          PLAY AGAIN
        </Link>
      </div>
    );
  }

  return null;
}
