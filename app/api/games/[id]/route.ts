import { canPlay, requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getGame, saveGame, deleteGame } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // full game includes the answers → only for players who entered the play code (or admins)
  if (!(await canPlay())) return NextResponse.json({ error: "Play code required" }, { status: 401 });
  const { id } = await params;
  const game = getGame(id);
  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(game);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
    const deny = await requireAdmin();
    if (deny) return deny;
  try {
    const { id } = await params;
    const existing = getGame(id);
    if (!existing)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();
    const updated = {
      ...existing,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };
    saveGame(updated);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating game:", error);
    return NextResponse.json(
      { error: "Failed to update game" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
    const deny = await requireAdmin();
    if (deny) return deny;
  const { id } = await params;
  deleteGame(id);
  return NextResponse.json({ success: true });
}
