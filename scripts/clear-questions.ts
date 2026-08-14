import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "games.json");

function clearAllQuestions() {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const games = JSON.parse(raw);

    // Clear all questions from all categories in all games
    const clearedGames = games.map((game) => ({
      ...game,
      categories: game.categories.map((category) => ({
        ...category,
        questions: [],
      })),
      updatedAt: new Date().toISOString(),
    }));

    fs.writeFileSync(DB_PATH, JSON.stringify(clearedGames, null, 2), "utf-8");

    console.log("✅ Successfully cleared all questions!");
    console.log(`📊 Processed ${games.length} game(s)`);
    console.log(
      `📂 Kept ${clearedGames.reduce((acc, g) => acc + g.categories.length, 0)} categories`,
    );
  } catch (error) {
    console.error("❌ Error clearing questions:", error);
    process.exit(1);
  }
}

clearAllQuestions();
