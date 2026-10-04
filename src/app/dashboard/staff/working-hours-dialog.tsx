"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { getWorkingHours, setWorkingHours, type WorkingHourDTO } from "./working-hours-actions";

const DAY_LABELS: Record<number, string> = {
  1: "Lunedì",
  2: "Martedì",
  3: "Mercoledì",
  4: "Giovedì",
  5: "Venerdì",
  6: "Sabato",
  7: "Domenica",
};

function buildDefaults(): WorkingHourDTO[] {
  return Array.from({ length: 7 }, (_, i) => ({
    id: "",
    dayOfWeek: i + 1,
    startTime: "09:00",
    endTime: "19:00",
    isActive: i + 1 <= 5,
  }));
}

type WorkingHoursDialogProps = {
  staffId: string | null;
  staffName: string;
  onClose: () => void;
};

export function WorkingHoursDialog({ staffId, staffName, onClose }: WorkingHoursDialogProps) {
  const open = staffId !== null;
  const [rows, setRows] = useState<WorkingHourDTO[]>(buildDefaults());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!staffId) return;

    setRows(buildDefaults());

    startTransition(async () => {
      const saved = await getWorkingHours(staffId);
      if (saved.length === 0) return;

      setRows((defaults) =>
        defaults.map((def) => {
          const match = saved.find((s) => s.dayOfWeek === def.dayOfWeek);
          return match ?? def;
        })
      );
    });
  }, [staffId]);

  function updateRow(dayOfWeek: number, patch: Partial<WorkingHourDTO>) {
    setRows((current) =>
      current.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row))
    );
  }

  function handleSave() {
    if (!staffId) return;

    startTransition(async () => {
      const result = await setWorkingHours(
        staffId,
        rows.map(({ dayOfWeek, startTime, endTime, isActive }) => ({
          dayOfWeek,
          startTime,
          endTime,
          isActive,
        }))
      );

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Orari salvati.");
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Orari di lavoro — {staffName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {rows.map((row) => (
            <div key={row.dayOfWeek} className="flex items-center gap-3">
              <Switch
                checked={row.isActive}
                onCheckedChange={(checked) => updateRow(row.dayOfWeek, { isActive: checked })}
              />
              <Label className="w-24 shrink-0 text-sm">{DAY_LABELS[row.dayOfWeek]}</Label>
              <input
                type="time"
                value={row.startTime}
                disabled={!row.isActive}
                onChange={(e) => updateRow(row.dayOfWeek, { startTime: e.target.value })}
                className="h-8 rounded-md border px-2 text-sm disabled:opacity-40"
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="time"
                value={row.endTime}
                disabled={!row.isActive}
                onChange={(e) => updateRow(row.dayOfWeek, { endTime: e.target.value })}
                className="h-8 rounded-md border px-2 text-sm disabled:opacity-40"
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvataggio..." : "Salva orari"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
