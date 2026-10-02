import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listBackups } from "@/lib/db";

export async function GET() {
  const deny = await requireAdmin();
  if (deny) return deny;
  return NextResponse.json(listBackups());
}
