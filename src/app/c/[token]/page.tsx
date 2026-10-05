import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { ConsentSignForm } from "./consent-sign-form";

export const metadata: Metadata = {
  title: "Firma consenso",
  robots: { index: false, follow: false },
};

type ConsentPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ConsentPage({ params }: ConsentPageProps) {
  const { token } = await params;

  const record = await prisma.consentRecord.findUnique({
    where: { token },
    include: {
      client: { select: { firstName: true, lastName: true, phone: true } },
      template: { select: { title: true } },
      tenant: { select: { name: true, isActive: true } },
    },
  });

  if (!record || !record.tenant.isActive) {
    notFound();
  }

  if (record.status === "SIGNED") {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-forest px-5 pb-10 pt-8 text-forest-foreground">
          <div className="mx-auto max-w-lg">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-mint">
              {record.tenant.name}
            </div>
            <h1 className="mt-2 text-3xl font-bold leading-tight">Consenso già firmato</h1>
          </div>
        </header>
        <main className="mx-auto -mt-5 max-w-lg px-4 pb-12">
          <div className="rounded-2xl border border-mint-border bg-card p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Hai già firmato questo consenso. Non è necessaria nessuna azione.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-forest px-5 pb-10 pt-8 text-forest-foreground">
        <div className="mx-auto max-w-lg">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-mint">
            {record.tenant.name}
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight">
            Ciao {record.client.firstName}!
          </h1>
          <p className="mt-2 text-sm text-forest-foreground/80">
            Ti chiediamo di leggere e firmare il consenso qui sotto prima del trattamento.
          </p>
        </div>
      </header>

      <main className="mx-auto -mt-5 max-w-lg px-4 pb-12">
        <ConsentSignForm
          token={token}
          clientName={`${record.client.firstName} ${record.client.lastName}`}
          clientPhone={record.client.phone}
          consentTitle={record.titleSnapshot}
          consentBody={record.bodySnapshot}
        />
      </main>
    </div>
  );
}
