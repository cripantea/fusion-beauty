"use client";

import { Plus } from "lucide-react";

import { formatEuro } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { OperatorDTO } from "./actions";
import type { AppointmentDTO } from "./dto";

const timeFormatter = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" });

const palettes = [
  { head: "bg-emerald-100 text-emerald-900 border-emerald-200", card: "bg-emerald-50 border-emerald-200 text-emerald-950" },
  { head: "bg-teal-100 text-teal-900 border-teal-200", card: "bg-teal-50 border-teal-200 text-teal-950" },
  { head: "bg-violet-100 text-violet-900 border-violet-200", card: "bg-violet-50 border-violet-200 text-violet-950" },
  { head: "bg-amber-100 text-amber-900 border-amber-200", card: "bg-amber-50 border-amber-200 text-amber-950" },
  { head: "bg-sky-100 text-sky-900 border-sky-200", card: "bg-sky-50 border-sky-200 text-sky-950" },
];

type OperatorsGridProps = {
  appointments: AppointmentDTO[];
  operators: OperatorDTO[];
  onAppointmentClick: (appointment: AppointmentDTO) => void;
  onCreate: (operatorId: string | null) => void;
};

/** Vista del giorno con una colonna per operatrice, come nella proposta. */
export function OperatorsGrid({
  appointments,
  operators,
  onAppointmentClick,
  onCreate,
}: OperatorsGridProps) {
  const unassigned = appointments.filter((appointment) => !appointment.operator);
  const columns = [
    ...operators.map((operator) => ({
      id: operator.id as string | null,
      label: operator.firstName,
      items: appointments.filter((appointment) => appointment.operator?.id === operator.id),
    })),
    ...(unassigned.length > 0 || operators.length === 0
      ? [{ id: null, label: "Senza operatrice", items: unassigned }]
      : []),
  ];

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(13rem, 1fr))`, overflowX: "auto" }}
    >
      {columns.map((column, index) => {
        const palette = palettes[index % palettes.length];
        return (
          <div key={column.id ?? "none"} className="min-w-0 space-y-3">
            <div
              className={cn(
                "rounded-full border px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider",
                palette.head
              )}
            >
              {column.label}
            </div>
            {column.items.map((appointment) => {
              const cancelled = appointment.status === "CANCELLED" || appointment.status === "NO_SHOW";
              return (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => onAppointmentClick(appointment)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                    palette.card,
                    cancelled && "opacity-55"
                  )}
                >
                  <div className="text-xs font-bold">
                    {timeFormatter.format(appointment.startTime)} – {timeFormatter.format(appointment.endTime)}
                  </div>
                  <div className={cn("mt-0.5 text-sm font-semibold", cancelled && "line-through")}>
                    {appointment.client.firstName} {appointment.client.lastName}
                  </div>
                  <div className="text-xs opacity-75">{appointment.service.name}</div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
                    {appointment.payment ? (
                      <span className="rounded-full bg-white/70 px-2 py-0.5">
                        ✓ {formatEuro(appointment.payment.amount)}
                      </span>
                    ) : appointment.status === "COMPLETED" ? (
                      <span className="rounded-full bg-amber-200/80 px-2 py-0.5">Da incassare</span>
                    ) : appointment.status === "BOOKED" ? (
                      <span className="rounded-full bg-white/70 px-2 py-0.5">Da confermare</span>
                    ) : null}
                    {appointment.source === "ONLINE" ? (
                      <span className="rounded-full bg-white/70 px-2 py-0.5">Sito</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onCreate(column.id)}
              className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-mint-border py-2.5 text-xs font-semibold text-mint-ink transition-colors hover:bg-mint-soft"
            >
              <Plus className="size-3.5" />
              Aggiungi
            </button>
          </div>
        );
      })}
    </div>
  );
}
