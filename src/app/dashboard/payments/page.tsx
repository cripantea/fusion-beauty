import { redirect } from "next/navigation";

import { getTenantContext } from "@/lib/auth-context";
import { isPaymentsEnabled } from "@/lib/payments-mode";

import { getPaymentsOverview } from "./actions";
import { PaymentsManager } from "./payments-manager";

export default async function PaymentsPage() {
  const { tenantId } = await getTenantContext();
  // Incassi in cassa spenti per il centro: la sezione non esiste.
  if (!(await isPaymentsEnabled(tenantId))) redirect("/dashboard");
  const overview = await getPaymentsOverview();

  return <PaymentsManager initialOverview={overview} />;
}
