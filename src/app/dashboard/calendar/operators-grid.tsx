"use client";

import { endOfDay, format, isSameDay, startOfDay } from "date-fns";
import { CalendarPlus, Coffee, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { formatEuro } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { OperatorDTO } from "./actions";
import type { StaffAbsenceDTO, StaffBlockDTO } from "./block-actions";
import { appointmentBlocks, type AppointmentDTO } from "./dto";

/** Orario minimo mostrato; si allarga se gli orari di lavoro o gli appuntamenti escono da qui. */
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;
const HOUR_HEIGHT = 80;
const MIN_BLOCK_MINUTES = 20;
const SNAP_MINUTES = 15;

const PX_PER_MINUTE = HOUR_HEIGHT / 60;

const palettes = [
  { head: "bg-emerald-100 text-emerald-900 border-emerald-200", card: "bg-emerald-50 border-emerald-200 text-emerald-950" },
  { head: "bg-teal-100 text-teal-900 border-teal-200", card: "bg-teal-50 border-teal-200 text-teal-950" },
  { head: "bg-violet-100 text-violet-900 border-violet-200", card: "bg-violet-50 border-violet-200 text-violet-950" },
  { head: "bg-amber-100 text-amber-900 border-amber-200", card: "bg-amber-50 border-amber-200 text-amber-950" },
  { head: "bg-sky-100 text-sky-900 border-sky-200", card: "bg-sky-50 border-sky-200 text-sky-950" },
];

const timeFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short" });

type WorkingHour = { dayOfWeek: number; startTime: string; endTime: string };
type Grid = { startHour: number; endHour: number };

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function dayOfWeek(date: Date) {
  return ((date.getDay() + 6) % 7) + 1; // 1=Mon … 7=Sun
}

function minutesOfDay(value: Date, date: Date) {
  if (value < startOfDay(date)) return 0;
  if (value >= endOfDay(date)) return 24 * 60;
  return value.getHours() * 60 + value.getMinutes();
}

/**
 * Orari di lavoro del giorno. Un imprevisto con orario li sostituisce
 * (quel giorno lavora solo in quella fascia), come nella prenotazione online.
 */
function dayWorkingHours(workingHours: WorkingHour[], absence: StaffAbsenceDTO | undefined, date: Date) {
  if (absence?.startTime && absence.endTime) {
    return [{ start: timeToMinutes(absence.startTime), end: timeToMinutes(absence.endTime) }];
  }
  const dow = dayOfWeek(date);
  return workingHours
    .filter((wh) => wh.dayOfWeek === dow)
    .map((wh) => ({ start: timeToMinutes(wh.startTime), end: timeToMinutes(wh.endTime) }))
    .sort((a, b) => a.start - b.start);
}

// Returns pixel bands that are OUTSIDE working hours (unavailable time)
function getUnavailableBands(
  blocks: { start: number; end: number }[],
  grid: Grid
): { top: number; height: number }[] {
  if (blocks.length === 0) return [];

  const gridStart = grid.startHour * 60;
  const gridEnd = grid.endHour * 60;
  const bands: { top: number; height: number }[] = [];
  let cursor = gridStart;

  for (const block of blocks) {
    const blockStart = Math.max(block.start, gridStart);
    const blockEnd = Math.min(block.end, gridEnd);
    if (blockStart > cursor) {
      bands.push({
        top: (cursor - gridStart) * PX_PER_MINUTE,
        height: (blockStart - cursor) * PX_PER_MINUTE,
      });
    }
    cursor = Math.max(cursor, blockEnd);
  }
  if (cursor < gridEnd) {
    bands.push({
      top: (cursor - gridStart) * PX_PER_MINUTE,
      height: (gridEnd - cursor) * PX_PER_MINUTE,
    });
  }
  return bands;
}

function getPosition(item: { startTime: Date; endTime: Date }, date: Date, grid: Grid) {
  const gridStart = grid.startHour * 60;
  const gridEnd = grid.endHour * 60;
  const start = Math.min(Math.max(minutesOfDay(item.startTime, date), gridStart), gridEnd);
  const end = Math.min(Math.max(minutesOfDay(item.endTime, date), gridStart), gridEnd);

  return {
    top: (start - gridStart) * PX_PER_MINUTE,
    height: Math.max(end - start, MIN_BLOCK_MINUTES) * PX_PER_MINUTE,
  };
}

function getCurrentTimeTop(date: Date, grid: Grid): number | null {
  const now = new Date();
  if (!isSameDay(now, date)) return null;

  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < grid.startHour * 60 || minutes > grid.endHour * 60) return null;

  return (minutes - grid.startHour * 60) * PX_PER_MINUTE;
}

