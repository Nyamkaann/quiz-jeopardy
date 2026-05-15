"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

const PASSWORD = "Nyamka2324";
const SESSION_KEY = "sp_quiz_auth";

export function isAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

export function setAuthed() {
  sessionStorage.setItem(SESSION_KEY, "1");
}

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

  function attempt() {
    if (value === PASSWORD) {
      setAuthed();
      onSuccess();
    } else {
      setError(true);
      setShake(true);
      setValue("");
      setTimeout(() => setShake(false), 500);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(4,5,26,0.95)" }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        className={`retro-frame rounded-2xl w-full max-w-sm ${shake ? "animate-[shake_0.4s_ease]" : ""}`}
        style={{ background: "var(--bg-card)" }}
      >
        {/* header */}
        <div className="flex items-center gap-3 px-6 py-4"
          style={{ borderBottom: "2px solid var(--sp-blue)", background: "linear-gradient(90deg,#060d3a,#04051a)" }}>
          <Image src="/sp-logo.svg" width={22} height={22} alt="" />
          <span className="retro-title text-xl text-[var(--gold)] tracking-widest">ACCESS REQUIRED</span>
        </div>

        <div className="p-6 space-y-4">
          <p style={{ fontFamily: "'Share Tech Mono',monospace", color: "rgba(120,160,255,0.7)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
            ENTER PASSWORD TO {action.toUpperCase()}
          </p>

          <input
            ref={inputRef}
            type="password"
            placeholder="••••••••••"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === "Enter" && attempt()}
            className="w-full px-4 py-3 rounded text-white text-center text-xl tracking-widest focus:outline-none"
            style={{
              background: "#07102a",
              border: `2px solid ${error ? "#cc2200" : "var(--sp-blue)"}`,
              fontFamily: "'Share Tech Mono',monospace",
              boxShadow: error ? "0 0 12px rgba(204,34,0,0.4)" : "0 0 8px rgba(0,84,255,0.2)",
            }}
          />

          {error && (
            <p className="text-center text-sm"
              style={{ fontFamily: "'Share Tech Mono',monospace", color: "#ff5544", letterSpacing: "0.1em" }}>
              ✗ INCORRECT PASSWORD
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onCancel}
              className="btn-blue flex-1 py-3 rounded text-base text-white">
              CANCEL
            </button>
            <button onClick={attempt} disabled={!value}
              className="btn-gold flex-1 py-3 rounded text-base disabled:opacity-30">
              UNLOCK
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
