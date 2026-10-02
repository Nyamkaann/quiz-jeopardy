"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { login } from "@/lib/clientAuth";

// Re-exported so existing imports keep working; the password itself lives on the server.
export { isAuthed } from "@/lib/clientAuth";

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
  action?: string;
}

export default function PasswordModal({ onSuccess, onCancel, action = "continue" }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const [checking, setChecking] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function attempt() {
    if (!value || checking) return;
    setChecking(true);
    const { ok, error: err } = await login(value);
    setChecking(false);
    if (ok) {
      onSuccess();
      return;
    }
    setServerError(err ?? null);
    setError(true);
    setShake(true);
    setValue("");
    setTimeout(() => setShake(false), 500);
    inputRef.current?.focus();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(3,8,14,0.65)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className={`retro-frame rounded-2xl w-full max-w-sm ${shake ? "animate-[shake_0.4s_ease]" : ""}`}
        style={{ background: "var(--bg-card)" }}
      >
        {/* header */}
        <div className="flex items-center gap-3 px-6 py-4"
          style={{ borderBottom: "1px solid var(--sp-blue)", background: "rgba(255,255,255,0.03)" }}>
          <Image src="/astro-nots.png" width={22} height={22} alt="" />
          <span className="retro-title text-xl text-[var(--gold)] tracking-widest">ACCESS REQUIRED</span>
        </div>

        <div className="p-6 space-y-4">
          <p style={{ fontFamily: "var(--font-mono)", color: "rgba(243,233,210,0.7)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
            ENTER PASSWORD TO {action.toUpperCase()}
          </p>

          <input
            ref={inputRef}
            type="password"
            placeholder="••••••••••"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === "Enter" && attempt()}
            className="w-full px-4 py-3 rounded text-[var(--cream)] text-center text-xl tracking-widest focus:outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `2px solid ${error ? "#cc2200" : "var(--sp-blue)"}`,
              fontFamily: "var(--font-mono)",
              boxShadow: error ? "0 0 12px rgba(204,34,0,0.4)" : "0 0 8px rgba(95,195,195,0.2)",
            }}
          />

          {error && (
            <p className="text-center text-sm"
              style={{ fontFamily: "var(--font-mono)", color: "#ff5544", letterSpacing: "0.1em" }}>
              {serverError ? `⚠ ${serverError}` : "✗ INCORRECT PASSWORD"}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onCancel}
              className="btn-blue flex-1 py-3 rounded text-base text-[var(--cream)]">
              CANCEL
            </button>
            <button onClick={attempt} disabled={!value || checking}
              className="btn-gold flex-1 py-3 rounded text-base disabled:opacity-30">
              {checking ? "..." : "UNLOCK"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-10px); }
          40%      { transform: translateX(10px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
