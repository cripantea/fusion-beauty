import { requireTenantAdmin } from "@/lib/auth-context";
import { fusionWaBaseUrl, getConnectionState, getNumberStatus, getWidgetToken, isFusionWaConfigured } from "@/lib/fusion-wa";
import { prisma } from "@/lib/prisma";
import { APP_CONTACT_SOURCE } from "@/lib/whatsapp";

import { WhatsappSettings, type WhatsappTab } from "./whatsapp-settings";

const TABS: WhatsappTab[] = ["numero", "template", "rubrica"];

/** Area WhatsApp come nel CRM: numero collegato (stato su Meta), template, rubrica dell'app Business. */
export default async function WhatsappPage({ searchParams }: PageProps<"/dashboard/whatsapp">) {
  const { tenantId } = await requireTenantAdmin();
  const tabParam = (await searchParams).tab;
  const tab = TABS.find((t) => t === tabParam) ?? "numero";

  if (!isFusionWaConfigured()) {
    return <WhatsappSettings configured={false} tab={tab} tenantId={tenantId} fusionWaBaseUrl="" connection={null} widgetToken={null} stateError={null} meta={null} imported={0} />;
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

  const [widget, numberStatus, imported] = await Promise.all([
    connection ? null : getWidgetToken(tenantId),
    connection ? getNumberStatus(tenantId) : null,
    prisma.client.count({ where: { tenantId, acquisitionSource: APP_CONTACT_SOURCE } }),
  ]);

  return (
    <WhatsappSettings
      configured
      tab={tab}
      tenantId={tenantId}
      fusionWaBaseUrl={fusionWaBaseUrl()}
      connection={
        connection
          ? {
              phoneNumber: connection.phoneNumber,
              connectedAt: connection.createdAt.toISOString(),
              operational: remote?.phoneNumberId === connection.phoneNumberId ? remote.operational : null,
              billingStatus: remote?.phoneNumberId === connection.phoneNumberId ? remote.billingStatus : null,
            }
          : null
      }
      meta={
        numberStatus?.ok
          ? {
              number: numberStatus.number,
              sync: numberStatus.sync,
              windowOpen: numberStatus.sync?.windowClosesAt ? new Date(numberStatus.sync.windowClosesAt) > new Date() : false,
            }
          : null
      }
      widgetToken={widget?.ok ? widget.token : null}
      stateError={!state.ok ? state.error : widget && !widget.ok ? widget.error : null}
      imported={imported}
    />
  );
}
