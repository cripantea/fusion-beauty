import { redirect } from "next/navigation";

import { requireSuperAdmin } from "@/lib/auth-context";

export default async function AdminPage() {
  await requireSuperAdmin();
  redirect("/admin/tenants");
}
