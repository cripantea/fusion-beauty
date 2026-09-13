import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionRole } from "@/lib/auth/session";

export type AuthenticatedUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: SessionRole;
  tenantId: string | null;
};

/**
 * Returns the currently authenticated user, re-validated against the database
 * (not just the JWT claims) so a deactivated user/tenant is caught immediately.
 * Redirects to /login when there is no valid session.
 */
export async function getAuthContext(): Promise<{ user: AuthenticatedUser }> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? await verifySessionToken(token) : null;

  if (!payload) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { tenant: { select: { isActive: true } } },
  });

  if (!user || !user.isActive) {
    redirect("/login");
  }

  if (user.tenant && !user.tenant.isActive) {
    redirect("/login");
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
    },
  };
}

export class TenantContextError extends Error {
  constructor(message = "Nessun tenant associato all'utente corrente.") {
    super(message);
    this.name = "TenantContextError";
  }
}

/**
 * Like getAuthContext(), but also guarantees a tenantId is available —
 * the shape every tenant-scoped query/action should depend on.
 * Throws for a SUPER_ADMIN with no tenant selected (there is nothing to
 * redirect to yet since tenant impersonation isn't implemented).
 */
export async function getTenantContext(): Promise<{
  user: AuthenticatedUser;
  tenantId: string;
}> {
  const { user } = await getAuthContext();

  if (!user.tenantId) {
    throw new TenantContextError();
  }

  return { user, tenantId: user.tenantId };
}

/** Redirects non-SUPER_ADMIN users to /dashboard. */
export async function requireSuperAdmin(): Promise<{ user: AuthenticatedUser }> {
  const { user } = await getAuthContext();

  if (user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return { user };
}
