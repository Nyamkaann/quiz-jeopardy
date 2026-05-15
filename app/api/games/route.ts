import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readGames, saveGame } from "@/lib/db";
import { Game } from "@/types";

export async function GET() {
  const games = readGames();
  return NextResponse.json(games);
}

export async function POST(req: Request) {
  const body = await req.json();
  const now = new Date().toISOString();
  const game: Game = {
    id: uuidv4(),
    title: body.title || "New Game",
    categories: body.categories || [],
    createdAt: now,
    updatedAt: now,
  };
  saveGame(game);
  return NextResponse.json(game, { status: 201 });
}
