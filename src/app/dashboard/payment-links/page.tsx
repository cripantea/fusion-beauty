import { getBaseUrl } from "@/lib/app-url";
import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";
import { getStripeStatus } from "@/lib/stripe-tenant";

import { PaymentLinksManager } from "./payment-links-manager";

export default async function PaymentLinksPage() {
  const { tenantId } = await getTenantContext();
  const [links, stripe, base] = await Promise.all([
    prisma.paymentLink.findMany({
      where: { tenantId },
      include: { client: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    getStripeStatus(tenantId),
    getBaseUrl(),
  ]);

  return (
    <PaymentLinksManager
      connected={stripe.connected}
      links={links.map((l) => ({
        token: l.token,
        url: `${base}/paga/${l.token}`,
        status: l.status,
        amountCents: l.amountCents,
        description: l.description,
        paidWith: l.paidWith,
        createdAt: l.createdAt.toISOString(),
        paidAt: l.paidAt?.toISOString() ?? null,
        client: { id: l.client.id, name: `${l.client.firstName} ${l.client.lastName}`.trim(), phone: l.client.phone },
      }))}
    />
  );
}
