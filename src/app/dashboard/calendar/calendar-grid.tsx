"use client";

import { differenceInMinutes, format, isSameDay } from "date-fns";
import { it } from "date-fns/locale";

import { cn } from "@/lib/utils";

import type { AppointmentDTO } from "./dto";
import type { AppointmentStatusValue } from "./schema";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const HOUR_HEIGHT = 64;
const MIN_BLOCK_MINUTES = 20;

const statusBlockClasses: Record<AppointmentStatusValue, string> = {
  BOOKED: "bg-slate-100 border-slate-300 text-slate-900",
  CONFIRMED: "bg-emerald-100 border-emerald-300 text-emerald-950",
  COMPLETED: "bg-forest border-forest text-forest-foreground",
  CANCELLED: "bg-rose-100 border-rose-300 text-rose-900 line-through opacity-70",
  NO_SHOW: "bg-amber-100 border-amber-300 text-amber-900 opacity-80",
};

const hours = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, index) => DAY_START_HOUR + index
);

const GRID_HEIGHT = hours.length * HOUR_HEIGHT;
const PX_PER_MINUTE = HOUR_HEIGHT / 60;

function getAppointmentPosition(appointment: AppointmentDTO, day: Date) {
  const gridStart = new Date(day);
  gridStart.setHours(DAY_START_HOUR, 0, 0, 0);
  const gridEnd = new Date(day);
  gridEnd.setHours(DAY_END_HOUR, 0, 0, 0);

  const clampedStart = appointment.startTime < gridStart ? gridStart : appointment.startTime;
  const clampedEnd = appointment.endTime > gridEnd ? gridEnd : appointment.endTime;

  const topMinutes = Math.max(differenceInMinutes(clampedStart, gridStart), 0);
  const durationMinutes = Math.max(
    differenceInMinutes(clampedEnd, clampedStart),
    MIN_BLOCK_MINUTES
  );

  return {
    top: topMinutes * PX_PER_MINUTE,
    height: durationMinutes * PX_PER_MINUTE,
  };
}

type CalendarGridProps = {
  days: Date[];
  appointments: AppointmentDTO[];
  onAppointmentClick: (appointment: AppointmentDTO) => void;
};

export function CalendarGrid({ days, appointments, onAppointmentClick }: CalendarGridProps) {
  return (
    <div className="flex overflow-x-auto rounded-lg border">
      <div className="w-14 shrink-0 border-r">
        <div className="h-10 border-b" />
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

      {days.map((day) => {
        const dayAppointments = appointments.filter((appointment) =>
          isSameDay(appointment.startTime, day)
        );

        return (
          <div key={day.toISOString()} className="min-w-40 flex-1 border-r last:border-r-0">
            <div className="flex h-10 items-center justify-center border-b text-sm font-medium">
              <span className="capitalize">{format(day, "EEE d MMM", { locale: it })}</span>
            </div>
            <div className="relative" style={{ height: GRID_HEIGHT }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute w-full border-t"
                  style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT }}
                />
              ))}
              {dayAppointments.map((appointment) => {
                const { top, height } = getAppointmentPosition(appointment, day);
                return (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => onAppointmentClick(appointment)}
                    className={cn(
                      "absolute inset-x-1 overflow-hidden rounded-md border px-2 py-1 text-left text-xs shadow-sm transition-opacity hover:opacity-80",
                      statusBlockClasses[appointment.status]
                    )}
                    style={{ top, height }}
                  >
                    <div className="truncate font-medium">
                      {appointment.client.firstName} {appointment.client.lastName}
                    </div>
                    <div className="truncate">{appointment.service.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
