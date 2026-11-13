"use client";

import { addDays, format } from "date-fns";
import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
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

import type { OperatorDTO } from "./actions";
import { Chip } from "./appointment-form-dialog";
import { createStaffBlock, deleteStaffBlock, updateStaffBlock, type StaffBlockDTO } from "./block-actions";

const KINDS = ["Pausa", "Ferie", "Visita medica", "Corso"] as const;
const OTHER = "Altro";

type Duration = 30 | 60 | 120 | "day" | "custom";

const DURATIONS: { value: Duration; label: string }[] = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 ora" },
  { value: 120, label: "2 ore" },
  { value: "day", label: "Tutto il giorno" },
  { value: "custom", label: "Fino alle..." },
];

type StaffBlockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Impegno da modificare; null = nuovo. */
  block: StaffBlockDTO | null;
  operators: OperatorDTO[];
  defaultOperatorId?: string;
  defaultStart?: Date;
  /** La titolare segna impegni per tutte; lo staff solo per sé. */
  isAdmin: boolean;
  currentUserId: string;
  onChanged: () => void;
};

function isMidnight(date: Date) {
  return date.getHours() === 0 && date.getMinutes() === 0;
}

type FormValues = {
  kind: string;
  customTitle: string;
  userId: string;
  date: string;
  time: string;
  duration: Duration;
  endTime: string;
  untilDate: string;
  note: string;
};

function initialValues(
  block: StaffBlockDTO | null,
  selectableOperators: OperatorDTO[],
  defaultOperatorId: string | undefined,
  defaultStart: Date | undefined
): FormValues {
  if (block) {
    const known = (KINDS as readonly string[]).includes(block.title);
    const base = {
      kind: known ? block.title : OTHER,
      customTitle: known ? "" : block.title,
      userId: block.userId,
      date: format(block.startTime, "yyyy-MM-dd"),
      time: format(block.startTime, "HH:mm"),
      note: block.note ?? "",
    };
    const minutes = Math.round((block.endTime.getTime() - block.startTime.getTime()) / 60000);
    if (isMidnight(block.startTime) && isMidnight(block.endTime)) {
      const lastDay = format(addDays(block.endTime, -1), "yyyy-MM-dd");
      return { ...base, duration: "day", endTime: "", untilDate: lastDay === base.date ? "" : lastDay };
    }
    if (minutes === 30 || minutes === 60 || minutes === 120) {
      return { ...base, duration: minutes, endTime: "", untilDate: "" };
    }
    return { ...base, duration: "custom", endTime: format(block.endTime, "HH:mm"), untilDate: "" };
  }

  const start = defaultStart ?? new Date();
  return {
    kind: "Pausa",
    customTitle: "",
    userId:
      defaultOperatorId && selectableOperators.some((o) => o.id === defaultOperatorId)
        ? defaultOperatorId
        : (selectableOperators[0]?.id ?? ""),
    date: format(start, "yyyy-MM-dd"),
    // Dal pulsante "Impegno" arriva solo il giorno (mezzanotte): si propone l'ora di pranzo.
    time: defaultStart && !isMidnight(defaultStart) ? format(start, "HH:mm") : "13:00",
    duration: 60,
    endTime: "",
    untilDate: "",
    note: "",
  };
}

