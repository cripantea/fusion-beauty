"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { getWorkingHours, setWorkingHours, type WorkingHourDTO } from "./working-hours-actions";

// ── constants ────────────────────────────────────────────────────────────────

const DAY_START = 8;   // 08:00
const DAY_END = 20;    // 20:00
const SLOT_MINS = 30;
const TOTAL_SLOTS = ((DAY_END - DAY_START) * 60) / SLOT_MINS; // 24 slots
const CELL_H = 22;     // px per slot → 528px total

const DAYS = [
  { label: "Lun", iso: 1 },
  { label: "Mar", iso: 2 },
  { label: "Mer", iso: 3 },
  { label: "Gio", iso: 4 },
  { label: "Ven", iso: 5 },
  { label: "Sab", iso: 6 },
  { label: "Dom", iso: 7 },
] as const;

// ── helpers ──────────────────────────────────────────────────────────────────

function slotToTime(slot: number): string {
  const mins = DAY_START * 60 + slot * SLOT_MINS;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

function timeToSlot(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return ((h - DAY_START) * 60 + m) / SLOT_MINS;
}

// ── types ─────────────────────────────────────────────────────────────────────

type Block = { startSlot: number; endSlot: number }; // endSlot exclusive
type DayMap = Record<number, Block | null>; // null = giorno libero

type DragState = {
  dayOfWeek: number;
  anchorSlot: number;
  currentSlot: number;
};

// ── helpers ───────────────────────────────────────────────────────────────────

function defaultDays(): DayMap {
  const out: DayMap = {};
  for (let d = 1; d <= 7; d++) {
    out[d] = d <= 5 ? { startSlot: 2, endSlot: 22 } : null; // 09:00–19:00 lun-ven
  }
  return out;
}

function dtosToDays(dtos: WorkingHourDTO[]): DayMap {
  const out = defaultDays();
  for (const dto of dtos) {
    out[dto.dayOfWeek] = dto.isActive
      ? { startSlot: timeToSlot(dto.startTime), endSlot: timeToSlot(dto.endTime) }
      : null;
  }
  return out;
}

// ── component ─────────────────────────────────────────────────────────────────

export type WorkingHoursDialogProps = {
  staffId: string | null;
  staffName: string;
  onClose: () => void;
};

export function WorkingHoursDialog({ staffId, staffName, onClose }: WorkingHoursDialogProps) {
  const open = staffId !== null;
  const [days, setDays] = useState<DayMap>(defaultDays);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!staffId) return;
    startTransition(async () => {
      const saved = await getWorkingHours(staffId);
      setDays(saved.length > 0 ? dtosToDays(saved) : defaultDays());
    });
  }, [staffId]);

  // Commit drag on mouseup (registered globally so releasing outside grid works)
  const commitDrag = useCallback(() => {
    if (!drag) return;
    const start = Math.min(drag.anchorSlot, drag.currentSlot);
    const end = Math.max(drag.anchorSlot, drag.currentSlot) + 1;
    setDays((prev) => ({ ...prev, [drag.dayOfWeek]: { startSlot: start, endSlot: end } }));
    setDrag(null);
  }, [drag]);

  useEffect(() => {
    window.addEventListener("mouseup", commitDrag);
    return () => window.removeEventListener("mouseup", commitDrag);
  }, [commitDrag]);

  function handleCellDown(dayOfWeek: number, slot: number) {
    const existing = days[dayOfWeek];
    if (existing && slot >= existing.startSlot && slot < existing.endSlot) {
      setDays((prev) => ({ ...prev, [dayOfWeek]: null }));
    } else {
      setDrag({ dayOfWeek, anchorSlot: slot, currentSlot: slot });
    }
  }

  function handleCellEnter(dayOfWeek: number, slot: number) {
    if (!drag || drag.dayOfWeek !== dayOfWeek) return;
    setDrag((prev) => (prev ? { ...prev, currentSlot: slot } : null));
  }

  function handleSave() {
    if (!staffId) return;
    startTransition(async () => {
      const hours = Array.from({ length: 7 }, (_, i) => i + 1).map((day) => {
        const blk = days[day];
        return {
          dayOfWeek: day,
          startTime: blk ? slotToTime(blk.startSlot) : "09:00",
          endTime: blk ? slotToTime(blk.endSlot) : "19:00",
          isActive: blk !== null,
        };
      });
      const result = await setWorkingHours(staffId, hours);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Disponibilità salvata.");
      onClose();
    });
  }

  // Time labels at every full hour
  const hourLabels = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => ({
    slot: i * 2,
    label: `${String(DAY_START + i).padStart(2, "0")}:00`,
  }));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle>Disponibilità settimanale — {staffName}</DialogTitle>
          <p className="text-xs text-muted-foreground pt-1">
            Trascina per segnare gli orari disponibili · Click su un blocco per rimuoverlo
          </p>
        </DialogHeader>

        {/* Calendar grid */}
        <div
          className="px-4 py-3 overflow-y-auto"
          style={{ maxHeight: "calc(80vh - 140px)" }}
        >
          <div className="flex gap-1 select-none" onMouseLeave={commitDrag}>
            {/* Time axis */}
            <div className="w-11 shrink-0 relative" style={{ marginTop: 28 }}>
              {hourLabels.map(({ slot, label }) => (
                <div
                  key={slot}
                  className="absolute right-2 text-[10px] leading-none text-muted-foreground"
                  style={{ top: slot * CELL_H - 5 }}
                >
                  {label}
                </div>
              ))}
              {/* Bottom label */}
              <div
                className="absolute right-2 text-[10px] leading-none text-muted-foreground"
                style={{ top: TOTAL_SLOTS * CELL_H - 5 }}
              >
                {`${String(DAY_END).padStart(2, "0")}:00`}
              </div>
            </div>

            {/* Day columns */}
            {DAYS.map(({ label, iso }) => {
              const block = days[iso];
              const isDragging = drag?.dayOfWeek === iso;
              const dStart = drag ? Math.min(drag.anchorSlot, drag.currentSlot) : 0;
              const dEnd = drag ? Math.max(drag.anchorSlot, drag.currentSlot) + 1 : 0;

              return (
                <div key={iso} className="flex-1 min-w-0">
                  {/* Day header */}
                  <div
                    className={`h-7 flex items-center justify-center text-[11px] font-bold tracking-wide ${
                      block ? "text-primary" : "text-muted-foreground/50"
                    }`}
                  >
                    {label}
                  </div>

                  {/* Slot column */}
                  <div
                    className="relative rounded-lg border border-border/40 overflow-hidden cursor-crosshair"
                    style={{ height: TOTAL_SLOTS * CELL_H, background: "var(--muted)" }}
                  >
                    {/* Hour/half-hour lines */}
                    {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                      <div
                        key={i}
                        className={`absolute inset-x-0 ${
                          i % 2 === 0 ? "border-t border-border/50" : "border-t border-border/20"
                        }`}
                        style={{ top: i * CELL_H, height: CELL_H }}
                      />
                    ))}

                    {/* Existing availability block */}
                    {block && !isDragging && (
                      <div
                        className="absolute inset-x-0.5 rounded bg-primary/25 border border-primary/40 z-10 hover:bg-primary/35 transition-colors group"
                        style={{
                          top: block.startSlot * CELL_H + 1,
                          height: (block.endSlot - block.startSlot) * CELL_H - 2,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDays((prev) => ({ ...prev, [iso]: null }));
                        }}
                      >
                        <div className="absolute inset-0 flex flex-col justify-between px-1 py-0.5 pointer-events-none">
                          <span className="text-[9px] font-bold text-primary leading-tight">
                            {slotToTime(block.startSlot)}
                          </span>
                          <span className="text-[9px] text-primary/70 leading-tight">
                            {slotToTime(block.endSlot)}
                          </span>
                        </div>
                        {/* Left border accent */}
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l bg-primary" />
                      </div>
                    )}

                    {/* Live drag preview */}
                    {isDragging && (
                      <div
                        className="absolute inset-x-0.5 rounded bg-primary/35 border border-primary/60 z-10 pointer-events-none"
                        style={{
                          top: dStart * CELL_H + 1,
                          height: (dEnd - dStart) * CELL_H - 2,
                        }}
                      >
                        <div className="absolute inset-0 flex flex-col justify-between px-1 py-0.5">
                          <span className="text-[9px] font-bold text-primary leading-tight">
                            {slotToTime(dStart)}
                          </span>
                          <span className="text-[9px] text-primary/70 leading-tight">
                            {slotToTime(dEnd)}
                          </span>
                        </div>
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l bg-primary" />
                      </div>
                    )}

                    {/* Invisible interaction cells (on top of everything) */}
                    {Array.from({ length: TOTAL_SLOTS }, (_, slot) => (
                      <div
                        key={slot}
                        className="absolute inset-x-0 z-20"
                        style={{ top: slot * CELL_H, height: CELL_H }}
                        onMouseDown={() => handleCellDown(iso, slot)}
                        onMouseEnter={() => handleCellEnter(iso, slot)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvataggio..." : "Salva disponibilità"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
