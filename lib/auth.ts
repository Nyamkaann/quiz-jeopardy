import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Admin auth, server side only.
 * The password lives in .env.local (ADMIN_PASSWORD) and never reaches the browser.
 * After a correct password the server sets an httpOnly, HMAC-signed cookie.
 */

export const AUTH_COOKIE = "astro_admin";
const TTL_SECONDS = 12 * 60 * 60; // 12h

/**
 * Cookie-signing key. Works as long as ANY of the secrets is set, so the play
 * code still works on a host where only PLAY_CODE was configured.
 */
function key(): Buffer | null {
  const parts = [process.env.AUTH_SECRET, process.env.ADMIN_PASSWORD, process.env.PLAY_CODE].filter(Boolean);
  if (parts.length === 0) return null;
  return crypto.createHash("sha256").update(`astro:${parts.join(":")}`).digest();
}

export function passwordConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

export function checkPassword(input: unknown): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || typeof input !== "string") return false;
  const a = crypto.createHash("sha256").update(input.trim()).digest();
  const b = crypto.createHash("sha256").update(pw.trim()).digest();
  return crypto.timingSafeEqual(a, b);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", key()!).update(payload).digest("base64url");
}

export function makeToken(): { value: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return { value: `${exp}.${sign(String(exp))}`, maxAge: TTL_SECONDS };
}

export function verifyToken(token: string | undefined): boolean {
  if (!token || !key()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  const expected = sign(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(AUTH_COOKIE)?.value);
}

/** Use at the top of a mutating route: `const deny = await requireAdmin(); if (deny) return deny;` */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/* ─────────── Play code (separate from the admin password) ─────────── */

/** Cookie set after the correct PLAY_CODE — lets this browser open /play/... */
export const PLAY_COOKIE = "astro_play";

export function playCodeConfigured(): boolean {
  return !!process.env.PLAY_CODE;
}

export function checkPlayCode(input: unknown): boolean {
  const code = process.env.PLAY_CODE;
  if (!code || typeof input !== "string") return false;
  const a = crypto.createHash("sha256").update(input.trim()).digest();
  const b = crypto.createHash("sha256").update(code).digest();
  return crypto.timingSafeEqual(a, b);
}

export function makePlayToken(): { value: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return { value: `${exp}.${sign(`play:${exp}`)}`, maxAge: TTL_SECONDS };
}

function verifyPlayToken(token: string | undefined): boolean {
  if (!token || !key()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(`play:${exp}`));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Allowed to play: entered the play code, or is logged in as admin. */
export async function canPlay(): Promise<boolean> {
  const store = await cookies();
  return verifyPlayToken(store.get(PLAY_COOKIE)?.value) || verifyToken(store.get(AUTH_COOKIE)?.value);
}
