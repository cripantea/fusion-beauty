"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { DateField, TimeField } from "@/components/ui/date-field";
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

/** Nome o telefono, comunque sia scritto il numero ("333 000…", "+39333…", "333000…"). */
function matchesClient(item: ClientOption, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (item.label.toLowerCase().includes(q)) return true;
  const digits = q.replace(/\D/g, "");
  return digits.length >= 3 && item.label.replace(/\D/g, "").includes(digits);
}

export function Chip({
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
  /** Orario già scelto (tocco sulla griglia), "HH:mm". */
  defaultTime?: string;
  /** "Sposta": si apre col cursore su data e ora. */
  focusWhen?: boolean;
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
  defaultTime,
  focusWhen,
  onSuccess,
  onClientCreated,
}: AppointmentFormDialogProps) {
  const isEditing = Boolean(appointment);
  const [isPending, startTransition] = useTransition();
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [createdClients, setCreatedClients] = useState<ClientListItemDTO[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  // Orario accavallato: si mostra l'avviso con "Salva comunque".
  const [clash, setClash] = useState<string | null>(null);
  // Modifica di cliente, trattamento, operatrice o orario: prima si mostra cosa cambia e si conferma.
  const [pendingChange, setPendingChange] = useState<{ values: AppointmentFormValues; lines: string[]; notifies: boolean } | null>(null);
  // Operatrice scelta per ultima (o colonna toccata in agenda): la prendono i trattamenti aggiunti dopo.
  const [preferredOperatorId, setPreferredOperatorId] = useState(NO_OPERATOR_VALUE);
  const whenRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

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
  const itemsValue = useWatch({ control: form.control, name: "items" });
  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const operatorsFor = (serviceId: string) => operators.filter((operator) => !operator.excludedServiceIds.includes(serviceId));

  const rows = useMemo(
    () => itemsValue.map((item) => ({ ...item, name: serviceById.get(item.serviceId)?.name ?? "Trattamento" })),
    [itemsValue, serviceById]
  );
  // Più trattamenti: ognuno ha il suo orario, scelto a mano (lo vede solo il centro, in agenda).
  const multi = rows.length > 1;

  function setItems(next: AppointmentFormInput["items"]) {
    form.setValue("items", next, { shouldValidate: form.formState.isSubmitted, shouldDirty: true });
    form.clearErrors("items");
    // L'orario dell'appuntamento (quello che legge la cliente) è il primo degli orari dei trattamenti.
    if (next.length > 1) {
      const times = next.map((item) => item.time).filter(Boolean).sort();
      form.setValue("time", times[0] ?? "");
    }
  }

  /**
   * Aggiunge o toglie un trattamento: quello nuovo prende l'operatrice già scelta, se lo
   * esegue. Il suo orario non si mette da solo (né prima né dopo gli altri): lo sceglie il centro.
   */
  function toggleService(serviceId: string) {
    const current = form.getValues("items");
    const active = current.some((item) => item.serviceId === serviceId);
    let next: AppointmentFormInput["items"];
    if (active) {
      next = current.filter((item) => item.serviceId !== serviceId);
      // Ne resta uno solo: il suo orario è quello dell'appuntamento.
      if (next.length === 1 && current.length > 1 && next[0].time) form.setValue("time", next[0].time);
    } else {
      const able = operatorsFor(serviceId);
      const operatorId = able.some((operator) => operator.id === preferredOperatorId)
        ? preferredOperatorId
        : able.length === 1
          ? able[0].id
          : NO_OPERATOR_VALUE;
      // Il primo tiene l'orario già scelto per l'appuntamento.
      const first = current.length === 1 ? [{ ...current[0], time: form.getValues("time") }] : current;
      next = [...first, { serviceId, operatorId, time: "" }];
    }
    setItems(next);
    // Durata: la somma dei trattamenti scelti (si può sempre cambiare a mano).
    const total = next.reduce((sum, item) => sum + (serviceById.get(item.serviceId)?.durationMinutes ?? 0), 0);
    if (total > 0) form.setValue("durationMinutes", total);
  }

  /** Orario di un trattamento, scelto a mano. */
  function chooseTime(index: number, time: string) {
    setItems(form.getValues("items").map((item, position) => (position === index ? { ...item, time } : item)));
  }

  /** Operatrice di un trattamento: la prendono anche quelli ancora senza, se li esegue. */
  function chooseOperator(index: number, operatorId: string) {
    setPreferredOperatorId(operatorId);
    const excluded = operators.find((operator) => operator.id === operatorId)?.excludedServiceIds ?? [];
    setItems(
      form.getValues("items").map((item, position) =>
        position === index || (item.operatorId === NO_OPERATOR_VALUE && !excluded.includes(item.serviceId))
          ? { ...item, operatorId }
          : item
      )
    );
  }

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
        items: appointment.services.map((service) => ({
          serviceId: service.id,
          operatorId: service.operator?.id ?? NO_OPERATOR_VALUE,
          time: toTimeInputValue(service.startTime),
        })),
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
        time: defaultTime ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- si riparte dall'operatrice dell'appuntamento o della colonna toccata
    setPreferredOperatorId(appointment?.operator?.id ?? defaultOperatorId ?? NO_OPERATOR_VALUE);
  }, [open, appointment, defaultDate, defaultOperatorId, defaultTime, form]);

  // La richiesta di conferma compare in fondo: si porta in vista da sola.
  useEffect(() => {
    if (pendingChange) confirmRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [pendingChange]);

  // "Sposta": porta subito a data e ora (dopo l'animazione di apertura).
  useEffect(() => {
    if (!open || !focusWhen) return;
    const timer = setTimeout(() => {
      whenRef.current?.scrollIntoView({ block: "center" });
      whenRef.current?.querySelector<HTMLButtonElement>('[data-slot="date-field"]')?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [open, focusWhen]);

  function save(values: AppointmentFormValues, force: boolean) {
    startTransition(async () => {
      const several = values.items.length > 1;
      const startTime = new Date(`${values.date}T${values.time}:00`);

      if (Number.isNaN(startTime.getTime())) {
        toast.error("Data o ora non valide.");
        return;
      }

      const payload = {
        clientId: values.clientId,
        services: values.items.map((item) => ({
          serviceId: item.serviceId,
          operatorId: item.operatorId === NO_OPERATOR_VALUE ? null : item.operatorId,
          startTime: several ? new Date(`${values.date}T${item.time}:00`) : null,
        })),
        startTime,
        durationMinutes: values.durationMinutes,
        notes: values.notes,
        force,
      };

      const result =
        isEditing && appointment
          ? await updateAppointment(appointment.id, payload)
          : await createAppointment(payload);

      if (!result.success) {
        if (result.clash) setClash(result.error);
        else toast.error(result.error);
        return;
      }

      setClash(null);
      toast.success(isEditing ? "Appuntamento aggiornato." : "Appuntamento creato.");
      onSuccess(result.appointment);
      handleOpenChange(false);
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setClash(null);
      setPendingChange(null);
    }
    onOpenChange(next);
  }

  /** Cosa cambia rispetto all'appuntamento salvato (vuoto = solo note o durata). */
  function describeChanges(values: AppointmentFormValues) {
    if (!appointment) return { lines: [], notifies: false };
    const lines: string[] = [];
    const clientName = (id: string) => {
      const c = allClients.find((client) => client.id === id);
      return c ? `${c.firstName} ${c.lastName}`.trim() : "altra cliente";
    };
    const operatorName = (id: string) =>
      id === NO_OPERATOR_VALUE ? "nessuna" : (operators.find((o) => o.id === id)?.firstName ?? "altra operatrice");
    const serviceName = (id: string) => serviceById.get(id)?.name ?? "altro";
    if (values.clientId !== appointment.client.id) lines.push(`Cliente: ${clientName(appointment.client.id)} → ${clientName(values.clientId)}`);
    const before = appointment.services.map((service) => ({
      serviceId: service.id,
      name: service.name,
      operatorId: service.operator?.id ?? NO_OPERATOR_VALUE,
      operatorName: service.operator?.firstName ?? "nessuna",
    }));
    const after = values.items.map((item) => ({
      ...item,
      name: serviceName(item.serviceId),
      operatorName: operatorName(item.operatorId),
    }));
    const sorted = <T extends { serviceId: string }>(list: T[]) => [...list].sort((a, b) => a.serviceId.localeCompare(b.serviceId));
    const key = (list: { serviceId: string }[]) => sorted(list).map((item) => item.serviceId).join();
    if (key(before) !== key(after)) {
      const names = (list: { name: string }[]) => list.map((item) => item.name).join(" + ");
      lines.push(`Trattamenti: ${names(before)} → ${names(after)}`);
    }
    // Orari dei singoli trattamenti (interni): "Manicure 10:00, Pedicure 11:30".
    const hours = (list: { name: string; time: string }[]) =>
      [...list].sort((a, b) => a.time.localeCompare(b.time)).map((item) => `${item.name} ${item.time}`).join(", ");
    const beforeHours = appointment.services.map((service) => ({ name: service.name, time: toTimeInputValue(service.startTime) }));
    if (after.length > 1 && beforeHours.length > 1 && key(before) === key(after) && hours(beforeHours) !== hours(after)) {
      lines.push(`Orari dei trattamenti: ${hours(beforeHours)} → ${hours(after)}`);
    }
    // "Roberta" se fa tutto lei, altrimenti chi fa cosa.
    const who = (list: { serviceId: string; name: string; operatorId: string; operatorName: string }[]) =>
      new Set(list.map((item) => item.operatorId)).size <= 1
        ? (list[0]?.operatorName ?? "nessuna")
        : sorted(list).map((item) => `${item.name} con ${item.operatorName}`).join(", ");
    if (who(before) !== who(after)) {
      lines.push(`${after.length > 1 ? "Operatrici" : "Operatrice"}: ${who(before)} → ${who(after)}`);
    }
    const oldWhen = `${toDateInputValue(appointment.startTime)} ${toTimeInputValue(appointment.startTime)}`;
    const newWhen = `${values.date} ${values.time}`;
    const timeChanged = oldWhen !== newWhen;
    if (timeChanged) {
      const fmt = (d: Date) =>
        new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);
      lines.push(`Orario: ${fmt(appointment.startTime)} → ${fmt(new Date(`${values.date}T${values.time}:00`))}`);
    }
    // Solo un nuovo orario fa partire un messaggio (la conferma con il nuovo orario).
    // Come sul server: riceve la conferma col nuovo orario se l'aveva già avuta e il nuovo orario è futuro.
    const alreadyConfirmed =
      appointment.status === "CONFIRMED" || (appointment.status === "BOOKED" && appointment.source === "INTERNAL");
    const notifies = timeChanged && alreadyConfirmed && new Date(`${values.date}T${values.time}:00`).getTime() > Date.now();
    return { lines, notifies };
  }

  function onSubmit(values: AppointmentFormValues) {
    // Orari e operatrici si controllano qui: con più trattamenti ognuno ha i suoi.
    const several = values.items.length > 1;
    const noTime = several ? values.items.find((item) => !item.time) : undefined;
    const noOperator = operators.length > 0 ? values.items.find((item) => item.operatorId === NO_OPERATOR_VALUE) : undefined;
    const name = (serviceId: string) => serviceById.get(serviceId)?.name ?? "ogni trattamento";
    if (noOperator || noTime) {
      form.setError("items", {
        message: noOperator
          ? several
            ? `Scegli l'operatrice per ${name(noOperator.serviceId)}.`
            : "Scegli l'operatrice."
          : `Scegli l'orario di ${name(noTime!.serviceId)}.`,
      });
      return;
    }
    if (!values.time) {
      form.setError("time", { message: "Seleziona un orario." });
      return;
    }
    const change = describeChanges(values);
    if (change.lines.length > 0) {
      setPendingChange({ values, ...change });
      return;
    }
    save(values, false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isEditing ? (focusWhen ? "Sposta appuntamento" : "Modifica appuntamento") : "Nuovo appuntamento"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? focusWhen
                ? "Scegli il nuovo giorno e il nuovo orario."
                : "Aggiorna i dati dell'appuntamento."
              : "Scegli la cliente, i trattamenti, chi li fa e l'orario: il resto è automatico."}
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
                    filter={matchesClient}
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
              name="items"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trattamenti</FormLabel>
                  <p className="-mt-1 text-xs text-muted-foreground">Tocca per aggiungere o togliere: puoi sceglierne più di uno.</p>
                  <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
                    {services.map((service) => {
                      const active = field.value.some((item) => item.serviceId === service.id);
                      return (
                        <button
                          key={service.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleService(service.id)}
                          className={cn(
                            "relative rounded-xl border p-3 text-left transition-colors",
                            active
                              ? "border-forest bg-forest text-forest-foreground"
                              : "border-mint-border bg-card hover:bg-mint-soft"
                          )}
                        >
                          <div className="pr-6 text-sm font-semibold leading-tight">{service.name}</div>
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
                  {rows.length > 1 ? (
                    <p className="text-sm font-medium">
                      {rows.length} trattamenti ·{" "}
                      {rows.reduce((sum, row) => sum + (serviceById.get(row.serviceId)?.durationMinutes ?? 0), 0)} min ·{" "}
                      {formatEuro(rows.reduce((sum, row) => sum + Number(serviceById.get(row.serviceId)?.price ?? 0), 0))}
                    </p>
                  ) : null}

                  {multi ? (
                    <div className="space-y-2 pt-1">
                      <FormLabel>{operators.length > 0 ? "Orario e operatrice di ogni trattamento" : "Orario di ogni trattamento"}</FormLabel>
                      <p className="-mt-1 text-xs text-muted-foreground">
                        Scegli tu a che ora si fa ogni trattamento: lo vedete solo voi in agenda. Alla cliente arriva un
                        solo messaggio, con l&apos;orario del primo.
                      </p>
                      <ul className="space-y-2">
                        {rows.map((row, index) => (
                          <li key={row.serviceId} className="rounded-xl border border-mint-border bg-card p-2.5">
                            <div className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.name}</span>
                              <span className="text-xs text-muted-foreground">alle</span>
                              <TimeField
                                className="h-9 w-28 shrink-0"
                                value={row.time}
                                onChange={(time) => chooseTime(index, time)}
                                aria-label={`Orario di ${row.name}`}
                              />
                            </div>
                            {operators.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {operatorsFor(row.serviceId).map((operator) => (
                                  <Chip
                                    key={operator.id}
                                    active={row.operatorId === operator.id}
                                    onClick={() => chooseOperator(index, operator.id)}
                                    className="px-2.5 py-1 text-xs"
                                  >
                                    {operator.firstName}
                                  </Chip>
                                ))}
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : operators.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      <FormLabel>Operatrice</FormLabel>
                      <div className="flex flex-wrap gap-2">
                        {(rows.length === 1 ? operatorsFor(rows[0].serviceId) : operators).map((operator) => (
                          <Chip
                            key={operator.id}
                            active={(rows[0]?.operatorId ?? preferredOperatorId) === operator.id}
                            onClick={() => (rows.length === 1 ? chooseOperator(0, operator.id) : setPreferredOperatorId(operator.id))}
                          >
                            {operator.firstName}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div ref={whenRef} className="space-y-2">
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
              <div className={cn("grid gap-3", multi ? "grid-cols-1" : "grid-cols-[1fr_8rem]")}>
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <DateField className="h-10" value={field.value} onChange={field.onChange} aria-label="Giorno" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {multi ? null : (
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <TimeField className="h-10" value={field.value} onChange={field.onChange} aria-label="Orario" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              {/* Con più trattamenti ognuno dura il suo tempo, dal suo orario. */}
              {multi ? null : <FormField
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
              />}
              {showNotes ? null : (
                <button
                  type="button"
                  onClick={() => setNotesOpen(true)}
                  className="h-10 rounded-full border border-dashed border-mint-border px-4 text-sm font-semibold text-mint-ink transition-colors hover:bg-mint-soft"
                >
                  📝 Aggiungi nota
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

            {pendingChange ? (
              <div ref={confirmRef} className="space-y-2 rounded-xl border-2 border-forest/40 bg-mint-soft p-3 text-sm">
                <p className="font-semibold">Confermi queste modifiche?</p>
                <ul className="space-y-1">
                  {pendingChange.lines.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  {pendingChange.notifies
                    ? "La cliente riceverà su WhatsApp la conferma con il nuovo orario."
                    : "La cliente non riceve nessun messaggio."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="h-10"
                    disabled={isPending}
                    onClick={() => {
                      const values = pendingChange.values;
                      setPendingChange(null);
                      save(values, false);
                    }}
                  >
                    Sì, conferma
                  </Button>
                  <Button type="button" variant="outline" className="h-10" onClick={() => setPendingChange(null)}>
                    No, torna indietro
                  </Button>
                </div>
              </div>
            ) : null}

            {clash ? (
              <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {clash}
                </p>
                <p className="text-xs">Cambia orario o operatrice, oppure salva lo stesso.</p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 border-amber-300"
                  disabled={isPending}
                  onClick={form.handleSubmit((values) => save(values, true))}
                >
                  Salva comunque
                </Button>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" className="h-10" onClick={() => handleOpenChange(false)}>
                Annulla
              </Button>
              <Button type="submit" className="h-10 px-6" disabled={isPending || pendingChange !== null}>
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
