"use client";

import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/boutique";
import { Switch } from "@/components/ui/switch";

import { setGoogleReviewLeft } from "../actions";

const dateFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long", year: "numeric" });

/** "Ha già lasciato la recensione su Google": le automazioni non gliela chiedono più. */
export function GoogleReviewCard({ clientId, googleReviewAt }: { clientId: string; googleReviewAt: Date | null }) {
  const [markedAt, setMarkedAt] = useState(googleReviewAt);
  const [isPending, startTransition] = useTransition();

  function toggle(left: boolean) {
    startTransition(async () => {
      const result = await setGoogleReviewLeft(clientId, left);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setMarkedAt(result.googleReviewAt);
      toast.success(left ? "Segnata: non riceverà più richieste di recensione." : "Tolta: potrà ricevere di nuovo la richiesta di recensione.");
    });
  }

  return (
    <Panel title="Recensione Google" icon={Star}>
      <label className="flex cursor-pointer items-start justify-between gap-4 p-5 text-sm">
        <span>
          <span className="block font-semibold">Ha già lasciato la recensione</span>
          <span className="mt-0.5 block text-muted-foreground">
            {markedAt
              ? `Segnata il ${dateFormatter.format(markedAt)}: le richieste di recensione automatiche non partono.`
              : "Spunta quando la lascia (ad esempio quando manda lo screenshot): non le arriveranno più richieste di recensione."}
          </span>
        </span>
        <Switch checked={Boolean(markedAt)} disabled={isPending} onCheckedChange={toggle} />
      </label>
    </Panel>
  );
}
