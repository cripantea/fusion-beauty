import { ArrowLeft, Inbox } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState, PageHeader, Panel } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { requireTenantAdmin } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

type Answer = { key: string; label: string; value: string };

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function FormSubmissionsPage({ params }: PageProps<"/dashboard/forms/[id]/risposte">) {
  const { id } = await params;
  const { tenantId } = await requireTenantAdmin();
  const form = await prisma.form.findFirst({ where: { id, tenantId }, select: { id: true, name: true } });
  if (!form) notFound();

  const submissions = await prisma.formSubmission.findMany({
    where: { formId: form.id, tenantId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { client: { select: { id: true, firstName: true, lastName: true, phone: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Form"
        title={`Risposte – ${form.name}`}
        description="Ogni risposta è collegata alla scheda della cliente (creata o aggiornata in automatico)."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard/forms" />}>
            <ArrowLeft className="size-4" />
            Tutti i form
          </Button>
        }
      />

      <Panel title={`${submissions.length} ${submissions.length === 1 ? "risposta" : "risposte"}`} icon={Inbox}>
        {submissions.length === 0 ? (
          <EmptyState>Ancora nessuna risposta. Appena qualcuno compila il form la trovi qui.</EmptyState>
        ) : (
          <ul className="divide-y divide-mint-border/70">
            {submissions.map((submission) => {
              const payload = submission.payload as { answers?: Answer[]; page?: string | null };
              return (
                <li key={submission.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/dashboard/clients/${submission.client.id}`} className="font-semibold hover:underline">
                      {submission.client.firstName} {submission.client.lastName}
                    </Link>
                    <span className="text-xs text-muted-foreground">{dateFormatter.format(submission.createdAt)}</span>
                  </div>
                  <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[180px_1fr]">
                    {(payload.answers ?? []).map((answer) => (
                      <div key={answer.key} className="contents">
                        <dt className="text-muted-foreground">{answer.label}</dt>
                        <dd className="whitespace-pre-line">{answer.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {payload.page ? (
                    <p className="truncate text-xs text-muted-foreground">Dalla pagina: {payload.page}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
