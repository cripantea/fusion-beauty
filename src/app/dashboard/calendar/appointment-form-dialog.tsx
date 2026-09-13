"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { ClientListItemDTO } from "@/app/dashboard/clients/actions";
import type { ServiceDTO } from "@/app/dashboard/services/actions";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
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
import { Textarea } from "@/components/ui/textarea";

import { createAppointment, updateAppointment, type AppointmentDTO, type OperatorDTO } from "./actions";
import {
  appointmentFormDefaultValues,
  appointmentFormSchema,
  NO_OPERATOR_VALUE,
  type AppointmentFormInput,
  type AppointmentFormValues,
} from "./schema";

type ClientOption = { value: string; label: string };

type AppointmentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: AppointmentDTO | null;
  clients: ClientListItemDTO[];
  services: ServiceDTO[];
  operators: OperatorDTO[];
  defaultDate?: Date;
  onSuccess: (appointment: AppointmentDTO) => void;
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  appointment,
  clients,
  services,
  operators,
  defaultDate,
  onSuccess,
}: AppointmentFormDialogProps) {
  const isEditing = Boolean(appointment);
  const [isPending, startTransition] = useTransition();

  const form = useForm<AppointmentFormInput, unknown, AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: appointmentFormDefaultValues,
  });

  const clientOptions = useMemo<ClientOption[]>(
    () =>
      clients.map((client) => ({
        value: client.id,
        label: `${client.firstName} ${client.lastName} — ${client.phone}`,
      })),
    [clients]
  );

  const serviceLabels = useMemo(
    () =>
      Object.fromEntries(
        services.map((service) => [service.id, `${service.name} (${service.durationMinutes} min)`])
      ) as Record<string, string>,
    [services]
  );

  const operatorLabels = useMemo(
    () =>
      Object.fromEntries(
        operators.map((operator) => [operator.id, `${operator.firstName} ${operator.lastName}`])
      ) as Record<string, string>,
    [operators]
  );

  useEffect(() => {
    if (!open) return;

    if (appointment) {
      form.reset({
        clientId: appointment.client.id,
        serviceId: appointment.service.id,
        operatorId: appointment.operator?.id ?? NO_OPERATOR_VALUE,
        date: toDateInputValue(appointment.startTime),
        time: toTimeInputValue(appointment.startTime),
        durationMinutes: Math.round(
          (appointment.endTime.getTime() - appointment.startTime.getTime()) / 60000
        ),
        notes: appointment.notes ?? "",
      });
    } else {
      const base = defaultDate ?? new Date();
      form.reset({
        ...appointmentFormDefaultValues,
        date: toDateInputValue(base),
      });
    }
  }, [open, appointment, defaultDate, form]);

  function onSubmit(values: AppointmentFormValues) {
    startTransition(async () => {
      const startTime = new Date(`${values.date}T${values.time}:00`);

      if (Number.isNaN(startTime.getTime())) {
        toast.error("Data o ora non valide.");
        return;
      }

      const payload = {
        clientId: values.clientId,
        serviceId: values.serviceId,
        operatorId: values.operatorId === NO_OPERATOR_VALUE ? null : values.operatorId,
        startTime,
        durationMinutes: values.durationMinutes,
        notes: values.notes,
      };

      const result =
        isEditing && appointment
          ? await updateAppointment(appointment.id, payload)
          : await createAppointment(payload);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(isEditing ? "Appuntamento aggiornato." : "Appuntamento creato.");
      onSuccess(result.appointment);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifica appuntamento" : "Nuovo appuntamento"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Aggiorna i dati dell'appuntamento."
              : "Pianifica un nuovo appuntamento per il centro."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Combobox
                    items={clientOptions}
                    value={clientOptions.find((option) => option.value === field.value) ?? null}
                    onValueChange={(option: ClientOption | null) =>
                      field.onChange(option?.value ?? "")
                    }
                    isItemEqualToValue={(itemValue: ClientOption, value: ClientOption) =>
                      itemValue.value === value.value
                    }
                  >
                    <FormControl>
                      <ComboboxInput placeholder="Cerca cliente per nome o telefono..." />
                    </FormControl>
                    <ComboboxContent>
                      <ComboboxEmpty>Nessun cliente trovato.</ComboboxEmpty>
                      <ComboboxList>
                        {(item: ClientOption) => (
                          <ComboboxItem key={item.value} value={item}>
                            {item.label}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trattamento</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      const service = services.find((item) => item.id === value);
                      if (service) {
                        form.setValue("durationMinutes", service.durationMinutes);
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string | undefined) =>
                            value ? serviceLabels[value] : "Seleziona un trattamento"
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} ({service.durationMinutes} min)
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
              name="operatorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operatore</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string) =>
                            value === NO_OPERATOR_VALUE
                              ? "Nessun operatore"
                              : operatorLabels[value]
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_OPERATOR_VALUE}>Nessun operatore</SelectItem>
                      {operators.map((operator) => (
                        <SelectItem key={operator.id} value={operator.id}>
                          {operator.firstName} {operator.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ora inizio</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="durationMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Durata (minuti)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      {...field}
                      value={field.value as number | string}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Note facoltative" {...field} />
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
                {isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
