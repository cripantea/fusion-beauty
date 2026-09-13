"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
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

import { createTenant, type TenantDTO } from "./actions";
import {
  createTenantDefaultValues,
  createTenantSchema,
  type CreateTenantFormValues,
} from "./schema";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type TenantFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (tenant: TenantDTO) => void;
};

export function TenantFormDialog({ open, onOpenChange, onSuccess }: TenantFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [slugTouched, setSlugTouched] = useState(false);

  const form = useForm<CreateTenantFormValues>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: createTenantDefaultValues,
  });

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      form.reset(createTenantDefaultValues);
      setSlugTouched(false);
    }
    onOpenChange(nextOpen);
  }

  function onSubmit(values: CreateTenantFormValues) {
    startTransition(async () => {
      const result = await createTenant(values);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success("Centro creato con successo.");
      onSuccess(result.tenant);
      handleOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuovo centro</DialogTitle>
          <DialogDescription>
            Crea un nuovo centro estetico e il suo amministratore iniziale.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="tenantName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome del centro</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Es. Centro Estetico Bellavista"
                      {...field}
                      onChange={(event) => {
                        field.onChange(event);
                        if (!slugTouched) {
                          form.setValue("tenantSlug", slugify(event.target.value));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tenantSlug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="centro-estetico-bellavista"
                      {...field}
                      onChange={(event) => {
                        setSlugTouched(true);
                        field.onChange(event);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="adminFirstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome amministratore</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Anna" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adminLastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cognome amministratore</FormLabel>
                    <FormControl>
                      <Input placeholder="Es. Rossi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="adminEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email amministratore</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="admin@centro.it" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="adminPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password iniziale</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creazione..." : "Crea centro"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
