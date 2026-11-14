"use client";

import {
  addDays,
  addWeeks,
  endOfDay,
  endOfWeek,
  format,
  startOfDay,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, Coffee } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import type { ClientListItemDTO } from "@/app/dashboard/clients/actions";
import { PaymentDialog } from "@/app/dashboard/payments/payment-dialog";
import type { ServiceDTO } from "@/app/dashboard/services/actions";
import { appointmentServiceNames, appointmentTotalPrice } from "@/lib/appointment-services";
import { Button } from "@/components/ui/button";
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
import { OperatorsGrid } from "./operators-grid";
import { PaymentLinkDialog, type PaymentLinkTarget } from "@/app/dashboard/payment-links/payment-link-dialog";

import { AppointmentDetailDialog } from "./appointment-detail-dialog";
import { AppointmentFormDialog } from "./appointment-form-dialog";
import { CalendarGrid } from "./calendar-grid";
import { StaffBlockDialog } from "./staff-block-dialog";

type ViewMode = "operators" | "day" | "week";

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
    <div className="space-y-6">
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

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
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
              {isPending ? (
                <span className="text-sm text-muted-foreground">Caricamento...</span>
              ) : null}
            </div>
            <div className="flex items-center gap-1 rounded-lg border p-1">
              <Button
                variant={viewMode === "operators" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("operators")}
              >
                Operatrici
              </Button>
              <Button
                variant={viewMode === "day" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("day")}
              >
                Giorno
              </Button>
              <Button
                variant={viewMode === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("week")}
              >
                Settimana
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "operators" ? (
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
