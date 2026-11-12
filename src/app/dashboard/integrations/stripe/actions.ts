"use server";

import { revalidatePath } from "next/cache";

import { requireTenantAdmin } from "@/lib/auth-context";
import { connectStripe, disconnectStripe } from "@/lib/stripe-tenant";

type Result = { success: true; webhook: boolean } | { success: false; error: string };

export async function saveStripeKey(key: string): Promise<Result> {
  const { tenantId } = await requireTenantAdmin();
  const result = await connectStripe(tenantId, key);
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/dashboard", "layout");
  return { success: true, webhook: result.webhook };
}

export async function removeStripe(): Promise<{ success: true }> {
  const { tenantId } = await requireTenantAdmin();
  await disconnectStripe(tenantId);
  revalidatePath("/dashboard", "layout");
  return { success: true };
}