export function StaffBlockDialog(props: StaffBlockDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        {/* Montato a ogni apertura: i campi ripartono dai valori iniziali. */}
        {props.open ? <StaffBlockForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function StaffBlockForm({
  onOpenChange,
  block,
  operators,
  defaultOperatorId,
  defaultStart,
  isAdmin,
  currentUserId,
  onChanged,
}: StaffBlockDialogProps) {
  const selectableOperators = isAdmin ? operators : operators.filter((o) => o.id === currentUserId);
  const [initial] = useState(() => initialValues(block, selectableOperators, defaultOperatorId, defaultStart));

  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState(initial.kind);
  const [customTitle, setCustomTitle] = useState(initial.customTitle);
  const [userId, setUserId] = useState(initial.userId);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState<Duration>(initial.duration);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [untilDate, setUntilDate] = useState(initial.untilDate);
  const [note, setNote] = useState(initial.note);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function pickKind(value: string) {
    setKind(value);
    // Le ferie di solito durano giorni interi.
    if (value === "Ferie") setDuration("day");
  }

  function buildRange(): { start: Date; end: Date } | string {
    if (!date) return "Scegli la data.";
    if (duration === "day") {
      const start = new Date(`${date}T00:00:00`);
      const lastDay = untilDate ? new Date(`${untilDate}T00:00:00`) : start;
      if (lastDay < start) return "\"Fino al\" deve essere dopo la data di inizio.";
      return { start, end: addDays(lastDay, 1) };
    }
    if (!time) return "Scegli l'orario.";
    const start = new Date(`${date}T${time}:00`);
    if (duration === "custom") {
      if (!endTime) return "Scegli a che ora finisce.";
      const end = new Date(`${date}T${endTime}:00`);
      if (end <= start) return "La fine deve essere dopo l'inizio.";
      return { start, end };
    }
    return { start, end: new Date(start.getTime() + duration * 60000) };
  }

  function handleSave() {
    const title = kind === OTHER ? customTitle.trim() : kind;
    if (!title) {
      toast.error("Scrivi cos'è l'impegno.");
      return;
    }
    if (!userId) {
      toast.error("Scegli l'operatrice.");
      return;
    }
    const range = buildRange();
    if (typeof range === "string") {
      toast.error(range);
      return;
    }

    startTransition(async () => {
      const input = { userId, start: range.start, end: range.end, title, note };
      const result = block ? await updateStaffBlock(block.id, input) : await createStaffBlock(input);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.warning) toast.warning(result.warning);
      else toast.success(block ? "Impegno aggiornato." : "Impegno aggiunto.");
      onChanged();
      onOpenChange(false);
    });
  }

  function handleDelete() {
    if (!block) return;
    startTransition(async () => {
      const result = await deleteStaffBlock(block.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Impegno eliminato.");
      onChanged();
      onOpenChange(false);
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg">{block ? "Modifica impegno" : "Nuovo impegno"}</DialogTitle>
        <DialogDescription>
          In questo orario l&apos;operatrice non si può prenotare, né qui né online.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Cosa</Label>
          <div className="flex flex-wrap gap-2">
            {[...KINDS, OTHER].map((value) => (
              <Chip key={value} active={kind === value} onClick={() => pickKind(value)}>
                {value}
              </Chip>
            ))}
          </div>
          {kind === OTHER ? (
            <Input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Es. Riunione, commissione..."
              maxLength={80}
              className="h-10"
            />
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Operatrice</Label>
          <div className="flex flex-wrap gap-2">
            {selectableOperators.map((operator) => (
              <Chip key={operator.id} active={userId === operator.id} onClick={() => setUserId(operator.id)}>
                {operator.firstName}
              </Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Quando</Label>
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-10"
              disabled={duration === "day"}
              aria-label="Dalle"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((option) => (
              <Chip key={option.label} active={duration === option.value} onClick={() => setDuration(option.value)}>
                {option.label}
              </Chip>
            ))}
          </div>
          {duration === "custom" ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Fino alle</span>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-10 w-32" />
            </div>
          ) : null}
          {duration === "day" ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Fino al (facoltativo)</span>
              <Input
                type="date"
                value={untilDate}
                min={date}
                onChange={(e) => setUntilDate(e.target.value)}
                className="h-10 w-44"
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Nota (facoltativa)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="h-10" />
        </div>

        {block && confirmDelete ? (
          <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p>Eliminare questo impegno? L&apos;orario torna prenotabile.</p>
            <div className="flex gap-2">
              <Button variant="destructive" className="h-10" disabled={isPending} onClick={handleDelete}>
                Sì, elimina
              </Button>
              <Button variant="outline" className="h-10" onClick={() => setConfirmDelete(false)}>
                No
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <DialogFooter>
        {block && !confirmDelete ? (
          <Button variant="ghost" className="h-10 text-destructive sm:mr-auto" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
            Elimina
          </Button>
        ) : null}
        <Button variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
          Annulla
        </Button>
        <Button className="h-10 px-6" disabled={isPending} onClick={handleSave}>
          {isPending ? "Salvataggio..." : "Salva impegno"}
        </Button>
      </DialogFooter>
    </>
  );
}
