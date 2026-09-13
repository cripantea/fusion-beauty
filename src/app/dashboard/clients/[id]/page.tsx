import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import { getClientById } from "../actions";
import { ClientDetailHeader } from "./client-detail-header";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
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

const statusVariants: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  BOOKED: "secondary",
  CONFIRMED: "default",
  COMPLETED: "outline",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
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

  const appointments = await prisma.appointment.findMany({
    where: { tenantId, clientId: id },
    orderBy: { startTime: "desc" },
    take: 20,
    include: {
      service: { select: { name: true } },
      operator: { select: { firstName: true, lastName: true } },
    },
  });

  const now = new Date();
  const lastAppointment = appointments.find((appointment) => appointment.startTime <= now) ?? null;

  return (
    <div className="space-y-6 p-8">
      <ClientDetailHeader client={client} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Anagrafica & contatti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Nome completo: </span>
              {client.firstName} {client.lastName}
            </div>
            <div>
              <span className="text-muted-foreground">Telefono: </span>
              {client.phone}
            </div>
            <div>
              <span className="text-muted-foreground">Email: </span>
              {client.email ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Note interne: </span>
              {client.notes ?? "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Cliente dal: </span>
              {dateFormatter.format(client.createdAt)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ultimo trattamento</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {lastAppointment ? (
              <div className="space-y-2">
                <div>
                  <span className="text-muted-foreground">Data: </span>
                  {dateTimeFormatter.format(lastAppointment.startTime)}
                </div>
                <div>
                  <span className="text-muted-foreground">Trattamento: </span>
                  {lastAppointment.service.name}
                </div>
                <div>
                  <span className="text-muted-foreground">Operatore: </span>
                  {lastAppointment.operator
                    ? `${lastAppointment.operator.firstName} ${lastAppointment.operator.lastName}`
                    : "-"}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Nessun trattamento svolto finora.</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Storico appuntamenti</CardTitle>
            <CardDescription>Appuntamenti passati e futuri del cliente.</CardDescription>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun appuntamento registrato.</p>
            ) : (
              <ul className="divide-y">
                {appointments.map((appointment) => (
                  <li
                    key={appointment.id}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">{appointment.service.name}</div>
                      <div className="text-muted-foreground">
                        {dateTimeFormatter.format(appointment.startTime)}
                        {appointment.operator
                          ? ` — ${appointment.operator.firstName} ${appointment.operator.lastName}`
                          : ""}
                      </div>
                    </div>
                    <Badge variant={statusVariants[appointment.status]}>
                      {statusLabels[appointment.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
