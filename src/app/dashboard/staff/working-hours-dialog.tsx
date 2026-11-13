"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

// Orari semplici: una riga per giorno (Lavora / Riposo, dalle–alle, pausa facoltativa)
// e "Un giorno diverso" per ferie o orari cambiati in una data sola. Tutto con menu a
// tendina, niente da trascinare: si usa bene anche dal telefono.

const DAYS = [
  { label: "Lunedì", iso: 1 },
  { label: "Martedì", iso: 2 },
  { label: "Mercoledì", iso: 3 },
  { label: "Giovedì", iso: 4 },
  { label: "Venerdì", iso: 5 },
  { label: "Sabato", iso: 6 },
  { label: "Domenica", iso: 7 },
] as const;

// Dalle 7:00 alle 22:00 ogni 15 minuti.
const TIMES = Array.from({ length: ((22 - 7) * 60) / 15 + 1 }, (_, i) => {
  const mins = 7 * 60 + i * 15;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
});

type Range = { start: string; end: string };
type DayState = { on: boolean; ranges: Range[] };
type Week = Record<number, DayState>;

const DEFAULT_RANGE: Range = { start: "09:30", end: "19:00" };

function emptyWeek(): Week {
  const week: Week = {};
  for (const { iso } of DAYS) week[iso] = { on: false, ranges: [{ ...DEFAULT_RANGE }] };
  return week;
}

function weekFromDtos(dtos: WorkingHourDTO[]): Week {
  const week = emptyWeek();
  for (const { iso } of DAYS) {
    const ranges = dtos
      .filter((dto) => dto.dayOfWeek === iso)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((dto) => ({ start: dto.startTime, end: dto.endTime }));
    if (ranges.length > 0) week[iso] = { on: true, ranges };
  }
  return week;
}

/** Errore da mostrare sotto il giorno, o null se va bene. */
function rangeError(ranges: Range[]): string | null {
  for (const range of ranges) {
    if (range.end <= range.start) return "L'orario di fine deve essere dopo l'inizio.";
  }
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < ranges[i - 1].end) return "Il secondo orario deve iniziare dopo la fine del primo.";
  }
  return null;
}

