"use client";

/**
 * Browser-side auth helpers. The real check happens on the server (httpOnly cookie);
 * the sessionStorage flag is only a UI hint so we don't ask for the password twice.
 */
const FLAG = "sp_quiz_auth";

export function isAuthed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

export function markAuthed(on: boolean) {
  try {
    if (on) sessionStorage.setItem(FLAG, "1");
    else sessionStorage.removeItem(FLAG);
  } catch {
    /* ignore */
  }
}

/** Ask the server to verify a password; sets the httpOnly cookie on success. */
export async function login(password: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.ok) {
    markAuthed(true);
    return { ok: true };
  }
  const body = await res.json().catch(() => ({}));
  return { ok: false, error: res.status === 500 ? body.error : undefined };
}

export async function logout() {
  markAuthed(false);
  await fetch("/api/auth", { method: "DELETE" });
}

/** Server truth: is the cookie still valid? */
export async function checkAuth(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth", { cache: "no-store" });
    const { authed } = await res.json();
    markAuthed(!!authed);
    return !!authed;
  } catch {
    return false;
  }
}

/** fetch() that notices an expired login and tells the host. */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    markAuthed(false);
    alert("Нэвтрэх хугацаа дууссан байна. Хуудсыг refresh хийгээд нууц үгээ дахин оруулна уу.");
  }
  return res;
}