/** 8–20 di base, allargato a orari di lavoro, imprevisti, appuntamenti e impegni del giorno. */
function getGrid(
  operators: OperatorDTO[],
  absences: StaffAbsenceDTO[],
  items: { startTime: Date; endTime: Date }[],
  date: Date
): Grid {
  let min = DEFAULT_START_HOUR * 60;
  let max = DEFAULT_END_HOUR * 60;
  const ranges = [
    ...operators.flatMap((operator) => dayWorkingHours(operator.workingHours, undefined, date)),
    ...absences.filter((a) => a.startTime && a.endTime).map((a) => ({ start: timeToMinutes(a.startTime!), end: timeToMinutes(a.endTime!) })),
    ...items.map((item) => ({ start: minutesOfDay(item.startTime, date), end: minutesOfDay(item.endTime, date) })),
  ];
  for (const range of ranges) {
    // Impegni di tutto il giorno (00–24) non allargano la griglia.
    if (range.start === 0 && range.end === 24 * 60) continue;
    min = Math.min(min, range.start);
    max = Math.max(max, range.end);
  }
  return { startHour: Math.max(Math.floor(min / 60), 0), endHour: Math.min(Math.ceil(max / 60), 24) };
}

type OperatorsGridProps = {
  appointments: AppointmentDTO[];
  operators: OperatorDTO[];
  blocks: StaffBlockDTO[];
  absences: StaffAbsenceDTO[];
  date: Date;
  onAppointmentClick: (appointment: AppointmentDTO) => void;
  onBlockClick: (block: StaffBlockDTO) => void;
  onCreate: (operatorId: string | null, start?: Date) => void;
  onCreateBlock: (operatorId: string, start: Date) => void;
  paymentsEnabled: boolean;
};

/** Tratto di un appuntamento nella colonna di chi lo fa (tutto l'appuntamento, se lo fa una sola). */
type ColumnItem = {
  appointment: AppointmentDTO;
  startTime: Date;
  endTime: Date;
  names: string[];
  /** Primo tratto dell'appuntamento: qui si vede l'incasso. */
  first: boolean;
  /** Chi fa gli altri trattamenti, se non è lei. */
  others: string;
};

type Column = {
  id: string | null;
  label: string;
  items: ColumnItem[];
  blocks: StaffBlockDTO[];
  operator?: OperatorDTO;
  absence?: StaffAbsenceDTO;
};

