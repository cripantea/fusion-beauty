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

import { toggleTenantStatus, type TenantDTO } from "./actions";
import { TenantFormDialog } from "./tenant-form-dialog";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type TenantsManagerProps = {
  initialTenants: TenantDTO[];
};

export function TenantsManager({ initialTenants }: TenantsManagerProps) {
  const [tenants, setTenants] = useState(initialTenants);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(tenant: TenantDTO) {
    setPendingToggleId(tenant.id);
    startTransition(async () => {
      const result = await toggleTenantStatus(tenant.id, !tenant.isActive);
      setPendingToggleId(null);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.tenant.isActive ? "Centro riattivato." : "Centro sospeso."
      );
      setTenants((current) =>
        current.map((item) => (item.id === tenant.id ? result.tenant : item))
      );
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Centri estetici</h1>
          <p className="text-muted-foreground">
            Gestisci i centri registrati sulla piattaforma.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>Nuovo centro</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Centri ({tenants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Creato il</TableHead>
                <TableHead>Utenti</TableHead>
                <TableHead>Clienti</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {isPending ? "Caricamento..." : "Nessun centro registrato."}
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>{tenant.slug}</TableCell>
                    <TableCell>{tenant.email ?? "-"}</TableCell>
                    <TableCell>{tenant.phone ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={tenant.isActive ? "default" : "secondary"}>
                        {tenant.isActive ? "Attivo" : "Sospeso"}
                      </Badge>
                    </TableCell>
                    <TableCell>{dateFormatter.format(tenant.createdAt)}</TableCell>
                    <TableCell>{tenant.userCount}</TableCell>
                    <TableCell>{tenant.clientCount}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingToggleId === tenant.id}
                        onClick={() => handleToggle(tenant)}
                      >
                        {tenant.isActive ? "Sospendi" : "Riattiva"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TenantFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={(tenant) => setTenants((current) => [tenant, ...current])}
      />
    </div>
  );
}
