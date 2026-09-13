"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, isBefore, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

import {
  createPublicBooking,
  getAvailableSlots,
  type BookingConfirmation,
} from "./actions";
import type { PublicServiceDTO } from "./data";
import { contactFormDefaultValues, contactFormSchema, type ContactFormValues } from "./schema";

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const timeFormatter = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

type Step = "service" | "datetime" | "contact" | "success";

type WidgetBookingFlowProps = {
  slug: string;
  services: PublicServiceDTO[];
};

export function WidgetBookingFlow({ slug, services }: WidgetBookingFlowProps) {
  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<PublicServiceDTO | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: contactFormDefaultValues,
  });

  function fetchSlots(service: PublicServiceDTO, date: Date) {
    setSlotsLoading(true);
    setSelectedSlot(null);
    startTransition(async () => {
      const result = await getAvailableSlots({
        slug,
        serviceId: service.id,
        date: format(date, "yyyy-MM-dd"),
      });
      setSlotsLoading(false);

      if (!result.success) {
        toast.error(result.error);
        setSlots([]);
        return;
      }

      setSlots(result.slots);
    });
  }

  function handleSelectService(service: PublicServiceDTO) {
    setSelectedService(service);
    setStep("datetime");
    fetchSlots(service, selectedDate);
  }

  function handleSelectDate(date: Date | undefined) {
    if (!date || !selectedService) return;
    setSelectedDate(date);
    fetchSlots(selectedService, date);
  }

  function handleSelectSlot(slot: string) {
    setSelectedSlot(slot);
    setStep("contact");
  }

  function handleSubmitContact(values: ContactFormValues) {
    if (!selectedService || !selectedSlot) return;

    startTransition(async () => {
      const result = await createPublicBooking({
        slug,
        serviceId: selectedService.id,
        startTime: selectedSlot,
        ...values,
      });

      if (!result.success) {
        toast.error(result.error);
        // The slot may have just been taken by someone else: refresh the list.
        fetchSlots(selectedService, selectedDate);
        setStep("datetime");
        return;
      }

      setConfirmation(result.booking);
      setStep("success");
    });
  }

  if (step === "success" && confirmation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prenotazione confermata!</CardTitle>
          <CardDescription>
            Ti aspettiamo {dateTimeFormatter.format(new Date(confirmation.startTime))}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Trattamento: </span>
            {confirmation.serviceName}
          </div>
          <div>
            <span className="text-muted-foreground">Cliente: </span>
            {confirmation.clientName}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-muted-foreground">
        {step === "service" && "Passo 1 di 3 — Scegli il trattamento"}
        {step === "datetime" && "Passo 2 di 3 — Scegli data e ora"}
        {step === "contact" && "Passo 3 di 3 — I tuoi dati"}
      </p>

      {step === "service" ? (
        <div className="space-y-3">
          {services.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Nessun trattamento disponibile per la prenotazione online al momento.
            </p>
          ) : (
            services.map((service) => (
              <Card
                key={service.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectService(service)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSelectService(service);
                }}
                className="cursor-pointer transition-colors hover:border-primary"
              >
                <CardHeader>
                  <CardTitle className="text-base">{service.name}</CardTitle>
                  {service.description ? (
                    <CardDescription>{service.description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {service.durationMinutes} min
                  </span>
                  <span className="font-medium">
                    {currencyFormatter.format(service.price)}
                  </span>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : null}

      {step === "datetime" && selectedService ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setStep("service")}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Cambia trattamento
          </button>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{selectedService.name}</CardTitle>
              <CardDescription>
                {selectedService.durationMinutes} min ·{" "}
                {currencyFormatter.format(selectedService.price)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleSelectDate}
                locale={it}
                disabled={(date) => isBefore(date, startOfDay(new Date()))}
              />
            </CardContent>
          </Card>

          <div className="space-y-2">
            {slotsLoading ? (
              <p className="text-center text-sm text-muted-foreground">
                Caricamento orari disponibili...
              </p>
            ) : slots.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                Nessun orario disponibile per questa data. Prova un&apos;altra data.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <Button
                    key={slot}
                    type="button"
                    variant={selectedSlot === slot ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSelectSlot(slot)}
                  >
                    {timeFormatter.format(new Date(slot))}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {step === "contact" && selectedService && selectedSlot ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setStep("datetime")}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Cambia data/ora
          </button>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riepilogo</CardTitle>
              <CardDescription>
                {selectedService.name} —{" "}
                {dateTimeFormatter.format(new Date(selectedSlot))}
              </CardDescription>
            </CardHeader>
          </Card>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmitContact)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Maria" {...field} />
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
                        <Input placeholder="Verdi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefono</FormLabel>
                    <FormControl>
                      <Input placeholder="+39 333 1234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (facoltativa)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="maria@esempio.it" {...field} />
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
                    <FormLabel>Note (facoltative)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Richieste particolari..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Conferma in corso..." : "Conferma prenotazione"}
              </Button>
            </form>
          </Form>
        </div>
      ) : null}
    </div>
  );
}
