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

import { toggleUserStatus, type TenantOption, type UserDTO } from "./actions";
import { UserFormDialog } from "./user-form-dialog";

const roleLabels: Record<UserDTO["role"], string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Amministratore",
  OPERATOR: "Operatore",
};

const roleBadgeVariant: Record<UserDTO["role"], "default" | "secondary" | "outline"> = {
  SUPER_ADMIN: "default",
  ADMIN: "secondary",
  OPERATOR: "outline",
};

type UsersManagerProps = {
  initialUsers: UserDTO[];
  tenantOptions: TenantOption[];
  currentUserId: string;
};

export function UsersManager({ initialUsers, tenantOptions, currentUserId }: UsersManagerProps) {
  const [users, setUsers] = useState(initialUsers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function openCreateDialog() {
    setEditingUser(null);
    setDialogOpen(true);
  }

  function openEditDialog(user: UserDTO) {
    setEditingUser(user);
    setDialogOpen(true);
  }

  function upsertUser(user: UserDTO) {
    setUsers((current) => {
      const exists = current.some((item) => item.id === user.id);
      return exists
        ? current.map((item) => (item.id === user.id ? user : item))
        : [user, ...current];
    });
  }

  function handleToggle(user: UserDTO) {
    setPendingToggleId(user.id);
    startTransition(async () => {
      const result = await toggleUserStatus(user.id, !user.isActive);
      setPendingToggleId(null);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(result.user.isActive ? "Utente riattivato." : "Utente disattivato.");
      upsertUser(result.user);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Utenti</h1>
          <p className="text-muted-foreground">
            Gestisci gli account di tutti i centri e dello staff super admin.
          </p>
        </div>
        <Button onClick={openCreateDialog}>Nuovo utente</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utenti ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.firstName} {user.lastName}
                    {user.id === currentUserId ? (
                      <span className="ml-2 text-xs text-muted-foreground">(tu)</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant[user.role]}>{roleLabels[user.role]}</Badge>
                  </TableCell>
                  <TableCell>{user.tenantName ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "outline"}>
                      {user.isActive ? "Attivo" : "Disattivato"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                      Modifica
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingToggleId === user.id || user.id === currentUserId}
                      onClick={() => handleToggle(user)}
                    >
                      {user.isActive ? "Disattiva" : "Riattiva"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nessun utente trovato.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editingUser}
        tenantOptions={tenantOptions}
        onSuccess={upsertUser}
      />
    </div>
  );
}
