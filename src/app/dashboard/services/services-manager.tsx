"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  getServices,
  toggleServiceStatus,
  type ServiceDTO,
  type ServiceStatusFilter,
} from "./actions";
import { ServiceFormDialog } from "./service-form-dialog";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const statusFilterLabels: Record<ServiceStatusFilter, string> = {
  all: "Tutti",
  active: "Attivi",
  inactive: "Inattivi",
};

type ServicesManagerProps = {
  initialServices: ServiceDTO[];
};

export function ServicesManager({ initialServices }: ServicesManagerProps) {
  const [services, setServices] = useState(initialServices);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ServiceStatusFilter>("all");
  const [isPending, startTransition] = useTransition();
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceDTO | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function refresh(nextSearch: string, nextStatus: ServiceStatusFilter) {
    startTransition(async () => {
      const results = await getServices({ search: nextSearch, status: nextStatus });
      setServices(results);
    });
  }

  function handleSearchChange(value: string) {
    setSearch(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      refresh(value, status);
    }, 300);
  }

  function handleStatusChange(value: ServiceStatusFilter) {
    setStatus(value);
    refresh(search, value);
  }

  function handleToggle(service: ServiceDTO, nextActive: boolean) {
    setPendingToggleId(service.id);
    startTransition(async () => {
      const result = await toggleServiceStatus(service.id, nextActive);
      setPendingToggleId(null);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(nextActive ? "Trattamento attivato." : "Trattamento disattivato.");
      setServices((current) =>
        current.map((item) => (item.id === service.id ? result.service : item))
      );
    });
  }

  function handleSaved() {
    refresh(search, status);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Catalogo trattamenti</h1>
          <p className="text-muted-foreground">
            Gestisci i trattamenti offerti dal centro.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingService(null);
            setDialogOpen(true);
          }}
        >
          Nuovo trattamento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trattamenti</CardTitle>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            <Input
              placeholder="Cerca per nome..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              className="sm:max-w-xs"
            />
            <Select
              value={status}
              onValueChange={(value) => handleStatusChange(value as ServiceStatusFilter)}
            >
              <SelectTrigger className="sm:w-40">
                <SelectValue>
                  {(value: ServiceStatusFilter) => statusFilterLabels[value]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="active">Attivi</SelectItem>
                <SelectItem value="inactive">Inattivi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Prezzo</TableHead>
                <TableHead>Durata</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Visibilità online</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {isPending ? "Caricamento..." : "Nessun trattamento trovato."}
                  </TableCell>
                </TableRow>
              ) : (
                services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell>{currencyFormatter.format(service.price)}</TableCell>
                    <TableCell>{service.durationMinutes} min</TableCell>
                    <TableCell>
                      <Badge variant={service.isActive ? "default" : "secondary"}>
                        {service.isActive ? "Attivo" : "Inattivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>{service.isOnlineBookingEnabled ? "Sì" : "No"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-3">
                        <Switch
                          checked={service.isActive}
                          onCheckedChange={(checked) => handleToggle(service, checked)}
                          disabled={pendingToggleId === service.id}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingService(service);
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

      <ServiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        service={editingService}
        onSuccess={handleSaved}
      />
    </div>
  );
}
