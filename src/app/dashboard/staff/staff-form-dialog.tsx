"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createStaffMember, updateStaffMember, type StaffDTO } from "./actions";
import { staffFormDefaultValues, staffFormSchema, type StaffFormValues } from "./schema";

const roleLabels: Record<StaffFormValues["role"], string> = {
  ADMIN: "Amministratore",
  OPERATOR: "Operatore",
};

type StaffFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: StaffDTO | null;
  onSuccess: (staff: StaffDTO) => void;
};

export function StaffFormDialog({ open, onOpenChange, staff, onSuccess }: StaffFormDialogProps) {
  const isEditing = Boolean(staff);
  const [isPending, startTransition] = useTransition();

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: staffFormDefaultValues,
  });

  useEffect(() => {
    if (!open) return;

    form.reset(
      staff
        ? {
            email: staff.email,
            firstName: staff.firstName,
            lastName: staff.lastName,
            role: staff.role,
            password: "",
          }
        : staffFormDefaultValues
    );
  }, [open, staff, form]);

  function onSubmit(values: StaffFormValues) {
    if (!isEditing && !values.password) {
      form.setError("password", {
        message: "La password è obbligatoria per un nuovo membro dello staff.",
      });
      return;
    }

    startTransition(async () => {
      const result =
        isEditing && staff
          ? await updateStaffMember(staff.id, values)
          : await createStaffMember(values);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(isEditing ? "Membro dello staff aggiornato." : "Membro dello staff creato.");
      onSuccess(result.staff);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifica membro staff" : "Nuovo membro staff"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Aggiorna ruolo o password."
              : "Crea un account operatore o amministratore per il tuo centro."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Giulia" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cognome</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Bianchi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="nome@centro.it" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ruolo</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string) => roleLabels[value as StaffFormValues["role"]]}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isEditing ? "Nuova password (opzionale)" : "Password iniziale"}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder={isEditing ? "Lascia vuoto per non modificarla" : undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvataggio..." : isEditing ? "Salva modifiche" : "Crea membro staff"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
