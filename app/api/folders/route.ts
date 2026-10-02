import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readFolders, writeFolders } from "@/lib/db";
import { Folder } from "@/types";

export async function GET() {
  return NextResponse.json(readFolders());
}

export async function POST(req: Request) {
    const deny = await requireAdmin();
    if (deny) return deny;
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    const folders = readFolders();
    const parentId =
      typeof body.parentId === "string" && folders.some((f) => f.id === body.parentId) ? body.parentId : null;
    const folder: Folder = { id: uuidv4(), name, parentId, createdAt: new Date().toISOString() };
    writeFolders([...folders, folder]);
    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }
}
