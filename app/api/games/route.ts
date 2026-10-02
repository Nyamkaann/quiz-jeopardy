import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readGames, saveGame } from "@/lib/db";
import { Game } from "@/types";

/** Library listing: titles and category names only — never the clues or answers. */
export async function GET() {
  const games = readGames().map((g) => ({
    ...g,
    categories: g.categories.map((c) => ({ id: c.id, name: c.name, type: c.type, questions: [] })),
  }));
  return NextResponse.json(games);
}

export async function POST(req: Request) {
    const deny = await requireAdmin();
    if (deny) return deny;
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const game: Game = {
      id: uuidv4(),
      title: body.title || "New Game",
      categories: body.categories || [],
      folderId: typeof body.folderId === "string" ? body.folderId : null,
      createdAt: now,
      updatedAt: now,
    };
    saveGame(game);
    return NextResponse.json(game, { status: 201 });
  } catch (error) {
    console.error("Error creating game:", error);
    return NextResponse.json(
      { error: "Failed to create game" },
      { status: 500 },
    );
  }
}
