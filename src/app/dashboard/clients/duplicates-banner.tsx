"use client";

import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { mergeDuplicateGroup, type DuplicateGroupDTO } from "./duplicate-actions";

const dateFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", year: "numeric" });

/** Stesso numero su più schede: si uniscono con un tocco nella prima (che tiene il suo nome). */
export function DuplicatesBanner({ groups }: { groups: DuplicateGroupDTO[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(groups);
  const [isPending, startTransition] = useTransition();

  if (left.length === 0) return null;

  function merge(phone: string) {
    startTransition(async () => {
      const result = await mergeDuplicateGroup(phone);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Schede unite.");
      const next = left.filter((g) => g.phone !== phone);
      setLeft(next);
      if (next.length === 0) setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <Users className="size-4 shrink-0" />
        <span className="flex-1">
          {left.length === 1 ? "C'è 1 cliente doppia" : `Ci sono ${left.length} clienti doppie`} (stesso numero di telefono).
        </span>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Controlla e unisci
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Clienti doppie</DialogTitle>
            <DialogDescription>
              Unendo, resta la prima scheda con il suo nome: appuntamenti, pagamenti, consensi e messaggi delle altre passano a lei.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {left.map((group) => (
              <div key={group.phone} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-1">
                    <p>
                      <span className="font-semibold">{group.keep.name || "Senza nome"}</span>{" "}
                      <span className="text-xs text-muted-foreground">resta · dal {dateFormatter.format(new Date(group.keep.createdAt))}</span>
                    </p>
                    {group.others.map((other) => (
                      <p key={other.id} className="text-muted-foreground line-through decoration-muted-foreground/40">
                        {other.name || "Senza nome"} <span className="text-xs">· dal {dateFormatter.format(new Date(other.createdAt))}</span>
                      </p>
                    ))}
                    <p className="font-mono text-xs text-muted-foreground">+{group.phone}</p>
                  </div>
                  <Button size="sm" disabled={isPending} onClick={() => merge(group.phone)}>
                    Unisci
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
