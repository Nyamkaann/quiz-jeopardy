"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Player } from "@/types";
import { AnimatedScore } from "@/components/Fx";

export interface ScoreLogEntry {
  id: string;
  playerId: string;
  delta: number;
  reason: string;
  at: number;
}

const STEPS = [50, 100, 200, 250, 500];

interface Props {
  players: Player[];
  log: ScoreLogEntry[];
  onAdjust: (playerId: string, delta: number) => void;
  onSet: (playerId: string, value: number) => void;
  onRename: (playerId: string, name: string) => void;
  onAdd: (name: string) => void;
  onRemove: (playerId: string) => void;
  onUndo: (entryId: string) => void;
  onClose: () => void;
}

/** Slide-in drawer for the host to fix team scores at any moment. */
export default function ScorePanel(props: Props) {
  const { players, log, onAdjust, onSet, onRename, onAdd, onRemove, onUndo, onClose } = props;
  const [step, setStep] = useState(100);
  const [customStep, setCustomStep] = useState("");
  const [editingScore, setEditingScore] = useState<{ id: string; v: string } | null>(null);
  const [editingName, setEditingName] = useState<{ id: string; v: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [closing, setClosing] = useState(false);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  /** fade the row out, then undo */
  function undo(id: string) {
    if (leaving.has(id)) return;
    setLeaving((prev) => new Set(prev).add(id));
    setTimeout(() => {
      onUndo(id);
      setLeaving((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }, 230);
  }

  const amount = customStep.trim() ? Math.abs(parseInt(customStep, 10) || 0) : step;
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const rankOf = (id: string) => ranked.findIndex((p) => p.id === id);

  function close() {
    setClosing(true);
    setTimeout(onClose, 220);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !editingScore && !editingName) close();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !editingScore && !editingName && log[0]) {
        e.preventDefault();
        undo(log[0].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function commitScore() {
    if (!editingScore) return;
    const v = parseInt(editingScore.v, 10);
    if (!Number.isNaN(v)) onSet(editingScore.id, v);
    setEditingScore(null);
  }

  function commitName() {
    if (!editingName) return;
    if (editingName.v.trim()) onRename(editingName.id, editingName.v.trim());
    setEditingName(null);
  }

  function add() {
    if (!newName.trim()) return;
    onAdd(newName.trim());
    setNewName("");
  }

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "—";

  return createPortal(
    <div className="fixed inset-0 z-[95] flex justify-end" onMouseDown={(e) => e.target === e.currentTarget && close()}
      style={{ background: closing ? "transparent" : "rgba(3,8,14,0.45)", transition: "background 0.2s" }}>
      <aside
        className="h-full w-full sm:w-[440px] flex flex-col"
        style={{
          background: "rgba(8,20,32,0.82)",
          borderLeft: "1px solid var(--glass-border-hi)",
          backdropFilter: "blur(28px) saturate(150%)",
          WebkitBackdropFilter: "blur(28px) saturate(150%)",
          boxShadow: "-30px 0 80px rgba(0,0,0,0.5)",
          animation: `${closing ? "panelOut" : "panelIn"} 0.25s cubic-bezier(.2,.8,.2,1) both`,
        }}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <div>
            <p className="mono text-[0.6rem]" style={{ color: "var(--teal)" }}>HOST CONTROL</p>
            <h2 className="retro-title title-mixed text-xl text-[var(--cream)]">Онооны удирдлага</h2>
          </div>
          <button onClick={close} className="text-[var(--teal)] hover:text-[var(--cream)] text-3xl leading-none">×</button>
        </div>

        {/* step selector */}
        <div className="px-5 py-3 shrink-0 space-y-2" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <p className="mono text-[0.6rem]" style={{ color: "rgba(243,233,210,0.5)" }}>НЭМЭХ / ХАСАХ ХЭМЖЭЭ</p>
          <div className="flex flex-wrap gap-1.5 items-center">
            {STEPS.map((s) => {
              const on = !customStep.trim() && step === s;
              return (
                <button
                  key={s}
                  onClick={() => { setStep(s); setCustomStep(""); }}
                  className="retro-title rounded-lg px-3 py-1.5 text-sm transition-all"
                  style={{
                    color: on ? "#1a0b04" : "var(--gold)",
                    background: on ? "linear-gradient(135deg,#ffb066,var(--orange))" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${on ? "rgba(255,214,170,0.7)" : "var(--glass-border)"}`,
                  }}
                >
                  {s}
                </button>
              );
            })}
            <input
              value={customStep}
              onChange={(e) => setCustomStep(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="өөр"
              inputMode="numeric"
              className="w-16 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none mono"
              style={{
                background: customStep ? "rgba(255,138,61,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${customStep ? "rgba(255,165,82,0.6)" : "var(--glass-border)"}`,
                color: "var(--cream)",
              }}
            />
          </div>
        </div>

        {/* teams */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2.5">
          {players.length === 0 && (
            <p className="mono text-xs text-center py-8" style={{ color: "rgba(243,233,210,0.45)" }}>БАГ АЛГА</p>
          )}
          {players.map((p) => {
            const rank = rankOf(p.id);
            return (
              <div key={p.id} className="group rounded-2xl p-3"
                style={{
                  background: "linear-gradient(160deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))",
                  border: `1px solid ${rank === 0 && p.score > 0 ? "rgba(255,165,82,0.5)" : "var(--glass-border)"}`,
                }}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="retro-title text-xs w-6 text-center" style={{ color: rank === 0 ? "var(--gold)" : "rgba(243,233,210,0.4)" }}>
                    {rank === 0 && p.score > 0 ? "🏆" : `#${rank + 1}`}
                  </span>
                  {editingName?.id === p.id ? (
                    <input
                      autoFocus
                      value={editingName.v}
                      onChange={(e) => setEditingName({ id: p.id, v: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") setEditingName(null); }}
                      onBlur={commitName}
                      className="flex-1 min-w-0 rounded-lg px-2 py-1 text-sm focus:outline-none title-mixed"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--teal)", color: "var(--cream)" }}
                    />
                  ) : (
                    <button onClick={() => setEditingName({ id: p.id, v: p.name })} title="Нэр солих"
                      className="flex-1 min-w-0 text-left title-mixed text-base text-[var(--cream)] truncate hover:text-[var(--teal)] transition-colors">
                      {p.name} <span className="opacity-0 group-hover:opacity-50 text-xs">✎</span>
                    </button>
                  )}
                  <button
                    onClick={() => confirm(`«${p.name}» багийг хасах уу?`) && onRemove(p.id)}
                    title="Багийг хасах"
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-md text-xs"
                    style={{ color: "#ff8a83", background: "rgba(242,72,63,0.12)", border: "1px solid rgba(242,72,63,0.4)" }}
                  >×</button>
                </div>

                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                  <button onClick={() => amount && onAdjust(p.id, -amount)} disabled={!amount}
                    className="rounded-xl w-16 h-12 retro-title text-base disabled:opacity-30 transition-all active:scale-95"
                    style={{ background: "rgba(242,72,63,0.14)", border: "1px solid rgba(242,72,63,0.45)", color: "#ff9a93" }}>
                    −{amount || ""}
                  </button>

                  {editingScore?.id === p.id ? (
                    <input
                      autoFocus
                      value={editingScore.v}
                      onChange={(e) => setEditingScore({ id: p.id, v: e.target.value.replace(/[^0-9-]/g, "") })}
                      onKeyDown={(e) => { if (e.key === "Enter") commitScore(); if (e.key === "Escape") setEditingScore(null); }}
                      onBlur={commitScore}
                      inputMode="numeric"
                      className="w-full h-12 rounded-xl text-center retro-title text-2xl focus:outline-none"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--gold)", color: "var(--gold)" }}
                    />
                  ) : (
                    <button onClick={() => setEditingScore({ id: p.id, v: String(p.score) })} title="Оноог шууд оруулах"
                      className="h-12 rounded-xl flex items-center justify-center transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                      style={{ border: "1px dashed transparent" }}>
                      <AnimatedScore id={`panel-${p.id}`} value={p.score} className="retro-title text-3xl"
                        style={{ color: p.score < 0 ? "#ff6a62" : "var(--gold)" }} />
                    </button>
                  )}

                  <button onClick={() => amount && onAdjust(p.id, amount)} disabled={!amount}
                    className="rounded-xl w-16 h-12 retro-title text-base disabled:opacity-30 transition-all active:scale-95"
                    style={{ background: "rgba(80,220,150,0.14)", border: "1px solid rgba(120,240,180,0.45)", color: "#8ff3c0" }}>
                    +{amount || ""}
                  </button>
                </div>
              </div>
            );
          })}

          {/* add team */}
          <div className="flex gap-2 pt-1">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Шинэ баг нэмэх…"
              className="flex-1 min-w-0 rounded-xl px-3 py-2.5 text-sm focus:outline-none title-mixed"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px dashed var(--glass-border-hi)", color: "var(--cream)" }}
            />
            <button onClick={add} disabled={!newName.trim()} className="btn-blue px-4 rounded-xl text-sm disabled:opacity-30">+ БАГ</button>
          </div>
        </div>

        {/* history */}
        <div className="shrink-0 max-h-[36%] flex flex-col" style={{ borderTop: "1px solid var(--glass-border)" }}>
          <div className="flex items-center justify-between gap-2 px-5 pt-3 pb-2">
            <p className="mono text-[0.6rem]" style={{ color: "rgba(243,233,210,0.5)" }}>СҮҮЛИЙН ӨӨРЧЛӨЛТ</p>
            {log.length > 0 && (
              <button
                onClick={() => undo(log[0].id)}
                title="Хамгийн сүүлийн өөрчлөлтийг буцаах (Ctrl+Z)"
                className="undo-btn group/u flex items-center gap-1.5 rounded-full pl-2 pr-3 py-1 text-[0.7rem]"
              >
                <UndoIcon /> <span className="title-mixed">Сүүлийнхийг буцаах</span>
                <kbd className="mono text-[0.55rem] opacity-50 ml-1">⌃Z</kbd>
              </button>
            )}
          </div>
          <div className="overflow-y-auto px-3 pb-3 space-y-1.5">
            {log.length === 0 && (
              <p className="mono text-[0.6rem] px-2 pb-2" style={{ color: "rgba(243,233,210,0.3)" }}>ОДООГООР ӨӨРЧЛӨЛТ АЛГА</p>
            )}
            {log.slice(0, 30).map((e, i) => {
              const plus = e.delta > 0;
              const gone = leaving.has(e.id);
              return (
                <div
                  key={e.id}
                  className={`group relative flex items-center gap-2.5 rounded-xl pl-3 pr-1.5 py-1.5 overflow-hidden ${i === 0 && !gone ? "drop-in" : ""}`}
                  style={{
                    background: "linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))",
                    border: "1px solid var(--glass-border)",
                    transition: "opacity 0.25s ease, transform 0.25s ease, max-height 0.25s ease",
                    opacity: gone ? 0 : 1,
                    transform: gone ? "translateX(40px) scale(0.96)" : "none",
                  }}
                >
                  {/* colored accent stripe */}
                  <span className="absolute left-0 top-0 bottom-0 w-1" style={{ background: plus ? "#5ef0a0" : "#ff6a62" }} />
                  <span
                    className="retro-title text-sm min-w-[3.6rem] text-center rounded-lg px-1.5 py-0.5 shrink-0"
                    style={{
                      color: plus ? "#8ff3c0" : "#ff9a93",
                      background: plus ? "rgba(80,220,150,0.12)" : "rgba(242,72,63,0.12)",
                    }}
                  >
                    {plus ? `+${e.delta}` : `−${Math.abs(e.delta)}`}
                  </span>
                  <div className="flex-1 min-w-0 leading-tight">
                    <p className="title-mixed text-sm text-[var(--cream)] truncate">{nameOf(e.playerId)}</p>
                    <p className="mono text-[0.55rem] truncate" style={{ color: "rgba(243,233,210,0.4)" }}>
                      {e.reason} · {ago(e.at, now)}
                    </p>
                  </div>
                  <button
                    onClick={() => undo(e.id)}
                    title="Энэ өөрчлөлтийг буцаах"
                    className="undo-btn group/u shrink-0 flex items-center gap-1 rounded-full pl-1.5 pr-2.5 py-1 text-[0.65rem]"
                  >
                    <UndoIcon />
                    <span className="title-mixed">Буцаах</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function ago(at: number, now: number): string {
  const sec = Math.max(0, Math.round((now - at) / 1000));
  if (sec < 45) return "дөнгөж сая";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} мин`;
  return `${Math.round(min / 60)} цаг`;
}

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden
      className="transition-transform duration-300 group-hover/u:-rotate-45">
      <path d="M9 14 4 9l5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
