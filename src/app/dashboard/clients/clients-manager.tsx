"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
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

import { getClients, type ClientListItemDTO, type ClientSegment } from "./actions";
import { ClientFormDialog } from "./client-form-dialog";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const segmentConfig = {
  vip: { label: "VIP", variant: "default" as const, className: "bg-amber-500 text-white hover:bg-amber-600" },
  new: { label: "Nuova", variant: "outline" as const, className: "border-blue-500 text-blue-700" },
  inactive: { label: "Inattiva", variant: "secondary" as const, className: "bg-red-50 text-red-700 border border-red-200" },
  active: { label: "Attiva", variant: "outline" as const, className: "border-green-500 text-green-700" },
};

const SEGMENTS: Array<{ value: ClientSegment; label: string }> = [
  { value: "all", label: "Tutte" },
  { value: "vip", label: "VIP" },
  { value: "new", label: "Nuove" },
  { value: "active", label: "Attive" },
  { value: "inactive", label: "Inattive" },
  { value: "no_future", label: "Senza futuro" },
];

type ClientsManagerProps = {
  initialClients: ClientListItemDTO[];
  initialSegment?: ClientSegment;
};

export function ClientsManager({ initialClients, initialSegment = "all" }: ClientsManagerProps) {
  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<ClientSegment>(initialSegment);
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientListItemDTO | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function refresh(nextSearch: string, nextSegment: ClientSegment) {
    startTransition(async () => {
      const results = await getClients({ search: nextSearch, segment: nextSegment });
      setClients(results);
    });
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => refresh(value, segment), 300);
  }

  function handleSegmentChange(value: ClientSegment) {
    setSegment(value);
    refresh(search, value);
  }

  function handleSaved() {
    refresh(search, segment);
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
          + Nuova cliente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Cerca per nome, cognome o telefono..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-1">
              {SEGMENTS.map((seg) => (
                <Button
                  key={seg.value}
                  variant={segment === seg.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSegmentChange(seg.value)}
                >
                  {seg.label}
                  {seg.value !== "all" && segment !== seg.value && (
                    <span className="ml-1 text-xs opacity-60">
                      {clients.filter((c) =>
                        seg.value === "inactive"
                          ? c.segment === "inactive"
                          : seg.value === "vip"
                          ? c.segment === "vip"
                          : seg.value === "new"
                          ? c.segment === "new"
                          : seg.value === "no_future"
                          ? !c.nextAppointment
                          : c.segment === "active"
                      ).length}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Visite</TableHead>
                <TableHead>Totale speso</TableHead>
                <TableHead>Ultima visita</TableHead>
                <TableHead>Prossimo appuntamento</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    {isPending ? "Caricamento..." : "Nessuna cliente trovata."}
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client) => {
                  const seg = segmentConfig[client.segment];
                  return (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        <Link href={`/dashboard/clients/${client.id}`} className="hover:underline">
                          {client.firstName} {client.lastName}
                        </Link>
                        {client.email && (
                          <div className="text-xs text-muted-foreground">{client.email}</div>
                        )}
                      </TableCell>
                      <TableCell>{client.phone}</TableCell>
                      <TableCell>
                        <Badge className={seg.className}>{seg.label}</Badge>
                      </TableCell>
                      <TableCell>{client.visitCount}</TableCell>
                      <TableCell>{currencyFormatter.format(client.totalSpent)}</TableCell>
                      <TableCell>
                        {client.lastAppointment
                          ? `${dateFormatter.format(client.lastAppointment.date)}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {client.nextAppointment ? (
                          <span className="text-sm text-blue-700">
                            {dateFormatter.format(client.nextAppointment.date)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
                  );
                })
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
