import { Cake, CalendarClock, MessageCircle, TriangleAlert } from "lucide-react";

import { EmptyState, PageHeader, Panel } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { getTenantContext } from "@/lib/auth-context";
import { whatsappUrl } from "@/lib/format";
import { getInactiveClients, getUpcomingBirthdays, INACTIVE_MONTHS } from "@/lib/insights";
import { prisma } from "@/lib/prisma";

const timeFormatter = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });
const birthdayFormatter = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" });

function monthsAgo(date: Date) {
  const now = new Date();
  const months = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
  return Math.max(months, 1);
}

function WhatsappButton({ href, label }: { href: string; label: string }) {
  return (
    <Button
      size="sm"
      className="h-8 rounded-lg bg-[#25D366] font-semibold text-white hover:bg-[#1fb857]"
      nativeButton={false}
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
    >
      <MessageCircle className="size-3.5" />
      {label}
    </Button>
  );
}

export default async function FollowUpPage() {
  const { tenantId } = await getTenantContext();

  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const [inactive, birthdays, tomorrow, tenant] = await Promise.all([
    getInactiveClients(tenantId),
    getUpcomingBirthdays(tenantId, 7),
    prisma.appointment.findMany({
      where: {
        tenantId,
        startTime: { gte: tomorrowStart, lte: tomorrowEnd },
        status: { in: ["BOOKED", "CONFIRMED"] },
      },
      orderBy: { startTime: "asc" },
      include: {
        client: { select: { firstName: true, lastName: true, phone: true } },
        service: { select: { name: true } },
      },
    }),
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Da ricontattare"
        title="Nessuna cliente dimenticata."
        description="Promemoria, compleanni e clienti che non tornano: un tocco e il messaggio WhatsApp è pronto."
      />

      <Panel
        tone="wine"
        title={`${inactive.length} ${inactive.length === 1 ? "cliente non torna" : "clienti non tornano"} da oltre ${INACTIVE_MONTHS} mesi`}
        icon={TriangleAlert}
      >
        {inactive.length === 0 ? (
          <EmptyState>Tutte le clienti sono tornate di recente 🎉</EmptyState>
        ) : (
          <ul className="divide-y divide-wine/10">
            {inactive.map((client) => (
              <li key={client.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {client.firstName} {client.lastName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    ultima visita {monthsAgo(client.lastVisit)} mesi fa
                    {client.lastServiceName ? ` · ${client.lastServiceName}` : ""} · {client.visits}{" "}
                    {client.visits === 1 ? "visita" : "visite"}
                  </div>
                </div>
                <WhatsappButton
                  label="Ricontatta"
                  href={whatsappUrl(
                    client.phone,
                    `Ciao ${client.firstName} 😊 è passato un po' dall'ultima volta da ${tenant.name}. Ti va di fissare un nuovo appuntamento? Ti aspettiamo!`
                  )}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Promemoria per domani" icon={CalendarClock}>
        {tomorrow.length === 0 ? (
          <EmptyState>Nessun appuntamento domani.</EmptyState>
        ) : (
          <ul className="divide-y divide-mint-border/60">
            {tomorrow.map((appointment) => (
              <li key={appointment.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="rounded-lg border border-mint-border bg-card px-2.5 py-1 text-sm font-bold">
                  {timeFormatter.format(appointment.startTime)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {appointment.client.firstName} {appointment.client.lastName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{appointment.service.name}</div>
                </div>
                <WhatsappButton
                  label="Invia promemoria"
                  href={whatsappUrl(
                    appointment.client.phone,
                    `Ciao ${appointment.client.firstName} 😊 ti ricordiamo il tuo appuntamento domani (${dayFormatter.format(appointment.startTime)}) alle ${timeFormatter.format(appointment.startTime)}. A presto!`
                  )}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Compleanni nei prossimi 7 giorni" icon={Cake}>
        {birthdays.length === 0 ? (
          <EmptyState>
            Nessun compleanno in arrivo. Le date si raccolgono dal questionario o dalla scheda cliente.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-mint-border/60">
            {birthdays.map((client) => (
              <li key={client.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {client.firstName} {client.lastName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {client.inDays === 0
                      ? "Oggi è il suo compleanno 🎂"
                      : `${birthdayFormatter.format(new Date(2000, client.month - 1, client.day))} · tra ${client.inDays} ${client.inDays === 1 ? "giorno" : "giorni"}`}
                  </div>
                </div>
                <WhatsappButton
                  label="Auguri"
                  href={whatsappUrl(
                    client.phone,
                    `Tanti auguri ${client.firstName} 🎂🎉 Tutto il team di ${tenant.name} ti augura una splendida giornata!`
                  )}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
