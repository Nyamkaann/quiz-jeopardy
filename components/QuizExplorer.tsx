"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Folder, Game } from "@/types";
import PasswordModal from "@/components/PasswordModal";
import { authFetch, checkAuth, isAuthed, logout } from "@/lib/clientAuth";

type Item = { kind: "game" | "folder"; id: string };

type PendingAction =
  | { type: "new-game" }
  | { type: "new-folder" }
  | { type: "edit"; gameId: string }
  | { type: "delete-game"; game: Game }
  | { type: "delete-folder"; folder: Folder }
  | { type: "rename-folder"; folder: Folder }
  | { type: "move"; item: Item; to?: string | null } // to undefined → open picker
  | { type: "backups" };

const DRAG_TYPE = "application/x-astro-item";

function blankBoard() {
  return Array.from({ length: 6 }, (_, ci) => ({
    id: crypto.randomUUID(),
    name: `Category ${ci + 1}`,
    questions: [100, 200, 300, 400, 500].map((v) => ({
      id: crypto.randomUUID(),
      value: v,
      clue: "",
      answer: "",
      isDailyDouble: false,
      answered: false,
    })),
  }));
}

export default function QuizExplorer() {
  const router = useRouter();
  const params = useSearchParams();
  const [games, setGames] = useState<Game[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState<"game" | "folder" | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [moving, setMoving] = useState<Item | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null); // folder id or "root"
  const [showBackups, setShowBackups] = useState(false);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    checkAuth().then(setAdmin);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/games").then((r) => r.json()),
      fetch("/api/folders").then((r) => r.json()),
    ]).then(([g, f]) => {
      setGames(g);
      setFolders(f);
      setLoaded(true);
    });
  }, []);

  /* current folder from ?f= (falls back to root if it no longer exists) */
  const fParam = params.get("f");
  const current = folders.find((f) => f.id === fParam) ?? null;
  const currentId = current?.id ?? null;

  const byId = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  function pathOf(folderId: string | null | undefined): Folder[] {
    const out: Folder[] = [];
    let id = folderId ?? null;
    const seen = new Set<string>();
    while (id && byId.has(id) && !seen.has(id)) {
      seen.add(id);
      const f = byId.get(id)!;
      out.unshift(f);
      id = f.parentId;
    }
    return out;
  }

  function descendants(id: string): Set<string> {
    const out = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of folders) {
        if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
          out.add(f.id);
          grew = true;
        }
      }
    }
    return out;
  }

  function quizCount(folderId: string): number {
    const ids = descendants(folderId);
    return games.filter((g) => g.folderId && ids.has(g.folderId)).length;
  }

  function open(folderId: string | null) {
    setQuery("");
    setCreating(null);
    router.push(folderId ? `/?f=${folderId}` : "/");
  }

  /* ── auth guard ── */
  function guard(action: PendingAction) {
    if (isAuthed()) execute(action);
    else setPending(action);
  }

  function execute(action: PendingAction) {
    setPending(null);
    setAdmin(true);
    switch (action.type) {
      case "backups":
        setShowBackups(true);
        break;
      case "new-game":
        setDraft("");
        setCreating("game");
        break;
      case "new-folder":
        setDraft("");
        setCreating("folder");
        break;
      case "edit":
        router.push(`/admin/${action.gameId}`);
        break;
      case "delete-game":
        if (confirm(`«${action.game.title}» quiz-ийг устгах уу?`)) deleteGame(action.game);
        break;
      case "delete-folder": {
        const n = quizCount(action.folder.id);
        const msg = n
          ? `«${action.folder.name}» folder-ийг устгах уу?\nДотор нь байгаа ${n} quiz устахгүй — дээд folder руу шилжинэ.`
          : `«${action.folder.name}» folder-ийг устгах уу?`;
        if (confirm(msg)) deleteFolder(action.folder);
        break;
      }
      case "rename-folder":
        setRenaming({ id: action.folder.id, name: action.folder.name });
        break;
      case "move":
        if (action.to === undefined) setMoving(action.item);
        else moveItem(action.item, action.to);
        break;
    }
  }

  /* ── mutations ── */
  async function createGame() {
    const title = draft.trim();
    if (!title) return;
    setBusy(true);
    const res = await authFetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, folderId: currentId, categories: blankBoard() }),
    });
    const game: Game = await res.json();
    setGames((prev) => [...prev, game]);
    setCreating(null);
    setBusy(false);
  }

  async function createFolder() {
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    const res = await authFetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: currentId }),
    });
    const folder: Folder = await res.json();
    setFolders((prev) => [...prev, folder]);
    setCreating(null);
    setBusy(false);
  }

  async function renameFolder() {
    if (!renaming) return;
    const name = renaming.name.trim();
    setRenaming(null);
    if (!name) return;
    setFolders((prev) => prev.map((f) => (f.id === renaming.id ? { ...f, name } : f)));
    await authFetch(`/api/folders/${renaming.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }

  async function deleteGame(game: Game) {
    await authFetch(`/api/games/${game.id}`, { method: "DELETE" });
    setGames((prev) => prev.filter((g) => g.id !== game.id));
  }

  async function deleteFolder(folder: Folder) {
    await authFetch(`/api/folders/${folder.id}`, { method: "DELETE" });
    setFolders((prev) =>
      prev.filter((f) => f.id !== folder.id).map((f) => (f.parentId === folder.id ? { ...f, parentId: folder.parentId } : f)),
    );
    setGames((prev) => prev.map((g) => (g.folderId === folder.id ? { ...g, folderId: folder.parentId } : g)));
  }

  async function moveItem(item: Item, to: string | null) {
    setMoving(null);
    if (item.kind === "game") {
      const g = games.find((x) => x.id === item.id);
      if (!g || (g.folderId ?? null) === to) return;
      setGames((prev) => prev.map((x) => (x.id === item.id ? { ...x, folderId: to } : x)));
      await authFetch(`/api/games/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: to }),
      });
    } else {
      const f = byId.get(item.id);
      if (!f || f.parentId === to || (to && descendants(item.id).has(to))) return;
      setFolders((prev) => prev.map((x) => (x.id === item.id ? { ...x, parentId: to } : x)));
      await authFetch(`/api/folders/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: to }),
      });
    }
  }

  /* ── drag & drop ── */
  function dragProps(item: Item) {
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item));
        e.dataTransfer.effectAllowed = "move";
      },
      onDragEnd: () => setDropTarget(null),
    };
  }

  function dropProps(target: string | null, selfId?: string) {
    const key = target ?? "root";
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dropTarget !== key) setDropTarget(key);
      },
      onDragLeave: () => setDropTarget((t) => (t === key ? null : t)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setDropTarget(null);
        try {
          const item = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as Item;
          if (item.id === selfId) return;
          guard({ type: "move", item, to: target });
        } catch {
          /* not ours */
        }
      },
    };
  }

  /* ── what to show ── */
  const q = query.trim().toLowerCase();
  const shownFolders = q
    ? folders.filter((f) => f.name.toLowerCase().includes(q))
    : folders.filter((f) => (f.parentId ?? null) === currentId);
  const shownGames = q
    ? games.filter((g) => g.title.toLowerCase().includes(q))
    : games.filter((g) => (g.folderId ?? null) === currentId);
  shownFolders.sort((a, b) => a.name.localeCompare(b.name));

  const crumbs = pathOf(currentId);

  const actionLabel =
    pending?.type === "new-game" ? "create a new game" :
    pending?.type === "new-folder" ? "create a folder" :
    pending?.type === "edit" ? "edit this game" :
    pending?.type === "delete-game" ? "delete this game" :
    pending?.type === "delete-folder" ? "delete this folder" :
    pending?.type === "rename-folder" ? "rename this folder" :
    pending?.type === "move" ? "move this item" :
    pending?.type === "backups" ? "open backups" : "";

  let anim = 0;
  const delay = () => ({ animationDelay: `${120 + anim++ * 50}ms` });

  return (
    <section className="glass rounded-3xl flex flex-col min-h-0 overflow-hidden rise-in" style={{ animationDelay: "120ms" }}>
      {/* modals are portalled to <body>: the glass panel's backdrop-filter would otherwise trap position:fixed */}
      {pending && createPortal(
        <PasswordModal action={actionLabel} onSuccess={() => execute(pending)} onCancel={() => setPending(null)} />,
        document.body,
      )}
      {showBackups && createPortal(<BackupDialog onClose={() => setShowBackups(false)} />, document.body)}
      {moving && createPortal(
        <MoveDialog
          item={moving}
          folders={folders}
          blocked={moving.kind === "folder" ? descendants(moving.id) : new Set()}
          currentParent={
            moving.kind === "game"
              ? games.find((g) => g.id === moving.id)?.folderId ?? null
              : byId.get(moving.id)?.parentId ?? null
          }
          onPick={(to) => moveItem(moving, to)}
          onClose={() => setMoving(null)}
        />,
        document.body,
      )}

      {/* header */}
      <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4 space-y-3" style={{ borderBottom: "1px solid var(--glass-border)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="mono text-[0.65rem]" style={{ color: "var(--teal)" }}>QUIZ EXPLORER</p>
            <h2 className="retro-title title-mixed text-2xl sm:text-3xl text-[var(--cream)] truncate">
              {q ? "Хайлт" : current ? current.name : "Бүх quiz"}
            </h2>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => guard({ type: "new-folder" })} className="btn-blue px-4 py-2.5 rounded-xl text-sm flex-1 sm:flex-none">
              + FOLDER
            </button>
            <button onClick={() => guard({ type: "new-game" })} className="btn-gold px-5 py-2.5 rounded-xl text-sm flex-1 sm:flex-none">
              + NEW GAME
            </button>
          </div>
        </div>

        {/* breadcrumb + search */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
          <nav className="flex items-center flex-wrap gap-1 min-w-0 flex-1 mono text-[0.7rem]">
            <Crumb
              label="🏠 HOME"
              active={!currentId && !q}
              hot={dropTarget === "root"}
              onClick={() => open(null)}
              {...dropProps(null)}
            />
            {crumbs.map((f) => (
              <span key={f.id} className="flex items-center gap-1 min-w-0">
                <span style={{ color: "rgba(243,233,210,0.3)" }}>›</span>
                <Crumb
                  label={f.name}
                  active={f.id === currentId && !q}
                  hot={dropTarget === f.id}
                  onClick={() => open(f.id)}
                  {...dropProps(f.id)}
                />
              </span>
            ))}
          </nav>
          <div className="relative md:w-64">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Хайх…"
              className="w-full rounded-xl pl-9 pr-8 py-2 text-sm focus:outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border-hi)", color: "var(--cream)" }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60">⌕</span>
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--teal)] text-lg leading-none">×</button>
            )}
          </div>
        </div>
      </div>

      {/* inline create */}
      {creating && (
        <div className="drop-in mx-5 sm:mx-7 mt-4 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3"
          style={{ background: "rgba(95,195,195,0.08)", border: "1px solid rgba(95,195,195,0.3)" }}>
          <span className="self-center text-xl hidden sm:block">{creating === "folder" ? "📁" : "🪐"}</span>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (creating === "folder") createFolder();
                else createGame();
              }
              if (e.key === "Escape") setCreating(null);
            }}
            placeholder={creating === "folder" ? "Folder-ийн нэр…" : "Тоглоомын нэр…"}
            className="flex-1 min-w-0 rounded-xl px-4 py-3 text-[var(--cream)] text-base focus:outline-none title-mixed"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border-hi)" }}
          />
          <div className="flex gap-2">
            <button
              onClick={creating === "folder" ? createFolder : createGame}
              disabled={busy || !draft.trim()}
              className="btn-gold px-5 py-3 rounded-xl text-sm disabled:opacity-40 flex-1 sm:flex-none"
            >
              {busy ? "..." : "CREATE"}
            </button>
            <button onClick={() => setCreating(null)} className="btn-blue px-5 py-3 rounded-xl text-sm flex-1 sm:flex-none">
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-7">
        {loaded && shownFolders.length === 0 && shownGames.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-16">
            <Image src="/astro-nots.png" width={96} height={96} alt="" className="mb-5 opacity-25" />
            <p className="retro-title title-mixed text-xl text-[var(--teal)]">
              {q ? "Юу ч олдсонгүй" : current ? "Энэ folder хоосон байна" : "Одоогоор quiz алга"}
            </p>
            {!q && (
              <p className="mono text-xs mt-2" style={{ color: "rgba(243,233,210,0.45)" }}>
                + FOLDER ЭСВЭЛ + NEW GAME ДАРЖ ЭХЛЭЭРЭЙ
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* folders */}
            {shownFolders.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {shownFolders.map((f) => {
                  const subs = folders.filter((x) => x.parentId === f.id).length;
                  const n = quizCount(f.id);
                  const hot = dropTarget === f.id;
                  return (
                    <div
                      key={f.id}
                      {...dragProps({ kind: "folder", id: f.id })}
                      {...dropProps(f.id, f.id)}
                      onClick={() => renaming?.id !== f.id && open(f.id)}
                      className="group rise-in relative rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 select-none"
                      style={{
                        ...delay(),
                        background: hot
                          ? "linear-gradient(160deg,rgba(255,138,61,0.22),rgba(255,255,255,0.04))"
                          : "linear-gradient(160deg,rgba(95,195,195,0.12),rgba(255,255,255,0.02))",
                        border: `1px solid ${hot ? "rgba(255,165,82,0.8)" : "rgba(95,195,195,0.3)"}`,
                        boxShadow: hot ? "0 0 30px rgba(255,138,61,0.3)" : undefined,
                      }}
                    >
                      <FolderIcon open={hot} />
                      {renaming?.id === f.id ? (
                        <input
                          autoFocus
                          value={renaming.name}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setRenaming({ id: f.id, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameFolder();
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          onBlur={renameFolder}
                          className="mt-3 w-full rounded-lg px-2 py-1 text-sm focus:outline-none title-mixed"
                          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--teal)", color: "var(--cream)" }}
                        />
                      ) : (
                        <p className="mt-3 title-mixed text-base text-[var(--cream)] truncate">{f.name}</p>
                      )}
                      <p className="mono text-[0.6rem] mt-1 truncate" style={{ color: "rgba(243,233,210,0.5)" }}>
                        {q && f.parentId ? `${pathOf(f.parentId).map((p) => p.name).join(" › ")} · ` : ""}
                        {subs > 0 ? `${subs} FOLDER · ` : ""}{n} QUIZ
                      </p>

                      {/* hover actions */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <IconBtn title="Нэр солих" onClick={() => guard({ type: "rename-folder", folder: f })}>✎</IconBtn>
                        <IconBtn title="Зөөх" onClick={() => guard({ type: "move", item: { kind: "folder", id: f.id } })}>⇄</IconBtn>
                        <IconBtn title="Устгах" danger onClick={() => guard({ type: "delete-folder", folder: f })}>×</IconBtn>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* games */}
            {shownGames.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
                {shownGames.map((game) => (
                  <div
                    key={game.id}
                    {...dragProps({ kind: "game", id: game.id })}
                    className="group rise-in rounded-2xl p-4 sm:p-5 flex flex-col gap-4 transition-all hover:-translate-y-0.5"
                    style={{
                      ...delay(),
                      background: "linear-gradient(160deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))",
                      border: "1px solid var(--glass-border)",
                    }}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl"
                        style={{ background: "linear-gradient(135deg,rgba(95,195,195,0.25),rgba(255,138,61,0.2))", border: "1px solid var(--glass-border-hi)" }}>
                        🪐
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="retro-title title-mixed text-lg sm:text-xl text-[var(--cream)] truncate">{game.title}</p>
                        <p className="mono text-[0.65rem] mt-1 truncate" style={{ color: "rgba(243,233,210,0.5)" }}>
                          {q ? `${["HOME", ...pathOf(game.folderId).map((p) => p.name)].join(" › ")} · ` : ""}
                          {game.categories.length} CATEGORIES · {new Date(game.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
                      <Link href={`/play/${game.id}`} className="btn-gold px-5 py-2.5 rounded-xl text-sm text-center" style={{ textDecoration: "none" }}>
                        ▶ PLAY
                      </Link>
                      <button onClick={() => guard({ type: "edit", gameId: game.id })} className="btn-blue px-4 py-2.5 rounded-xl text-sm">
                        EDIT
                      </button>
                      <button onClick={() => guard({ type: "move", item: { kind: "game", id: game.id } })} className="btn-blue px-3 py-2.5 rounded-xl text-sm" title="Folder руу зөөх">
                        ⇄
                      </button>
                      <button onClick={() => guard({ type: "delete-game", game })}
                        className="px-4 py-2.5 rounded-xl text-sm transition-colors hover:bg-[rgba(242,72,63,0.25)]"
                        style={{ fontFamily: "var(--font-display)", fontWeight: 700, background: "rgba(242,72,63,0.1)", border: "1px solid rgba(242,72,63,0.45)", color: "#ff8a83" }}>
                        DEL
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-7 py-3 flex items-center justify-between gap-3 mono text-[0.6rem]"
        style={{ borderTop: "1px solid var(--glass-border)", color: "rgba(243,233,210,0.35)" }}>
        <span>ASTRO-NOTS © {new Date().getFullYear()}</span>
        <span className="hidden md:inline">ЧИРЧ FOLDER РУУ ЗӨӨЖ БОЛНО</span>
        <span className="flex items-center gap-3">
          <span>{folders.length} FOLDER · {games.length} QUIZ</span>
          <button onClick={() => guard({ type: "backups" })} className="hover:text-[var(--teal)] transition-colors" title="Автомат нөөц">
            🗄 НӨӨЦ
          </button>
          {admin && (
            <button
              onClick={async () => { await logout(); setAdmin(false); }}
              className="hover:text-[var(--red)] transition-colors"
              title="Админ эрхээс гарах"
            >
              🔒 ГАРАХ
            </button>
          )}
        </span>
      </div>
    </section>
  );
}

/* ── pieces ── */

function Crumb({
  label,
  active,
  hot,
  onClick,
  ...drop
}: {
  label: string;
  active: boolean;
  hot: boolean;
  onClick: () => void;
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...drop}
      onClick={onClick}
      className="rounded-lg px-2 py-1 transition-colors truncate max-w-[12rem]"
      style={{
        color: active ? "var(--gold)" : "rgba(243,233,210,0.7)",
        background: hot ? "rgba(255,138,61,0.25)" : active ? "rgba(255,138,61,0.08)" : "transparent",
        border: `1px solid ${hot ? "rgba(255,165,82,0.8)" : "transparent"}`,
      }}
    >
      {label}
    </button>
  );
}

function IconBtn({ children, title, danger, onClick }: { children: React.ReactNode; title: string; danger?: boolean; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
      style={{
        background: danger ? "rgba(242,72,63,0.2)" : "rgba(5,13,22,0.7)",
        border: `1px solid ${danger ? "rgba(242,72,63,0.5)" : "var(--glass-border-hi)"}`,
        color: danger ? "#ff8a83" : "var(--cream)",
      }}
    >
      {children}
    </button>
  );
}

function FolderIcon({ open }: { open?: boolean }) {
  return (
    <svg width="44" height="36" viewBox="0 0 44 36" aria-hidden className="transition-transform" style={{ transform: open ? "scale(1.08)" : undefined }}>
      <defs>
        <linearGradient id="fold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fc3c3" />
          <stop offset="1" stopColor="#2b8c93" />
        </linearGradient>
      </defs>
      <path d="M2 6a4 4 0 0 1 4-4h10l4 4h18a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" fill="url(#fold)" opacity="0.9" />
      <path d={open ? "M2 14h40l-3 16a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" : "M2 12h40v18a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"} fill="#a6e6e3" opacity="0.35" />
      <circle cx="34" cy="22" r="3" fill="#ff8a3d" />
    </svg>
  );
}

function MoveDialog({
  item,
  folders,
  blocked,
  currentParent,
  onPick,
  onClose,
}: {
  item: Item;
  folders: Folder[];
  blocked: Set<string>;
  currentParent: string | null;
  onPick: (to: string | null) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // flatten the tree depth-first
  const rows: { f: Folder; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    folders
      .filter((f) => (f.parentId ?? null) === parent)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((f) => {
        rows.push({ f, depth });
        walk(f.id, depth + 1);
      });
  };
  walk(null, 0);

  const row = (id: string | null, label: string, depth: number) => {
    const disabled = (id !== null && blocked.has(id)) || id === currentParent;
    return (
      <button
        key={id ?? "root"}
        disabled={disabled}
        onClick={() => onPick(id)}
        className="w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-2 transition-colors hover:bg-[rgba(95,195,195,0.12)] disabled:opacity-30 disabled:hover:bg-transparent"
        style={{ paddingLeft: 12 + depth * 20, color: "var(--cream)" }}
      >
        <span>{id ? "📁" : "🏠"}</span>
        <span className="title-mixed text-sm truncate">{label}</span>
        {id === currentParent && <span className="mono text-[0.55rem] ml-auto" style={{ color: "var(--teal)" }}>ОДОО ЭНД</span>}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(3,8,14,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="retro-frame zoom-in rounded-3xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <h3 className="retro-title title-mixed text-lg text-[var(--gold)]">
            {item.kind === "game" ? "Quiz-ийг" : "Folder-ийг"} хаашаа зөөх вэ?
          </h3>
          <button onClick={onClose} className="text-[var(--teal)] text-2xl leading-none">×</button>
        </div>
        <div className="p-3 max-h-[60vh] overflow-y-auto">
          {row(null, "HOME", 0)}
          {rows.map(({ f, depth }) => row(f.id, f.name, depth + 1))}
        </div>
      </div>
    </div>
  );
}

interface BackupInfo {
  file: string;
  kind: "games" | "folders";
  at: string;
  bytes: number;
  items: number | null;
}

function BackupDialog({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<BackupInfo[] | null>(null);
  const [kind, setKind] = useState<"games" | "folders">("games");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/api/backups")
      .then((r) => (r.ok ? r.json() : []))
      .then(setList);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function restore(b: BackupInfo) {
    const when = new Date(b.at).toLocaleString();
    if (!confirm(`${when}-ийн нөөцийг сэргээх үү?\nОдоогийн өгөгдөл ч бас нөөцлөгдөнө, тиймээс буцааж болно.`)) return;
    setBusy(b.file);
    const res = await authFetch("/api/backups/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file: b.file }),
    });
    setBusy(null);
    if (res.ok) window.location.reload();
    else if (res.status !== 401) alert("Сэргээж чадсангүй.");
  }

  const rows = (list ?? []).filter((b) => b.kind === kind);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(3,8,14,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="retro-frame zoom-in rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--glass-border)" }}>
          <div>
            <p className="mono text-[0.6rem]" style={{ color: "var(--teal)" }}>DATA/BACKUPS</p>
            <h3 className="retro-title title-mixed text-lg text-[var(--gold)]">Автомат нөөц</h3>
          </div>
          <button onClick={onClose} className="text-[var(--teal)] text-2xl leading-none">×</button>
        </div>
        <div className="px-5 pt-3 flex gap-2">
          {(["games", "folders"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className="rounded-lg px-3 py-1.5 mono text-[0.65rem]"
              style={{
                color: kind === k ? "#1a0b04" : "var(--cream)",
                background: kind === k ? "linear-gradient(135deg,#ffb066,var(--orange))" : "rgba(255,255,255,0.04)",
                border: "1px solid var(--glass-border)",
              }}>
              {k === "games" ? "QUIZ" : "FOLDER"}
            </button>
          ))}
        </div>
        <p className="mono text-[0.6rem] px-5 pt-2" style={{ color: "rgba(243,233,210,0.45)" }}>
          ХАДГАЛАХ БҮРТ ӨМНӨХ ХУВИЛБАР АВТОМАТААР НӨӨЦЛӨГДӨНӨ · СҮҮЛИЙН 100
        </p>
        <div className="p-3 overflow-y-auto flex-1">
          {list === null && <p className="mono text-xs p-4 text-center" style={{ color: "rgba(243,233,210,0.5)" }}>...</p>}
          {list !== null && rows.length === 0 && (
            <p className="mono text-xs p-6 text-center" style={{ color: "rgba(243,233,210,0.45)" }}>ОДООГООР НӨӨЦ АЛГА</p>
          )}
          {rows.map((b) => (
            <div key={b.file} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[rgba(255,255,255,0.04)]">
              <span className="text-lg">🗂</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--cream)] title-mixed">{new Date(b.at).toLocaleString()}</p>
                <p className="mono text-[0.6rem]" style={{ color: "rgba(243,233,210,0.45)" }}>
                  {b.items ?? "?"} {kind === "games" ? "QUIZ" : "FOLDER"} · {(b.bytes / 1024).toFixed(1)} KB
                </p>
              </div>
              <button onClick={() => restore(b)} disabled={!!busy}
                className="btn-blue px-3 py-1.5 rounded-lg text-xs disabled:opacity-40">
                {busy === b.file ? "..." : "↶ СЭРГЭЭХ"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
