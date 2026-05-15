"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Game } from "@/types";
import PasswordModal, { isAuthed } from "@/components/PasswordModal";

type PendingAction =
  | { type: "new" }
  | { type: "edit"; gameId: string }
  | { type: "delete"; game: Game };

export default function HomePage() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);

  useEffect(() => {
    fetch("/api/games").then((r) => r.json()).then(setGames);
  }, []);

  function guard(action: PendingAction) {
    if (isAuthed()) {
      execute(action);
    } else {
      setPending(action);
    }
  }

  function execute(action: PendingAction) {
    if (action.type === "new") {
      setShowNew(true);
    } else if (action.type === "edit") {
      router.push(`/admin/${action.gameId}`);
    } else if (action.type === "delete") {
      doDelete(action.game);
    }
    setPending(null);
  }

  async function createGame() {
    if (!title.trim()) return;
    setCreating(true);
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        categories: Array.from({ length: 6 }, (_, ci) => ({
          id: crypto.randomUUID(),
          name: `Category ${ci + 1}`,
          questions: [100, 200, 300, 400, 500].map((v) => ({
            id: crypto.randomUUID(),
            value: v, clue: "", answer: "",
            isDailyDouble: false, answered: false,
          })),
        })),
      }),
    });
    const game: Game = await res.json();
    setGames((prev) => [...prev, game]);
    setTitle("");
    setShowNew(false);
    setCreating(false);
  }

  async function doDelete(game: Game) {
    await fetch(`/api/games/${game.id}`, { method: "DELETE" });
    setGames((prev) => prev.filter((g) => g.id !== game.id));
  }

  const actionLabel =
    pending?.type === "new" ? "create a new game" :
    pending?.type === "edit" ? "edit this game" :
    pending?.type === "delete" ? "delete this game" : "";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-deep)" }}>
      {/* password modal */}
      {pending && (
        <PasswordModal
          action={actionLabel}
          onSuccess={() => execute(pending)}
          onCancel={() => setPending(null)}
        />
      )}

      {/* ── HEADER ── */}
      <header className="relative overflow-hidden"
        style={{ background: "linear-gradient(180deg,#060d3a 0%,#04051a 100%)", borderBottom: "3px solid var(--sp-blue)", boxShadow: "0 0 40px rgba(0,84,255,0.4)" }}>
        <div className="absolute top-3 left-4 opacity-30">
          <Image src="/sp-logo.svg" width={28} height={28} alt="" />
        </div>
        <div className="absolute top-3 right-4 opacity-30">
          <Image src="/sp-logo.svg" width={28} height={28} alt="" />
        </div>
        <div className="flex flex-col items-center py-8 gap-4">
          <Image src="/sp-logo.svg" width={72} height={72} alt="StorePay" />
          <h1 className="retro-title text-7xl text-[var(--gold)]">STOREPAY</h1>
          <div className="star-divider w-64 mb-1" />
          <h2 className="retro-title text-4xl sp-glow text-white tracking-widest">JEOPARDY!</h2>
          <p style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(180,200,255,0.7)", fontSize: "0.75rem", letterSpacing: "0.15em" }}>
            THE ULTIMATE QUIZ CHALLENGE
          </p>
        </div>
        <div className="star-divider w-full" />
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="retro-title text-3xl text-white tracking-wider"
            style={{ textShadow: "0 0 10px rgba(0,84,255,0.5)" }}>
            GAME LIBRARY
          </h2>
          <button onClick={() => guard({ type: "new" })} className="btn-gold px-6 py-2 rounded text-lg">
            + NEW GAME
          </button>
        </div>

        {/* new game form — only shown after password */}
        {showNew && (
          <div className="retro-panel rounded-xl p-6 mb-6">
            <h3 className="retro-title text-2xl text-[var(--gold)] mb-4 tracking-wider">CREATE NEW GAME</h3>
            <div className="flex gap-3">
              <input
                autoFocus
                type="text"
                placeholder="Enter game title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createGame()}
                className="flex-1 rounded px-4 py-2 text-white placeholder-blue-400 text-lg focus:outline-none"
                style={{ background: "#07102a", border: "2px solid var(--sp-blue)", fontFamily: "'Oswald',sans-serif" }}
              />
              <button onClick={createGame} disabled={creating || !title.trim()}
                className="btn-gold px-6 py-2 rounded text-lg disabled:opacity-40">
                {creating ? "CREATING..." : "CREATE"}
              </button>
              <button onClick={() => setShowNew(false)} className="btn-blue px-5 py-2 rounded text-lg text-white">
                CANCEL
              </button>
            </div>
          </div>
        )}

        {games.length === 0 ? (
          <div className="text-center py-20">
            <Image src="/sp-logo.svg" width={64} height={64} alt="" className="mx-auto mb-6 opacity-20" />
            <p className="retro-title text-2xl text-blue-400 tracking-wider">NO GAMES YET</p>
            <p style={{ color: "rgba(150,170,255,0.5)", fontFamily: "'Share Tech Mono',monospace", fontSize: "0.8rem", marginTop: "0.5rem" }}>
              CREATE A GAME TO GET STARTED
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {games.map((game, i) => (
              <div key={game.id}
                className="retro-panel rounded-xl px-6 py-4 flex items-center gap-4 transition-all hover:shadow-[0_0_24px_rgba(0,84,255,0.3)]">
                <div className="w-10 h-10 rounded flex items-center justify-center text-lg font-black shrink-0"
                  style={{ background: "var(--sp-blue)", fontFamily: "'Bebas Neue',sans-serif", color: "var(--gold)", boxShadow: "0 0 8px rgba(0,84,255,0.6)" }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="retro-title text-xl text-white truncate tracking-wide">{game.title}</p>
                  <p style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(120,160,255,0.7)", fontSize: "0.7rem", letterSpacing: "0.1em" }}>
                    {game.categories.length} CATEGORIES · {new Date(game.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/play/${game.id}`}
                    className="btn-gold px-5 py-2 rounded text-base" style={{ textDecoration: "none" }}>
                    PLAY
                  </Link>
                  <button onClick={() => guard({ type: "edit", gameId: game.id })}
                    className="btn-blue px-5 py-2 rounded text-base text-white">
                    EDIT
                  </button>
                  <button
                    onClick={() => guard({ type: "delete", game })}
                    className="px-4 py-2 rounded text-base font-black tracking-wider transition-colors"
                    style={{ fontFamily: "'Bebas Neue',sans-serif", background: "linear-gradient(180deg,#cc2200,#880000)", border: "2px solid #ff4422", boxShadow: "0 3px 0 #440000", color: "white" }}>
                    DEL
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-6" style={{ borderTop: "1px solid rgba(0,84,255,0.2)" }}>
        <div className="flex items-center justify-center gap-3">
          <Image src="/sp-logo.svg" width={16} height={16} alt="" className="opacity-40" />
          <span style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(100,130,255,0.4)", fontSize: "0.65rem", letterSpacing: "0.2em" }}>
            STOREPAY JEOPARDY © {new Date().getFullYear()}
          </span>
          <Image src="/sp-logo.svg" width={16} height={16} alt="" className="opacity-40" />
        </div>
      </footer>
    </div>
  );
}
