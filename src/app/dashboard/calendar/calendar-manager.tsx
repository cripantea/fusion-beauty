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
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import type { ClientListItemDTO } from "@/app/dashboard/clients/actions";
import type { ServiceDTO } from "@/app/dashboard/services/actions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { getAppointments, type AppointmentDTO, type OperatorDTO } from "./actions";
import { AppointmentDetailDialog } from "./appointment-detail-dialog";
import { AppointmentFormDialog } from "./appointment-form-dialog";
import { CalendarGrid } from "./calendar-grid";

type ViewMode = "day" | "week";

type CalendarManagerProps = {
  initialAppointments: AppointmentDTO[];
  initialDate: string;
  clients: ClientListItemDTO[];
  services: ServiceDTO[];
  operators: OperatorDTO[];
};

export function CalendarManager({
  initialAppointments,
  initialDate,
  clients,
  services,
  operators,
}: CalendarManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(() => new Date(`${initialDate}T00:00:00`));
  const [appointments, setAppointments] = useState(initialAppointments);
  const [isPending, startTransition] = useTransition();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentDTO | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDTO | null>(null);
  const isFirstRender = useRef(true);

  const range =
    viewMode === "day"
      ? { start: startOfDay(currentDate), end: endOfDay(currentDate) }
      : {
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 }),
        };

  const days =
    viewMode === "day" ? [range.start] : Array.from({ length: 7 }, (_, i) => addDays(range.start, i));

  function refresh(start: Date, end: Date) {
    startTransition(async () => {
      const results = await getAppointments({ start, end });
      setAppointments(results);
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
    setCurrentDate((date) => (viewMode === "day" ? subDays(date, 1) : subWeeks(date, 1)));
  }

  function goForward() {
    setCurrentDate((date) => (viewMode === "day" ? addDays(date, 1) : addWeeks(date, 1)));
  }

  function handleAppointmentSaved() {
    refresh(range.start, range.end);
  }

  function handleStatusChanged(appointment: AppointmentDTO) {
    setSelectedAppointment(appointment);
    refresh(range.start, range.end);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calendario</h1>
          <p className="text-muted-foreground">Gestisci gli appuntamenti del centro.</p>
        </div>
        <Button
          onClick={() => {
            setEditingAppointment(null);
            setFormDialogOpen(true);
          }}
        >
          Nuovo appuntamento
        </Button>
      </div>

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
          <CalendarGrid
            days={days}
            appointments={appointments}
            onAppointmentClick={setSelectedAppointment}
          />
        </CardContent>
      </Card>

      <AppointmentFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        appointment={editingAppointment}
        clients={clients}
        services={services}
        operators={operators}
        defaultDate={currentDate}
        onSuccess={handleAppointmentSaved}
      />

      <AppointmentDetailDialog
        open={Boolean(selectedAppointment)}
        onOpenChange={(open) => {
          if (!open) setSelectedAppointment(null);
        }}
        appointment={selectedAppointment}
        onEdit={(appointment) => {
          setSelectedAppointment(null);
          setEditingAppointment(appointment);
          setFormDialogOpen(true);
        }}
        onStatusChanged={handleStatusChanged}
      />
    </div>
  );
}
