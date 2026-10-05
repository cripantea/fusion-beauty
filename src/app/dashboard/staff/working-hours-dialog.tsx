"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  getWorkingHours,
  setWorkingHours,
  getStaffExceptions,
  createStaffException,
  deleteStaffException,
  type WorkingHourDTO,
  type StaffExceptionDTO,
} from "./working-hours-actions";

// ── constants ─────────────────────────────────────────────────────────────────

const DAY_START = 8;
const DAY_END = 20;
const SLOT_MINS = 30;
const TOTAL_SLOTS = ((DAY_END - DAY_START) * 60) / SLOT_MINS; // 24
const CELL_H = 22;

const DAYS = [
  { label: "Lun", iso: 1 },
  { label: "Mar", iso: 2 },
  { label: "Mer", iso: 3 },
  { label: "Gio", iso: 4 },
  { label: "Ven", iso: 5 },
  { label: "Sab", iso: 6 },
  { label: "Dom", iso: 7 },
] as const;

// ── helpers ───────────────────────────────────────────────────────────────────

function slotToTime(slot: number): string {
  const mins = DAY_START * 60 + slot * SLOT_MINS;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

function timeToSlot(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return ((h - DAY_START) * 60 + m) / SLOT_MINS;
}

function overlaps(a: Block, b: Block): boolean {
  return a.startSlot < b.endSlot && b.startSlot < a.endSlot;
}

// ── types ─────────────────────────────────────────────────────────────────────

type Block = { startSlot: number; endSlot: number };
type DayMap = Record<number, Block[]>;

type DragState = {
  dayOfWeek: number;
  anchorSlot: number;
  currentSlot: number;
};

// ── presets ───────────────────────────────────────────────────────────────────

const PRESETS: { label: string; fn: () => DayMap }[] = [
  {
    label: "Standard (9-13 / 15-19)",
    fn: () => {
      const out: DayMap = {};
      for (let d = 1; d <= 7; d++) {
        if (d <= 5) out[d] = [{ startSlot: 2, endSlot: 10 }, { startSlot: 14, endSlot: 22 }];
        else if (d === 6) out[d] = [{ startSlot: 2, endSlot: 10 }];
        else out[d] = [];
      }
      return out;
    },
  },
  {
    label: "Solo mattine (9-13)",
    fn: () => {
      const out: DayMap = {};
      for (let d = 1; d <= 7; d++) {
        out[d] = d <= 6 ? [{ startSlot: 2, endSlot: 10 }] : [];
      }
      return out;
    },
  },
  {
    label: "Piena giornata (9-19)",
    fn: () => {
      const out: DayMap = {};
      for (let d = 1; d <= 7; d++) {
        out[d] = d <= 5 ? [{ startSlot: 2, endSlot: 22 }] : [];
      }
      return out;
    },
  },
];

// ── init helpers ──────────────────────────────────────────────────────────────

function emptyDays(): DayMap {
  const out: DayMap = {};
  for (let d = 1; d <= 7; d++) out[d] = [];
  return out;
}

function dtosToDays(dtos: WorkingHourDTO[]): DayMap {
  const out = emptyDays();
  for (const dto of dtos) {
    out[dto.dayOfWeek].push({
      startSlot: timeToSlot(dto.startTime),
      endSlot: timeToSlot(dto.endTime),
    });
  }
  for (const d of Object.keys(out)) {
    out[Number(d)].sort((a, b) => a.startSlot - b.startSlot);
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
  const [tab, setTab] = useState<"schedule" | "exceptions">("schedule");
  const [days, setDays] = useState<DayMap>(emptyDays);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [isPending, startTransition] = useTransition();

  // Exceptions state
  const [exceptions, setExceptions] = useState<StaffExceptionDTO[]>([]);
  const [exDate, setExDate] = useState("");
  const [exStart, setExStart] = useState("");
  const [exEnd, setExEnd] = useState("");
  const [exNote, setExNote] = useState("");
  const [exPending, startExTransition] = useTransition();

  useEffect(() => {
    if (!staffId) return;
    startTransition(async () => {
      const [saved, excs] = await Promise.all([
        getWorkingHours(staffId),
        getStaffExceptions(staffId),
      ]);
      setDays(saved.length > 0 ? dtosToDays(saved) : PRESETS[0].fn());
      setExceptions(excs);
    });
  }, [staffId]);

  // Commit drag on mouseup — global so releasing outside grid still commits
  const commitDrag = useCallback(() => {
    if (!drag) return;
    const start = Math.min(drag.anchorSlot, drag.currentSlot);
    const end = Math.max(drag.anchorSlot, drag.currentSlot) + 1;
    const newBlock: Block = { startSlot: start, endSlot: end };
    setDays((prev) => {
      const existing = prev[drag.dayOfWeek] ?? [];
      if (existing.some((b) => overlaps(b, newBlock))) return prev;
      return {
        ...prev,
        [drag.dayOfWeek]: [...existing, newBlock].sort((a, b) => a.startSlot - b.startSlot),
      };
    });
    setDrag(null);
  }, [drag]);

  useEffect(() => {
    window.addEventListener("mouseup", commitDrag);
    return () => window.removeEventListener("mouseup", commitDrag);
  }, [commitDrag]);

  function handleCellDown(dayOfWeek: number, slot: number) {
    const existing = days[dayOfWeek] ?? [];
    const blockIdx = existing.findIndex((b) => slot >= b.startSlot && slot < b.endSlot);
    if (blockIdx !== -1) {
      setDays((prev) => ({
        ...prev,
        [dayOfWeek]: prev[dayOfWeek].filter((_, i) => i !== blockIdx),
      }));
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
      const hours: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
      for (let d = 1; d <= 7; d++) {
        for (const block of days[d] ?? []) {
          hours.push({ dayOfWeek: d, startTime: slotToTime(block.startSlot), endTime: slotToTime(block.endSlot) });
        }
      }
      const result = await setWorkingHours(staffId, hours);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Disponibilità salvata.");
      onClose();
    });
  }

  function handleAddException() {
    if (!staffId || !exDate) return;
    startExTransition(async () => {
      const result = await createStaffException(staffId, {
        date: exDate,
        startTime: exStart || undefined,
        endTime: exEnd || undefined,
        note: exNote || undefined,
      });
      if (!result.success || !result.exception) { toast.error(result.error); return; }
      setExceptions((prev) => [...prev, result.exception!].sort((a, b) => a.date.localeCompare(b.date)));
      setExDate(""); setExStart(""); setExEnd(""); setExNote("");
      toast.success("Imprevisto aggiunto.");
    });
  }

  function handleDeleteException(id: string) {
    startExTransition(async () => {
      const result = await deleteStaffException(id);
      if (!result.success) { toast.error(result.error); return; }
      setExceptions((prev) => prev.filter((e) => e.id !== id));
    });
  }

  const hourLabels = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => ({
    slot: i * 2,
    label: `${String(DAY_START + i).padStart(2, "0")}:00`,
  }));

  const dateFormatter = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle>Disponibilità — {staffName}</DialogTitle>

          {/* Tabs */}
          <div className="flex gap-1 mt-2">
            <button
              type="button"
              onClick={() => setTab("schedule")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "schedule" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              Orari settimanali
            </button>
            <button
              type="button"
              onClick={() => setTab("exceptions")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === "exceptions" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              Imprevisti
              {exceptions.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                  {exceptions.length}
                </span>
              )}
            </button>
          </div>
        </DialogHeader>

        {/* ── Tab: schedule ── */}
        {tab === "schedule" && (
          <>
            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 px-6 pt-3 pb-0">
              <span className="self-center text-xs text-muted-foreground mr-1">Preset:</span>
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDays(preset.fn())}
                  className="rounded-full border border-mint-border bg-mint-soft px-3 py-1 text-xs font-medium text-forest hover:bg-mint-border/60 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <p className="px-6 pt-2 pb-0 text-xs text-muted-foreground">
              Trascina per aggiungere un blocco · Click su un blocco per rimuoverlo
            </p>

            {/* Calendar grid */}
            <div className="px-4 py-3 overflow-y-auto" style={{ maxHeight: "calc(80vh - 200px)" }}>
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
                  <div
                    className="absolute right-2 text-[10px] leading-none text-muted-foreground"
                    style={{ top: TOTAL_SLOTS * CELL_H - 5 }}
                  >
                    {`${String(DAY_END).padStart(2, "0")}:00`}
                  </div>
                </div>

                {/* Day columns */}
                {DAYS.map(({ label, iso }) => {
                  const blocks = days[iso] ?? [];
                  const isDragging = drag?.dayOfWeek === iso;
                  const dStart = drag ? Math.min(drag.anchorSlot, drag.currentSlot) : 0;
                  const dEnd = drag ? Math.max(drag.anchorSlot, drag.currentSlot) + 1 : 0;
                  const hasBlocks = blocks.length > 0;

                  return (
                    <div key={iso} className="flex-1 min-w-0">
                      {/* Day header */}
                      <div
                        className={cn(
                          "h-7 flex items-center justify-center text-[11px] font-bold tracking-wide",
                          hasBlocks ? "text-primary" : "text-muted-foreground/50"
                        )}
                      >
                        {label}
                      </div>

                      {/* Slot column */}
                      <div
                        className="relative rounded-lg border border-border/40 overflow-hidden cursor-crosshair"
                        style={{ height: TOTAL_SLOTS * CELL_H, background: "var(--muted)" }}
                      >
                        {/* Grid lines */}
                        {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "absolute inset-x-0",
                              i % 2 === 0 ? "border-t border-border/50" : "border-t border-border/20"
                            )}
                            style={{ top: i * CELL_H, height: CELL_H }}
                          />
                        ))}

                        {/* Existing blocks */}
                        {blocks.map((block, idx) => (
                          <div
                            key={idx}
                            className="absolute inset-x-0.5 rounded bg-primary/25 border border-primary/40 z-10 hover:bg-primary/35 transition-colors"
                            style={{
                              top: block.startSlot * CELL_H + 1,
                              height: (block.endSlot - block.startSlot) * CELL_H - 2,
                            }}
                          >
                            <div className="absolute inset-0 flex flex-col justify-between px-1 py-0.5 pointer-events-none">
                              <span className="text-[9px] font-bold text-primary leading-tight">
                                {slotToTime(block.startSlot)}
                              </span>
                              {(block.endSlot - block.startSlot) >= 3 && (
                                <span className="text-[9px] text-primary/70 leading-tight">
                                  {slotToTime(block.endSlot)}
                                </span>
                              )}
                            </div>
                            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l bg-primary" />
                          </div>
                        ))}

                        {/* Drag preview */}
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

                        {/* Interaction cells (on top) */}
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
          </>
        )}

        {/* ── Tab: exceptions ── */}
        {tab === "exceptions" && (
          <>
            <div className="px-6 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(80vh - 160px)" }}>
              <p className="text-sm text-muted-foreground">
                Aggiungi giorni o fasce orarie in cui l&apos;operatrice non sarà disponibile (ferie, visite, imprevisti).
              </p>

              {/* Add form */}
              <div className="rounded-xl border border-mint-border bg-mint-soft/40 p-4 space-y-3">
                <p className="text-xs font-semibold text-forest uppercase tracking-wide">Nuovo imprevisto</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Data *</Label>
                    <Input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dalle</Label>
                    <Input type="time" value={exStart} onChange={(e) => setExStart(e.target.value)} className="h-9" placeholder="Intera giornata" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Alle</Label>
                    <Input type="time" value={exEnd} onChange={(e) => setExEnd(e.target.value)} className="h-9" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Note (opzionale)</Label>
                  <Input value={exNote} onChange={(e) => setExNote(e.target.value)} placeholder="Es. Visita medica, ferie..." className="h-9" />
                </div>
                <Button
                  onClick={handleAddException}
                  disabled={!exDate || exPending}
                  size="sm"
                  className="gap-1.5"
                >
                  <Plus className="size-3.5" />
                  Aggiungi
                </Button>
              </div>

              {/* List */}
              {exceptions.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">Nessun imprevisto registrato.</p>
              ) : (
                <ul className="space-y-2">
                  {exceptions.map((exc) => (
                    <li key={exc.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">
                          {dateFormatter.format(new Date(exc.date + "T00:00:00"))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {exc.startTime && exc.endTime
                            ? `${exc.startTime} – ${exc.endTime}`
                            : "Giornata intera"}
                          {exc.note && ` · ${exc.note}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteException(exc.id)}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label="Elimina imprevisto"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t">
              <Button variant="outline" onClick={onClose}>Chiudi</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