export function OperatorsGrid({
  appointments,
  operators,
  blocks,
  absences,
  date,
  onAppointmentClick,
  onBlockClick,
  onCreate,
  onCreateBlock,
  paymentsEnabled,
}: OperatorsGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState<{ operator: OperatorDTO; start: Date } | null>(null);

  // La settimana caricata può contenere altri giorni: qui solo quello scelto.
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const dayAppointments = appointments.filter((a) => isSameDay(a.startTime, date));
  const dayBlocks = blocks.filter((block) => block.startTime <= dayEnd && block.endTime > dayStart);
  const dayKey = format(date, "yyyy-MM-dd");
  const dayAbsences = absences.filter((a) => a.date === dayKey);

  // Trattamenti con operatrici diverse: ognuna vede nella sua colonna solo il suo tratto.
  const dayItems = dayAppointments.flatMap((appointment) => {
    const parts = appointmentBlocks(appointment);
    return parts.map((part, index) => ({
      appointment,
      operatorId: part.operatorId,
      startTime: part.startTime,
      endTime: part.endTime,
      names: part.names,
      first: index === 0,
      others: [
        ...new Set(
          appointment.services
            .filter((service) => service.operator && service.operator.id !== part.operatorId)
            .map((service) => service.operator!.firstName)
        ),
      ].join(" e "),
    }));
  });

  const columns: Column[] = operators.map((operator) => ({
    id: operator.id,
    label: operator.firstName,
    items: dayItems.filter((item) => item.operatorId === operator.id),
    blocks: dayBlocks.filter((block) => block.userId === operator.id),
    operator,
    absence: dayAbsences.find((a) => a.userId === operator.id),
  }));

  const grid = getGrid(operators, dayAbsences, [...dayAppointments, ...dayBlocks], date);
  const hours = Array.from({ length: grid.endHour - grid.startHour }, (_, i) => grid.startHour + i);
  const gridHeight = hours.length * HOUR_HEIGHT;
  const currentTimeTop = getCurrentTimeTop(date, grid);

  useEffect(() => {
    if (!scrollRef.current || currentTimeTop === null) return;
    scrollRef.current.scrollTop = Math.max(currentTimeTop - 120, 0);
  }, [currentTimeTop]);

  function handleEmptyClick(column: Column, event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = (event.clientY - rect.top) / PX_PER_MINUTE;
    const snapped = grid.startHour * 60 + Math.floor(minutes / SNAP_MINUTES) * SNAP_MINUTES;
    const start = new Date(date);
    start.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0);

    if (column.operator) setPick({ operator: column.operator, start });
    else onCreate(null, start);
  }

  return (
    <div className="rounded-lg border" style={{ overflow: "hidden" }}>
      <div className="flex" style={{ overflowX: "auto" }}>
        <div className="w-14 shrink-0 border-r">
          <div className="h-10 border-b" />
        </div>
        {columns.map((column, index) => {
          const palette = palettes[index % palettes.length];
          const absentAllDay = column.absence && !column.absence.startTime;
          return (
            <div key={column.id ?? "none"} className="min-w-[200px] flex-1 border-r last:border-r-0">
              <div
                className={cn(
                  "flex h-10 items-center justify-center gap-1.5 border-b text-xs font-bold uppercase tracking-wider",
                  column.id ? palette.head : "border-amber-300 bg-amber-200 text-amber-950",
                  absentAllDay && "bg-muted text-muted-foreground"
                )}
              >
                {column.label}
                {absentAllDay ? <span className="font-medium normal-case tracking-normal">· assente</span> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        className="flex"
        style={{ overflowY: "auto", overflowX: "auto", maxHeight: "calc(100vh - 300px)" }}
      >
        <div className="w-14 shrink-0 border-r">
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 w-full -translate-y-1/2 pr-2 text-right text-xs text-muted-foreground"
                style={{ top: (hour - grid.startHour) * HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>

        {columns.map((column, index) => {
          const palette = palettes[index % palettes.length];
          const absentAllDay = Boolean(column.absence && !column.absence.startTime);
          const todayHours = column.operator ? dayWorkingHours(column.operator.workingHours, column.absence, date) : [];
          // Ha orari impostati ma oggi nessuno (es. mercoledì): tutta la colonna grigia.
          const dayOff = Boolean(column.operator && column.operator.workingHours.length > 0 && todayHours.length === 0);
          const unavailBands =
            absentAllDay || dayOff
              ? [{ top: 0, height: gridHeight }]
              : column.operator
                ? getUnavailableBands(todayHours, grid)
                : [];

          return (
            <div key={column.id ?? "none"} className="min-w-[200px] flex-1 border-r last:border-r-0">
              <div
                className="relative cursor-pointer"
                style={{ height: gridHeight }}
                onClick={(event) => handleEmptyClick(column, event)}
                title="Tocca per aggiungere"
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="pointer-events-none absolute w-full border-t border-border/50"
                    style={{ top: (hour - grid.startHour) * HOUR_HEIGHT }}
                  />
                ))}

                {/* Unavailable time overlay */}
                {unavailBands.map((band, i) => (
                  <div
                    key={i}
                    className="absolute inset-x-0 bg-muted/60 pointer-events-none"
                    style={{ top: band.top, height: band.height }}
                  />
                ))}

                {absentAllDay ? (
                  <div className="pointer-events-none absolute inset-x-0 top-4 text-center text-xs font-semibold text-muted-foreground">
                    Assente tutto il giorno
                    {column.absence?.note ? ` · ${column.absence.note}` : ""}
                  </div>
                ) : null}

                {currentTimeTop !== null && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 h-px bg-rose-500"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="absolute -left-1 -top-1.5 size-3 rounded-full bg-rose-500" />
                  </div>
                )}

                {/* Impegni dello staff: grigio a righe */}
                {column.blocks.map((block) => {
                  const { top, height } = getPosition(block, date, grid);
                  const allDay = block.endTime.getTime() - block.startTime.getTime() >= 24 * 3600000;
                  return (
                    <button
                      key={block.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onBlockClick(block);
                      }}
                      className="absolute inset-x-1 z-10 overflow-hidden rounded-lg border border-slate-300 px-2 py-1 text-left text-xs text-slate-700 transition hover:opacity-80"
                      style={{
                        top,
                        height,
                        backgroundColor: "rgb(241 245 249)",
                        backgroundImage:
                          "repeating-linear-gradient(135deg, rgb(203 213 225 / 0.55) 0 6px, transparent 6px 12px)",
                      }}
                    >
                      <div className="truncate font-bold">{block.title}</div>
                      <div className="truncate">
                        {allDay
                          ? "Tutto il giorno"
                          : `${timeFormatter.format(block.startTime)} – ${timeFormatter.format(block.endTime)}`}
                      </div>
                    </button>
                  );
                })}

                {column.items.map((item) => {
                  const { appointment } = item;
                  const { top, height } = getPosition(item, date, grid);
                  const cancelled =
                    appointment.status === "CANCELLED" || appointment.status === "NO_SHOW";
                  return (
                    <button
                      key={`${appointment.id}-${item.startTime.getTime()}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAppointmentClick(appointment);
                      }}
                      className={cn(
                        "absolute inset-x-1 z-10 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm transition hover:opacity-80",
                        column.id ? palette.card : "border-amber-300 bg-amber-50 text-amber-950",
                        cancelled && "opacity-55"
                      )}
                      style={{ top, height }}
                    >
                      {/* Prima il nome (si legge anche negli appuntamenti brevi), poi ora, trattamenti e nota. */}
                      <div className="truncate leading-tight">
                        <span className={cn("font-bold", cancelled && "line-through")}>
                          {appointment.client.firstName} {appointment.client.lastName}
                        </span>{" "}
                        <span className="opacity-75">{timeFormatter.format(item.startTime)}</span>
                      </div>
                      <div className="truncate opacity-75 leading-tight">
                        {item.names.join(" + ")}
                        {item.others ? ` · il resto con ${item.others}` : ""}
                      </div>
                      {appointment.notes ? (
                        <div className="truncate italic leading-tight opacity-75" title={appointment.notes}>
                          📝 {appointment.notes}
                        </div>
                      ) : null}
                      {appointment.consentMissing ? (
                        <span className="mt-0.5 inline-block rounded border border-amber-300 bg-amber-100 px-1 text-[10px] font-semibold text-amber-900">
                          Consenso
                        </span>
                      ) : null}
                      {!item.first ? null : paymentsEnabled && appointment.payment ? (
                        <div className="mt-0.5 truncate font-semibold">
                          ✓ {formatEuro(appointment.payment.amount)}
                        </div>
                      ) : appointment.paymentLink?.status === "PAID" ? (
                        <div className="mt-0.5 truncate font-semibold">✓ Pagato online</div>
                      ) : paymentsEnabled && appointment.status === "COMPLETED" ? (
                        <div className="mt-0.5 text-amber-700">Da incassare</div>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="border-t p-2">
                <button
                  type="button"
                  onClick={() => onCreate(column.id)}
                  className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-mint-border py-2.5 text-xs font-semibold text-mint-ink transition-colors hover:bg-mint-soft"
                >
                  <Plus className="size-3.5" />
                  Aggiungi
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={Boolean(pick)} onOpenChange={(open) => !open && setPick(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Cosa vuoi aggiungere?</DialogTitle>
            <DialogDescription>
              {pick
                ? `${pick.operator.firstName} · ${dayFormatter.format(pick.start)} alle ${timeFormatter.format(pick.start)}`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              className="h-12 rounded-xl text-base"
              onClick={() => {
                if (!pick) return;
                setPick(null);
                onCreate(pick.operator.id, pick.start);
              }}
            >
              <CalendarPlus className="size-5" />
              Appuntamento
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-xl text-base"
              onClick={() => {
                if (!pick) return;
                setPick(null);
                onCreateBlock(pick.operator.id, pick.start);
              }}
            >
              <Coffee className="size-5" />
              Impegno (pausa, ferie...)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
