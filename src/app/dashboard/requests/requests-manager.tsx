"use client";

import { CalendarClock, Check, MessageCircle, Phone } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateAppointmentStatus, type OperatorDTO } from "@/app/dashboard/calendar/actions";
import type { AppointmentDTO } from "@/app/dashboard/calendar/dto";
import { getAvailableSlots } from "@/app/embed/[slug]/actions";
import type { ClientListItemDTO } from "@/app/dashboard/clients/actions";
import type { ServiceDTO } from "@/app/dashboard/services/actions";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { whatsappUrl } from "@/lib/format";

import { getOnlineRequests, proposeAlternative, setAutoConfirmOnline, type RequestDTO } from "./actions";

const whenFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" });

type RequestsManagerProps = {
  tenantSlug: string;
  autoConfirm: boolean;
  isAdmin: boolean;
  initialRequests: RequestDTO[];
  clients: ClientListItemDTO[];
  services: ServiceDTO[];
  operators: OperatorDTO[];
};

export function RequestsManager({ tenantSlug, autoConfirm: initialAutoConfirm, isAdmin, initialRequests, operators }: RequestsManagerProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [autoConfirm, setAutoConfirm] = useState(initialAutoConfirm);
  const [editing, setEditing] = useState<RequestDTO | null>(null);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => setRequests(await getOnlineRequests()));
  }

  // Come Treatwell e Fresha: una richiesta non si rifiuta, si conferma o si sposta.
  function confirm(request: AppointmentDTO) {
    startTransition(async () => {
      const result = await updateAppointmentStatus(request.id, "CONFIRMED");
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Confermata: è in agenda e alla cliente arriva la conferma su WhatsApp.");
      setRequests(await getOnlineRequests());
    });
  }

  function toggleAutoConfirm(enabled: boolean) {
    setAutoConfirm(enabled);
    startTransition(async () => {
      const result = await setAutoConfirmOnline(enabled);
      if (!result.success) {
        setAutoConfirm(!enabled);
        toast.error(result.error);
        return;
      }
      toast.success(enabled ? "Le prenotazioni dal sito si confermano da sole." : "Le prenotazioni dal sito le confermi tu.");
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Dal sito"
        title="Le prenotazioni del sito arrivano qui."
        description={
          autoConfirm
            ? "Come su Treatwell: la cliente sceglie solo orari liberi negli orari di lavoro e la prenotazione è subito confermata, con il riepilogo su WhatsApp. Se devi spostarla, proponi un altro orario: se la cliente accetta si sposta da sola, se dice di no torna qui."
            : "Conferma, oppure se l'orario non va bene proponine un altro: la cliente riceve tutto su WhatsApp e, se accetta, l'appuntamento si conferma da solo. Se dice di no, la richiesta torna qui per un'altra proposta."
        }
      />

      {isAdmin ? (
        <label className="flex items-start gap-3 rounded-xl border border-mint-border bg-white p-4 text-sm">
          <Switch checked={autoConfirm} disabled={isPending} onCheckedChange={toggleAutoConfirm} />
          <span>
            <span className="font-semibold">Conferma automatica</span>
            <span className="block text-muted-foreground">
              {autoConfirm
                ? "Attiva: l'agenda online mostra solo gli orari liberi dentro gli orari di lavoro dello staff (Staff → Orari)."
                : "Spenta: ogni prenotazione dal sito resta da confermare qui."}
            </span>
          </span>
        </label>
      ) : null}

      <Panel title={`Prenotazioni dal sito${requests.length ? ` · ${requests.length}` : ""}`}>
        {requests.length === 0 ? (
          <EmptyState>Nessuna prenotazione recente. Quando una cliente prenota dal sito la vedi qui.</EmptyState>
        ) : (
          <ul className="space-y-3 p-3">
            {requests.map((request) => (
              <li key={request.id} className="rounded-xl border border-mint-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-mint-ink">
                      {request.autoConfirmed ? "Prenotata dal sito" : "Nuova richiesta dal sito"}
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
                  <Pill tone={request.autoConfirmed && !request.proposal ? "forest" : "amber"}>
                    {request.proposal?.status === "DECLINED"
                      ? "Proponi un altro orario"
                      : request.proposal?.status === "PENDING"
                        ? "Attende la cliente"
                        : request.autoConfirmed
                          ? "Confermata"
                          : "Da confermare"}
                  </Pill>
                </div>
                {request.proposal ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <CalendarClock className="mt-0.5 size-4 shrink-0 text-mint-ink" />
                    <span>
                      Proposto <strong className="capitalize">{whenFormatter.format(request.proposal.start)}</strong> ·{" "}
                      {request.proposal.status === "PENDING"
                        ? "in attesa di risposta su WhatsApp"
                        : request.proposal.status === "DECLINED"
                          ? "la cliente non può: proponile un altro orario (le abbiamo scritto che arriva a breve) o chiamala"
                          : "accettato"}
                    </span>
                  </div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {request.autoConfirmed ? null : (
                    <Button className="h-9 rounded-xl" disabled={isPending} onClick={() => confirm(request)}>
                      <Check className="size-4" />
                      Conferma
                    </Button>
                  )}
                  <Button
                    variant={request.proposal?.status === "DECLINED" ? "default" : "outline"}
                    className="h-9 rounded-xl"
                    onClick={() => setEditing(request)}
                  >
                    <CalendarClock className="size-4" />
                    {request.proposal?.status === "PENDING"
                      ? "Proponi un altro orario ancora"
                      : request.autoConfirmed && !request.proposal
                        ? "Sposta"
                        : "Proponi un altro orario"}
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ProposeDialog
        request={editing}
        tenantSlug={tenantSlug}
        operators={operators}
        onClose={() => setEditing(null)}
        onSent={() => {
          setEditing(null);
          refresh();
        }}
      />
    </div>
  );
}

function ProposeDialog({
  request,
  tenantSlug,
  operators,
  onClose,
  onSent,
}: {
  request: RequestDTO | null;
  tenantSlug: string;
  operators: OperatorDTO[];
  onClose: () => void;
  onSent: () => void;
}) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {request ? <ProposeBody key={request.id} request={request} tenantSlug={tenantSlug} operators={operators} onSent={onSent} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ProposeBody({ request, tenantSlug, operators, onSent }: { request: RequestDTO; tenantSlug: string; operators: OperatorDTO[]; onSent: () => void }) {
  const [date, setDate] = useState(() => new Date(request.startTime).toISOString().slice(0, 10));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [manualTime, setManualTime] = useState("");
  const [operatorId, setOperatorId] = useState<string>(request.operator?.id ?? operators[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  function loadSlots(day: string) {
    setDate(day);
    setSlot(null);
    setSlots(null);
    startTransition(async () => {
      const result = await getAvailableSlots({ slug: tenantSlug, serviceId: request.service.id, date: day });
      setSlots(result.success ? result.slots : []);
    });
  }

  const start = slot ?? (manualTime ? new Date(`${date}T${manualTime}:00`).toISOString() : null);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Proponi un altro orario</DialogTitle>
        <DialogDescription>
          A {request.client.firstName} arriva su WhatsApp la proposta per {request.service.name}, con i pulsanti “Sì, confermo” e “Scelgo
          un altro orario”. Se conferma, l&apos;appuntamento si sposta e si conferma da solo.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Giorno</Label>
          <Input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => loadSlots(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground">Orari liberi</Label>
          {slots === null ? (
            <Button type="button" variant="outline" size="sm" onClick={() => loadSlots(date)} disabled={isPending}>
              {isPending ? "Cerco…" : "Mostra gli orari liberi"}
            </Button>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun orario libero online quel giorno: scrivi tu l&apos;orario qui sotto.</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSlot(s);
                    setManualTime("");
                  }}
                  className={`rounded-lg border px-2 py-1.5 text-sm ${slot === s ? "border-mint-ink bg-mint-soft font-semibold" : "hover:bg-muted"}`}
                >
                  {timeFormatter.format(new Date(s))}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Oppure un orario a scelta</Label>
            <Input
              type="time"
              value={manualTime}
              onChange={(e) => {
                setManualTime(e.target.value);
                setSlot(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Operatrice</Label>
            <select className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm" value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.firstName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button
          className="w-full"
          disabled={!start || isPending}
          onClick={() =>
            startTransition(async () => {
              if (!start) return;
              const result = await proposeAlternative({ appointmentId: request.id, start, operatorId: operatorId || null });
              if (!result.success) {
                toast.error(result.error);
                return;
              }
              toast.success("Proposta inviata su WhatsApp.");
              onSent();
            })
          }
        >
          <MessageCircle className="size-4" />
          Invia la proposta su WhatsApp
        </Button>
      </div>
    </>
  );
}
