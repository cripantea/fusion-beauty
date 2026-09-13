import { getTenantContext } from "@/lib/auth-context";

import { getIntegrationSettings } from "./actions";
import { IntegrationsManager } from "./integrations-manager";

export default async function CalendarIntegrationsPage() {
  await getTenantContext();
  const settings = await getIntegrationSettings();

  return (
    <div className="p-8">
      <IntegrationsManager initialSettings={settings} />
    </div>
  );
}
