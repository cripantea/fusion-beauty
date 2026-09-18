import { notFound } from "next/navigation";

import { ConsentPanel } from "@/app/dashboard/consents/consent-panel";
import { getConsentsByClient } from "@/app/dashboard/consents/actions";
import { getPaymentsByClient } from "@/app/dashboard/payments/actions";
import { PAYMENT_METHOD_LABELS } from "@/app/dashboard/payments/constants";
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

import { getClientById, getClientDetailStats } from "../actions";
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

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const statusLabels: Record<string, string> = {
  BOOKED: "Prenotato",
  CONFIRMED: "Confermato",
  COMPLETED: "Completato",
  CANCELLED: "Annullato",
  NO_SHOW: "Assente",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
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
  if (!client) notFound();

  const [appointments, stats, consents, payments, productSales] = await Promise.all([
    prisma.appointment.findMany({
      where: { tenantId, clientId: id },
      orderBy: { startTime: "desc" },
      take: 30,
      include: {
        service: { select: { name: true, price: true } },
        operator: { select: { firstName: true, lastName: true } },
        payment: { select: { amount: true, method: true } },
      },
    }),
    getClientDetailStats(id),
    getConsentsByClient(id),
    getPaymentsByClient(id),
    prisma.productSale.findMany({
      where: { tenantId, clientId: id },
      orderBy: { soldAt: "desc" },
      take: 20,
      include: { product: { select: { name: true } } },
    }),
  ]);

  const missingConsents = ["PRIVACY", "MARKETING", "DATA_PROCESSING", "TREATMENT_SPECIFIC"].filter(
    (type) => !consents.find((c) => c.type === type && c.status === "GIVEN")
  ).length;

  return (
    <div className="space-y-6">
      <ClientDetailHeader client={client} />

      {/* Stats Row */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{stats.visitCount}</div>
            <p className="mt-1 text-sm text-muted-foreground">Visite totali</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{currencyFormatter.format(stats.totalSpent)}</div>
            <p className="mt-1 text-sm text-muted-foreground">Totale speso</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium">
              {stats.lastAppointmentDate
                ? dateFormatter.format(stats.lastAppointmentDate)
                : "—"}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Ultima visita</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {stats.nextAppointmentDate ? (
              <div className="text-sm font-medium text-blue-700">
                {dateFormatter.format(stats.nextAppointmentDate)}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Nessuno</div>
            )}
            <p className="mt-1 text-sm text-muted-foreground">Prossimo appuntamento</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Anagrafica */}
        <Card>
          <CardHeader>
            <CardTitle>Anagrafica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Nome: </span>
              <span className="font-medium">{client.firstName} {client.lastName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Telefono: </span>
              <a href={`tel:${client.phone}`} className="font-medium hover:underline">{client.phone}</a>
            </div>
            <div>
              <span className="text-muted-foreground">Email: </span>
              {client.email ? (
                <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a>
              ) : "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Operatrice preferita: </span>
              {stats.preferredOperator
                ? `${stats.preferredOperator.firstName} ${stats.preferredOperator.lastName}`
                : "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Cliente dal: </span>
              {dateFormatter.format(client.createdAt)}
            </div>
            {client.isVip && (
              <div className="pt-1">
                <Badge className="bg-amber-500 text-white">⭐ Cliente VIP</Badge>
              </div>
            )}
            {client.notes && (
              <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm italic">
                {client.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Consensi */}
        <ConsentPanel clientId={client.id} initialConsents={consents} />

        {/* Storico appuntamenti */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Storico appuntamenti</CardTitle>
                <CardDescription>Ultimi {appointments.length} appuntamenti.</CardDescription>
              </div>
              {missingConsents > 0 && (
                <Badge variant="destructive">{missingConsents} consensi mancanti</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun appuntamento registrato.</p>
            ) : (
              <div className="divide-y">
                {appointments.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <div className="flex-1">
                      <div className="font-medium">{apt.service.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {dateTimeFormatter.format(apt.startTime)}
                        {apt.operator
                          ? ` — ${apt.operator.firstName} ${apt.operator.lastName}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {apt.payment ? (
                        <span className="text-xs font-medium text-green-700">
                          {currencyFormatter.format(apt.payment.amount.toNumber())}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {currencyFormatter.format(apt.service.price.toNumber())}
                        </span>
                      )}
                      <Badge variant={statusVariants[apt.status]}>
                        {statusLabels[apt.status]}
                      </Badge>
                      {apt.payment && (
                        <Badge variant="outline" className="border-green-600 text-green-700 text-xs">
                          ✓ {PAYMENT_METHOD_LABELS[apt.payment.method as keyof typeof PAYMENT_METHOD_LABELS] ?? apt.payment.method}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prodotti acquistati */}
        {productSales.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Prodotti acquistati</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {productSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <div className="font-medium">{sale.product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {dateFormatter.format(sale.soldAt)}
                        {sale.quantity > 1 && ` × ${sale.quantity}`}
                      </div>
                    </div>
                    <span className="font-medium">
                      {currencyFormatter.format(sale.unitPrice.toNumber() * sale.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagamenti */}
        {payments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Storico pagamenti</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <div className="font-medium">
                        {p.appointment?.service.name ?? "Pagamento generico"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {dateFormatter.format(p.paidAt)} — {PAYMENT_METHOD_LABELS[p.method]}
                      </div>
                    </div>
                    <span className="font-bold">{currencyFormatter.format(p.amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
