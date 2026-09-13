"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";

import { clearSessionCookie, setSessionCookie } from "@/lib/auth/cookies";
import { createSessionToken } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = {
  error?: string;
};

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Inserisci un'email valida e una password." };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: { select: { isActive: true } } },
  });

  if (!user || !user.isActive) {
    return { error: "Credenziali non valide." };
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return { error: "Credenziali non valide." };
  }

  if (user.tenant && !user.tenant.isActive) {
    return { error: "Il centro associato a questo account è stato sospeso." };
  }

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
  });

  await setSessionCookie(token);

  redirect(user.role === "SUPER_ADMIN" ? "/admin" : "/dashboard");
}

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}
