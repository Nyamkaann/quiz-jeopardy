"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import AudienceView from "@/components/AudienceView";
import { DisplayMessage, DisplaySnapshot, displayChannelName } from "@/lib/display";

/**
 * Audience / projector screen.
 * Open it from the host's game ("📺 ҮЗЭГЧИД"), drag the window to the projector
 * and go fullscreen. It mirrors the host window through a BroadcastChannel.
 */
export default function DisplayPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const [snap, setSnap] = useState<DisplaySnapshot | null>(null);
  const [fx, setFx] = useState<DisplaySnapshot["fx"]>(null);
  const [lastSeen, setLastSeen] = useState(0);
  const [now, setNow] = useState(0);
  const [showChrome, setShowChrome] = useState(true);
  const lastFx = useRef<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ch = new BroadcastChannel(displayChannelName(gameId));
    ch.onmessage = (e: MessageEvent<DisplayMessage>) => {
      const msg = e.data;
      if (msg.type === "off") {
        setSnap(null);
        return;
      }
      if (msg.type !== "state") return;
      const t = Date.now();
      setSnap(msg.snapshot);
      setLastSeen(t);
      const f = msg.snapshot.fx;
      if (f && f.k !== lastFx.current) {
        lastFx.current = f.k;
        if (t - f.k < 2500) setFx(f);
      }
    };
    const hello = () => ch.postMessage({ type: "hello" } satisfies DisplayMessage);
    hello();
    const beat = setInterval(() => {
      hello();
      setNow(Date.now());
    }, 2000);
    const bye = () => ch.postMessage({ type: "bye" } satisfies DisplayMessage);
    window.addEventListener("beforeunload", bye);
    return () => {
      clearInterval(beat);
      window.removeEventListener("beforeunload", bye);
      bye();
      ch.close();
    };
  }, [gameId]);

  useEffect(() => {
    hideTimer.current = setTimeout(() => setShowChrome(false), 4000);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  /* show the fullscreen button briefly when the mouse moves */
  function poke() {
    setShowChrome(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowChrome(false), 2500);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  }

  const hostLost = snap && now - lastSeen > 6000;

  return (
    <div onMouseMove={poke} onDoubleClick={toggleFullscreen}>
      {snap ? (
        <AudienceView s={snap} fx={fx} />
      ) : (
        <div className="h-dvh w-full flex flex-col items-center justify-center gap-6 text-center px-6">
          <div className="orbit-ring" />
          <div className="relative floaty">
            <div className="logo-orbit" />
            <Image src="/astro-nots.png" width={260} height={260} alt="" priority className="relative" />
          </div>
          <h1 className="retro-title title-mixed text-gradient text-4xl">Үзэгчдийн дэлгэц</h1>
          <p className="mono text-xs max-w-md leading-relaxed" style={{ color: "rgba(243,233,210,0.6)" }}>
            ХӨТЛӨГЧИЙН ЦОНХТОЙ ХОЛБОГДОЖ БАЙНА…<br />
            ТОГЛООМЫГ ЭНЭ BROWSER-Т НЭЭЛТТЭЙ БАЙЛГААРАЙ.
          </p>
        </div>
      )}

      {hostLost && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[99] rounded-xl px-4 py-2 mono text-[0.65rem]"
          style={{ background: "rgba(242,72,63,0.2)", border: "1px solid rgba(242,72,63,0.5)", color: "#ff9a93" }}>
          ХӨТЛӨГЧИЙН ЦОНХТОЙ ХОЛБОЛТ ТАСАРЛАА
        </div>
      )}

      <button
        onClick={toggleFullscreen}
        className="fixed top-3 right-3 z-[99] glass rounded-xl px-4 py-2 mono text-[0.65rem] transition-opacity"
        style={{ color: "var(--cream)", opacity: showChrome ? 1 : 0, pointerEvents: showChrome ? "auto" : "none" }}
      >
        ⛶ FULLSCREEN
      </button>
    </div>
  );
}
