import { getTenantContext } from "@/lib/auth-context";
import { normalizePhoneForWhatsapp } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { getConversations, getWhatsappStatus } from "./actions";
import { MessagesManager } from "./messages-manager";

export default async function MessagesPage({ searchParams }: PageProps<"/dashboard/messages">) {
  const { user, tenantId } = await getTenantContext();
  const status = await getWhatsappStatus();
  const conversations = status.connected ? await getConversations() : [];

  // ?cliente=<id>: apre la chat di quella cliente (dalla sua scheda).
  const { cliente } = await searchParams;
  let initialClient: { id: string; name: string; phone: string } | null = null;
  if (typeof cliente === "string") {
    const client = await prisma.client.findFirst({
      where: { id: cliente, tenantId },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    if (client) {
      initialClient = { id: client.id, name: `${client.firstName} ${client.lastName}`.trim(), phone: normalizePhoneForWhatsapp(client.phone) };
    }
  }

  return (
    <MessagesManager
      connected={status.connected}
      phoneNumber={status.phoneNumber}
      isAdmin={user.role === "ADMIN"}
      initialConversations={conversations}
      initialClient={initialClient}
    />
  );
}
