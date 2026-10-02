"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Game, Question, Player } from "@/types";
import { getClueImages, getAnswerImages } from "@/lib/media";
import ConnectRound, { ConnectState, initialConnectState } from "@/components/ConnectRound";
import { isConnectCategory } from "@/lib/connect";
import { AnimatedScore, Confetti, ScreenFlash, ShootingStars } from "@/components/Fx";
import ScorePanel, { ScoreLogEntry } from "@/components/ScorePanel";
import HostAnswer from "@/components/HostAnswer";
import PlayCodeGate from "@/components/PlayCodeGate";
import { DisplayMessage, DisplaySnapshot, displayChannelName } from "@/lib/display";
import { sfx, isMuted, pauseMusic, resumeMusic, setMuted, startMusic, stopMusic, timesUp } from "@/lib/timerAudio";

type Phase = "setup" | "board" | "clue" | "connect" | "final";

const RULES = [
  {
    icon: "🎯",
    title: "Асуулт сонгох",
    body: "Багууд сэдэв болон оноогоо сонгож асуултад хариулна. Сонгосон асуултандаа заавал хариулах шаардлагатай ба бусад багийн асуултад хариулж болно.",
  },
  {
    icon: "✅",
    title: "Зөв хариулт",
    body: "Зөв хариулсан баг сонгосон оноогоо бүтнээр авна.",
  },
  {
    icon: "❌",
    title: "Буруу хариулт",
    body: "Буруу хариулбал сонгосон онооны тал хасагдана.",
  },
  {
    icon: "👥",
    title: "Бусад багийн боломж",
    body: "Асуулт нээлттэй хэвээр үлдэж, бусад баг хариулах боломжтой.",
  },
  {
    icon: "🏁",
    title: "Эцсийн үе",
    body: "Үндсэн асуултууд дууссаны дараа эцсийн 2 үе эхэлнэ.",
  },
  {
    icon: "🏆",
    title: "Ялагч",
    body: "Хамгийн өндөр оноотой баг тоглоомын ялагч болно.",
  },
];

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(3,8,14,0.6)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="retro-frame rounded-2xl w-full max-w-lg overflow-hidden"
        style={{ background: "var(--bg-card)" }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderBottom: "1px solid var(--sp-blue)",
          }}
        >
          <div className="flex items-center gap-3">
            <Image src="/astro-nots.png" width={24} height={24} alt="" />
            <h2 className="retro-title text-xl text-[var(--gold)] tracking-wider">
              ТОГЛООМЫН ДҮРЭМ
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--teal)] hover:text-[var(--cream)] text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>
        <div
          className="p-6 space-y-4 overflow-y-auto"
          style={{ maxHeight: "70vh" }}
        >
          {RULES.map((r, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-xl px-4 py-3"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(95,195,195,0.25)",
              }}
            >
              <span className="text-2xl shrink-0 mt-0.5">{r.icon}</span>
              <div>
                <p className="retro-title title-mixed text-base text-[var(--gold)] tracking-wide mb-1">
                  {r.title}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-body)",
                    color: "rgba(243,233,210,0.85)",
                    fontSize: "0.95rem",
                    lineHeight: "1.5",
                  }}
                >
                  {r.body}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="btn-gold w-full py-3 rounded text-xl"
          >
            ОЙЛГОСОН!
          </button>
        </div>
      </div>
    </div>
  );
}

function storageKey(gameId: string) {
  return `sp_session_${gameId}`;
}

function clearSession(gameId: string) {
  sessionStorage.removeItem(storageKey(gameId));
}

/** The play code (PLAY_CODE) must be entered before any game data is loaded. */
export default function PlayPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  return (
    <PlayCodeGate>
      <PlayGame gameId={gameId} />
    </PlayCodeGate>
  );
}