function TimeSelect({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  // Un orario salvato fuori dai quarti d'ora (es. 10:10) resta selezionabile.
  const options = TIMES.includes(value) ? TIMES : [...TIMES, value].sort();
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 rounded-lg border border-input bg-background px-2 text-base font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
    >
      {options.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  );
}

export type WorkingHoursDialogProps = {
  staffId: string | null;
  staffName: string;
  onClose: () => void;
};

export function WorkingHoursDialog({ staffId, staffName, onClose }: WorkingHoursDialogProps) {
  const open = staffId !== null;
  const [tab, setTab] = useState<"week" | "day">("week");
  const [week, setWeek] = useState<Week>(emptyWeek);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Un giorno diverso
  const [exceptions, setExceptions] = useState<StaffExceptionDTO[]>([]);
  const [exDate, setExDate] = useState("");
  const [exWorks, setExWorks] = useState(false);
  const [exRange, setExRange] = useState<Range>({ ...DEFAULT_RANGE });
  const [exNote, setExNote] = useState("");
  const [exPending, startExTransition] = useTransition();

  useEffect(() => {
    if (!staffId) return;
    startTransition(async () => {
      const [saved, excs] = await Promise.all([getWorkingHours(staffId), getStaffExceptions(staffId)]);
      setWeek(weekFromDtos(saved));
      setExceptions(excs);
      setLoaded(true);
    });
  }, [staffId]);

  function updateDay(iso: number, change: (day: DayState) => DayState) {
    setWeek((prev) => ({ ...prev, [iso]: change(prev[iso]) }));
  }

  function setRange(iso: number, index: number, patch: Partial<Range>) {
    updateDay(iso, (day) => ({ ...day, ranges: day.ranges.map((r, i) => (i === index ? { ...r, ...patch } : r)) }));
  }

  function addPause(iso: number) {
    // Pausa pranzo: il primo orario finisce alle 13, il secondo va dalle 14 alla fine di prima.
    updateDay(iso, (day) => {
      const first = day.ranges[0];
      const end = first.end > "14:00" ? first.end : "19:00";
      return { ...day, ranges: [{ start: first.start, end: "13:00" }, { start: "14:00", end }] };
    });
  }

  function removePause(iso: number) {
    updateDay(iso, (day) => ({ ...day, ranges: [{ start: day.ranges[0].start, end: day.ranges[day.ranges.length - 1].end }] }));
  }

  function copyToAll(iso: number) {
    const source = week[iso];
    setWeek((prev) => {
      const next = { ...prev };
      for (const { iso: other } of DAYS) {
        if (other !== iso && prev[other].on) next[other] = { on: true, ranges: source.ranges.map((r) => ({ ...r })) };
      }
      return next;
    });
    toast.success("Stesso orario copiato su tutti i giorni in cui lavora.");
  }

  const errors = Object.fromEntries(DAYS.map(({ iso }) => [iso, week[iso].on ? rangeError(week[iso].ranges) : null]));
  const hasErrors = Object.values(errors).some(Boolean);
  const workingDays = DAYS.filter(({ iso }) => week[iso].on).length;

  function handleSave() {
    if (!staffId || hasErrors) return;
    startTransition(async () => {
      const hours = DAYS.flatMap(({ iso }) =>
        week[iso].on ? week[iso].ranges.map((r) => ({ dayOfWeek: iso, startTime: r.start, endTime: r.end })) : []
      );
      const result = await setWorkingHours(staffId, hours);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Orari salvati.");
      onClose();
    });
  }

  const exError = exWorks && exRange.end <= exRange.start ? "L'orario di fine deve essere dopo l'inizio." : null;

  function handleAddException() {
    if (!staffId || !exDate || exError) return;
    startExTransition(async () => {
      const result = await createStaffException(staffId, {
        date: exDate,
        startTime: exWorks ? exRange.start : undefined,
        endTime: exWorks ? exRange.end : undefined,
        note: exNote || undefined,
      });
      if (!result.success || !result.exception) {
        toast.error(result.error);
        return;
      }
      setExceptions((prev) => [...prev, result.exception!].sort((a, b) => a.date.localeCompare(b.date)));
      setExDate("");
      setExWorks(false);
      setExNote("");
      toast.success("Giorno salvato.");
    });
  }

  function handleDeleteException(id: string) {
    startExTransition(async () => {
      const result = await deleteStaffException(id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setExceptions((prev) => prev.filter((e) => e.id !== id));
    });
  }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
  const upcoming = exceptions.filter((exc) => exc.date >= today);
  const dateFormatter = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="flex max-h-[92dvh] flex-col sm:max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 pb-3 pt-5">
          <DialogTitle>Orari di {staffName}</DialogTitle>
          <DialogDescription>Online si possono prenotare solo gli orari in cui lavora.</DialogDescription>
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(
              [
                { key: "week", label: "Ogni settimana" },
                { key: "day", label: "Un giorno diverso" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  tab === item.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
              >
                {item.label}
                {item.key === "day" && upcoming.length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    {upcoming.length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </DialogHeader>

        {tab === "week" ? (
          <>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {loaded && workingDays === 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Nessun giorno di lavoro: online non è prenotabile. Tocca &ldquo;Riposo&rdquo; per far diventare un giorno &ldquo;Lavora&rdquo;.
                </p>
              ) : null}

              {DAYS.map(({ label, iso }) => {
                const day = week[iso];
                return (
                  <div
                    key={iso}
                    className={cn("rounded-xl border px-3 py-2.5", day.on ? "border-mint-border bg-mint-soft/40" : "bg-muted/40")}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm font-semibold">{label}</span>
                      <button
                        type="button"
                        onClick={() => updateDay(iso, (d) => ({ ...d, on: !d.on }))}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                          day.on ? "bg-primary text-primary-foreground" : "border bg-background text-muted-foreground"
                        )}
                      >
                        {day.on ? "Lavora" : "Riposo"}
                      </button>
                      {day.on && workingDays > 1 ? (
                        <button
                          type="button"
                          onClick={() => copyToAll(iso)}
                          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="size-3.5" />
                          Uguale per tutti
                        </button>
                      ) : null}
                    </div>

                    {day.on ? (
                      <div className="mt-2 space-y-2">
                        {day.ranges.map((range, index) => (
                          <div key={index} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="w-10 text-muted-foreground">{index === 0 ? "dalle" : "poi"}</span>
                            <TimeSelect label={`${label}: inizio`} value={range.start} onChange={(start) => setRange(iso, index, { start })} />
                            <span className="text-muted-foreground">alle</span>
                            <TimeSelect label={`${label}: fine`} value={range.end} onChange={(end) => setRange(iso, index, { end })} />
                            {index === 1 ? (
                              <button
                                type="button"
                                onClick={() => removePause(iso)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label="Togli la pausa"
                              >
                                <X className="size-4" />
                              </button>
                            ) : null}
                          </div>
                        ))}
                        {day.ranges.length === 1 ? (
                          <button
                            type="button"
                            onClick={() => addPause(iso)}
                            className="inline-flex items-center gap-1 pl-12 text-xs font-medium text-primary hover:underline"
                          >
                            <Plus className="size-3.5" />
                            Aggiungi pausa pranzo
                          </button>
                        ) : null}
                        {errors[iso] ? <p className="pl-12 text-xs text-destructive">{errors[iso]}</p> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <p className="pt-1 text-xs text-muted-foreground">
                Ferie o un orario cambiato solo per una data? Usa &ldquo;Un giorno diverso&rdquo;. Una pausa di un&apos;ora? &ldquo;Impegno&rdquo; in Agenda.
              </p>
            </div>

            <DialogFooter className="shrink-0 border-t px-5 py-3">
              <Button variant="outline" onClick={onClose}>
                Annulla
              </Button>
              <Button onClick={handleSave} disabled={isPending || !loaded || hasErrors}>
                {isPending ? "Salvataggio..." : "Salva orari"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="space-y-3 rounded-xl border border-mint-border bg-mint-soft/40 p-4">
                <div className="space-y-1">
                  <Label htmlFor="ex-date">Che giorno?</Label>
                  <Input id="ex-date" type="date" min={today} value={exDate} onChange={(e) => setExDate(e.target.value)} className="h-10" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { works: false, label: "Non lavora" },
                    { works: true, label: "Orario diverso" },
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setExWorks(option.works)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                        exWorks === option.works ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {exWorks ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">dalle</span>
                    <TimeSelect label="Inizio" value={exRange.start} onChange={(start) => setExRange((r) => ({ ...r, start }))} />
                    <span className="text-muted-foreground">alle</span>
                    <TimeSelect label="Fine" value={exRange.end} onChange={(end) => setExRange((r) => ({ ...r, end }))} />
                  </div>
                ) : null}
                {exError ? <p className="text-xs text-destructive">{exError}</p> : null}
                <Input value={exNote} onChange={(e) => setExNote(e.target.value)} placeholder="Nota (facoltativa): ferie, corso…" className="h-10" />
                <Button onClick={handleAddException} disabled={!exDate || exPending || Boolean(exError)} className="w-full gap-1.5">
                  <Plus className="size-4" />
                  Salva questo giorno
                </Button>
              </div>

              {upcoming.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Nessun giorno diverso in programma.</p>
              ) : (
                <ul className="space-y-2">
                  {upcoming.map((exc) => (
                    <li key={exc.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold capitalize">{dateFormatter.format(new Date(`${exc.date}T12:00:00`))}</div>
                        <div className="text-xs text-muted-foreground">
                          {exc.startTime && exc.endTime ? `Lavora ${exc.startTime} – ${exc.endTime}` : "Non lavora"}
                          {exc.note ? ` · ${exc.note}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteException(exc.id)}
                        disabled={exPending}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Togli questo giorno"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <DialogFooter className="shrink-0 border-t px-5 py-3">
              <Button variant="outline" onClick={onClose}>
                Chiudi
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
