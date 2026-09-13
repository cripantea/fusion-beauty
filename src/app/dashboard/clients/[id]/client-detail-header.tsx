"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ClientFormDialog } from "@/app/dashboard/clients/client-form-dialog";
import type { ClientDTO } from "@/app/dashboard/clients/actions";

type ClientDetailHeaderProps = {
  client: ClientDTO;
};

export function ClientDetailHeader({ client }: ClientDetailHeaderProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  const whatsappHref = `https://wa.me/${client.phone.replace(/[^\d]/g, "")}`;

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">
          {client.firstName} {client.lastName}
        </h1>
        <p className="text-muted-foreground">Scheda cliente</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
        >
          WhatsApp
        </Button>
        <Button onClick={() => setDialogOpen(true)}>Modifica anagrafica</Button>
      </div>

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={client}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
