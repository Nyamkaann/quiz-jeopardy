"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Game, Category, Question } from "@/types";
import PasswordModal, { isAuthed } from "@/components/PasswordModal";

const VALUES = [100, 200, 300, 400, 500];
type MediaField = "clueImage" | "clueAudio" | "answerImage" | "answerAudio";

export default function AdminPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<{ catId: string; qId: string } | null>(null);
  const [uploading, setUploading] = useState<MediaField | null>(null);
  const fileRefs: Record<MediaField, React.RefObject<HTMLInputElement | null>> = {
    clueImage: useRef<HTMLInputElement>(null),
    clueAudio: useRef<HTMLInputElement>(null),
    answerImage: useRef<HTMLInputElement>(null),
    answerAudio: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    setAuthed(isAuthed());
  }, []);

  useEffect(() => {
    if (authed) {
      fetch(`/api/games/${gameId}`).then((r) => r.json()).then(setGame);
    }
  }, [authed, gameId]);

  async function save(updated: Game) {
    setSaving(true);
    await fetch(`/api/games/${gameId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updateTitle(title: string) {
    if (!game) return;
    setGame({ ...game, title });
  }

  function updateCategoryName(catId: string, name: string) {
    if (!game) return;
    setGame({ ...game, categories: game.categories.map((c) => c.id === catId ? { ...c, name } : c) });
  }

  function updateQuestion(catId: string, qId: string, patch: Partial<Question>) {
    if (!game) return;
    setGame({
      ...game,
      categories: game.categories.map((c) =>
        c.id === catId
          ? { ...c, questions: c.questions.map((q) => q.id === qId ? { ...q, ...patch } : q) }
          : c
      ),
    });
  }

  async function uploadFile(catId: string, qId: string, field: MediaField, file: File) {
    setUploading(field);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const { url } = await res.json();
    updateQuestion(catId, qId, { [field]: url });
    setUploading(null);
  }

  function clearMedia(catId: string, qId: string, field: MediaField) {
    updateQuestion(catId, qId, { [field]: undefined });
    const ref = fileRefs[field];
    if (ref.current) ref.current.value = "";
  }

  function addCategory() {
    if (!game) return;
    const newCat: Category = {
      id: crypto.randomUUID(),
      name: `Category ${game.categories.length + 1}`,
      questions: VALUES.map((v) => ({
        id: crypto.randomUUID(), value: v, clue: "", answer: "",
        isDailyDouble: false, answered: false,
      })),
    };
    setGame({ ...game, categories: [...game.categories, newCat] });
  }

  function removeCategory(catId: string) {
    if (!game) return;
    setGame({ ...game, categories: game.categories.filter((c) => c.id !== catId) });
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-deep)" }}>
        <PasswordModal
          action="edit this game"
          onSuccess={() => setAuthed(true)}
          onCancel={() => router.push("/")}
        />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-deep)" }}>
        <div className="flex flex-col items-center gap-4">
          <Image src="/sp-logo.svg" width={48} height={48} alt="" className="animate-pulse opacity-60" />
          <p className="retro-title text-2xl text-blue-400 tracking-widest">LOADING...</p>
        </div>
      </div>
    );
  }

  const editingQ = editing
    ? game.categories.find((c) => c.id === editing.catId)?.questions.find((q) => q.id === editing.qId) ?? null
    : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-deep)" }}>
      {/* ── HEADER ── */}
      <header style={{ background: "linear-gradient(180deg,#060d3a 0%,#04051a 100%)", borderBottom: "3px solid var(--sp-blue)", boxShadow: "0 0 24px rgba(0,84,255,0.4)" }}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-70">
              <Image src="/sp-logo.svg" width={28} height={28} alt="StorePay" />
              <span style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(120,160,255,0.7)", fontSize: "0.75rem", letterSpacing: "0.15em" }}>
                ← HOME
              </span>
            </Link>
            <div style={{ width: 1, height: 24, background: "rgba(0,84,255,0.4)" }} />
            <h1 className="retro-title text-2xl text-[var(--gold)] tracking-widest">GAME EDITOR</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href={`/play/${game.id}`}
              className="btn-gold px-5 py-2 rounded text-base" style={{ textDecoration: "none" }}>
              ▶ PLAY
            </Link>
            <button
              onClick={() => save(game)}
              disabled={saving}
              className="btn-blue px-5 py-2 rounded text-base text-white disabled:opacity-50"
            >
              {saving ? "SAVING..." : saved ? "✓ SAVED!" : "SAVE"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Title field */}
        <div className="mb-8">
          <label className="retro-title text-sm tracking-widest text-blue-400 block mb-2">GAME TITLE</label>
          <input
            type="text"
            value={game.title}
            onChange={(e) => updateTitle(e.target.value)}
            className="text-white text-2xl font-bold w-full max-w-lg px-4 py-3 rounded focus:outline-none retro-title tracking-wider"
            style={{ background: "#07102a", border: "2px solid var(--sp-blue)", boxShadow: "0 0 10px rgba(0,84,255,0.2)" }}
          />
        </div>

        {/* Board grid */}
        <div className="overflow-x-auto pb-4">
          <div className="grid gap-3 min-w-max"
            style={{ gridTemplateColumns: `repeat(${game.categories.length}, 180px)` }}>

            {/* Category header inputs */}
            {game.categories.map((cat) => (
              <div key={cat.id} className="relative group">
                <input
                  type="text"
                  value={cat.name}
                  onChange={(e) => updateCategoryName(cat.id, e.target.value)}
                  className="cat-header w-full px-2 py-3 text-center text-white text-sm rounded focus:outline-none"
                  style={{ textTransform: "uppercase" }}
                />
                <button
                  onClick={() => removeCategory(cat.id)}
                  className="absolute -top-2 -right-2 hidden group-hover:flex w-6 h-6 rounded-full items-center justify-center text-xs font-black"
                  style={{ background: "#cc2200", border: "1px solid #ff4422", color: "white" }}
                >×</button>
              </div>
            ))}

            {/* Question tiles */}
            {VALUES.map((val) =>
              game.categories.map((cat) => {
                const q = cat.questions.find((q) => q.value === val);
                if (!q) return null;
                const isEmpty = !q.clue.trim() && !q.clueImage && !q.clueAudio;
                const hasMedia = q.clueImage || q.clueAudio || q.answerImage || q.answerAudio;
                return (
                  <button
                    key={`${cat.id}-${val}`}
                    onClick={() => setEditing({ catId: cat.id, qId: q.id })}
                    className="board-tile h-20 rounded flex flex-col items-center justify-center relative"
                    style={{ opacity: isEmpty ? 0.5 : 1 }}
                  >
                    <span className="retro-title text-2xl" style={{ color: isEmpty ? "rgba(100,130,255,0.5)" : "var(--gold)" }}>
                      {isEmpty ? "?" : `$${val}`}
                    </span>
                    {hasMedia && (
                      <span className="absolute top-1 right-2 text-xs flex gap-1">
                        {(q.clueImage || q.answerImage) && <span>🖼</span>}
                        {(q.clueAudio || q.answerAudio) && <span>🔊</span>}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <button onClick={addCategory} className="btn-blue px-5 py-2 rounded text-base text-white">
            + ADD CATEGORY
          </button>
          <p style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(100,130,255,0.5)", fontSize: "0.7rem", letterSpacing: "0.1em" }}>
            CLICK A TILE TO EDIT · ? = EMPTY · 🖼 IMAGE · 🔊 AUDIO
          </p>
        </div>
      </main>

      {/* ── QUESTION EDIT MODAL ── */}
      {editing && editingQ && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto"
          style={{ background: "rgba(4,5,26,0.92)" }}
          onClick={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <div className="retro-frame rounded-2xl w-full max-w-xl my-8" style={{ background: "var(--bg-card)" }}>
            {/* modal header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "2px solid var(--sp-blue)", background: "linear-gradient(90deg,#060d3a,#04051a)" }}>
              <div className="flex items-center gap-3">
                <Image src="/sp-logo.svg" width={24} height={24} alt="" />
                <h2 className="retro-title text-xl text-[var(--gold)] tracking-wider">
                  ${editingQ.value} — {game.categories.find((c) => c.id === editing.catId)?.name?.toUpperCase()}
                </h2>
              </div>
              <button onClick={() => setEditing(null)}
                className="text-blue-400 hover:text-white text-2xl leading-none transition-colors">×</button>
            </div>

            <div className="p-6 space-y-6">
              {/* CLUE */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1" style={{ background: "var(--sp-blue)", opacity: 0.4 }} />
                  <span className="retro-title text-sm text-[var(--sp-blue-glow)] tracking-widest px-2">CLUE</span>
                  <div className="h-px flex-1" style={{ background: "var(--sp-blue)", opacity: 0.4 }} />
                </div>

                <label className="block text-xs tracking-widest mb-1" style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(120,160,255,0.6)" }}>TEXT</label>
                <textarea
                  rows={2}
                  placeholder="Enter the clue..."
                  value={editingQ.clue}
                  onChange={(e) => updateQuestion(editing.catId, editing.qId, { clue: e.target.value })}
                  className="w-full px-4 py-2 rounded text-white placeholder-blue-800 focus:outline-none resize-none mb-3"
                  style={{ background: "#07102a", border: "2px solid rgba(0,84,255,0.5)", fontFamily: "'Oswald',sans-serif", fontSize: "1rem" }}
                />

                <div className="grid grid-cols-2 gap-3">
                  <MediaUpload label="IMAGE" field="clueImage" url={editingQ.clueImage}
                    accept="image/*" uploading={uploading}
                    fileRef={fileRefs.clueImage}
                    onUpload={(f) => uploadFile(editing.catId, editing.qId, "clueImage", f)}
                    onClear={() => clearMedia(editing.catId, editing.qId, "clueImage")}
                    onUrl={(u) => updateQuestion(editing.catId, editing.qId, { clueImage: u })} />
                  <MediaUpload label="AUDIO" field="clueAudio" url={editingQ.clueAudio}
                    accept="audio/*" uploading={uploading}
                    fileRef={fileRefs.clueAudio}
                    onUpload={(f) => uploadFile(editing.catId, editing.qId, "clueAudio", f)}
                    onClear={() => clearMedia(editing.catId, editing.qId, "clueAudio")}
                    onUrl={(u) => updateQuestion(editing.catId, editing.qId, { clueAudio: u })} />
                </div>
              </section>

              {/* ANSWER */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1" style={{ background: "var(--gold)", opacity: 0.4 }} />
                  <span className="retro-title text-sm text-[var(--gold)] tracking-widest px-2">ANSWER</span>
                  <div className="h-px flex-1" style={{ background: "var(--gold)", opacity: 0.4 }} />
                </div>

                <label className="block text-xs tracking-widest mb-1" style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(120,160,255,0.6)" }}>TEXT</label>
                <input
                  type="text"
                  placeholder='e.g. "What is the Sun?"'
                  value={editingQ.answer}
                  onChange={(e) => updateQuestion(editing.catId, editing.qId, { answer: e.target.value })}
                  className="w-full px-4 py-2 rounded text-white placeholder-blue-800 focus:outline-none mb-3"
                  style={{ background: "#07102a", border: "2px solid rgba(255,215,0,0.4)", fontFamily: "'Oswald',sans-serif", fontSize: "1rem" }}
                />

                <div className="grid grid-cols-2 gap-3">
                  <MediaUpload label="IMAGE" field="answerImage" url={editingQ.answerImage}
                    accept="image/*" uploading={uploading}
                    fileRef={fileRefs.answerImage}
                    onUpload={(f) => uploadFile(editing.catId, editing.qId, "answerImage", f)}
                    onClear={() => clearMedia(editing.catId, editing.qId, "answerImage")}
                    onUrl={(u) => updateQuestion(editing.catId, editing.qId, { answerImage: u })} />
                  <MediaUpload label="AUDIO" field="answerAudio" url={editingQ.answerAudio}
                    accept="audio/*" uploading={uploading}
                    fileRef={fileRefs.answerAudio}
                    onUpload={(f) => uploadFile(editing.catId, editing.qId, "answerAudio", f)}
                    onClear={() => clearMedia(editing.catId, editing.qId, "answerAudio")}
                    onUrl={(u) => updateQuestion(editing.catId, editing.qId, { answerAudio: u })} />
                </div>
              </section>

              <div className="flex justify-end pt-2">
                <button onClick={() => setEditing(null)} className="btn-gold px-8 py-2 rounded text-lg">
                  DONE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── inline media upload sub-component ── */
function MediaUpload({
  label, field, url, accept, uploading, fileRef, onUpload, onClear, onUrl,
}: {
  label: string;
  field: MediaField;
  url?: string;
  accept: string;
  uploading: MediaField | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (f: File) => void;
  onClear: () => void;
  onUrl: (url: string) => void;
}) {
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState("");
  const isImage = accept.startsWith("image");

  function applyUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onUrl(trimmed);
    setUrlInput("");
  }

  return (
    <div>
      <label className="block text-xs tracking-widest mb-1" style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(120,160,255,0.6)" }}>
        {label}
      </label>

      {url ? (
        /* ── preview ── */
        <div className="relative group rounded overflow-hidden" style={{ border: "2px solid rgba(0,84,255,0.4)", minHeight: 80 }}>
          {isImage ? (
            <div className="relative h-20">
              <Image src={url} alt={label} fill className="object-contain" unoptimized />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 px-2 py-2" style={{ background: "#07102a" }}>
              <span className="text-xl">🔊</span>
              <audio controls src={url} className="w-full" style={{ height: 28 }} />
            </div>
          )}
          <button
            onClick={onClear}
            className="absolute top-1 right-1 hidden group-hover:flex w-5 h-5 rounded-full items-center justify-center text-xs font-black"
            style={{ background: "#cc2200", border: "1px solid #ff4422", color: "white" }}
          >×</button>
        </div>
      ) : (
        /* ── input panel ── */
        <div className="rounded overflow-hidden" style={{ border: "2px solid rgba(0,84,255,0.3)", background: "#07102a" }}>
          {/* tab bar */}
          <div className="flex" style={{ borderBottom: "1px solid rgba(0,84,255,0.2)" }}>
            {(["upload", "url"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-1 text-xs tracking-widest transition-colors"
                style={{
                  fontFamily: "'Share Tech Mono',monospace",
                  background: tab === t ? "rgba(0,84,255,0.2)" : "transparent",
                  color: tab === t ? "rgba(180,210,255,0.9)" : "rgba(100,130,255,0.4)",
                  borderBottom: tab === t ? "2px solid var(--sp-blue)" : "2px solid transparent",
                }}
              >
                {t === "upload" ? "📁 FILE" : "🔗 URL"}
              </button>
            ))}
          </div>

          {tab === "upload" ? (
            <>
              <input ref={fileRef} type="file" accept={accept} className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading === field}
                className="w-full py-4 flex flex-col items-center justify-center gap-1 transition-all"
                style={{ color: "rgba(100,130,255,0.5)" }}
              >
                <span className="text-xl">{isImage ? "🖼" : "🔊"}</span>
                <span className="text-xs tracking-widest" style={{ fontFamily: "'Share Tech Mono',monospace" }}>
                  {uploading === field ? "UPLOADING..." : "CHOOSE FILE"}
                </span>
              </button>
            </>
          ) : (
            <div className="p-2 flex gap-1">
              <input
                type="url"
                placeholder={isImage ? "https://example.com/image.jpg" : "https://example.com/audio.mp3"}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyUrl()}
                className="flex-1 px-2 py-1 rounded text-white text-xs focus:outline-none"
                style={{ background: "#04051a", border: "1px solid rgba(0,84,255,0.3)", fontFamily: "'Share Tech Mono',monospace" }}
              />
              <button
                onClick={applyUrl}
                disabled={!urlInput.trim()}
                className="px-3 py-1 rounded text-xs font-black disabled:opacity-30"
                style={{ fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em", background: "var(--sp-blue)", color: "white" }}
              >
                USE
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
