import { requireTenantAdmin } from "@/lib/auth-context";
import { getStripeStatus } from "@/lib/stripe-tenant";

import { StripeSettings } from "./stripe-settings";

export default async function StripePage() {
  const { tenantId } = await requireTenantAdmin();
  return <StripeSettings status={await getStripeStatus(tenantId)} />;
}
