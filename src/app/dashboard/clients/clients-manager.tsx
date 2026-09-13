"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { getClients, type ClientListItemDTO } from "./actions";
import { ClientFormDialog } from "./client-form-dialog";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type ClientsManagerProps = {
  initialClients: ClientListItemDTO[];
};

export function ClientsManager({ initialClients }: ClientsManagerProps) {
  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientListItemDTO | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function refresh(nextSearch: string) {
    startTransition(async () => {
      const results = await getClients({ search: nextSearch });
      setClients(results);
    });
  }

  function handleSearchChange(value: string) {
    setSearch(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      refresh(value);
    }, 300);
  }

  function handleSaved() {
    refresh(search);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Anagrafica clienti</h1>
          <p className="text-muted-foreground">Gestisci i clienti del centro.</p>
        </div>
        <Button
          onClick={() => {
            setEditingClient(null);
            setDialogOpen(true);
          }}
        >
          Nuovo cliente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clienti</CardTitle>
          <div className="pt-2">
            <Input
              placeholder="Cerca per nome, cognome o telefono..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              className="sm:max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome e Cognome</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Ultimo trattamento</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {isPending ? "Caricamento..." : "Nessun cliente trovato."}
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="hover:underline"
                      >
                        {client.firstName} {client.lastName}
                      </Link>
                    </TableCell>
                    <TableCell>{client.phone}</TableCell>
                    <TableCell>{client.email ?? "-"}</TableCell>
                    <TableCell className="max-w-48 truncate" title={client.notes ?? undefined}>
                      {client.notes ?? "-"}
                    </TableCell>
                    <TableCell>
                      {client.lastAppointment
                        ? `${dateFormatter.format(client.lastAppointment.date)} — ${client.lastAppointment.serviceName}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          render={<Link href={`/dashboard/clients/${client.id}`} />}
                          nativeButton={false}
                        >
                          Scheda
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingClient(client);
                            setDialogOpen(true);
                          }}
                        >
                          Modifica
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={editingClient}
        onSuccess={handleSaved}
      />
    </div>
  );
}
