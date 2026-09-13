import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionRole = "SUPER_ADMIN" | "ADMIN" | "OPERATOR";

export type SessionPayload = {
  sub: string;
  email: string;
  role: SessionRole;
  tenantId: string | null;
};

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }

  return new TextEncoder().encode(secret);
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.sub === "string" &&
    typeof candidate.email === "string" &&
    (candidate.role === "SUPER_ADMIN" ||
      candidate.role === "ADMIN" ||
      candidate.role === "OPERATOR") &&
    (candidate.tenantId === null || typeof candidate.tenantId === "string")
  );
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return isSessionPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}
