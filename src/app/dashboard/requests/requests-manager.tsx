"use client";

import { Check, MessageCircle, Phone, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateAppointmentStatus, type OperatorDTO } from "@/app/dashboard/calendar/actions";
import { AppointmentFormDialog } from "@/app/dashboard/calendar/appointment-form-dialog";
import type { AppointmentDTO } from "@/app/dashboard/calendar/dto";
import type { ClientListItemDTO } from "@/app/dashboard/clients/actions";
import type { ServiceDTO } from "@/app/dashboard/services/actions";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/format";

import { getOnlineRequests } from "./actions";

const whenFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

type RequestsManagerProps = {
  initialRequests: AppointmentDTO[];
  clients: ClientListItemDTO[];
  services: ServiceDTO[];
  operators: OperatorDTO[];
};

export function RequestsManager({ initialRequests, clients, services, operators }: RequestsManagerProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [editing, setEditing] = useState<AppointmentDTO | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => setRequests(await getOnlineRequests()));
  }

  function resolve(request: AppointmentDTO, status: "CONFIRMED" | "CANCELLED") {
    startTransition(async () => {
      const result = await updateAppointmentStatus(request.id, status);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(status === "CONFIRMED" ? "Richiesta confermata: è in agenda." : "Richiesta rifiutata.");
      setRequests(await getOnlineRequests());
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Dal sito"
        title="Le richieste del sito arrivano qui."
        description="Conferma, proponi un altro orario o chiama: una volta confermata, la richiesta resta in agenda."
      />

      <Panel title={`Richieste da confermare${requests.length ? ` · ${requests.length}` : ""}`}>
        {requests.length === 0 ? (
          <EmptyState>Nessuna richiesta in attesa. Quando una cliente prenota dal widget la vedi qui.</EmptyState>
        ) : (
          <ul className="space-y-3 p-3">
            {requests.map((request) => (
              <li key={request.id} className="rounded-xl border border-mint-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-mint-ink">
                      Nuova richiesta dal sito
                    </div>
                    <div className="mt-1 text-lg font-bold">
                      {request.client.firstName} {request.client.lastName}
                    </div>
                    <div className="text-sm capitalize text-muted-foreground">
                      {request.service.name} · {whenFormatter.format(request.startTime)}
                    </div>
                    {request.notes ? (
                      <div className="mt-1 text-sm text-muted-foreground">“{request.notes}”</div>
                    ) : null}
                  </div>
                  <Pill tone="amber">Da confermare</Pill>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    className="h-9 rounded-xl"
                    disabled={isPending}
                    onClick={() => resolve(request, "CONFIRMED")}
                  >
                    <Check className="size-4" />
                    Conferma
                  </Button>
                  <Button variant="outline" className="h-9 rounded-xl" onClick={() => setEditing(request)}>
                    Proponi altro orario
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 rounded-xl"
                    nativeButton={false}
                    render={<a href={`tel:${request.client.phone}`} />}
                  >
                    <Phone className="size-4" />
                    Chiama
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 rounded-xl"
                    nativeButton={false}
                    render={<a href={whatsappUrl(request.client.phone)} target="_blank" rel="noopener noreferrer" />}
                  >
                    <MessageCircle className="size-4" />
                    WhatsApp
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-9 rounded-xl text-wine hover:bg-wine-soft hover:text-wine"
                    disabled={isPending}
                    onClick={() => resolve(request, "CANCELLED")}
                  >
                    <X className="size-4" />
                    Rifiuta
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <AppointmentFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        appointment={editing}
        clients={clients}
        services={services}
        operators={operators}
        onSuccess={refresh}
      />
    </div>
  );
}
