import { NextResponse } from "next/server";
import { readGames, writeGames } from "@/lib/db";

export async function POST() {
  try {
    const games = readGames();

    // Clear all questions from all categories in all games
    const clearedGames = games.map((game) => ({
      ...game,
      categories: game.categories.map((category) => ({
        ...category,
        questions: [],
      })),
      updatedAt: new Date().toISOString(),
    }));

    writeGames(clearedGames);

    return NextResponse.json({
      success: true,
      message: "All questions have been deleted",
      gamesCleared: clearedGames.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error clearing questions:", error);
    return NextResponse.json(
      { error: "Failed to clear questions" },
      { status: 500 },
    );
  }
}
