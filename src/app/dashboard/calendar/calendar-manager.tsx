"use client";

import {
  addDays,
  addWeeks,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, Coffee, Plus } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import type { ClientListItemDTO } from "@/app/dashboard/clients/actions";
import { PaymentDialog } from "@/app/dashboard/payments/payment-dialog";
import type { ServiceDTO } from "@/app/dashboard/services/actions";
import { appointmentServiceNames, appointmentTotalPrice } from "@/lib/appointment-services";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { PageHeader } from "@/components/boutique";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { getAppointments, type OperatorDTO } from "./actions";
import {
  getStaffAbsences,
  getStaffBlocks,
  type StaffAbsenceDTO,
  type StaffBlockDTO,
} from "./block-actions";
import type { AppointmentDTO } from "./dto";
import { DayList } from "./day-list";
import { OperatorsGrid } from "./operators-grid";
import { PaymentLinkDialog, type PaymentLinkTarget } from "@/app/dashboard/payment-links/payment-link-dialog";

import { AppointmentDetailDialog } from "./appointment-detail-dialog";
import { AppointmentFormDialog } from "./appointment-form-dialog";
import { CalendarGrid } from "./calendar-grid";
import { StaffBlockDialog } from "./staff-block-dialog";

type ViewMode = "list" | "operators" | "day" | "week";

/** La vista scelta resta la stessa alla prossima apertura, su quel dispositivo. */
const VIEW_KEY = "fusion-beauty:agenda-view";
const VIEW_LABELS: { mode: ViewMode; label: string; className?: string }[] = [
  { mode: "list", label: "Lista" },
  { mode: "operators", label: "Operatrici" },
  // Sul telefono la giornata si legge già in Lista.
  { mode: "day", label: "Giorno", className: "hidden sm:inline-flex" },
  { mode: "week", label: "Settimana" },
];

type CalendarManagerProps = {
  initialAppointments: AppointmentDTO[];
  initialBlocks: StaffBlockDTO[];
  initialAbsences: StaffAbsenceDTO[];
  initialDate: string;
  clients: ClientListItemDTO[];
  services: ServiceDTO[];
  operators: OperatorDTO[];
  isAdmin: boolean;
  currentUserId: string;
  paymentsEnabled: boolean;
  /** Consensi informati attivi: spenti, niente "Raccogli consenso". */
  consentsEnabled: boolean;
  onlinePayments: boolean;
};

