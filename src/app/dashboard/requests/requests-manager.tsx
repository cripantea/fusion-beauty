"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  confirmBookingRequest,
  getBookingRequests,
  rejectBookingRequest,
  type BookingRequestDTO,
} from "./actions";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const statusConfig = {
  PENDING: { label: "In attesa", variant: "secondary" as const },
  CONFIRMED: { label: "Confermata", variant: "default" as const },
  REJECTED: { label: "Rifiutata", variant: "destructive" as const },
};

type RequestsManagerProps = {
  initialRequests: BookingRequestDTO[];
};

export function RequestsManager({ initialRequests }: RequestsManagerProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "PENDING" | "CONFIRMED" | "REJECTED">("PENDING");

  function refresh(status?: "PENDING" | "CONFIRMED" | "REJECTED") {
    startTransition(async () => {
      const result = await getBookingRequests(status);
      setRequests(result);
    });
  }

  function handleFilterChange(value: typeof filter) {
    setFilter(value);
    refresh(value === "all" ? undefined : value);
  }

  function handleConfirm(req: BookingRequestDTO) {
    startTransition(async () => {
      const result = await confirmBookingRequest(req.id, null);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Richiesta di ${req.firstName} ${req.lastName} confermata — appuntamento creato.`);
      refresh(filter === "all" ? undefined : filter);
    });
  }

  function handleReject(req: BookingRequestDTO) {
    startTransition(async () => {
      const result = await rejectBookingRequest(req.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Richiesta rifiutata.");
      refresh(filter === "all" ? undefined : filter);
    });
  }

  const pendingCount = initialRequests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Richieste di prenotazione</h1>
        <p className="text-muted-foreground">Gestisci le richieste arrivate dal sito.</p>
      </div>

      {pendingCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <strong>{pendingCount} richieste in attesa</strong> di conferma.
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex gap-1">
            {(["PENDING", "CONFIRMED", "REJECTED", "all"] as const).map((s) => (
              <Button
                key={s}
                variant={filter === s ? "default" : "outline"}
                size="sm"
                onClick={() => handleFilterChange(s)}
              >
                {s === "all" ? "Tutte" : statusConfig[s].label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Trattamento</TableHead>
                <TableHead>Data preferita</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Ricevuta</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {isPending ? "Caricamento..." : "Nessuna richiesta."}
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div className="font-medium">{req.firstName} {req.lastName}</div>
                      <div className="text-xs text-muted-foreground">{req.phone}</div>
                      {req.email && <div className="text-xs text-muted-foreground">{req.email}</div>}
                    </TableCell>
                    <TableCell>
                      {req.service ? (
                        <div>
                          <div>{req.service.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {req.service.durationMinutes} min — {currencyFormatter.format(req.service.price)}
                          </div>
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {req.preferredDate ? (
                        <div>
                          <div>{new Date(req.preferredDate).toLocaleDateString("it-IT")}</div>
                          {req.preferredTime && (
                            <div className="text-xs text-muted-foreground">ore {req.preferredTime}</div>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="max-w-48">
                      <span className="text-sm text-muted-foreground line-clamp-2">
                        {req.notes ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[req.status].variant}>
                        {statusConfig[req.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dateFormatter.format(req.createdAt)}
                    </TableCell>
                    <TableCell>
                      {req.status === "PENDING" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleConfirm(req)}
                            disabled={isPending}
                          >
                            Conferma
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(req)}
                            disabled={isPending}
                          >
                            Rifiuta
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
