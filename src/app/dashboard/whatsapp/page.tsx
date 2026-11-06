import { requireTenantAdmin } from "@/lib/auth-context";
import { fusionWaBaseUrl, getConnectionState, getWidgetToken, isFusionWaConfigured } from "@/lib/fusion-wa";
import { prisma } from "@/lib/prisma";
import { AUTOMATION_KINDS } from "@/lib/whatsapp";

import { WhatsappSettings, type AutomationDTO } from "./whatsapp-settings";

export default async function WhatsappPage() {
  const { tenantId } = await requireTenantAdmin();

  if (!isFusionWaConfigured()) {
    return <WhatsappSettings configured={false} tenantId={tenantId} fusionWaBaseUrl="" connection={null} widgetToken={null} automations={[]} stateError={null} />;
  }

  let connection = await prisma.whatsappConnection.findUnique({ where: { tenantId } });
  const state = await getConnectionState(tenantId);

  // Collegamento completato su Fusion WA ma non ancora salvato qui (es. finestra chiusa
  // durante l'attesa): lo si adotta, verificato server-to-server.
  const remote = state.ok ? state.state.connection : null;
  if (!connection && remote?.status === "CONNECTED") {
    const taken = await prisma.whatsappConnection.findUnique({ where: { phoneNumberId: remote.phoneNumberId } });
    if (!taken) {
      connection = await prisma.whatsappConnection.create({
        data: { tenantId, wabaId: remote.wabaId, phoneNumberId: remote.phoneNumberId, phoneNumber: remote.phoneNumber },
      });
    }
  }

  const widget = connection ? null : await getWidgetToken(tenantId);
  const saved = await prisma.whatsappAutomation.findMany({ where: { tenantId } });
  const automations: AutomationDTO[] = AUTOMATION_KINDS.map((kind) => {
    const row = saved.find((a) => a.kind === kind);
    return {
      kind,
      enabled: row?.enabled ?? false,
      templateName: row?.templateName ?? "",
      language: row?.language ?? "it",
      templateBody: row?.templateBody ?? "",
      params: row?.params ?? [],
    };
  });

  return (
    <WhatsappSettings
      configured
      tenantId={tenantId}
      fusionWaBaseUrl={fusionWaBaseUrl()}
      connection={
        connection
          ? {
              phoneNumber: connection.phoneNumber,
              operational: remote?.phoneNumberId === connection.phoneNumberId ? remote.operational : null,
            }
          : null
      }
      widgetToken={widget?.ok ? widget.token : null}
      stateError={!state.ok ? state.error : widget && !widget.ok ? widget.error : null}
      automations={automations}
    />
  );
}
