import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "./session";

export async function setSessionCookie(token: string) {
  const store = await cookies();

  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
