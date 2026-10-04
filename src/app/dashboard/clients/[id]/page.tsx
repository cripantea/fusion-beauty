import { AlertCircle, Clock, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";

import { EmptyState, Panel, Pill } from "@/components/boutique";
import { getTenantContext } from "@/lib/auth-context";
import { formatEuro } from "@/lib/format";
import { getClientStatsMap } from "@/lib/insights";
import { prisma } from "@/lib/prisma";

import { getClientConsents } from "@/app/dashboard/consents/collect-actions";

import { getClientById } from "../actions";
import { ClientConsentsCard } from "./client-consents-card";
import { ClientDetailHeader } from "./client-detail-header";
import { QuestionnaireCard } from "./questionnaire-card";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const statusLabels: Record<string, string> = {
  BOOKED: "Prenotato",
  CONFIRMED: "Confermato",
  COMPLETED: "Completato",
  CANCELLED: "Annullato",
  NO_SHOW: "Assente",
};

const statusTones: Record<string, "mint" | "amber" | "wine" | "slate" | "forest"> = {
  BOOKED: "slate",
  CONFIRMED: "mint",
  COMPLETED: "forest",
  CANCELLED: "wine",
  NO_SHOW: "amber",
};

type ClientDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { id } = await params;
  const { tenantId } = await getTenantContext();

  const client = await getClientById(id);

  if (!client) {
    notFound();
  }

  const now = new Date();

  const [consents, statsMap, appointments, nextAppointment, favorites, questionnaire] =
    await Promise.all([
      getClientConsents(id),
      getClientStatsMap(tenantId, [id]),
      prisma.appointment.findMany({
        where: { tenantId, clientId: id },
        orderBy: { startTime: "desc" },
        take: 20,
        include: {
          service: { select: { name: true, price: true } },
          operator: { select: { firstName: true, lastName: true } },
          payment: { select: { amount: true } },
        },
      }),
      prisma.appointment.findFirst({
        where: {
          tenantId,
          clientId: id,
          startTime: { gte: now },
          status: { in: ["BOOKED", "CONFIRMED"] },
        },
        orderBy: { startTime: "asc" },
        select: { startTime: true, service: { select: { name: true } } },
      }),
      prisma.appointment.groupBy({
        by: ["serviceId"],
        where: { tenantId, clientId: id, status: "COMPLETED" },
        _count: { _all: true },
        orderBy: { _count: { serviceId: "desc" } },
        take: 3,
      }),
      prisma.clientQuestionnaire.findFirst({
        where: { tenantId, clientId: id },
        orderBy: { createdAt: "desc" },
        select: { sentAt: true, completedAt: true },
      }),
    ]);

  const stats = statsMap.get(id) ?? { visits: 0, totalSpent: 0, lastVisit: null };
  const favoriteServices = favorites.length
    ? await prisma.service.findMany({
        where: { tenantId, id: { in: favorites.map((favorite) => favorite.serviceId) } },
        select: { id: true, name: true },
      })
    : [];
  const favoriteNames = favorites
    .map((favorite) => favoriteServices.find((service) => service.id === favorite.serviceId)?.name)
    .filter((name): name is string => Boolean(name));

  const daysSinceLastVisit = stats.lastVisit
    ? Math.floor((now.getTime() - stats.lastVisit.getTime()) / 86_400_000)
    : null;

  const questionnaireStatus = questionnaire
    ? questionnaire.completedAt
      ? "completed"
      : "sent"
    : "none";
  const questionnaireDate = questionnaire?.completedAt ?? questionnaire?.sentAt ?? null;

  const hasMedicalInfo = Boolean(client.allergies || client.healthNotes);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ClientDetailHeader client={client} visits={stats.visits} totalSpent={stats.totalSpent} />

      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Stato visite" icon={Clock}>
          <dl className="space-y-3 p-5 text-sm">
            <div className="flex justify-between gap-3 border-b border-mint-border/60 pb-3">
              <dt className="text-muted-foreground">Ultima visita</dt>
              <dd className="text-right font-semibold">
                {stats.lastVisit
                  ? `${dateFormatter.format(stats.lastVisit)} (${daysSinceLastVisit} gg fa)`
                  : "Nessuna ancora"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Prossimo appuntamento</dt>
              <dd className="text-right font-semibold text-mint-ink">
                {nextAppointment
                  ? `${dateTimeFormatter.format(nextAppointment.startTime)} · ${nextAppointment.service.name}`
                  : "Non programmato"}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Trattamenti preferiti" icon={Sparkles}>
          <div className="space-y-3 p-5">
            {favoriteNames.length === 0 && client.interests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Compariranno dopo i primi trattamenti o dal questionario.
              </p>
            ) : null}
            {favoriteNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {favoriteNames.map((name) => (
                  <Pill key={name}>{name}</Pill>
                ))}
              </div>
            ) : null}
            {client.interests.length > 0 ? (
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Interessata a
                </div>
                <div className="flex flex-wrap gap-2">
                  {client.interests.map((name) => (
                    <Pill key={name} tone="slate">
                      {name}
                    </Pill>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Panel>

        <ClientConsentsCard
          clientId={client.id}
          clientName={`${client.firstName} ${client.lastName}`}
          consents={consents}
        />

        <QuestionnaireCard
          clientId={client.id}
          status={questionnaireStatus}
          date={questionnaireDate}
        />

        <section className="rounded-2xl border border-amber-200 bg-amber-soft p-5">
          <h2 className="flex items-center gap-2 font-sans text-sm font-semibold text-amber-ink">
            <AlertCircle className="size-4" />
            Note personali cabina
          </h2>
          <div className="mt-2 space-y-2 text-sm text-amber-ink">
            {client.notes ? <p>{client.notes}</p> : null}
            {client.allergies ? (
              <p>
                <strong>Allergie:</strong> {client.allergies}
              </p>
            ) : null}
            {client.healthNotes ? (
              <p>
                <strong>Pelle e salute:</strong> {client.healthNotes}
              </p>
            ) : null}
            {!client.notes && !hasMedicalInfo ? (
              <p className="opacity-75">
                Nessuna nota. Aggiungi preferenze e attenzioni dalla scheda, oppure invia il
                questionario.
              </p>
            ) : null}
            {client.acquisitionSource ? (
              <p className="opacity-75">Ci ha conosciuto tramite: {client.acquisitionSource}</p>
            ) : null}
          </div>
        </section>

        <Panel title="Storico appuntamenti" className="md:col-span-2">
          {appointments.length === 0 ? (
            <EmptyState>Nessun appuntamento registrato.</EmptyState>
          ) : (
            <ul className="divide-y divide-mint-border/60">
              {appointments.map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{appointment.service.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {dateTimeFormatter.format(appointment.startTime)}
                      {appointment.operator ? ` — ${appointment.operator.firstName}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {formatEuro(
                        (appointment.payment?.amount ?? appointment.service.price).toNumber()
                      )}
                    </span>
                    <Pill tone={statusTones[appointment.status]}>
                      {statusLabels[appointment.status]}
                    </Pill>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
