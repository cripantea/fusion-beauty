"use client";

import { Cake, MapPin, MessageCircle, Pencil, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { ClientFormDialog } from "@/app/dashboard/clients/client-form-dialog";
import type { ClientDTO } from "@/app/dashboard/clients/actions";
import { formatEuro, getInitials, whatsappUrl } from "@/lib/format";

type ClientDetailHeaderProps = {
  client: ClientDTO;
  visits: number;
  totalSpent: number;
};

const birthdayFormatter = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" });

export function ClientDetailHeader({ client, visits, totalSpent }: ClientDetailHeaderProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  const birthday = client.dateOfBirth
    ? birthdayFormatter.format(new Date(`${client.dateOfBirth}T12:00:00`))
    : null;

  return (
    <section className="overflow-hidden rounded-2xl bg-forest text-forest-foreground shadow-md">
      <div className="flex flex-wrap items-start gap-4 p-5 sm:p-6">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-mint-soft text-xl font-bold text-forest ring-4 ring-mint/60">
          {getInitials(client.firstName, client.lastName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold leading-tight">
              {client.firstName} {client.lastName}
            </h1>
            {visits >= 5 ? (
              <Pill tone="forest" className="border-mint/50 bg-mint/15 text-mint">
                Cliente fedele
              </Pill>
            ) : visits === 0 ? (
              <Pill tone="forest" className="border-white/25 bg-white/10 text-white">
                Nuova cliente
              </Pill>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-forest-foreground/75">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-3.5" />
              {client.phone}
            </span>
            {client.city ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {client.city}
              </span>
            ) : null}
            {birthday ? (
              <span className="inline-flex items-center gap-1.5">
                <Cake className="size-3.5" />
                {birthday}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="h-9 rounded-xl bg-mint font-semibold text-forest hover:bg-mint/85"
            nativeButton={false}
            render={<a href={whatsappUrl(client.phone)} target="_blank" rel="noopener noreferrer" />}
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            className="h-9 rounded-xl border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={() => setDialogOpen(true)}
          >
            <Pencil className="size-3.5" />
            Modifica
          </Button>
        </div>
      </div>

      <div className="mx-5 mb-5 rounded-xl border border-white/10 bg-black/15 p-4 text-right sm:mx-6 sm:mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-forest-foreground/60">
          Totale speso nel centro
        </div>
        <div className="font-heading text-4xl font-bold">{formatEuro(totalSpent)}</div>
        <div className="text-xs text-forest-foreground/60">
          {visits} {visits === 1 ? "trattamento completato" : "trattamenti completati"}
        </div>
      </div>

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={client}
        onSuccess={() => router.refresh()}
      />
    </section>
  );
}
