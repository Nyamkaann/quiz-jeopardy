import { NextResponse } from "next/server";
import { PLAY_COOKIE, canPlay, checkPlayCode, makePlayToken, playCodeConfigured } from "@/lib/auth";

/** Can this browser start a game? */
export async function GET() {
  return NextResponse.json({ authed: await canPlay(), configured: playCodeConfigured() });
}

/** Enter the play code: body { code } */
export async function POST(req: Request) {
  if (!playCodeConfigured()) {
    return NextResponse.json(
      { error: "PLAY_CODE is not set. Add it to .env.local and restart the server." },
      { status: 500 },
    );
  }
  let code: unknown;
  try {
    ({ code } = await req.json());
  } catch {
    code = undefined;
  }
  if (!checkPlayCode(code)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "Wrong code" }, { status: 401 });
  }
  const { value, maxAge } = makePlayToken();
  const res = NextResponse.json({ authed: true });
  res.cookies.set(PLAY_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: new URL(req.url).protocol === "https:",
  });
  return res;
}
