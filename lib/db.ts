import fs from "fs";
import path from "path";
import { Folder, Game } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "games.json");
const FOLDERS_PATH = path.join(DATA_DIR, "folders.json");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");
const KEEP_BACKUPS = 100; // per file kind

export type BackupKind = "games" | "folders";
const FILES: Record<BackupKind, string> = { games: DB_PATH, folders: FOLDERS_PATH };

/* ─────────── safe JSON storage ─────────── */

/**
 * Read a JSON array. A missing file is treated as empty, but a file that
 * exists and fails to parse THROWS — so a half-written or corrupt file can
 * never be read as "[]" and then saved back over the real data.
 */
function readJson<T>(file: string): T[] {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed as T[];
  } catch (e) {
    throw new Error(`Data file ${path.basename(file)} is corrupt (${(e as Error).message}). Restore it from data/backups.`);
  }
}

/** Snapshot the current file into data/backups before it is replaced. */
function backup(kind: BackupKind) {
  const file = FILES[kind];
  if (!fs.existsSync(file)) return;
  const current = fs.readFileSync(file, "utf-8");
  if (!current.trim() || current.trim() === "[]") return; // nothing worth keeping
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const existing = listBackupFiles(kind);
  const latest = existing[0];
  if (latest && fs.readFileSync(path.join(BACKUP_DIR, latest), "utf-8") === current) return; // unchanged

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.writeFileSync(path.join(BACKUP_DIR, `${kind}-${stamp}.json`), current, "utf-8");

  // prune old ones
  for (const old of listBackupFiles(kind).slice(KEEP_BACKUPS)) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, old));
    } catch {
      /* ignore */
    }
  }
}

/** Write via temp file + rename so the real file is never left half-written. */
function writeJson(kind: BackupKind, data: unknown[]) {
  const file = FILES[kind];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  backup(kind);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}

/* ─────────── games ─────────── */

export function readGames(): Game[] {
  return readJson<Game>(DB_PATH);
}

export function writeGames(games: Game[]): void {
  writeJson("games", games);
}

export function getGame(id: string): Game | null {
  return readGames().find((g) => g.id === id) ?? null;
}

export function saveGame(game: Game): void {
  const games = readGames();
  const idx = games.findIndex((g) => g.id === game.id);
  if (idx >= 0) {
    games[idx] = game;
  } else {
    games.push(game);
  }
  writeGames(games);
}

export function deleteGame(id: string): void {
  writeGames(readGames().filter((g) => g.id !== id));
}

/* ─────────── folders ─────────── */

export function readFolders(): Folder[] {
  return readJson<Folder>(FOLDERS_PATH);
}

export function writeFolders(folders: Folder[]): void {
  writeJson("folders", folders);
}

/** ids of `id` and every folder nested inside it */
export function descendantIds(folders: Folder[], id: string): Set<string> {
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

/**
 * Delete a folder. Its sub-folders and games are moved up to the parent,
 * so deleting a folder never deletes a quiz.
 */
export function deleteFolder(id: string): void {
  const folders = readFolders();
  const target = folders.find((f) => f.id === id);
  if (!target) return;
  const parent = target.parentId;
  writeFolders(
    folders
      .filter((f) => f.id !== id)
      .map((f) => (f.parentId === id ? { ...f, parentId: parent } : f)),
  );
  writeGames(readGames().map((g) => (g.folderId === id ? { ...g, folderId: parent } : g)));
}

/* ─────────── backups ─────────── */

function listBackupFiles(kind: BackupKind): string[] {
  try {
    return fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith(`${kind}-`) && f.endsWith(".json"))
      .sort()
      .reverse(); // newest first (ISO stamps sort lexically)
  } catch {
    return [];
  }
}

export interface BackupInfo {
  file: string;
  kind: BackupKind;
  at: string;
  bytes: number;
  items: number | null;
}

export function listBackups(): BackupInfo[] {
  const out: BackupInfo[] = [];
  for (const kind of ["games", "folders"] as BackupKind[]) {
    for (const file of listBackupFiles(kind)) {
      const full = path.join(BACKUP_DIR, file);
      let items: number | null = null;
      try {
        items = JSON.parse(fs.readFileSync(full, "utf-8")).length;
      } catch {
        /* unreadable */
      }
      const stamp = file.slice(kind.length + 1, -5); // 2026-10-03T01-02-03-456Z
      const iso = stamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z");
      out.push({ file, kind, at: iso, bytes: fs.statSync(full).size, items });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** Restore a backup (the current file is itself backed up first). */
export function restoreBackup(file: string): BackupKind {
  const safe = path.basename(file);
  const kind: BackupKind | null = safe.startsWith("games-") ? "games" : safe.startsWith("folders-") ? "folders" : null;
  if (!kind || !safe.endsWith(".json")) throw new Error("Invalid backup name");
  const full = path.join(BACKUP_DIR, safe);
  const data = JSON.parse(fs.readFileSync(full, "utf-8"));
  if (!Array.isArray(data)) throw new Error("Backup is not a list");
  writeJson(kind, data);
  return kind;
}