export function CalendarManager({
  initialAppointments,
  initialBlocks,
  initialAbsences,
  initialDate,
  clients,
  services,
  operators,
  isAdmin,
  currentUserId,
  paymentsEnabled,
  consentsEnabled,
  onlinePayments,
}: CalendarManagerProps) {
  const [linkTarget, setLinkTarget] = useState<PaymentLinkTarget | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("operators");
  const [currentDate, setCurrentDate] = useState(() => new Date(`${initialDate}T00:00:00`));
  const [appointments, setAppointments] = useState(initialAppointments);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [absences, setAbsences] = useState(initialAbsences);
  const [isPending, startTransition] = useTransition();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentDTO | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDTO | null>(null);
  const [payingAppointment, setPayingAppointment] = useState<AppointmentDTO | null>(null);
  const [defaultOperatorId, setDefaultOperatorId] = useState<string | undefined>();
  // Giorno e ora toccati sulla griglia (vuoto = giorno visualizzato, ora da scegliere).
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();
  const [focusWhen, setFocusWhen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<StaffBlockDTO | null>(null);
  const [clientOptions, setClientOptions] = useState(clients);
  const isFirstRender = useRef(true);

  // Sul telefono si parte dalla Lista; se ne è stata scelta un'altra, vale quella.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(VIEW_KEY);
    } catch {
      // Memoria del browser bloccata: si resta sulla vista di partenza.
    }
    const known = VIEW_LABELS.some((view) => view.mode === saved);
    const phone = window.matchMedia("(max-width: 639px)").matches;
    const wanted = known ? (saved as ViewMode) : phone ? "list" : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la larghezza dello schermo si conosce solo nel browser
    if (wanted && wanted !== "operators") setViewMode(wanted);
  }, []);

  function chooseView(mode: ViewMode) {
    setViewMode(mode);
    try {
      window.localStorage.setItem(VIEW_KEY, mode);
    } catch {
      // Senza memoria del browser la scelta vale solo per questa visita.
    }
  }

  const range =
    viewMode !== "week"
      ? { start: startOfDay(currentDate), end: endOfDay(currentDate) }
      : {
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 }),
        };

  const days =
    viewMode !== "week" ? [range.start] : Array.from({ length: 7 }, (_, i) => addDays(range.start, i));

  function refresh(start: Date, end: Date) {
    startTransition(async () => {
      const [results, blockResults, absenceResults] = await Promise.all([
        getAppointments({ start, end }),
        getStaffBlocks({ start, end }),
        getStaffAbsences({ start, end }),
      ]);
      setAppointments(results);
      setBlocks(blockResults);
      setAbsences(absenceResults);
    });
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    refresh(range.start, range.end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, currentDate]);

  function goToday() {
    setCurrentDate(new Date());
  }

  function goBack() {
    setCurrentDate((date) => (viewMode !== "week" ? subDays(date, 1) : subWeeks(date, 1)));
  }

  function goForward() {
    setCurrentDate((date) => (viewMode !== "week" ? addDays(date, 1) : addWeeks(date, 1)));
  }

  function handleAppointmentSaved() {
    refresh(range.start, range.end);
  }

  function openNewAppointment(operatorId?: string, start?: Date) {
    setEditingAppointment(null);
    setFocusWhen(false);
    setDefaultOperatorId(operatorId);
    setDefaultStart(start);
    setFormDialogOpen(true);
  }

  function openNewBlock(operatorId?: string, start?: Date) {
    setEditingBlock(null);
    setDefaultOperatorId(operatorId);
    setDefaultStart(start);
    setBlockDialogOpen(true);
  }

  function handleStatusChanged(appointment: AppointmentDTO) {
    setSelectedAppointment(appointment);
    refresh(range.start, range.end);
  }

  // Gli annullati spariscono dall'agenda (restano nello storico della cliente).
  const visibleAppointments = appointments.filter((appointment) => appointment.status !== "CANCELLED");

  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="hidden sm:block">
        <PageHeader
          eyebrow="Agenda del centro"
          title="Un'agenda semplice per tutto il centro."
          description="Ogni operatrice vede i propri appuntamenti. Tu vedi tutto il centro in un'unica schermata."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-10 rounded-xl px-4" onClick={() => openNewBlock(isAdmin ? undefined : currentUserId)}>
                <Coffee className="size-4" />
                Impegno
              </Button>
              <Button className="h-10 rounded-xl px-4" onClick={() => openNewAppointment()}>
                Nuovo appuntamento
              </Button>
            </div>
          }
        />
      </div>
      {/* Telefono: niente titoli, subito i due pulsanti a tutta larghezza. */}
      <div className="flex gap-2 sm:hidden">
        <Button className="h-12 flex-1 rounded-xl text-base" onClick={() => openNewAppointment()}>
          <Plus className="size-5" />
          Nuovo appuntamento
        </Button>
        <Button
          variant="outline"
          className="h-12 rounded-xl px-4"
          onClick={() => openNewBlock(isAdmin ? undefined : currentUserId)}
        >
          <Coffee className="size-4" />
          Impegno
        </Button>
      </div>

      <Card className="[--card-spacing:--spacing(3)] sm:[--card-spacing:--spacing(4)]">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Telefono: frecce grandi ai lati del giorno, scritto per esteso. */}
            <div className="flex w-full items-center gap-2 sm:hidden">
              <Button variant="outline" className="size-11 shrink-0 rounded-xl" onClick={goBack} aria-label="Giorno precedente">
                <ChevronLeftIcon className="size-5" />
              </Button>
              <Popover>
                <PopoverTrigger render={<Button variant="outline" className="h-11 min-w-0 flex-1 rounded-xl text-base font-semibold capitalize" />}>
                  <CalendarIcon className="size-4" />
                  <span className="truncate">
                    {isSameDay(currentDate, new Date()) ? "Oggi · " : ""}
                    {format(currentDate, "EEE d MMMM", { locale: it })}
                  </span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={currentDate} onSelect={(date) => date && setCurrentDate(date)} />
                </PopoverContent>
              </Popover>
              <Button variant="outline" className="size-11 shrink-0 rounded-xl" onClick={goForward} aria-label="Giorno successivo">
                <ChevronRightIcon className="size-5" />
              </Button>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="outline" size="sm" onClick={goToday}>
                Oggi
              </Button>
              <Button variant="outline" size="icon-sm" onClick={goBack} aria-label="Periodo precedente">
                <ChevronLeftIcon />
              </Button>
              <Button variant="outline" size="icon-sm" onClick={goForward} aria-label="Periodo successivo">
                <ChevronRightIcon />
              </Button>
              <Popover>
                <PopoverTrigger render={<Button variant="outline" size="sm" />}>
                  <CalendarIcon className="size-4" />
                  {format(currentDate, "d MMMM yyyy", { locale: it })}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={currentDate}
                    onSelect={(date) => date && setCurrentDate(date)}
                  />
                </PopoverContent>
              </Popover>
              {isPending ? <span className="text-sm text-muted-foreground">Caricamento...</span> : null}
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <div className="flex flex-1 items-center gap-1 rounded-lg border p-1 sm:flex-none">
                {VIEW_LABELS.map((view) => (
                  <Button
                    key={view.mode}
                    variant={viewMode === view.mode ? "secondary" : "ghost"}
                    size="sm"
                    className={cn("h-9 flex-1 sm:h-7 sm:flex-none", view.className)}
                    onClick={() => chooseView(view.mode)}
                  >
                    {view.label}
                  </Button>
                ))}
              </div>
              {isSameDay(currentDate, new Date()) ? null : (
                <Button variant="outline" className="h-11 rounded-xl sm:hidden" onClick={goToday}>
                  Oggi
                </Button>
              )}
              {isPending ? <span className="text-xs text-muted-foreground sm:hidden">Carico...</span> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "list" ? (
            <DayList
              appointments={visibleAppointments}
              operators={operators}
              blocks={blocks}
              absences={absences}
              date={currentDate}
              onAppointmentClick={setSelectedAppointment}
              onBlockClick={(block) => {
                setEditingBlock(block);
                setBlockDialogOpen(true);
              }}
              onCreate={(operatorId) => openNewAppointment(operatorId ?? undefined)}
              paymentsEnabled={paymentsEnabled}
            />
          ) : viewMode === "operators" ? (
            <OperatorsGrid
              appointments={visibleAppointments}
              operators={operators}
              blocks={blocks}
              absences={absences}
              date={currentDate}
              onAppointmentClick={setSelectedAppointment}
              onBlockClick={(block) => {
                setEditingBlock(block);
                setBlockDialogOpen(true);
              }}
              onCreate={(operatorId, start) => openNewAppointment(operatorId ?? undefined, start)}
              onCreateBlock={(operatorId, start) => openNewBlock(operatorId, start)}
              paymentsEnabled={paymentsEnabled}
            />
          ) : (
            <CalendarGrid
              days={days}
              appointments={visibleAppointments}
              onAppointmentClick={setSelectedAppointment}
            />
          )}
        </CardContent>
      </Card>

      <AppointmentFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        appointment={editingAppointment}
        clients={clientOptions}
        services={services}
        operators={operators}
        defaultDate={defaultStart ?? currentDate}
        defaultTime={defaultStart ? format(defaultStart, "HH:mm") : undefined}
        defaultOperatorId={defaultOperatorId}
        focusWhen={focusWhen}
        onSuccess={handleAppointmentSaved}
        onClientCreated={(client) => setClientOptions((current) => [...current, client])}
      />

      <StaffBlockDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        block={editingBlock}
        operators={operators}
        defaultOperatorId={defaultOperatorId}
        defaultStart={defaultStart ?? (editingBlock ? undefined : currentDate)}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        onChanged={handleAppointmentSaved}
      />

      <AppointmentDetailDialog
        open={Boolean(selectedAppointment)}
        onOpenChange={(open) => {
          if (!open) setSelectedAppointment(null);
        }}
        appointment={selectedAppointment}
        onEdit={(appointment) => {
          setSelectedAppointment(null);
          setFocusWhen(false);
          setEditingAppointment(appointment);
          setFormDialogOpen(true);
        }}
        onMove={(appointment) => {
          setSelectedAppointment(null);
          setFocusWhen(true);
          setEditingAppointment(appointment);
          setFormDialogOpen(true);
        }}
        onStatusChanged={handleStatusChanged}
        onCollect={(appointment) => {
          setSelectedAppointment(null);
          setPayingAppointment(appointment);
        }}
        paymentsEnabled={paymentsEnabled}
        consentsEnabled={consentsEnabled}
        onlinePayments={onlinePayments}
        onPaymentLinkSent={(appointment) => {
          setSelectedAppointment(appointment);
          setAppointments((current) => current.map((a) => (a.id === appointment.id ? appointment : a)));
        }}
        onPaymentLink={(appointment) => {
          setSelectedAppointment(null);
          setLinkTarget({
            clientId: appointment.client.id,
            clientFirstName: appointment.client.firstName,
            clientPhone: appointment.client.phone,
            appointmentId: appointment.id,
            amount: appointmentTotalPrice(appointment),
            description: `${appointmentServiceNames(appointment)} del ${new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long" }).format(appointment.startTime)}`,
          });
        }}
      />

      <PaymentLinkDialog
        target={linkTarget}
        onClose={() => setLinkTarget(null)}
        onCreated={(link) =>
          setAppointments((current) =>
            current.map((a) =>
              a.id === link.appointmentId ? { ...a, paymentLink: { status: "PENDING", amountCents: link.amountCents, token: link.token, paidWith: null } } : a
            )
          )
        }
      />

      <PaymentDialog
        open={Boolean(payingAppointment)}
        onOpenChange={(open) => {
          if (!open) setPayingAppointment(null);
        }}
        appointment={payingAppointment}
        onPaid={handleAppointmentSaved}
        isAdmin={isAdmin}
      />
    </div>
  );
}
