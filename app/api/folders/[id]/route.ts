import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";
import { deleteFolder, descendantIds, readFolders, writeFolders } from "@/lib/db";

/** Rename and/or move a folder: body { name?, parentId? } */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const deny = await requireAdmin();
    if (deny) return deny;
  try {
    const { id } = await params;
    const folders = readFolders();
    const folder = folders.find((f) => f.id === id);
    if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();
    const next = { ...folder };
    if (typeof body.name === "string" && body.name.trim()) next.name = body.name.trim();
    if (body.parentId !== undefined) {
      const parentId = body.parentId === null ? null : String(body.parentId);
      // can't move a folder into itself or one of its own sub-folders
      if (parentId && descendantIds(folders, id).has(parentId)) {
        return NextResponse.json({ error: "Cannot move a folder into itself" }, { status: 400 });
      }
      if (parentId && !folders.some((f) => f.id === parentId)) {
        return NextResponse.json({ error: "Parent not found" }, { status: 400 });
      }
      next.parentId = parentId;
    }
    writeFolders(folders.map((f) => (f.id === id ? next : f)));
    return NextResponse.json(next);
  } catch (error) {
    console.error("Error updating folder:", error);
    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const deny = await requireAdmin();
    if (deny) return deny;
  const { id } = await params;
  deleteFolder(id);
  return NextResponse.json({ success: true });
}
