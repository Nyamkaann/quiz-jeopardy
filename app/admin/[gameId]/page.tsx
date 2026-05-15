"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Game, Category, Question } from "@/types";
import PasswordModal, { isAuthed } from "@/components/PasswordModal";
import { getClueImages, getAnswerImages } from "@/lib/media";

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

  function addImage(catId: string, qId: string, field: "clueImages" | "answerImages", url: string) {
    if (!game) return;
    const q = game.categories.find((c) => c.id === catId)?.questions.find((q) => q.id === qId);
    if (!q) return;
    const existing = q[field] ?? [];
    updateQuestion(catId, qId, { [field]: [...existing, url] });
  }

  function removeImage(catId: string, qId: string, field: "clueImages" | "answerImages", idx: number) {
    if (!game) return;
    const q = game.categories.find((c) => c.id === catId)?.questions.find((q) => q.id === qId);
    if (!q) return;
    const existing = [...(q[field] ?? [])];
    existing.splice(idx, 1);
    updateQuestion(catId, qId, { [field]: existing });
  }

  async function uploadImageMulti(catId: string, qId: string, field: "clueImages" | "answerImages", file: File) {
    setUploading(field === "clueImages" ? "clueImage" : "answerImage");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const { url } = await res.json();
    addImage(catId, qId, field, url);
    setUploading(null);
  }

  function addCategory() {
    if (!game) return;
    const numRows = Math.max(...game.categories.map((c) => c.questions.length), 5);
    const firstCat = game.categories[0];
    const defaultValues = firstCat
      ? [...firstCat.questions].sort((a, b) => a.value - b.value).map((q) => q.value)
      : [100, 200, 300, 400, 500];
    const values = defaultValues.length >= numRows
      ? defaultValues.slice(0, numRows)
      : [...defaultValues, ...Array.from({ length: numRows - defaultValues.length }, (_, i) => (defaultValues[defaultValues.length - 1] ?? 100) + (i + 1) * 100)];
    const newCat: Category = {
      id: crypto.randomUUID(),
      name: `Category ${game.categories.length + 1}`,
      questions: values.map((v) => ({
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

            {/* Question tiles — rendered by row index, sorted by value */}
            {Array.from({ length: Math.max(...game.categories.map((c) => c.questions.length), 1) }).map((_, rowIdx) =>
              game.categories.map((cat) => {
                const sorted = [...cat.questions].sort((a, b) => a.value - b.value);
                const q = sorted[rowIdx];
                if (!q) return <div key={`${cat.id}-r${rowIdx}`} />;
                const isEmpty = !q.clue.trim() && !q.clueImage && !q.clueAudio;
                const hasMedia = q.clueImage || q.clueAudio || q.answerImage || q.answerAudio;
                return (
                  <button
                    key={`${cat.id}-${q.id}`}
                    onClick={() => setEditing({ catId: cat.id, qId: q.id })}
                    className="board-tile h-20 rounded flex flex-col items-center justify-center relative"
                    style={{ opacity: isEmpty ? 0.5 : 1 }}
                  >
                    <span className="retro-title text-2xl" style={{ color: isEmpty ? "rgba(100,130,255,0.5)" : "var(--gold)" }}>
                      {isEmpty ? "?" : `$${q.value}`}
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
              {/* VALUE */}
              <div className="flex items-center gap-4">
                <label className="retro-title text-sm tracking-widest text-[var(--gold)] shrink-0">POINT VALUE</label>
                <div className="flex items-center gap-2 flex-1">
                  <span className="retro-title text-xl text-[var(--gold)]">$</span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={editingQ.value}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 0) updateQuestion(editing.catId, editing.qId, { value: v });
                    }}
                    className="w-32 px-3 py-2 rounded text-white focus:outline-none retro-title text-xl"
                    style={{ background: "#07102a", border: "2px solid rgba(255,215,0,0.6)", color: "var(--gold)" }}
                  />
                </div>
                <p style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(120,160,255,0.5)", fontSize: "0.65rem", letterSpacing: "0.1em" }}>
                  SET ANY AMOUNT
                </p>
              </div>

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

                <MultiImageUpload
                  label="IMAGES"
                  images={getClueImages(editingQ)}
                  uploading={uploading === "clueImage"}
                  onUpload={(f) => uploadImageMulti(editing.catId, editing.qId, "clueImages", f)}
                  onUrl={(u) => addImage(editing.catId, editing.qId, "clueImages", u)}
                  onRemove={(i) => {
                    // remove from legacy field if index 0 and legacy exists
                    if (i === 0 && editingQ.clueImage) {
                      updateQuestion(editing.catId, editing.qId, { clueImage: undefined });
                    } else {
                      const offset = editingQ.clueImage ? 1 : 0;
                      removeImage(editing.catId, editing.qId, "clueImages", i - offset);
                    }
                  }}
                />
                <MediaUpload label="AUDIO" field="clueAudio" url={editingQ.clueAudio}
                  accept="audio/*" uploading={uploading}
                  fileRef={fileRefs.clueAudio}
                  onUpload={(f) => uploadFile(editing.catId, editing.qId, "clueAudio", f)}
                  onClear={() => clearMedia(editing.catId, editing.qId, "clueAudio")}
                  onUrl={(u) => updateQuestion(editing.catId, editing.qId, { clueAudio: u })} />
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

                <MultiImageUpload
                  label="IMAGES"
                  images={getAnswerImages(editingQ)}
                  uploading={uploading === "answerImage"}
                  onUpload={(f) => uploadImageMulti(editing.catId, editing.qId, "answerImages", f)}
                  onUrl={(u) => addImage(editing.catId, editing.qId, "answerImages", u)}
                  onRemove={(i) => {
                    if (i === 0 && editingQ.answerImage) {
                      updateQuestion(editing.catId, editing.qId, { answerImage: undefined });
                    } else {
                      const offset = editingQ.answerImage ? 1 : 0;
                      removeImage(editing.catId, editing.qId, "answerImages", i - offset);
                    }
                  }}
                />
                <MediaUpload label="AUDIO" field="answerAudio" url={editingQ.answerAudio}
                  accept="audio/*" uploading={uploading}
                  fileRef={fileRefs.answerAudio}
                  onUpload={(f) => uploadFile(editing.catId, editing.qId, "answerAudio", f)}
                  onClear={() => clearMedia(editing.catId, editing.qId, "answerAudio")}
                  onUrl={(u) => updateQuestion(editing.catId, editing.qId, { answerAudio: u })} />
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

/* ── multi-image upload strip ── */
function MultiImageUpload({
  label, images, uploading, onUpload, onUrl, onRemove,
}: {
  label: string;
  images: string[];
  uploading: boolean;
  onUpload: (f: File) => void;
  onUrl: (url: string) => void;
  onRemove: (index: number) => void;
}) {
  const [urlInput, setUrlInput] = useState("");
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const fileRef = useRef<HTMLInputElement>(null);

  function applyUrl() {
    const t = urlInput.trim();
    if (!t) return;
    onUrl(t);
    setUrlInput("");
  }

  return (
    <div>
      <label className="block text-xs tracking-widest mb-2"
        style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(120,160,255,0.6)" }}>
        {label} {images.length > 0 && <span style={{ color: "var(--gold)" }}>({images.length})</span>}
      </label>

      {/* thumbnail strip */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {images.map((url, i) => (
            <div key={i} className="relative group rounded overflow-hidden shrink-0"
              style={{ width: 72, height: 72, border: "2px solid rgba(0,84,255,0.4)" }}>
              <Image src={url} alt={`img-${i}`} fill className="object-cover" unoptimized />
              <button
                onClick={() => onRemove(i)}
                className="absolute inset-0 hidden group-hover:flex items-center justify-center text-white text-lg font-black"
                style={{ background: "rgba(180,0,0,0.7)" }}>×</button>
              <span className="absolute bottom-0 left-0 right-0 text-center"
                style={{ background: "rgba(0,0,0,0.6)", fontFamily: "'Share Tech Mono',monospace", color: "rgba(200,220,255,0.8)", fontSize: "0.55rem" }}>
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* add input */}
      <div className="rounded overflow-hidden" style={{ border: "2px solid rgba(0,84,255,0.3)", background: "#07102a" }}>
        <div className="flex" style={{ borderBottom: "1px solid rgba(0,84,255,0.2)" }}>
          {(["upload", "url"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-1 text-xs tracking-widest transition-colors"
              style={{
                fontFamily: "'Share Tech Mono',monospace",
                background: tab === t ? "rgba(0,84,255,0.2)" : "transparent",
                color: tab === t ? "rgba(180,210,255,0.9)" : "rgba(100,130,255,0.4)",
                borderBottom: tab === t ? "2px solid var(--sp-blue)" : "2px solid transparent",
              }}>
              {t === "upload" ? "📁 FILE" : "🔗 URL"}
            </button>
          ))}
        </div>

        {tab === "upload" ? (
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => {
                Array.from(e.target.files ?? []).forEach((f) => onUpload(f));
                e.target.value = "";
              }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="w-full py-3 flex flex-col items-center justify-center gap-1"
              style={{ color: "rgba(100,130,255,0.5)" }}>
              <span className="text-lg">🖼</span>
              <span className="text-xs tracking-widest" style={{ fontFamily: "'Share Tech Mono',monospace" }}>
                {uploading ? "UPLOADING..." : images.length > 0 ? "+ ADD MORE" : "CHOOSE FILES"}
              </span>
            </button>
          </>
        ) : (
          <div className="p-2 flex gap-1">
            <input type="url" placeholder="https://example.com/image.jpg"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyUrl()}
              className="flex-1 px-2 py-1 rounded text-white text-xs focus:outline-none"
              style={{ background: "#04051a", border: "1px solid rgba(0,84,255,0.3)", fontFamily: "'Share Tech Mono',monospace" }}
            />
            <button onClick={applyUrl} disabled={!urlInput.trim()}
              className="px-3 py-1 rounded text-xs font-black disabled:opacity-30"
              style={{ fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em", background: "var(--sp-blue)", color: "white" }}>
              ADD
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
