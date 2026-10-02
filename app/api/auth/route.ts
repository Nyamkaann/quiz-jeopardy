import { NextResponse } from "next/server";
import { AUTH_COOKIE, checkPassword, isAdmin, makeToken, passwordConfigured } from "@/lib/auth";

/** Is this browser logged in as admin? */
export async function GET() {
  return NextResponse.json({ authed: await isAdmin(), configured: passwordConfigured() });
}

/** Log in: body { password } */
export async function POST(req: Request) {
  if (!passwordConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not set. Add it to .env.local and restart the server." },
      { status: 500 },
    );
  }
  let password: unknown;
  try {
    ({ password } = await req.json());
  } catch {
    password = undefined;
  }
  if (!checkPassword(password)) {
    // small delay to slow down guessing
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const { value, maxAge } = makeToken();
  const res = NextResponse.json({ authed: true });
  res.cookies.set(AUTH_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: new URL(req.url).protocol === "https:",
  });
  return res;
}

/** Log out */
export async function DELETE() {
  const res = NextResponse.json({ authed: false });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
