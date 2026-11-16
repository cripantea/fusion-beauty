"use client";

import { endOfDay, format, isSameDay, startOfDay } from "date-fns";
import { Coffee, Plus } from "lucide-react";
import { useState } from "react";

import { formatEuro } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { OperatorDTO } from "./actions";
import type { StaffAbsenceDTO, StaffBlockDTO } from "./block-actions";
import type { AppointmentDTO } from "./dto";
import { operatorItems, palettes } from "./operators-grid";

const timeFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });

type DayListProps = {
  appointments: AppointmentDTO[];
  operators: OperatorDTO[];
  blocks: StaffBlockDTO[];
  absences: StaffAbsenceDTO[];
  date: Date;
  onAppointmentClick: (appointment: AppointmentDTO) => void;
  onBlockClick: (block: StaffBlockDTO) => void;
  onCreate: (operatorId: string | null) => void;
  paymentsEnabled: boolean;
};

/**
 * La giornata in elenco, dall'alto in basso: pensata per il telefono.
 * In alto si sceglie se vedere tutto il centro o una sola operatrice.
 */
export function DayList({
  appointments,
  operators,
  blocks,
  absences,
  date,
  onAppointmentClick,
  onBlockClick,
  onCreate,
  paymentsEnabled,
}: DayListProps) {
  const [operatorId, setOperatorId] = useState<string | null>(null);

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const dayKey = format(date, "yyyy-MM-dd");
  const now = new Date();
  const isToday = isSameDay(now, date);

  const paletteOf = (id: string | null) => {
    const index = operators.findIndex((operator) => operator.id === id);
    return index < 0 ? null : palettes[index % palettes.length];
  };
  const nameOf = (id: string | null) => operators.find((operator) => operator.id === id)?.firstName ?? null;

  const items = operatorItems(appointments.filter((appointment) => isSameDay(appointment.startTime, date)));
  const dayBlocks = blocks.filter((block) => block.startTime <= dayEnd && block.endTime > dayStart);
  const dayAbsences = absences.filter((absence) => absence.date === dayKey);

  const rows = [
    ...items
      .filter((item) => !operatorId || item.operatorId === operatorId)
      .map((item) => ({ kind: "appointment" as const, startTime: item.startTime, endTime: item.endTime, item })),
    ...dayBlocks
      .filter((block) => !operatorId || block.userId === operatorId)
      .map((block) => ({ kind: "block" as const, startTime: block.startTime, endTime: block.endTime, block })),
  ].sort((a, b) => a.startTime.getTime() - b.startTime.getTime() || a.endTime.getTime() - b.endTime.getTime());

  const shownAbsences = dayAbsences.filter((absence) => !operatorId || absence.userId === operatorId);
  const count = (id: string | null) => items.filter((item) => !id || item.operatorId === id).length;

  return (
    <div className="space-y-3">
      {operators.length > 1 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[{ id: null as string | null, label: "Tutte" }, ...operators.map((operator) => ({ id: operator.id as string | null, label: operator.firstName }))].map(
            (option) => {
              const active = operatorId === option.id;
              const palette = paletteOf(option.id);
              return (
                <button
                  key={option.id ?? "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setOperatorId(option.id)}
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                    active ? "border-forest bg-forest text-forest-foreground" : "border-mint-border bg-card text-foreground"
                  )}
                >
                  {palette ? <span className={cn("size-2.5 rounded-full", palette.bar)} /> : null}
                  {option.label}
                  <span className={cn("text-xs font-medium", active ? "text-forest-foreground/75" : "text-muted-foreground")}>
                    {count(option.id)}
                  </span>
                </button>
              );
            }
          )}
        </div>
      ) : null}

      {shownAbsences.map((absence) => (
        <div key={absence.userId} className="rounded-xl border border-dashed bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{nameOf(absence.userId) ?? "Operatrice"}</span>{" "}
          {absence.startTime && absence.endTime
            ? `oggi lavora solo ${absence.startTime}–${absence.endTime}`
            : "assente tutto il giorno"}
          {absence.note ? ` · ${absence.note}` : ""}
        </div>
      ))}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Nessun appuntamento in questa giornata.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const past = isToday && row.endTime <= now;
            if (row.kind === "block") {
              const { block } = row;
              const allDay = block.endTime.getTime() - block.startTime.getTime() >= 24 * 3600000;
              return (
                <li key={`block-${block.id}`}>
                  <button
                    type="button"
                    onClick={() => onBlockClick(block)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2.5 text-left text-slate-700",
                      past && "opacity-55"
                    )}
                  >
                    <div className="w-12 shrink-0 text-sm font-bold tabular-nums">
                      {allDay ? "Tutto il giorno" : timeFormatter.format(block.startTime)}
                      {allDay ? null : (
                        <div className="text-xs font-normal opacity-75">{timeFormatter.format(block.endTime)}</div>
                      )}
                    </div>
                    <Coffee className="size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{block.title}</div>
                      {operatorId ? null : <div className="truncate text-xs">{nameOf(block.userId)}</div>}
                    </div>
                  </button>
                </li>
              );
            }

            const { item } = row;
            const { appointment } = item;
            const palette = paletteOf(item.operatorId);
            const noShow = appointment.status === "NO_SHOW";
            const operatorName = nameOf(item.operatorId);
            return (
              <li key={`${appointment.id}-${item.startTime.getTime()}-${item.operatorId ?? "none"}-${item.names.join()}`}>
                <button
                  type="button"
                  onClick={() => onAppointmentClick(appointment)}
                  className={cn(
                    "relative flex w-full items-start gap-3 overflow-hidden rounded-xl border py-2.5 pl-4 pr-3 text-left shadow-sm",
                    palette ? palette.card : "border-amber-300 bg-amber-50 text-amber-950",
                    (past || noShow) && "opacity-55"
                  )}
                >
                  <span className={cn("absolute inset-y-0 left-0 w-1.5", palette ? palette.bar : "bg-amber-400")} />
                  <div className="w-12 shrink-0 text-base font-bold leading-tight tabular-nums">
                    {timeFormatter.format(item.startTime)}
                    <div className="text-xs font-normal opacity-75">{timeFormatter.format(item.endTime)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-base font-bold leading-tight", noShow && "line-through")}>
                      {appointment.client.firstName} {appointment.client.lastName}
                    </div>
                    <div className="mt-0.5 text-sm leading-snug opacity-80">
                      {item.names.join(" + ")}
                      {item.others ? ` · il resto con ${item.others}` : ""}
                    </div>
                    {appointment.notes ? (
                      <div className="mt-0.5 line-clamp-2 text-xs italic opacity-75">📝 {appointment.notes}</div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      {!operatorId ? (
                        <span className="rounded-full bg-white/70 px-2 py-0.5 font-semibold">
                          {operatorName ?? "Senza operatrice"}
                        </span>
                      ) : null}
                      {noShow ? <span className="font-semibold">Non si è presentata</span> : null}
                      {appointment.consentMissing ? (
                        <span className="rounded border border-amber-300 bg-amber-100 px-1 font-semibold text-amber-900">
                          Consenso
                        </span>
                      ) : null}
                      {!item.first ? null : paymentsEnabled && appointment.payment ? (
                        <span className="font-semibold">✓ {formatEuro(appointment.payment.amount)}</span>
                      ) : appointment.paymentLink?.status === "PAID" ? (
                        <span className="font-semibold">✓ Pagato online</span>
                      ) : paymentsEnabled && appointment.status === "COMPLETED" ? (
                        <span className="font-semibold text-amber-700">Da incassare</span>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => onCreate(operatorId)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-mint-border py-3 text-sm font-semibold text-mint-ink transition-colors hover:bg-mint-soft"
      >
        <Plus className="size-4" />
        Aggiungi appuntamento{operatorId ? ` per ${nameOf(operatorId)}` : ""}
      </button>
    </div>
  );
}
