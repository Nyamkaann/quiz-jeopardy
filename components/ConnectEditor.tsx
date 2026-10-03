"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { authFetch } from "@/lib/clientAuth";
import { ConnectClue, ConnectData } from "@/types";
import {
  CONNECT_CLUES,
  CONNECT_PENALTY,
  CONNECT_POINTS,
  emptyClue,
  newConnectData,
} from "@/lib/connect";

async function upload(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await authFetch("/api/upload", { method: "POST", body: form });
  const { url } = await res.json();
  return url;
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--glass-border-hi)",
  color: "var(--cream)",
  fontFamily: "var(--font-body)",
};

/** Edit modal for one tile in a "connect" category */
export default function ConnectEditor({
  title,
  value,
  onChange,
  onClose,
}: {
  title: string;
  value?: ConnectData;
  onChange: (v: ConnectData) => void;
  onClose: () => void;
}) {
  const data = value ?? newConnectData();
  const clues = Array.from({ length: CONNECT_CLUES }, (_, i) => data.clues[i] ?? emptyClue());

  function patch(p: Partial<ConnectData>) {
    onChange({ ...data, clues, ...p });
  }
  function patchClue(idx: number, p: Partial<ConnectClue>) {
    const next = [...clues];
    next[idx] = { ...next[idx], ...p };
    patch({ clues: next });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto"
      style={{ background: "rgba(3,8,14,0.82)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="retro-frame rounded-3xl w-full max-w-6xl my-4 sm:my-8">
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <div className="flex items-center gap-3 min-w-0">
            <Image src="/astro-nots.png" width={28} height={28} alt="" />
            <div className="min-w-0">
              <h2 className="retro-title text-lg sm:text-xl text-[var(--gold)] truncate">{title}</h2>
              <p className="mono text-[0.6rem]" style={{ color: "rgba(243,233,210,0.5)" }}>
                5 ЗҮЙЛ НЭГ НЭГЭЭР ГАРНА · {CONNECT_POINTS.join(" → ")} · БУРУУ −{CONNECT_PENALTY}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--teal)] hover:text-[var(--cream)] text-2xl leading-none">×</button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {clues.map((c, i) => (
              <ClueSlot key={c.id} index={i} clue={c} onPatch={(p) => patchClue(i, p)} />
            ))}
          </div>

          <div className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_auto] items-start">
            <div>
              <label className="mono text-[0.6rem] block mb-1" style={{ color: "var(--gold)" }}>ХАРИУЛТ (ХОЛБООС)</label>
              <input
                type="text"
                value={data.answer}
                onChange={(e) => patch({ answer: e.target.value })}
                placeholder="Жишээ: Нарны аймгийн гаригууд"
                className="w-full px-4 py-3 rounded-xl text-lg focus:outline-none title-mixed"
                style={{ ...inputStyle, border: "1px solid rgba(255,165,82,0.5)" }}
              />
              <label className="mono text-[0.6rem] block mt-3 mb-1" style={{ color: "var(--gold)" }}>ЯАГААД? (ТАЙЛБАР)</label>
              <textarea
                rows={2}
                value={data.explanation ?? ""}
                onChange={(e) => patch({ explanation: e.target.value })}
                placeholder="Сэжүүр бүр хариулттай хэрхэн холбогдохыг товч тайлбарлана"
                className="w-full px-4 py-2 rounded-xl text-sm focus:outline-none resize-y"
                style={{ ...inputStyle, border: "1px solid rgba(255,165,82,0.5)" }}
              />
            </div>
            <div className="w-full md:w-56">
              <MediaPick kind="image" label="ХАРИУЛТЫН ЗУРАГ" url={data.answerImage} onSet={(url) => patch({ answerImage: url })} />
            </div>
          </div>

          <button onClick={onClose} className="btn-gold w-full py-3 rounded-xl text-base">БОЛСОН</button>
        </div>
      </div>
    </div>
  );
}

function ClueSlot({
  index,
  clue,
  onPatch,
}: {
  index: number;
  clue?: ConnectClue;
  onPatch: (p: Partial<ConnectClue>) => void;
}) {
  const empty = !clue || (!clue.text?.trim() && !clue.image && !clue.audio);
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${empty ? "var(--glass-border)" : "rgba(95,195,195,0.45)"}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="retro-title text-sm text-[var(--cream)]">#{index + 1}</span>
        <span className="retro-title text-sm" style={{ color: "var(--gold)" }}>{CONNECT_POINTS[index]}</span>
      </div>
      <textarea
        rows={2}
        value={clue?.text ?? ""}
        onChange={(e) => onPatch({ text: e.target.value })}
        placeholder="Текст (заавал биш)"
        className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none"
        style={inputStyle}
      />
      <input
        type="text"
        value={clue?.note ?? ""}
        onChange={(e) => onPatch({ note: e.target.value })}
        placeholder="Тайлбар (дуусахад харагдана)"
        className="w-full px-3 py-1.5 rounded-lg text-xs focus:outline-none"
        style={inputStyle}
      />
      <MediaPick kind="image" label="ЗУРАГ" url={clue?.image} onSet={(url) => onPatch({ image: url })} />
      <MediaPick kind="audio" label="ДУУ" url={clue?.audio} onSet={(url) => onPatch({ audio: url })} />
    </div>
  );
}

export function MediaPick({
  kind,
  label,
  url,
  onSet,
}: {
  kind: "image" | "audio";
  label: string;
  url?: string;
  onSet: (url: string | undefined) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");

  if (url) {
    return (
      <div className="relative group rounded-lg overflow-hidden" style={{ border: "1px solid rgba(95,195,195,0.4)" }}>
        {kind === "image" ? (
          <div className="relative h-20">
            <Image src={url} alt={label} fill className="object-contain" unoptimized />
          </div>
        ) : (
          <div className="px-2 py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
            <audio controls src={url} className="w-full" style={{ height: 28 }} />
          </div>
        )}
        <button
          onClick={() => onSet(undefined)}
          className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-80 hover:opacity-100"
          style={{ background: "rgba(242,72,63,0.85)", color: "white" }}
          title="Устгах"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden flex" style={{ border: "1px dashed var(--glass-border-hi)" }}>
      <input
        ref={ref}
        type="file"
        accept={kind === "image" ? "image/*" : "audio/*"}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            onSet(await upload(f));
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="px-2 py-1.5 mono text-[0.6rem] shrink-0 transition-colors hover:bg-[rgba(95,195,195,0.12)]"
        style={{ color: "rgba(243,233,210,0.7)", borderRight: "1px solid var(--glass-border)" }}
      >
        {busy ? "..." : kind === "image" ? "🖼 " + label : "🔊 " + label}
      </button>
      <input
        type="url"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && link.trim()) {
            onSet(link.trim());
            setLink("");
          }
        }}
        placeholder="эсвэл URL ↵"
        className="flex-1 min-w-0 px-2 py-1.5 text-[0.7rem] bg-transparent focus:outline-none"
        style={{ color: "var(--cream)", fontFamily: "var(--font-mono)" }}
      />
    </div>
  );
}
