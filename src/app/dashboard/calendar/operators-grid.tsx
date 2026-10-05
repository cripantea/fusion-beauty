"use client";

import { differenceInMinutes, isSameDay } from "date-fns";
import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";

import { formatEuro } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { OperatorDTO } from "./actions";
import type { AppointmentDTO } from "./dto";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const HOUR_HEIGHT = 80;
const MIN_BLOCK_MINUTES = 20;

const hours = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i
);

const GRID_HEIGHT = hours.length * HOUR_HEIGHT;
const PX_PER_MINUTE = HOUR_HEIGHT / 60;

const palettes = [
  { head: "bg-emerald-100 text-emerald-900 border-emerald-200", card: "bg-emerald-50 border-emerald-200 text-emerald-950" },
  { head: "bg-teal-100 text-teal-900 border-teal-200", card: "bg-teal-50 border-teal-200 text-teal-950" },
  { head: "bg-violet-100 text-violet-900 border-violet-200", card: "bg-violet-50 border-violet-200 text-violet-950" },
  { head: "bg-amber-100 text-amber-900 border-amber-200", card: "bg-amber-50 border-amber-200 text-amber-950" },
  { head: "bg-sky-100 text-sky-900 border-sky-200", card: "bg-sky-50 border-sky-200 text-sky-950" },
];

const timeFormatter = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" });

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Returns pixel bands that are OUTSIDE working hours (unavailable time)
function getUnavailableBands(
  workingHours: { dayOfWeek: number; startTime: string; endTime: string }[],
  date: Date
): { top: number; height: number }[] {
  const dow = ((date.getDay() + 6) % 7) + 1; // 1=Mon … 7=Sun
  const blocks = workingHours
    .filter((wh) => wh.dayOfWeek === dow)
    .map((wh) => ({ start: timeToMinutes(wh.startTime), end: timeToMinutes(wh.endTime) }))
    .sort((a, b) => a.start - b.start);

  if (blocks.length === 0) return [];

  const gridStart = DAY_START_HOUR * 60;
  const gridEnd = DAY_END_HOUR * 60;
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

function getPosition(appointment: AppointmentDTO, date: Date) {
  const gridStart = new Date(date);
  gridStart.setHours(DAY_START_HOUR, 0, 0, 0);
  const gridEnd = new Date(date);
  gridEnd.setHours(DAY_END_HOUR, 0, 0, 0);

  const clampedStart = appointment.startTime < gridStart ? gridStart : appointment.startTime;
  const clampedEnd = appointment.endTime > gridEnd ? gridEnd : appointment.endTime;

  const topMinutes = Math.max(differenceInMinutes(clampedStart, gridStart), 0);
  const durationMinutes = Math.max(differenceInMinutes(clampedEnd, clampedStart), MIN_BLOCK_MINUTES);

  return {
    top: topMinutes * PX_PER_MINUTE,
    height: durationMinutes * PX_PER_MINUTE,
  };
}

function getCurrentTimeTop(date: Date): number | null {
  const now = new Date();
  if (!isSameDay(now, date)) return null;

  const gridStart = new Date(date);
  gridStart.setHours(DAY_START_HOUR, 0, 0, 0);
  const gridEnd = new Date(date);
  gridEnd.setHours(DAY_END_HOUR, 0, 0, 0);

  if (now < gridStart || now > gridEnd) return null;

  return differenceInMinutes(now, gridStart) * PX_PER_MINUTE;
}

type OperatorsGridProps = {
  appointments: AppointmentDTO[];
  operators: OperatorDTO[];
  date: Date;
  onAppointmentClick: (appointment: AppointmentDTO) => void;
  onCreate: (operatorId: string | null) => void;
};

export function OperatorsGrid({
  appointments,
  operators,
  date,
  onAppointmentClick,
  onCreate,
}: OperatorsGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const columns = operators.map((operator) => ({
    id: operator.id as string | null,
    label: operator.firstName,
    items: appointments.filter((a) => a.operator?.id === operator.id),
  }));

  const currentTimeTop = getCurrentTimeTop(date);

  useEffect(() => {
    if (!scrollRef.current || currentTimeTop === null) return;
    scrollRef.current.scrollTop = Math.max(currentTimeTop - 120, 0);
  }, [currentTimeTop]);

  return (
    <div className="rounded-lg border" style={{ overflow: "hidden" }}>
      <div className="flex" style={{ overflowX: "auto" }}>
        <div className="w-14 shrink-0 border-r">
          <div className="h-10 border-b" />
        </div>
        {columns.map((column, index) => {
          const palette = palettes[index % palettes.length];
          return (
            <div key={column.id ?? "none"} className="min-w-[200px] flex-1 border-r last:border-r-0">
              <div
                className={cn(
                  "flex h-10 items-center justify-center border-b text-xs font-bold uppercase tracking-wider",
                  palette.head
                )}
              >
                {column.label}
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
          <div className="relative" style={{ height: GRID_HEIGHT }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 w-full -translate-y-1/2 pr-2 text-right text-xs text-muted-foreground"
                style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>

        {columns.map((column, index) => {
          const palette = palettes[index % palettes.length];
          const operator = operators.find((o) => o.id === column.id);
          const unavailBands = operator ? getUnavailableBands(operator.workingHours, date) : [];

          return (
            <div key={column.id ?? "none"} className="min-w-[200px] flex-1 border-r last:border-r-0">
              <div className="relative" style={{ height: GRID_HEIGHT }}>
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute w-full border-t border-border/50"
                    style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT }}
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

                {currentTimeTop !== null && (
                  <div
                    className="absolute inset-x-0 z-20 h-px bg-rose-500"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="absolute -left-1 -top-1.5 size-3 rounded-full bg-rose-500" />
                  </div>
                )}

                {column.items.map((appointment) => {
                  const { top, height } = getPosition(appointment, date);
                  const cancelled =
                    appointment.status === "CANCELLED" || appointment.status === "NO_SHOW";
                  return (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => onAppointmentClick(appointment)}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm transition hover:opacity-80",
                        palette.card,
                        cancelled && "opacity-55"
                      )}
                      style={{ top, height }}
                    >
                      <div className="truncate font-bold">
                        {timeFormatter.format(appointment.startTime)} – {timeFormatter.format(appointment.endTime)}
                      </div>
                      <div className={cn("truncate font-semibold", cancelled && "line-through")}>
                        {appointment.client.firstName} {appointment.client.lastName}
                      </div>
                      <div className="truncate opacity-75">{appointment.service.name}</div>
                      {appointment.payment ? (
                        <div className="mt-0.5 truncate font-semibold">
                          ✓ {formatEuro(appointment.payment.amount)}
                        </div>
                      ) : appointment.status === "COMPLETED" ? (
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
    </div>
  );
}
