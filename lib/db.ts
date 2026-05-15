import fs from "fs";
import path from "path";
import { Game } from "@/types";

const DB_PATH = path.join(process.cwd(), "data", "games.json");

export function readGames(): Game[] {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw) as Game[];
  } catch {
    return [];
  }
}

export function writeGames(games: Game[]): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(games, null, 2), "utf-8");
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
