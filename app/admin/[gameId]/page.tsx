"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Game, Category, Question } from "@/types";
import PasswordModal from "@/components/PasswordModal";
import { authFetch, checkAuth } from "@/lib/clientAuth";
import ConnectEditor, { MediaPick } from "@/components/ConnectEditor";
import { connectIsEmpty, isConnectCategory, newConnectData } from "@/lib/connect";
import { getClueImages, getAnswerImages } from "@/lib/media";

type MediaField = "clueImage" | "clueAudio" | "answerImage" | "answerAudio";

export default function AdminPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null); // null = checking with server
  const [game, setGame] = useState<Game | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<{ catId: string; qId: string } | null>(null);
  const [editingConnect, setEditingConnect] = useState<{ catId: string; qId: string } | null>(null);
  const [uploading, setUploading] = useState<MediaField | null>(null);
  const fileRefs: Record<MediaField, React.RefObject<HTMLInputElement | null>> = {
    clueImage: useRef<HTMLInputElement>(null),
    clueAudio: useRef<HTMLInputElement>(null),
    answerImage: useRef<HTMLInputElement>(null),
    answerAudio: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    checkAuth().then(setAuthed);
  }, []);

  useEffect(() => {
    if (authed) {
      fetch(`/api/games/${gameId}`).then((r) => r.json()).then(setGame);
    }
  }, [authed, gameId]);

  async function save(updated: Game) {
    setSaving(true);
    const res = await authFetch(`/api/games/${gameId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    setSaving(false);
    if (!res.ok) {
      if (res.status !== 401) alert("Хадгалж чадсангүй. Дахин оролдоно уу.");
      return;
    }
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
    const res = await authFetch("/api/upload", { method: "POST", body: form });
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
    const res = await authFetch("/api/upload", { method: "POST", body: form });
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

  /** switch a column between a normal category and a CONNECT category */
  function toggleConnect(catId: string) {
    if (!game) return;
    setGame({
      ...game,
      categories: game.categories.map((c) => {
        if (c.id !== catId) return c;
        const toConnect = !isConnectCategory(c);
        return {
          ...c,
          type: toConnect ? "connect" : "normal",
          name: toConnect && /^category \d+$/i.test(c.name.trim()) ? "CONNECT" : c.name,
          questions: toConnect
            ? c.questions.map((q) => ({ ...q, connect: q.connect ?? newConnectData() }))
            : c.questions,
        };
      }),
    });
  }

  function addConnectCategory() {
    if (!game) return;
    addCategory();
    setGame((g) => {
      if (!g) return g;
      const last = g.categories[g.categories.length - 1];
      return {
        ...g,
        categories: g.categories.map((c) =>
          c.id === last.id
            ? { ...c, type: "connect" as const, name: "CONNECT", questions: c.questions.map((q) => ({ ...q, connect: newConnectData() })) }
            : c
        ),
      };
    });
  }

  function removeCategory(catId: string) {
    if (!game) return;
    setGame({ ...game, categories: game.categories.filter((c) => c.id !== catId) });
  }

  if (authed === null) {
    return <div className="min-h-dvh" />;
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "transparent" }}>
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "transparent" }}>
        <div className="flex flex-col items-center gap-4">
          <Image src="/astro-nots.png" width={48} height={48} alt="" className="animate-pulse opacity-60" />
          <p className="retro-title text-2xl text-[var(--teal)] tracking-widest">LOADING...</p>
        </div>
      </div>
    );
  }

  const editingQ = editing
    ? game.categories.find((c) => c.id === editing.catId)?.questions.find((q) => q.id === editing.qId) ?? null
    : null;

  return (
    <div className="min-h-screen" style={{ background: "transparent" }}>
      {/* ── HEADER ── */}
      <header style={{ background: "rgba(5,13,22,0.55)", borderBottom: "1px solid var(--sp-blue)", boxShadow: "0 0 24px rgba(95,195,195,0.4)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link href={game.folderId ? `/?f=${game.folderId}` : "/"} className="flex items-center gap-2 transition-opacity hover:opacity-70 shrink-0">
              <Image src="/astro-nots.png" width={28} height={28} alt="Astro" />
              <span style={{ fontFamily: "var(--font-mono)", color: "rgba(243,233,210,0.7)", fontSize: "0.75rem", letterSpacing: "0.15em" }}>
                ← HOME
              </span>
            </Link>
            <div className="hidden sm:block shrink-0" style={{ width: 1, height: 24, background: "rgba(95,195,195,0.4)" }} />
            <h1 className="retro-title text-lg sm:text-2xl text-[var(--gold)] tracking-widest truncate">GAME EDITOR</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link href={`/play/${game.id}`}
              className="btn-gold px-5 py-2 rounded text-base flex-1 sm:flex-none text-center" style={{ textDecoration: "none" }}>
              ▶ PLAY
            </Link>
            <button
              onClick={() => save(game)}
              disabled={saving}
              className="btn-blue px-5 py-2 rounded text-base text-[var(--cream)] disabled:opacity-50 flex-1 sm:flex-none"
            >
              {saving ? "SAVING..." : saved ? "✓ SAVED!" : "SAVE"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Title field */}
        <div className="mb-8">
          <label className="retro-title text-sm tracking-widest text-[var(--teal)] block mb-2">GAME TITLE</label>
          <input
            type="text"
            value={game.title}
            onChange={(e) => updateTitle(e.target.value)}
            className="text-[var(--cream)] text-2xl font-bold w-full max-w-lg px-4 py-3 rounded focus:outline-none retro-title title-mixed tracking-wide"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--sp-blue)", boxShadow: "0 0 10px rgba(95,195,195,0.2)" }}
          />
        </div>

        {/* Timer + countdown music */}
        <div className="mb-8 glass rounded-2xl p-4 sm:p-5 grid gap-4 grid-cols-1 md:grid-cols-[auto_1fr] items-start max-w-3xl">
          <div>
            <label className="retro-title text-sm tracking-widest text-[var(--teal)] block mb-2">ЦАГ (СЕК)</label>
            <div className="flex gap-1.5">
              {[30, 45, 60, 90].map((sec) => {
                const on = (game.timerSeconds ?? 60) === sec;
                return (
                  <button key={sec} onClick={() => setGame({ ...game, timerSeconds: sec })}
                    className="retro-title rounded-lg px-3 py-2 text-sm"
                    style={{
                      color: on ? "#1a0b04" : "var(--gold)",
                      background: on ? "linear-gradient(135deg,#ffb066,var(--orange))" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${on ? "rgba(255,214,170,0.7)" : "var(--glass-border)"}`,
                    }}>
                    {sec}
                  </button>
                );
              })}
              <input
                type="number" min={5} max={600}
                value={game.timerSeconds ?? 60}
                onChange={(e) => setGame({ ...game, timerSeconds: Math.max(5, parseInt(e.target.value, 10) || 60) })}
                className="w-20 rounded-lg px-2 py-2 text-sm text-center focus:outline-none mono"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border-hi)", color: "var(--cream)" }}
              />
            </div>
          </div>
          <div>
            <label className="retro-title text-sm tracking-widest text-[var(--teal)] block mb-2">ЦАГНЫ ХӨГЖИМ</label>
            <MediaPick kind="audio" label="ДУУ ОРУУЛАХ" url={game.timerMusic}
              onSet={(url) => setGame({ ...game, timerMusic: url })} />
            <p className="mono text-[0.6rem] mt-2" style={{ color: "rgba(243,233,210,0.45)" }}>
              ХООСОН БОЛ ДОТООД «THINKING» АЯ ТОГЛОНО · ЦАГ ЭХЛҮҮЛЭХЭД ЭХЭЛЖ, БАГ ХАРИУЛАХАД ЗОГСОНО
            </p>
          </div>
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
                  className="cat-header w-full px-2 py-3 text-center text-[var(--cream)] text-sm rounded focus:outline-none"
                  style={{ textTransform: "uppercase", borderBottomColor: isConnectCategory(cat) ? "var(--teal)" : undefined }}
                />
                <button
                  onClick={() => toggleConnect(cat.id)}
                  title="Энэ ангиллыг Connect болгох / буцаах"
                  className="mt-1 w-full rounded-md py-1 mono text-[0.55rem] transition-colors"
                  style={
                    isConnectCategory(cat)
                      ? { color: "#1a0b04", background: "linear-gradient(135deg,var(--teal),#a6e6e3)", border: "1px solid var(--teal)" }
                      : { color: "rgba(243,233,210,0.45)", background: "transparent", border: "1px dashed var(--glass-border-hi)" }
                  }
                >
                  {isConnectCategory(cat) ? "✦ CONNECT" : "+ CONNECT БОЛГОХ"}
                </button>
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
                if (isConnectCategory(cat)) {
                  const empty = connectIsEmpty(q.connect);
                  return (
                    <button
                      key={`${cat.id}-${q.id}`}
                      onClick={() => setEditingConnect({ catId: cat.id, qId: q.id })}
                      className="board-tile h-20 rounded flex flex-col items-center justify-center gap-0.5"
                      style={{ opacity: empty ? 0.5 : 1, borderColor: "rgba(95,195,195,0.55)" }}
                    >
                      <span className="retro-title text-xl" style={{ color: empty ? "rgba(243,233,210,0.5)" : "var(--teal)" }}>
                        ✦ #{rowIdx + 1}
                      </span>
                      <span className="mono text-[0.55rem]" style={{ color: "rgba(243,233,210,0.5)" }}>
                        {empty ? "ХООСОН" : (q.connect?.answer || "ХАРИУЛТГҮЙ")}
                      </span>
                    </button>
                  );
                }
                const isEmpty = !q.clue.trim() && !q.clueImage && !q.clueAudio;
                const hasMedia = q.clueImage || q.clueAudio || q.answerImage || q.answerAudio;
                return (
                  <button
                    key={`${cat.id}-${q.id}`}
                    onClick={() => setEditing({ catId: cat.id, qId: q.id })}
                    className="board-tile h-20 rounded flex flex-col items-center justify-center relative"
                    style={{ opacity: isEmpty ? 0.5 : 1 }}
                  >
                    <span className="retro-title text-2xl" style={{ color: isEmpty ? "rgba(243,233,210,0.5)" : "var(--gold)" }}>
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
          <button onClick={addCategory} className="btn-blue px-5 py-2 rounded text-base text-[var(--cream)]">
            + ADD CATEGORY
          </button>
          <button onClick={addConnectCategory} className="btn-gold px-5 py-2 rounded text-base">
            + ✦ CONNECT
          </button>
          <p style={{ fontFamily: "var(--font-mono)", color: "rgba(243,233,210,0.5)", fontSize: "0.7rem", letterSpacing: "0.1em" }}>
            CLICK A TILE TO EDIT · ? = EMPTY · 🖼 IMAGE · 🔊 AUDIO
          </p>
        </div>
      </main>

      {/* ── CONNECT TILE MODAL ── */}
      {editingConnect && (() => {
        const cat = game.categories.find((c) => c.id === editingConnect.catId);
        const sorted = [...(cat?.questions ?? [])].sort((a, b) => a.value - b.value);
        const idx = sorted.findIndex((q) => q.id === editingConnect.qId);
        const q = sorted[idx];
        if (!cat || !q) return null;
        return (
          <ConnectEditor
            title={`${cat.name.toUpperCase()} · ✦ #${idx + 1}`}
            value={q.connect}
            onChange={(connect) => updateQuestion(cat.id, q.id, { connect })}
            onClose={() => setEditingConnect(null)}
          />
        );
      })()}

      {/* ── QUESTION EDIT MODAL ── */}
      {editing && editingQ && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto"
          style={{ background: "rgba(4,5,26,0.92)" }}
          onClick={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <div className="retro-frame rounded-2xl w-full max-w-xl my-8" style={{ background: "var(--bg-card)" }}>
            {/* modal header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--sp-blue)", background: "rgba(255,255,255,0.03)" }}>
              <div className="flex items-center gap-3">
                <Image src="/astro-nots.png" width={24} height={24} alt="" />
                <h2 className="retro-title text-xl text-[var(--gold)] tracking-wider">
                  ${editingQ.value} — {game.categories.find((c) => c.id === editing.catId)?.name?.toUpperCase()}
                </h2>
              </div>
              <button onClick={() => setEditing(null)}
                className="text-[var(--teal)] hover:text-[var(--cream)] text-2xl leading-none transition-colors">×</button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* VALUE */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <label className="retro-title text-sm tracking-widest text-[var(--gold)] shrink-0">POINT VALUE</label>
                <div className="flex items-center gap-2">
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
                    className="w-32 px-3 py-2 rounded text-[var(--cream)] focus:outline-none retro-title text-xl"
                    style={{ background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,138,61,0.6)", color: "var(--gold)" }}
                  />
                </div>
                <p style={{ fontFamily: "var(--font-mono)", color: "rgba(243,233,210,0.5)", fontSize: "0.65rem", letterSpacing: "0.1em" }}>
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

                <label className="block text-xs tracking-widest mb-1" style={{ fontFamily: "var(--font-mono)", color: "rgba(243,233,210,0.6)" }}>TEXT</label>
                <textarea
                  rows={2}
                  placeholder="Enter the clue..."
                  value={editingQ.clue}
                  onChange={(e) => updateQuestion(editing.catId, editing.qId, { clue: e.target.value })}
                  className="w-full px-4 py-2 rounded text-[var(--cream)]  focus:outline-none resize-none mb-3"
                  style={{ background: "rgba(255,255,255,0.05)", border: "2px solid rgba(95,195,195,0.5)", fontFamily: "var(--font-body)", fontSize: "1rem" }}
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

                <label className="block text-xs tracking-widest mb-1" style={{ fontFamily: "var(--font-mono)", color: "rgba(243,233,210,0.6)" }}>TEXT</label>
                <input
                  type="text"
                  placeholder='e.g. "What is the Sun?"'
                  value={editingQ.answer}
                  onChange={(e) => updateQuestion(editing.catId, editing.qId, { answer: e.target.value })}
                  className="w-full px-4 py-2 rounded text-[var(--cream)]  focus:outline-none mb-3"
                  style={{ background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,138,61,0.4)", fontFamily: "var(--font-body)", fontSize: "1rem" }}
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
      <label className="block text-xs tracking-widest mb-1" style={{ fontFamily: "var(--font-mono)", color: "rgba(243,233,210,0.6)" }}>
        {label}
      </label>

      {url ? (
        /* ── preview ── */
        <div className="relative group rounded overflow-hidden" style={{ border: "2px solid rgba(95,195,195,0.4)", minHeight: 80 }}>
          {isImage ? (
            <div className="relative h-20">
              <Image src={url} alt={label} fill className="object-contain" unoptimized />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 px-2 py-2" style={{ background: "rgba(255,255,255,0.05)" }}>
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
        <div className="rounded overflow-hidden" style={{ border: "2px solid rgba(95,195,195,0.3)", background: "rgba(255,255,255,0.05)" }}>
          {/* tab bar */}
          <div className="flex" style={{ borderBottom: "1px solid rgba(95,195,195,0.2)" }}>
            {(["upload", "url"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-1 text-xs tracking-widest transition-colors"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: tab === t ? "rgba(95,195,195,0.2)" : "transparent",
                  color: tab === t ? "rgba(243,233,210,0.9)" : "rgba(243,233,210,0.4)",
                  borderBottom: tab === t ? "1px solid var(--sp-blue)" : "2px solid transparent",
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
                style={{ color: "rgba(243,233,210,0.5)" }}
              >
                <span className="text-xl">{isImage ? "🖼" : "🔊"}</span>
                <span className="text-xs tracking-widest" style={{ fontFamily: "var(--font-mono)" }}>
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
                className="flex-1 px-2 py-1 rounded text-[var(--cream)] text-xs focus:outline-none"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(95,195,195,0.3)", fontFamily: "var(--font-mono)" }}
              />
              <button
                onClick={applyUrl}
                disabled={!urlInput.trim()}
                className="px-3 py-1 rounded text-xs font-black disabled:opacity-30"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em", background: "var(--sp-blue)", color: "white" }}
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
        style={{ fontFamily: "var(--font-mono)", color: "rgba(243,233,210,0.6)" }}>
        {label} {images.length > 0 && <span style={{ color: "var(--gold)" }}>({images.length})</span>}
      </label>

      {/* thumbnail strip */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {images.map((url, i) => (
            <div key={i} className="relative group rounded overflow-hidden shrink-0"
              style={{ width: 72, height: 72, border: "2px solid rgba(95,195,195,0.4)" }}>
              <Image src={url} alt={`img-${i}`} fill className="object-cover" unoptimized />
              <button
                onClick={() => onRemove(i)}
                className="absolute inset-0 hidden group-hover:flex items-center justify-center text-[var(--cream)] text-lg font-black"
                style={{ background: "rgba(180,0,0,0.7)" }}>×</button>
              <span className="absolute bottom-0 left-0 right-0 text-center"
                style={{ background: "rgba(0,0,0,0.6)", fontFamily: "var(--font-mono)", color: "rgba(243,233,210,0.8)", fontSize: "0.55rem" }}>
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* add input */}
      <div className="rounded overflow-hidden" style={{ border: "2px solid rgba(95,195,195,0.3)", background: "rgba(255,255,255,0.05)" }}>
        <div className="flex" style={{ borderBottom: "1px solid rgba(95,195,195,0.2)" }}>
          {(["upload", "url"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-1 text-xs tracking-widest transition-colors"
              style={{
                fontFamily: "var(--font-mono)",
                background: tab === t ? "rgba(95,195,195,0.2)" : "transparent",
                color: tab === t ? "rgba(243,233,210,0.9)" : "rgba(243,233,210,0.4)",
                borderBottom: tab === t ? "1px solid var(--sp-blue)" : "2px solid transparent",
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
              style={{ color: "rgba(243,233,210,0.5)" }}>
              <span className="text-lg">🖼</span>
              <span className="text-xs tracking-widest" style={{ fontFamily: "var(--font-mono)" }}>
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
              className="flex-1 px-2 py-1 rounded text-[var(--cream)] text-xs focus:outline-none"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(95,195,195,0.3)", fontFamily: "var(--font-mono)" }}
            />
            <button onClick={applyUrl} disabled={!urlInput.trim()}
              className="px-3 py-1 rounded text-xs font-black disabled:opacity-30"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "0.05em", background: "var(--sp-blue)", color: "white" }}>
              ADD
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