function PlayGame({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [phase, setPhase] = useState<Phase>("setup");
  const [activeQ, setActiveQ] = useState<{ catId: string; q: Question } | null>(
    null,
  );
  const [showAnswer, setShowAnswer] = useState(false);
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [buzzed, setBuzzed] = useState<string | null>(null);
  const [wrongPlayers, setWrongPlayers] = useState<Set<string>>(new Set());
  const [finalWagers, setFinalWagers] = useState<Record<string, string>>({});
  const [finalClue, setFinalClue] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [finalPhase, setFinalPhase] = useState<
    "wager" | "clue" | "answer" | "results"
  >("wager");
  const [finalCorrect, setFinalCorrect] = useState<Record<string, boolean>>({});
  const [showRules, setShowRules] = useState(false);
  const [connectState, setConnectState] = useState<ConnectState>(initialConnectState);
  const [timeLeft, setTimeLeft] = useState(60);
  const [fx, setFx] = useState<{ kind: "good" | "bad"; k: number } | null>(null);
  const [boardIntro, setBoardIntro] = useState(true);
  const [showScores, setShowScores] = useState(false);
  const [scoreLog, setScoreLog] = useState<ScoreLogEntry[]>([]);
  const clueCardRef = useRef<HTMLDivElement>(null);
  const [timerState, setTimerState] = useState<"idle" | "running" | "paused" | "done">("idle");
  const [muted, setMutedState] = useState(false);
  const remainingRef = useRef(60);
  const toggleTimerRef = useRef<() => void>(() => {});
  const channelRef = useRef<BroadcastChannel | null>(null);
  const snapRef = useRef<DisplaySnapshot | null>(null);
  const lastHelloRef = useRef(0);
  const [displayOn, setDisplayOn] = useState(false);
  // "single" = host screen is also what the audience sees; "dual" = separate audience window
  const [screenMode, setScreenModeState] = useState<"single" | "dual">(() => {
    if (typeof window === "undefined") return "single";
    try {
      return localStorage.getItem("astro_screen_mode") === "dual" ? "dual" : "single";
    } catch {
      return "single";
    }
  });
  const dual = screenMode === "dual";
  const dualRef = useRef(dual);
  const hydrated = useRef(false);

  /* ── restore session on mount ── */
  useEffect(() => {
    const key = storageKey(gameId);
    const saved = sessionStorage.getItem(key);
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.game) setGame(s.game);
        if (s.players) setPlayers(s.players);
        if (s.phase) setPhase(s.phase);
        if (s.activeQ) setActiveQ(s.activeQ);
        if (s.showAnswer) setShowAnswer(s.showAnswer);
        if (s.activePlayer) setActivePlayer(s.activePlayer);
        if (s.buzzed) setBuzzed(s.buzzed);
        if (s.wrongPlayers) setWrongPlayers(new Set(s.wrongPlayers));
        if (s.finalWagers) setFinalWagers(s.finalWagers);
        if (s.finalClue) setFinalClue(s.finalClue);
        if (s.finalAnswer) setFinalAnswer(s.finalAnswer);
        if (s.finalPhase) setFinalPhase(s.finalPhase);
        if (s.finalCorrect) setFinalCorrect(s.finalCorrect);
        if (s.connectState) setConnectState(s.connectState);
        if (s.scoreLog) setScoreLog(s.scoreLog);
        if (s.screenMode === "single" || s.screenMode === "dual") setScreenModeState(s.screenMode);
        hydrated.current = true;
        return;
      } catch {
        /* corrupt — fall through to fresh fetch */
      }
    }
    fetch(`/api/games/${gameId}`)
      .then((r) => r.json())
      .then((g) => {
        setGame(g);
        hydrated.current = true;
      });
  }, [gameId]);

  /* ── persist every state change ── */
  useEffect(() => {
    if (!hydrated.current || !game) return;
    const snapshot = {
      game,
      players,
      phase,
      activeQ,
      showAnswer,
      activePlayer,
      buzzed,
      wrongPlayers: [...wrongPlayers],
      finalWagers,
      finalClue,
      finalAnswer,
      finalPhase,
      finalCorrect,
      connectState,
      scoreLog,
      screenMode,
    };
    sessionStorage.setItem(storageKey(gameId), JSON.stringify(snapshot));
  }, [
    game,
    players,
    phase,
    activeQ,
    showAnswer,
    activePlayer,
    buzzed,
    wrongPlayers,
    finalWagers,
    finalClue,
    finalAnswer,
    finalPhase,
    finalCorrect,
    connectState,
    scoreLog,
    screenMode,
    gameId,
  ]);

  /* ── audience screen link (BroadcastChannel, same browser) ── */
  useEffect(() => {
    const ch = new BroadcastChannel(displayChannelName(gameId));
    channelRef.current = ch;
    ch.onmessage = (e: MessageEvent<DisplayMessage>) => {
      if (e.data.type === "hello") {
        lastHelloRef.current = Date.now();
        setDisplayOn(true);
        if (dualRef.current && snapRef.current) ch.postMessage({ type: "state", snapshot: snapRef.current } satisfies DisplayMessage);
      } else if (e.data.type === "bye") {
        setDisplayOn(false);
      }
    };
    const check = setInterval(() => {
      if (Date.now() - lastHelloRef.current > 6000) setDisplayOn(false);
    }, 3000);
    return () => {
      clearInterval(check);
      ch.close();
      channelRef.current = null;
    };
  }, [gameId]);

  /* push the current state to the audience screen after every render */
  useEffect(() => {
    if (!game) return;
    const snapshot: DisplaySnapshot = {
      game,
      players,
      phase,
      activeQ,
      showAnswer,
      buzzed: activePlayer ?? buzzed,
      wrongPlayers: [...wrongPlayers],
      finalClue,
      finalAnswer,
      finalPhase,
      connectState,
      timeLeft,
      timerTotal: Math.max(5, game.timerSeconds ?? 60),
      timerState,
      fx,
    };
    snapRef.current = snapshot;
    dualRef.current = dual;
    if (dual) channelRef.current?.postMessage({ type: "state", snapshot } satisfies DisplayMessage);
  });

  /* ── countdown timer: starts only when the host presses START ── */
  useEffect(() => {
    if (phase !== "clue" || timerState !== "running") return;
    const id = setInterval(() => {
      remainingRef.current = Math.max(0, remainingRef.current - 1);
      setTimeLeft(remainingRef.current);
      if (remainingRef.current <= 0) {
        clearInterval(id);
        timesUp();
        setTimerState("done");
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, timerState]);

  /* Space = start / pause the timer while a clue is open */
  useEffect(() => {
    if (phase !== "clue" || showAnswer) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code !== "Space" || tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      e.preventDefault();
      toggleTimerRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, showAnswer]);

  /* stop music if we leave the page */
  useEffect(() => () => stopMusic(), []);

  /* sync mute flag from localStorage once on mount */
  useEffect(() => {
    const id = requestAnimationFrame(() => setMutedState(isMuted()));
    return () => cancelAnimationFrame(id);
  }, []);

  const allAnswered =
    game?.categories.every((cat) => cat.questions.every((q) => q.answered)) ??
    false;

  function addPlayer() {
    const name = newPlayerName.trim();
    if (!name) return;
    setPlayers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name, score: 0 },
    ]);
    setNewPlayerName("");
  }

  function removePlayer(id: string) {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  /** Host fix: re-open a tile that was closed by mistake. */
  function reopenQuestion(catId: string, q: Question) {
    const cat = game?.categories.find((c) => c.id === catId);
    if (!cat) return;
    const ok = confirm(
      `«${cat.name.toUpperCase()} ${isConnectCategory(cat) ? "CONNECT" : q.value}» асуултыг дахин нээх үү?\n` +
        "Энэ асуултаас өгсөн оноо автоматаар буцахгүй — хэрэгтэй бол ± ОНОО → ↶ ашиглана уу.",
    );
    if (!ok || !game) return;
    setGame({
      ...game,
      categories: game.categories.map((c) =>
        c.id === catId ? { ...c, questions: c.questions.map((x) => (x.id === q.id ? { ...x, answered: false } : x)) } : c,
      ),
    });
    if (connectState.qId === q.id) setConnectState(initialConnectState);
  }

  function markAnswered(catId: string, qId: string) {
    if (!game) return;
    setGame({
      ...game,
      categories: game.categories.map((c) =>
        c.id === catId
          ? {
              ...c,
              questions: c.questions.map((q) =>
                q.id === qId ? { ...q, answered: true } : q,
              ),
            }
          : c,
      ),
    });
  }

  function adjustScore(playerId: string, delta: number, reason = "ГАРААР") {
    if (!delta) return;
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === playerId ? { ...p, score: p.score + delta } : p,
      ),
    );
    setScoreLog((prev) =>
      [{ id: crypto.randomUUID(), playerId, delta, reason, at: Date.now() }, ...prev].slice(0, 60),
    );
  }

  /* ── host score control ── */
  function setScore(playerId: string, value: number) {
    const cur = players.find((p) => p.id === playerId)?.score ?? 0;
    adjustScore(playerId, value - cur, "ШУУД ОРУУЛСАН");
  }

  function undoScore(entryId: string) {
    const e = scoreLog.find((x) => x.id === entryId);
    if (!e) return;
    setPlayers((prev) => prev.map((p) => (p.id === e.playerId ? { ...p, score: p.score - e.delta } : p)));
    setScoreLog((prev) => prev.filter((x) => x.id !== entryId));
  }

  function qLabel(catId: string, value: number) {
    const name = game?.categories.find((c) => c.id === catId)?.name ?? "";
    return `${name.toUpperCase()} ${value}`;
  }

  const timerTotal = Math.max(5, game?.timerSeconds ?? 60);

  function resetTimer() {
    stopMusic();
    remainingRef.current = timerTotal;
    setTimeLeft(timerTotal);
    setTimerState("idle");
  }

  /** START / PAUSE / RESUME / RESTART — one button */
  function toggleTimer() {
    if (timerState === "running") {
      pauseMusic();
      setTimerState("paused");
    } else if (timerState === "paused") {
      resumeMusic(game?.timerMusic);
      setTimerState("running");
    } else {
      remainingRef.current = timerTotal;
      setTimeLeft(timerTotal);
      startMusic(game?.timerMusic);
      setTimerState("running");
    }
  }

  useEffect(() => {
    toggleTimerRef.current = toggleTimer;
  });

  function pauseTimer() {
    if (timerState !== "running") return;
    pauseMusic();
    setTimerState("paused");
  }

  function toggleMute() {
    setMuted(!muted);
    setMutedState(!muted);
  }

  function openQuestion(catId: string, q: Question) {
    if (q.answered) return;
    setBoardIntro(false);
    sfx.open();
    const cat = game?.categories.find((c) => c.id === catId);
    if (isConnectCategory(cat)) {
      setActiveQ({ catId, q });
      // resume if the host left this same tile mid-way, otherwise start fresh
      if (connectState.qId !== q.id) setConnectState({ ...initialConnectState, qId: q.id });
      setPhase("connect");
      return;
    }
    setActiveQ({ catId, q });
    setShowAnswer(false);
    setBuzzed(null);
    setActivePlayer(null);
    setWrongPlayers(new Set());
    resetTimer();
    setPhase("clue");
  }

  function fire(kind: "good" | "bad") {
    setFx({ kind, k: Date.now() });
    if (kind === "good") sfx.correct();
    else sfx.wrong();
  }

  function shake(el: HTMLElement | null) {
    el?.animate(
      [
        { transform: "translateX(0)" }, { transform: "translateX(-14px)" }, { transform: "translateX(12px)" },
        { transform: "translateX(-8px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" },
      ],
      { duration: 500, easing: "ease-out" },
    );
  }

  function markWrong() {
    if (!activeQ || !activePlayer) return;
    fire("bad");
    shake(clueCardRef.current);
    adjustScore(activePlayer, -Math.floor(activeQ.q.value / 2), `${qLabel(activeQ.catId, activeQ.q.value)} ✗`);
    setWrongPlayers((prev) => new Set(prev).add(activePlayer));
    setBuzzed(null);
    setActivePlayer(null);
    setShowAnswer(false);
  }

  function closeQuestion(correct: boolean) {
    if (!activeQ) return;
    if (activePlayer && correct) {
      adjustScore(activePlayer, activeQ.q.value, `${qLabel(activeQ.catId, activeQ.q.value)} ✓`);
      fire("good");
    }
    stopMusic();
    setTimerState("idle");
    markAnswered(activeQ.catId, activeQ.q.id);
    setActiveQ(null);
    setPhase("board");
    setBuzzed(null);
    setActivePlayer(null);
    setWrongPlayers(new Set());
  }

  function skipQuestion() {
    if (!activeQ) return;
    stopMusic();
    setTimerState("idle");
    markAnswered(activeQ.catId, activeQ.q.id);
    setActiveQ(null);
    setPhase("board");
    setBuzzed(null);
    setActivePlayer(null);
    setWrongPlayers(new Set());
  }

  if (!game) {
    return (
      <div
        className="min-h-dvh flex items-center justify-center"
        style={{ background: "transparent" }}
      >
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/astro-nots.png"
            width={56}
            height={56}
            alt=""
            className="animate-pulse opacity-60"
          />
          <p className="retro-title text-3xl text-[var(--teal)] tracking-widest">
            LOADING...
          </p>
        </div>
      </div>
    );
  }

  const scorePanel = showScores ? (
    <ScorePanel
      players={players}
      log={scoreLog}
      onAdjust={(id, d) => adjustScore(id, d)}
      onSet={setScore}
      onRename={(id, name) => setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))}
      onAdd={(name) => setPlayers((prev) => [...prev, { id: crypto.randomUUID(), name, score: 0 }])}
      onRemove={removePlayer}
      onUndo={undoScore}
      onClose={() => setShowScores(false)}
    />
  ) : null;

  function setScreenMode(m: "single" | "dual") {
    setScreenModeState(m);
    try {
      localStorage.setItem("astro_screen_mode", m);
    } catch {
      /* ignore */
    }
    if (m === "dual" && !displayOn) openDisplay(); // opened from the click, so pop-ups are allowed
    if (m === "single") channelRef.current?.postMessage({ type: "off" } satisfies DisplayMessage);
  }

  const modeButton = (
    <button
      onClick={() => setScreenMode(dual ? "single" : "dual")}
      title={dual ? "Нэг дэлгэцээр тоглох руу шилжих" : "Үзэгчдийн дэлгэцтэй тоглох руу шилжих"}
      className="rounded-lg px-2.5 py-1.5 mono text-[0.6rem] transition-colors hover:bg-[rgba(255,255,255,0.08)]"
      style={{ color: "rgba(243,233,210,0.7)", background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border)" }}
    >
      {dual ? "🖥🖥 2" : "🖥 1"}
    </button>
  );

  function openDisplay() {
    window.open(`/display/${gameId}`, `astro-display-${gameId}`, "popup,width=1280,height=720");
  }

  const displayButton = (
    <button
      onClick={openDisplay}
      title={displayOn ? "Үзэгчдийн дэлгэц холбогдсон" : "Проектор / үзэгчдийн дэлгэц нээх"}
      className="rounded-lg px-3 py-1.5 mono text-[0.6rem] flex items-center gap-1.5 transition-colors hover:bg-[rgba(95,195,195,0.18)]"
      style={{ color: "var(--cream)", background: "rgba(95,195,195,0.08)", border: `1px solid ${displayOn ? "rgba(120,240,180,0.6)" : "rgba(95,195,195,0.4)"}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: displayOn ? "#5ef0a0" : "rgba(243,233,210,0.3)", boxShadow: displayOn ? "0 0 8px #5ef0a0" : "none" }} />
      📺 ҮЗЭГЧИД
    </button>
  );

  const scoreButton = (
    <button
      onClick={() => setShowScores(true)}
      title="Онооны удирдлага"
      className="rounded-lg px-3 py-1.5 mono text-[0.6rem] flex items-center gap-1.5 transition-colors hover:bg-[rgba(255,138,61,0.18)]"
      style={{ color: "var(--gold)", background: "rgba(255,138,61,0.08)", border: "1px solid rgba(255,165,82,0.4)" }}
    >
      ± ОНОО
    </button>
  );

  const fxLayer = fx ? (
    <>
      {fx.kind === "good" && <Confetti key={`c${fx.k}`} />}
      <ScreenFlash key={`f${fx.k}`} kind={fx.kind} />
    </>
  ) : null;

  /* ─────────────────── SETUP ─────────────────── */
  if (phase === "setup") {
    return (
      <div
        className="h-dvh w-full overflow-y-auto grid grid-cols-1 lg:grid-cols-2 items-center content-center gap-8 lg:gap-16 px-4 sm:px-10 py-8 max-w-7xl mx-auto"
      >
        <div className="orbit-ring" />
        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative floaty drop-in">
            <div className="absolute inset-0 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(95,195,195,0.35), transparent 65%)" }} />
            <div className="logo-orbit" />
            <div className="logo-orbit reverse" />
            <Image src="/astro-nots.png" width={480} height={480} priority alt="Astro-Nots"
              className="relative w-40 sm:w-56 lg:w-[min(32vw,50vh)] h-auto drop-shadow-[0_20px_60px_rgba(0,0,0,0.6)]" />
          </div>
          <h1 className="retro-title title-mixed text-gradient text-3xl sm:text-5xl xl:text-6xl">
            {game.title}
          </h1>
          <div className="star-divider w-64 sm:w-80 max-w-full" />
          <p className="mono text-xs" style={{ color: "rgba(243,233,210,0.6)" }}>JEOPARDY · QUIZ CHALLENGE</p>
        </div>

        <div className="retro-panel rise-in rounded-3xl p-5 sm:p-8 w-full max-w-lg mx-auto lg:mx-0" style={{ animationDelay: "150ms" }}>
          <h2 className="retro-title text-xl text-[var(--cream)] mb-5 text-center">
            ADD PLAYERS
          </h2>

          <div className="flex gap-2 mb-4">
            <input
              autoFocus
              type="text"
              placeholder="Player / team name..."
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              className="flex-1 px-4 py-2 rounded text-[var(--cream)]  focus:outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--sp-blue)",
                fontFamily: "var(--font-body)",
                fontSize: "1rem",
              }}
            />
            <button
              onClick={addPlayer}
              className="btn-gold px-5 py-2 rounded text-base"
            >
              ADD
            </button>
          </div>

          {players.length > 0 && (
            <div className="space-y-2 mb-6">
              {players.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-2 rounded"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(95,195,195,0.4)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="retro-title text-lg text-[var(--gold)]">
                      {i + 1}
                    </span>
                    <span
                      className="font-semibold text-[var(--cream)]"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {p.name}
                    </span>
                  </div>
                  <button
                    onClick={() => removePlayer(p.id)}
                    className="text-xs tracking-wider transition-colors hover:text-red-300"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "rgba(255,80,60,0.6)",
                    }}
                  >
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

          {/* screen mode */}
          <p className="mono text-[0.6rem] mt-5 mb-2 text-center" style={{ color: "rgba(243,233,210,0.5)" }}>ТОГЛОХ ГОРИМ</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { m: "single", icon: "🖥", title: "Нэг дэлгэц", desc: "Хөтлөгч, үзэгчид нэг дэлгэц харна. Хариулт нуугдана." },
              { m: "dual", icon: "🖥🖥", title: "Хоёр дэлгэц", desc: "Проектор дээр үзэгчдийн дэлгэц. Хариулт танд харагдана." },
            ] as const).map((o) => {
              const on = screenMode === o.m;
              return (
                <button
                  key={o.m}
                  onClick={() => setScreenMode(o.m)}
                  className="rounded-xl p-3 text-left transition-all"
                  style={{
                    background: on ? "linear-gradient(160deg,rgba(255,138,61,0.18),rgba(255,255,255,0.03))" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${on ? "rgba(255,165,82,0.7)" : "var(--glass-border)"}`,
                    boxShadow: on ? "0 0 20px rgba(255,138,61,0.2)" : "none",
                  }}
                >
                  <span className="text-lg">{o.icon}</span>
                  <p className="title-mixed text-sm mt-1" style={{ color: on ? "var(--gold)" : "var(--cream)" }}>{o.title}</p>
                  <p className="text-[0.7rem] mt-0.5 leading-snug" style={{ color: "rgba(243,233,210,0.55)" }}>{o.desc}</p>
                </button>
              );
            })}
          </div>
          {dual && (
            <button
              onClick={openDisplay}
              className="btn-blue w-full mt-2 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: displayOn ? "#5ef0a0" : "rgba(243,233,210,0.3)", boxShadow: displayOn ? "0 0 8px #5ef0a0" : "none" }} />
              📺 ҮЗЭГЧДИЙН ДЭЛГЭЦ {displayOn ? "· ХОЛБОГДСОН" : "НЭЭХ"}
            </button>
          )}

          <button
            onClick={() => setShowRules(true)}
            className="w-full mt-3 py-2 rounded-full text-sm tracking-widest transition-all hover:opacity-80"
            style={{
              fontFamily: "var(--font-mono)",
              border: "1px solid rgba(95,195,195,0.4)",
              color: "rgba(243,233,210,0.7)",
              background: "rgba(95,195,195,0.06)",
              letterSpacing: "0.15em",
              fontSize: "0.7rem",
            }}
          >
            📋 ДҮРЭМТЭЙ ТАНИЛЦАХ
          </button>

          <Link
            href={game.folderId ? `/?f=${game.folderId}` : "/"}
            className="block text-center mt-3"
            style={{
              fontFamily: "var(--font-mono)",
              color: "rgba(243,233,210,0.5)",
              fontSize: "0.7rem",
              letterSpacing: "0.15em",
              textDecoration: "none",
            }}
          >
            ← BACK TO HOME
          </Link>
        </div>
      </div>
    );
  }

  /* ─────────────────── BOARD ─────────────────── */
  if (phase === "board") {
    const rows = Math.max(...game.categories.map((c) => c.questions.length), 1);
    return (
      <div className="h-dvh w-full flex flex-col overflow-hidden">
        <div className="orbit-ring" />
        <ShootingStars />
        {fxLayer}
        {scorePanel}
        {/* top bar: logo · title · actions */}
        <div className="glass-bar flex items-center gap-3 px-3 sm:px-5 py-2 shrink-0">
          <Link href={game.folderId ? `/?f=${game.folderId}` : "/"} className="flex items-center gap-2 shrink-0 transition-opacity hover:opacity-80" style={{ textDecoration: "none" }}>
            <Image src="/astro-nots.png" width={40} height={40} alt="Home" className="w-9 h-9 sm:w-10 sm:h-10" />
          </Link>
          <h1 className="retro-title title-mixed text-sm sm:text-xl text-[var(--cream)] truncate flex-1 min-w-0">
            {game.title}
          </h1>
          <div className="flex gap-1.5 sm:gap-2 items-center shrink-0">
            <button
              onClick={toggleMute}
              title={muted ? "Дуу асаах" : "Дуу хаах"}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)" }}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            {modeButton}
            {dual && displayButton}
            {scoreButton}
            <Link href={`/admin/${game.id}`} className="glass rounded-lg px-3 py-1.5 mono text-[0.6rem]" style={{ color: "var(--cream)", textDecoration: "none" }}>
              EDIT
            </Link>
            <button
              onClick={() => {
                if (confirm("Restart the game? All scores and progress will be reset.")) {
                  clearSession(gameId);
                  window.location.reload();
                }
              }}
              className="rounded-lg px-3 py-1.5 mono text-[0.6rem]"
              style={{ color: "#ff8a83", background: "rgba(242,72,63,0.08)", border: "1px solid rgba(242,72,63,0.35)" }}
            >
              RESET
            </button>
            {allAnswered && (
              <button onClick={() => { setFinalPhase("wager"); setPhase("final"); }} className="btn-gold px-4 py-1.5 rounded-lg text-xs">
                FINAL!
              </button>
            )}
          </div>
        </div>

        {/* board fills remaining height */}
        <div className="flex-1 min-h-0 p-2 sm:p-3 overflow-auto">
          <div
            className="grid gap-1.5 sm:gap-2.5 h-full min-w-[640px]"
            style={{
              gridTemplateColumns: `repeat(${game.categories.length}, minmax(0, 1fr))`,
              gridTemplateRows: `minmax(56px, auto) repeat(${rows}, minmax(56px, 1fr))`,
            }}
          >
            {game.categories.map((cat, colIdx) => (
              <div key={cat.id}
                className={`cat-header rounded-xl flex items-center justify-center gap-1.5 px-2 py-2 text-center ${boardIntro ? "drop-in" : ""}`}
                style={{
                  animationDelay: `${colIdx * 60}ms`,
                  fontSize: "clamp(0.65rem, 1.1vw, 1.05rem)",
                  ...(isConnectCategory(cat) && {
                    borderBottomColor: "var(--teal)",
                    background: "linear-gradient(180deg, rgba(95,195,195,0.22), rgba(255,255,255,0.03))",
                  }),
                }}>
                {isConnectCategory(cat) && <span style={{ color: "var(--teal)" }}>✦</span>}
                {cat.name.toUpperCase()}
              </div>
            ))}
            {Array.from({ length: rows }).map((_, rowIdx) =>
              game.categories.map((cat, colIdx) => {
                const q = [...cat.questions].sort((a, b) => a.value - b.value)[rowIdx];
                if (!q) return <div key={`${cat.id}-r${rowIdx}`} />;
                return (
                  <div key={`${cat.id}-${q.id}`} className="relative group min-h-0">
                  <button
                    onClick={() => openQuestion(cat.id, q)}
                    disabled={q.answered}
                    className={`board-tile rounded-xl flex items-center justify-center w-full h-full ${boardIntro ? "rise-in" : ""}`}
                    style={{ animationDelay: `${200 + (rowIdx + colIdx) * 55}ms` }}
                  >
                    {isConnectCategory(cat) ? (
                      <span className="flex flex-col items-center leading-none gap-1" style={{ opacity: q.answered ? 0 : 1 }}>
                        <span className="retro-title font-black" style={{ fontSize: "clamp(1.1rem, min(3vw, 5.5vh), 3.2rem)", color: "var(--teal)" }}>
                          ✦{rowIdx + 1}
                        </span>
                        <span className="mono" style={{ fontSize: "clamp(0.5rem, 0.8vw, 0.75rem)", color: "rgba(243,233,210,0.55)" }}>
                          CONNECT
                        </span>
                      </span>
                    ) : (
                      <span className="retro-title font-black"
                        style={{ fontSize: "clamp(1.1rem, min(3.4vw, 6vh), 3.6rem)", color: "var(--gold)", visibility: q.answered ? "hidden" : "visible" }}>
                        {q.value}
                      </span>
                    )}
                  </button>
                  {q.answered && (
                    <button
                      onClick={() => reopenQuestion(cat.id, q)}
                      title="Санамсаргүй хаасан бол дахин нээх"
                      className="absolute inset-0 m-auto w-fit h-fit rounded-lg px-3 py-1.5 mono text-[0.6rem] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      style={{ color: "var(--cream)", background: "rgba(5,13,22,0.8)", border: "1px solid var(--glass-border-hi)" }}
                    >
                      ↺ ДАХИН НЭЭХ
                    </button>
                  )}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {/* score dock */}
        <div className="glass-bar shrink-0 px-2 sm:px-3 py-2" style={{ borderTop: "1px solid var(--glass-border)", borderBottom: "none" }}>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(players.length, 1)}, minmax(0, 1fr))` }}>
            {players.map((p) => (
              <button key={p.id} onClick={() => setShowScores(true)} title="Оноо засах"
                className="score-chip rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 min-w-0 text-left transition-colors hover:border-[rgba(255,165,82,0.5)]">
                <span className="truncate text-xs sm:text-sm font-semibold" style={{ color: "var(--cream)", fontFamily: "var(--font-body)" }}>
                  {p.name}
                </span>
                <AnimatedScore
                  id={p.id}
                  value={p.score}
                  className="retro-title text-base sm:text-2xl shrink-0"
                  style={{ color: p.score < 0 ? "#ff6a62" : "var(--gold)" }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────── CONNECT ─────────────────── */
  if (phase === "connect" && activeQ) {
    const cat = game.categories.find((c) => c.id === activeQ.catId);
    const row = [...(cat?.questions ?? [])].sort((a, b) => a.value - b.value).findIndex((x) => x.id === activeQ.q.id);
    return (
      <>
      {fxLayer}
      {scorePanel}
      <ConnectRound
        onFx={fire}
        title={`${(cat?.name ?? "CONNECT").toUpperCase()} · ✦ #${row + 1}`}
        data={activeQ.q.connect ?? { clues: [], answer: "" }}
        players={players}
        state={connectState}
        setState={setConnectState}
        onScore={(id, d) => adjustScore(id, d, d > 0 ? "CONNECT ✓" : "CONNECT ✗")}
        extra={scoreButton}
        hostAnswerAuto={dual && displayOn}
        onDone={() => markAnswered(activeQ.catId, activeQ.q.id)}
        onExit={() => {
          // keep an unfinished puzzle where it was, so leaving can't reset the points
          if (connectState.showAnswer) setConnectState(initialConnectState);
          setActiveQ(null);
          setPhase("board");
        }}
      />
      </>
    );
  }

  /* ─────────────────── CLUE ─────────────────── */
  if (phase === "clue" && activeQ) {
    const catName =
      game.categories.find((c) => c.id === activeQ.catId)?.name ?? "";
    const q = activeQ.q;

    return (
      <div
        className="h-dvh w-full flex flex-col overflow-hidden"
      >
        <div className="orbit-ring" />
        {fxLayer}
        {scorePanel}
        {/* header */}
        <div className="glass-bar drop-in flex items-center justify-between gap-2 px-3 sm:px-6 py-2.5 sm:py-3 shrink-0">
          <span className="retro-title text-sm sm:text-lg text-[var(--sp-blue-glow)] tracking-wider truncate min-w-0">
            {catName.toUpperCase()}
          </span>

          {/* circular countdown timer */}
          <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleMute}
            title={muted ? "Дуу асаах" : "Дуу хаах"}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)" }}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button
            onClick={toggleTimer}
            title="Цаг эхлүүлэх / зогсоох (Space)"
            className={`relative flex items-center justify-center shrink-0 ${timerState === "running" && timeLeft > 0 && timeLeft <= 10 ? "urgent" : ""}`}
            style={{ width: 44, height: 44, opacity: timerState === "idle" ? 0.7 : 1 }}
          >
            <svg width="44" height="44" viewBox="0 0 64 64" style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}>
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(95,195,195,0.2)" strokeWidth="4" />
              <circle
                cx="32" cy="32" r="28" fill="none"
                stroke={timeLeft <= 10 ? "#ff4422" : timeLeft <= 20 ? "#ffaa00" : "var(--sp-blue)"}
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - timeLeft / timerTotal)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }}
              />
            </svg>
            <span className="retro-title text-sm sm:text-xl z-10"
              style={{ color: timeLeft <= 10 ? "#ff4422" : timeLeft <= 20 ? "#ffaa00" : "var(--gold)" }}>
              {timeLeft}
            </span>
          </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {scoreButton}
            <span className="retro-title text-lg sm:text-2xl text-[var(--gold)]">${q.value}</span>
            <button
              onClick={skipQuestion}
              style={{
                fontFamily: "var(--font-mono)",
                color: "rgba(243,233,210,0.5)",
                fontSize: "0.7rem",
                letterSpacing: "0.15em",
              }}
            >
              SKIP
            </button>
          </div>
        </div>

        {/* clue / answer display */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center px-4 sm:px-10 text-center gap-6 py-6">
          <div ref={clueCardRef} className="glass zoom-in rounded-3xl w-full max-w-6xl flex-1 min-h-0 flex flex-col items-center justify-center gap-6 px-6 sm:px-12 py-8">
          {!showAnswer ? (
            <>
              {q.clue && (
                <p
                  className="flip-in font-bold text-[var(--cream)] leading-relaxed"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "clamp(1.6rem,min(4.2vw,7vh),4.5rem)", lineHeight: 1.25,
                  }}
                >
                  {q.clue}
                </p>
              )}
              <ImageRow
                images={getClueImages(q)}
                borderColor="var(--sp-blue)"
                glowColor="rgba(95,195,195,0.4)"
              />
              {q.clueAudio && (
                <div className="w-full max-w-sm">
                  <audio
                    key={q.clueAudio}
                    autoPlay
                    controls
                    src={q.clueAudio}
                    className="w-full"
                    style={{ filter: "none" }}
                  />
                </div>
              )}
              {!q.clue && getClueImages(q).length === 0 && !q.clueAudio && (
                <p className="retro-title text-3xl text-[var(--teal-deep)] tracking-widest">
                  (NO CLUE SET)
                </p>
              )}
            </>
          ) : (
            <>
              {q.answer && (
                <p
                  className="flip-in font-bold leading-relaxed"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "clamp(1.6rem,min(4.2vw,7vh),4.5rem)", lineHeight: 1.25,
                    color: "var(--gold)",
                    textShadow: "0 0 20px rgba(255,138,61,0.4)",
                  }}
                >
                  {q.answer}
                </p>
              )}
              <ImageRow
                images={getAnswerImages(q)}
                borderColor="var(--gold)"
                glowColor="rgba(255,138,61,0.3)"
              />
              {q.answerAudio && (
                <div className="w-full max-w-sm">
                  <audio
                    key={q.answerAudio}
                    autoPlay
                    controls
                    src={q.answerAudio}
                    className="w-full"
                  />
                </div>
              )}
              {!q.answer &&
                getAnswerImages(q).length === 0 &&
                !q.answerAudio && (
                  <p
                    className="retro-title text-3xl tracking-widest"
                    style={{ color: "rgba(255,138,61,0.3)" }}
                  >
                    (NO ANSWER SET)
                  </p>
                )}
            </>
          )}
          </div>
        </div>

        {/* bottom controls */}
        <div
          className="glass-bar px-4 sm:px-6 pb-4 pt-3 space-y-3 shrink-0"
          style={{ borderTop: "1px solid var(--glass-border)", borderBottom: "none" }}
        >
          {/* host-only answer (never sent to the audience screen until REVEAL) */}
          {!showAnswer && (
            <HostAnswer key={q.id} answer={q.answer} images={getAnswerImages(q)} auto={dual && displayOn} />
          )}

          {/* wrong-player badges */}
          {wrongPlayers.size > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {[...wrongPlayers].map((id) => {
                const p = players.find((pl) => pl.id === id);
                if (!p) return null;
                return (
                  <span
                    key={id}
                    className="px-3 py-1 rounded text-sm"
                    style={{
                      fontFamily: "var(--font-display)",
                      letterSpacing: "0.08em",
                      background: "rgba(242,72,63,0.12)",
                      border: "1px solid rgba(242,72,63,0.45)",
                      color: "#ff8a83",
                    }}
                  >
                    {p.name} ✗ (-${Math.floor(q.value / 2)})
                  </span>
                );
              })}
            </div>
          )}

          {/* buzz-in buttons — hide players who already answered wrong */}
          {players.filter((p) => !wrongPlayers.has(p.id)).length > 0 && (
            <div>
              <p
                className="text-center mb-2"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "rgba(243,233,210,0.6)",
                  fontSize: "0.7rem",
                  letterSpacing: "0.15em",
                }}
              >
                WHO ANSWERED?
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {players
                  .filter((p) => !wrongPlayers.has(p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setBuzzed(p.id);
                        setActivePlayer(p.id);
                        pauseTimer(); // a team answers → stop the clock
                        sfx.buzz();
                      }}
                      className="px-5 py-2 rounded-xl transition-all"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        fontSize: "1rem",
                        background:
                          buzzed === p.id
                            ? "var(--gold)"
                            : "rgba(95,195,195,0.14)",
                        color: buzzed === p.id ? "#1a0b04" : "white",
                        border:
                          buzzed === p.id
                            ? "1px solid rgba(255,214,170,0.7)"
                            : "1px solid rgba(95,195,195,0.45)",
                        boxShadow:
                          buzzed === p.id
                            ? "0 0 16px rgba(255,138,61,0.5)"
                            : "0 0 8px rgba(95,195,195,0.3)",
                      }}
                    >
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
              <button
                onClick={() => closeQuestion(true)}
                className="px-8 py-3 rounded-xl text-lg"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  background: "linear-gradient(135deg,rgba(80,220,150,0.35),rgba(40,160,110,0.25))",
                  border: "1px solid rgba(120,240,180,0.6)",
                  boxShadow: "0 8px 28px rgba(60,200,130,0.25), inset 0 1px 0 rgba(255,255,255,0.2)",
                  backdropFilter: "blur(14px)",
                  color: "#eafff3",
                }}
              >
                CORRECT ✓
              </button>
            )}

            {/* WRONG — deducts half, keeps question open */}
            {activePlayer && (
              <button
                onClick={markWrong}
                className="px-8 py-3 rounded-xl text-lg"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  background: "linear-gradient(135deg,rgba(242,72,63,0.35),rgba(180,40,40,0.25))",
                  border: "1px solid rgba(255,130,120,0.6)",
                  boxShadow: "0 8px 28px rgba(242,72,63,0.25), inset 0 1px 0 rgba(255,255,255,0.2)",
                  backdropFilter: "blur(14px)",
                  color: "#fff0ee",
                }}
              >
                WRONG ✗
              </button>
            )}

            {/* START / PAUSE TIMER */}
            {!showAnswer && (
              <button
                onClick={toggleTimer}
                className={`btn-gold px-8 py-3 rounded-xl text-lg ${timerState === "idle" ? "pill-pulse" : ""}`}
                title="Space"
              >
                {timerState === "idle" ? "▶ ЦАГ ЭХЛҮҮЛЭХ" :
                 timerState === "running" ? "❚❚ ЗОГСООХ" :
                 timerState === "paused" ? "▶ ҮРГЭЛЖЛҮҮЛЭХ" : "↺ ДАХИН ЭХЛҮҮЛЭХ"}
              </button>
            )}

            {/* REVEAL ANSWER */}
            {!showAnswer && (
              <button
                onClick={() => {
                  stopMusic();
                  if (timerState === "running" || timerState === "paused") setTimerState("done");
                  setShowAnswer(true);
                  sfx.reveal();
                }}
                className="btn-blue px-8 py-3 rounded-xl text-lg"
              >
                REVEAL ANSWER
              </button>
            )}

            {/* NO ONE / close */}
            <button
              onClick={skipQuestion}
              className="btn-blue px-6 py-3 rounded-xl text-lg"
            >
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
        <div
          className="min-h-dvh flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12"
          style={{ background: "transparent" }}
        >
          <Image
            src="/astro-nots.png"
            width={56}
            height={56}
            alt=""
            className="mb-4"
          />
          <h1 className="retro-title text-4xl sm:text-6xl text-[var(--gold)] mb-1">
            FINAL
          </h1>
          <h2 className="retro-title text-2xl sm:text-4xl sp-glow text-[var(--cream)] tracking-widest mb-2">
            JEOPARDY!
          </h2>
          <div className="star-divider w-80 max-w-full mb-8" />

          <div className="retro-panel rounded-2xl p-5 sm:p-8 w-full max-w-lg space-y-5">
            <div>
              <label className="retro-title text-sm tracking-widest text-[var(--sp-blue-glow)] block mb-2">
                FINAL CLUE
              </label>
              <textarea
                rows={3}
                placeholder="Enter the final clue..."
                value={finalClue}
                onChange={(e) => setFinalClue(e.target.value)}
                className="w-full px-4 py-2 rounded text-[var(--cream)]  focus:outline-none resize-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid var(--sp-blue)",
                  fontFamily: "var(--font-body)",
                  fontSize: "1rem",
                }}
              />
            </div>
            <div>
              <label className="retro-title text-sm tracking-widest text-[var(--gold)] block mb-2">
                FINAL ANSWER
              </label>
              <input
                type="text"
                placeholder="Enter the answer..."
                value={finalAnswer}
                onChange={(e) => setFinalAnswer(e.target.value)}
                className="w-full px-4 py-2 rounded text-[var(--cream)]  focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "2px solid rgba(255,138,61,0.5)",
                  fontFamily: "var(--font-body)",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div>
              <label className="retro-title text-sm tracking-widest text-[var(--sp-blue-glow)] block mb-3">
                PLAYER WAGERS
              </label>
              {players.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                  <span
                    className="font-bold text-[var(--cream)] w-full sm:w-32 truncate"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {p.name}
                  </span>
                  <span
                    className="text-sm w-20 shrink-0"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--gold)",
                    }}
                  >
                    MAX ${Math.max(0, p.score)}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, p.score)}
                    placeholder="0"
                    value={finalWagers[p.id] ?? ""}
                    onChange={(e) =>
                      setFinalWagers((prev) => ({
                        ...prev,
                        [p.id]: e.target.value,
                      }))
                    }
                    className="flex-1 min-w-0 px-3 py-2 rounded text-[var(--cream)] focus:outline-none"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "2px solid rgba(95,195,195,0.4)",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => setFinalPhase("clue")}
              disabled={!finalClue.trim() || !finalAnswer.trim()}
              className="btn-gold w-full py-4 rounded text-2xl disabled:opacity-30"
            >
              SHOW FINAL CLUE!
            </button>
          </div>
        </div>
      );
    }

    if (finalPhase === "clue") {
      return (
        <div
          className="min-h-dvh flex flex-col items-center justify-center text-center px-4 sm:px-8"
          style={{
            background: "transparent",
          }}
        >
          <p className="retro-title text-lg text-[var(--sp-blue-glow)] tracking-widest mb-6">
            FINAL JEOPARDY!
          </p>
          <p
            className="flip-in font-bold text-[var(--cream)] leading-relaxed mb-12"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "clamp(1.8rem,5vw,4rem)",
              maxWidth: "800px",
            }}
          >
            {finalClue}
          </p>
          <button
            onClick={() => {
              setFinalPhase("answer");
              sfx.reveal();
            }}
            className="btn-gold px-12 py-4 rounded text-2xl"
          >
            REVEAL ANSWER
          </button>
        </div>
      );
    }

    if (finalPhase === "answer") {
      return (
        <div
          className="min-h-dvh flex flex-col items-center justify-center px-4 sm:px-8 py-8 sm:py-12"
          style={{
            background: "transparent",
          }}
        >
          <p
            className="flip-in font-bold mb-10 text-center"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "clamp(2rem,5vw,4rem)",
              color: "var(--gold)",
              textShadow: "0 0 24px rgba(255,138,61,0.4)",
            }}
          >
            {finalAnswer}
          </p>

          <p className="retro-title text-lg text-[var(--sp-blue-glow)] tracking-widest mb-6">
            WHO GOT IT RIGHT?
          </p>

          <div className="space-y-3 w-full max-w-md mb-8">
            {players.map((p) => (
              <div
                key={p.id}
                className="retro-panel rounded-xl px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 sm:gap-3"
              >
                <span
                  className="flex-1 min-w-0 truncate font-bold text-[var(--cream)]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {p.name}
                </span>
                <span
                  className="shrink-0"
                  style={{
                    fontFamily: "var(--font-mono)",
                    color: "var(--gold)",
                    fontSize: "0.75rem",
                  }}
                >
                  WAGER ${finalWagers[p.id] ?? 0}
                </span>
                <button
                  onClick={() =>
                    setFinalCorrect((prev) => ({ ...prev, [p.id]: true }))
                  }
                  className="px-3 py-1 rounded text-sm font-black transition-colors"
                  style={{
                    fontFamily: "var(--font-display)",
                    letterSpacing: "0.05em",
                    background:
                      finalCorrect[p.id] === true ? "rgba(80,220,150,0.5)" : "rgba(80,220,150,0.08)",
                    border: "1px solid rgba(120,240,180,0.5)",
                    color: "white",
                  }}
                >
                  CORRECT
                </button>
                <button
                  onClick={() =>
                    setFinalCorrect((prev) => ({ ...prev, [p.id]: false }))
                  }
                  className="px-3 py-1 rounded text-sm font-black transition-colors"
                  style={{
                    fontFamily: "var(--font-display)",
                    letterSpacing: "0.05em",
                    background:
                      finalCorrect[p.id] === false ? "rgba(242,72,63,0.55)" : "rgba(242,72,63,0.08)",
                    border: "1px solid rgba(255,130,120,0.5)",
                    color: "white",
                  }}
                >
                  WRONG
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setPlayers((prev) =>
                prev.map((p) => {
                  const wager = parseInt(finalWagers[p.id] ?? "0") || 0;
                  const correct = finalCorrect[p.id];
                  if (correct === undefined) return p;
                  return { ...p, score: p.score + (correct ? wager : -wager) };
                }),
              );
              setFinalPhase("results");
              sfx.fanfare();
            }}
            className="btn-gold px-12 py-4 rounded text-2xl"
          >
            SEE FINAL SCORES!
          </button>
        </div>
      );
    }

    /* RESULTS */
    const sorted = [...players].sort((a, b) => b.score - a.score);
    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12"
        style={{ background: "transparent" }}
      >
        <ShootingStars />
        <Confetti count={140} />
        <div className="relative mb-4 floaty">
          <div className="logo-orbit" />
          <Image src="/astro-nots.png" width={96} height={96} alt="" className="relative" />
        </div>
        <h1 className="retro-title drop-in text-4xl sm:text-6xl text-gradient mb-1 text-center">
          FINAL SCORES
        </h1>
        <div className="star-divider w-80 max-w-full mb-8" />

        <div className="w-full max-w-md space-y-3 mb-8">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`rise-in flex items-center gap-4 rounded-xl px-6 py-4 ${i === 0 ? "winner-glow" : ""}`}
              style={{
                // reveal from last place up to the winner
                animationDelay: i === 0 ? `${(sorted.length - 1) * 0.35 + 0.3}s, ${(sorted.length - 1) * 0.35 + 0.8}s` : `${(sorted.length - 1 - i) * 0.35}s`,
                background:
                  i === 0
                    ? "linear-gradient(90deg,rgba(95,195,195,0.12),rgba(255,138,61,0.14))"
                    : "var(--bg-card)",
                border:
                  i === 0
                    ? "1px solid var(--gold)"
                    : "1px solid var(--sp-blue)",
                boxShadow:
                  i === 0
                    ? "0 0 24px rgba(255,138,61,0.2), 0 0 8px rgba(95,195,195,0.3)"
                    : "0 0 8px rgba(95,195,195,0.15)",
              }}
            >
              <span
                className="retro-title text-3xl w-10 text-center"
                style={{
                  color: i === 0 ? "var(--gold)" : "rgba(243,233,210,0.6)",
                }}
              >
                {i + 1}
              </span>
              <span
                className="flex-1 font-bold text-[var(--cream)] text-xl"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {p.name}
              </span>
              <span
                className="retro-title text-2xl"
                style={{ color: p.score < 0 ? "#ff6a62" : "var(--gold)" }}
              >
                {p.score < 0 ? `-$${Math.abs(p.score)}` : `$${p.score}`}
              </span>
              {i === 0 && <span className="text-xl">🏆</span>}
            </div>
          ))}
        </div>

        <Link
          href={game.folderId ? `/?f=${game.folderId}` : "/"}
          onClick={() => clearSession(gameId)}
          className="btn-blue px-10 py-3 rounded text-xl text-[var(--cream)]"
          style={{ textDecoration: "none" }}
        >
          PLAY AGAIN
        </Link>
      </div>
    );
  }

  return null;
}

/* ── renders 1 image large, 2+ side-by-side in a row ── */
function ImageRow({
  images,
  borderColor,
  glowColor,
}: {
  images: string[];
  borderColor: string;
  glowColor: string;
}) {
  if (images.length === 0) return null;

  const single = images.length === 1;

  return (
    <div
      className={`flip-in w-full flex gap-3 justify-center ${single ? "max-w-2xl" : "max-w-4xl"} mx-auto`}
    >
      {images.map((src, i) => (
        <div
          key={i}
          className="relative flex-1 rounded-xl overflow-hidden"
          style={{
            height: single ? "min(50vh,400px)" : "min(42vh,300px)",
            maxWidth: single
              ? undefined
              : `${Math.min(100 / images.length, 50)}vw`,
            border: `3px solid ${borderColor}`,
            boxShadow: `0 0 24px ${glowColor}`,
          }}
        >
          <Image
            src={src}
            alt={`img-${i + 1}`}
            fill
            className="object-contain"
            unoptimized
          />
          {images.length > 1 && (
            <span
              className="absolute bottom-1 right-2 retro-title text-sm"
              style={{ color: borderColor, textShadow: `0 0 8px ${glowColor}` }}
            >
              {i + 1}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
