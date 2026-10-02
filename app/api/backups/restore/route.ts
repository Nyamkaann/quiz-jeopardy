import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { restoreBackup } from "@/lib/db";

/** body { file } — restore one backup over the live data */
export async function POST(req: Request) {
  const deny = await requireAdmin();
  if (deny) return deny;
  try {
    const { file } = await req.json();
    const kind = restoreBackup(String(file ?? ""));
    return NextResponse.json({ success: true, kind });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
