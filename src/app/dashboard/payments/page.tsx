import { getTenantContext } from "@/lib/auth-context";

import { getPaymentsOverview } from "./actions";
import { PaymentsManager } from "./payments-manager";

export default async function PaymentsPage() {
  await getTenantContext();
  const overview = await getPaymentsOverview();

  return <PaymentsManager initialOverview={overview} />;
}
