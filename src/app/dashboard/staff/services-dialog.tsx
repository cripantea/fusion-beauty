"use client";

import { useEffect, useState, useTransition } from "react";
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

import {
  getOperatorServices,
  setOperatorExcludedServices,
  type OperatorServicesDTO,
} from "./services-actions";

type ServicesDialogProps = {
  staffId: string | null;
  staffName: string;
  onClose: () => void;
};

/** Trattamenti eseguiti dall'operatrice: quelli non spuntati non saranno prenotabili con lei. */
export function ServicesDialog({ staffId, staffName, onClose }: ServicesDialogProps) {
  const [data, setData] = useState<OperatorServicesDTO | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!staffId) return;
    let cancelled = false;
    getOperatorServices(staffId).then((result) => {
      if (cancelled) return;
      setData(result);
      setExcluded(new Set(result.excludedServiceIds));
    });
    return () => {
      cancelled = true;
      setData(null);
    };
  }, [staffId]);

  function toggle(serviceId: string) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }

  function save() {
    if (!staffId) return;
    startTransition(async () => {
      const result = await setOperatorExcludedServices(staffId, [...excluded]);
      if (!result.success) {
        toast.error(result.error ?? "Errore nel salvataggio.");
        return;
      }
      toast.success("Trattamenti aggiornati.");
      onClose();
    });
  }

  const enabledCount = data ? data.services.length - excluded.size : 0;

  return (
    <Dialog open={Boolean(staffId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Trattamenti · {staffName}</DialogTitle>
          <DialogDescription>
            Togli la spunta ai trattamenti che non esegue: non sarà proponibile per quegli appuntamenti.
          </DialogDescription>
        </DialogHeader>

        {data ? (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {enabledCount} di {data.services.length} trattamenti
              </span>
              <span className="space-x-3">
                <button type="button" className="underline" onClick={() => setExcluded(new Set())}>
                  Tutti
                </button>
                <button
                  type="button"
                  className="underline"
                  onClick={() => setExcluded(new Set(data.services.map((service) => service.id)))}
                >
                  Nessuno
                </button>
              </span>
            </div>
            <div className="divide-y rounded-xl border">
              {data.services.map((service) => (
                <label
                  key={service.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-mint-soft/40"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-forest"
                    checked={!excluded.has(service.id)}
                    onChange={() => toggle(service.id)}
                  />
                  {service.name}
                </label>
              ))}
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Caricamento…</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={save} disabled={!data || isPending}>
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
