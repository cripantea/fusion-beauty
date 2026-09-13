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

import { toggleStaffStatus, type StaffDTO } from "./actions";
import { StaffFormDialog } from "./staff-form-dialog";

const roleLabels: Record<StaffDTO["role"], string> = {
  ADMIN: "Amministratore",
  OPERATOR: "Operatore",
};

type StaffManagerProps = {
  initialStaff: StaffDTO[];
  currentUserId: string;
};

export function StaffManager({ initialStaff, currentUserId }: StaffManagerProps) {
  const [staff, setStaff] = useState(initialStaff);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffDTO | null>(null);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function openCreateDialog() {
    setEditingStaff(null);
    setDialogOpen(true);
  }

  function openEditDialog(member: StaffDTO) {
    setEditingStaff(member);
    setDialogOpen(true);
  }

  function upsertStaff(member: StaffDTO) {
    setStaff((current) => {
      const exists = current.some((item) => item.id === member.id);
      return exists
        ? current.map((item) => (item.id === member.id ? member : item))
        : [member, ...current];
    });
  }

  function handleToggle(member: StaffDTO) {
    setPendingToggleId(member.id);
    startTransition(async () => {
      const result = await toggleStaffStatus(member.id, !member.isActive);
      setPendingToggleId(null);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(result.staff.isActive ? "Utente riattivato." : "Utente disattivato.");
      upsertStaff(result.staff);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Staff</h1>
          <p className="text-muted-foreground">
            Gestisci gli account di amministratori e operatori del tuo centro.
          </p>
        </div>
        <Button onClick={openCreateDialog}>Nuovo membro staff</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff ({staff.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.firstName} {member.lastName}
                    {member.id === currentUserId ? (
                      <span className="ml-2 text-xs text-muted-foreground">(tu)</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Badge variant={member.role === "ADMIN" ? "secondary" : "outline"}>
                      {roleLabels[member.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.isActive ? "default" : "outline"}>
                      {member.isActive ? "Attivo" : "Disattivato"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(member)}>
                      Modifica
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingToggleId === member.id || member.id === currentUserId}
                      onClick={() => handleToggle(member)}
                    >
                      {member.isActive ? "Disattiva" : "Riattiva"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nessun membro dello staff trovato.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <StaffFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        staff={editingStaff}
        onSuccess={upsertStaff}
      />
    </div>
  );
}
