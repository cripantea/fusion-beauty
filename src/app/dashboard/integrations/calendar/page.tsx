import { getTenantContext } from "@/lib/auth-context";

import { getIntegrationSettings } from "./actions";
import { IntegrationsManager } from "./integrations-manager";

export default async function CalendarIntegrationsPage() {
  await getTenantContext();
  const settings = await getIntegrationSettings();

  return <IntegrationsManager initialSettings={settings} />;
}
