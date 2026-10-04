"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import type { ClientDTO, ClientListItemDTO } from "@/app/dashboard/clients/actions";
import { toNewClientListItem } from "@/app/dashboard/clients/list-item";
import { QuickClientDialog } from "@/app/dashboard/clients/quick-client-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { formatEuro } from "@/lib/format";
import { cn } from "@/lib/utils";

import { createAppointment, updateAppointment, type AppointmentDTO, type OperatorDTO } from "./actions";
import {
  appointmentFormDefaultValues,
  appointmentFormSchema,
  NO_OPERATOR_VALUE,
  type AppointmentFormInput,
  type AppointmentFormValues,
} from "./schema";

type ClientOption = { value: string; label: string };

function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-forest bg-forest text-forest-foreground"
          : "border-mint-border bg-card hover:bg-mint-soft",
        className
      )}
    >
      {children}
    </button>
  );
}

function addDaysToInput(base: Date, days: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

type AppointmentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: AppointmentDTO | null;
  clients: ClientListItemDTO[];
  services: ServiceDTO[];
  operators: OperatorDTO[];
  defaultDate?: Date;
  defaultOperatorId?: string;
  onSuccess: (appointment: AppointmentDTO) => void;
  /** Una cliente creata al volo dal dialog, da aggiungere all'elenco di chi lo ospita. */
  onClientCreated?: (client: ClientListItemDTO) => void;
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
  defaultOperatorId,
  onSuccess,
  onClientCreated,
}: AppointmentFormDialogProps) {
  const isEditing = Boolean(appointment);
  const [isPending, startTransition] = useTransition();
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [createdClients, setCreatedClients] = useState<ClientListItemDTO[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);

  const form = useForm<AppointmentFormInput, unknown, AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: appointmentFormDefaultValues,
  });

  const allClients = useMemo(() => {
    const known = new Set(clients.map((client) => client.id));
    return [...clients, ...createdClients.filter((client) => !known.has(client.id))];
  }, [clients, createdClients]);

  function handleClientCreated(client: ClientDTO) {
    const item = toNewClientListItem(client);
    setCreatedClients((current) => [...current, item]);
    form.setValue("clientId", client.id, { shouldValidate: true });
    onClientCreated?.(item);
  }

  const dateValue = useWatch({ control: form.control, name: "date" });
  const notesValue = useWatch({ control: form.control, name: "notes" });
  const showNotes = notesOpen || Boolean(notesValue);

  const clientOptions = useMemo<ClientOption[]>(
    () =>
      allClients.map((client) => ({
        value: client.id,
        label: `${client.firstName} ${client.lastName} — ${client.phone}`,
      })),
    [allClients]
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
        operatorId: defaultOperatorId ?? NO_OPERATOR_VALUE,
      });
    }
  }, [open, appointment, defaultDate, defaultOperatorId, form]);

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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isEditing ? "Modifica appuntamento" : "Nuovo appuntamento"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Aggiorna i dati dell'appuntamento."
              : "Scegli la cliente, il trattamento e l'orario: il resto è automatico."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Cliente</FormLabel>
                    <button
                      type="button"
                      onClick={() => setQuickClientOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-mint-ink hover:underline"
                    >
                      <Plus className="size-3.5" />
                      Nuova cliente
                    </button>
                  </div>
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
                      <ComboboxInput
                        className="h-10"
                        placeholder="Cerca per nome o telefono..."
                      />
                    </FormControl>
                    <ComboboxContent>
                      <ComboboxEmpty>
                        Nessuna cliente trovata. Usa “Nuova cliente” qui sopra.
                      </ComboboxEmpty>
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
                  <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                    {services.map((service) => {
                      const active = field.value === service.id;
                      return (
                        <button
                          key={service.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            field.onChange(service.id);
                            form.setValue("durationMinutes", service.durationMinutes);
                          }}
                          className={cn(
                            "rounded-xl border p-3 text-left transition-colors",
                            active
                              ? "border-forest bg-forest text-forest-foreground"
                              : "border-mint-border bg-card hover:bg-mint-soft"
                          )}
                        >
                          <div className="text-sm font-semibold leading-tight">{service.name}</div>
                          <div
                            className={cn(
                              "mt-0.5 text-xs",
                              active ? "text-forest-foreground/75" : "text-muted-foreground"
                            )}
                          >
                            {service.durationMinutes} min · {formatEuro(Number(service.price))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Quando</FormLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Chip
                  active={dateValue === addDaysToInput(new Date(), 0)}
                  onClick={() => form.setValue("date", addDaysToInput(new Date(), 0))}
                >
                  Oggi
                </Chip>
                <Chip
                  active={dateValue === addDaysToInput(new Date(), 1)}
                  onClick={() => form.setValue("date", addDaysToInput(new Date(), 1))}
                >
                  Domani
                </Chip>
              </div>
              <div className="grid grid-cols-[1fr_8rem] gap-3">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input type="date" className="h-10" {...field} />
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
                      <FormControl>
                        <Input type="time" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {operators.length > 0 ? (
              <FormField
                control={form.control}
                name="operatorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operatrice</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      <Chip
                        active={field.value === NO_OPERATOR_VALUE}
                        onClick={() => field.onChange(NO_OPERATOR_VALUE)}
                      >
                        Qualsiasi
                      </Chip>
                      {operators.map((operator) => (
                        <Chip
                          key={operator.id}
                          active={field.value === operator.id}
                          onClick={() => field.onChange(operator.id)}
                        >
                          {operator.firstName}
                        </Chip>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="flex flex-wrap items-end gap-4">
              <FormField
                control={form.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem className="w-32">
                    <FormLabel>Durata (min)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        className="h-10"
                        {...field}
                        value={field.value as number | string}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {showNotes ? null : (
                <button
                  type="button"
                  onClick={() => setNotesOpen(true)}
                  className="pb-2 text-sm font-semibold text-mint-ink hover:underline"
                >
                  + Aggiungi nota
                </button>
              )}
            </div>

            {showNotes ? (
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
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
                Annulla
              </Button>
              <Button type="submit" className="h-10 px-6" disabled={isPending}>
                {isPending ? "Salvataggio..." : "Salva appuntamento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>

        <QuickClientDialog
          open={quickClientOpen}
          onOpenChange={setQuickClientOpen}
          onCreated={handleClientCreated}
        />
      </DialogContent>
    </Dialog>
  );
}
