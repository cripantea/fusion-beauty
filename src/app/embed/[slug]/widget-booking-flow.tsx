"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, isBefore, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { Check } from "lucide-react";
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

const STEPS: Step[] = ["service", "datetime", "contact"];

function StepBar({ step }: { step: Step }) {
  const current = STEPS.indexOf(step) + 1;
  const labels = ["Trattamento", "Data e ora", "I tuoi dati"];
  return (
    <div className="flex items-center gap-0">
      {labels.map((label, i) => {
        const done = i + 1 < current;
        const active = i + 1 === current;
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {i > 0 && (
                <div className={`h-0.5 flex-1 ${done ? "bg-primary" : "bg-border"}`} />
              )}
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "border-2 border-border text-muted-foreground"
                }`}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </div>
              {i < labels.length - 1 && (
                <div className={`h-0.5 flex-1 ${i + 1 < current ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
            <span
              className={`mt-1 text-[10px] font-medium ${
                active ? "text-primary" : done ? "text-primary/70" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function WidgetBookingFlow({ slug, services }: WidgetBookingFlowProps) {
  const [step, setStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<PublicServiceDTO | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [privacyError, setPrivacyError] = useState("");

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

    if (!privacyConsent) {
      setPrivacyError("Devi accettare il trattamento dei dati per procedere.");
      return;
    }
    setPrivacyError("");

    startTransition(async () => {
      const result = await createPublicBooking({
        slug,
        serviceId: selectedService.id,
        startTime: selectedSlot,
        ...values,
      });

      if (!result.success) {
        toast.error(result.error);
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
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Check className="size-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Prenotazione confermata!</CardTitle>
          <CardDescription className="text-base">
            Ti aspettiamo {dateTimeFormatter.format(new Date(confirmation.startTime))}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm pt-2">
          <div className="rounded-lg border border-primary/10 bg-white p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trattamento</span>
              <span className="font-medium">{confirmation.serviceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">{confirmation.clientName}</span>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground pt-1">
            Riceverai una conferma. A presto!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {step !== "success" && <StepBar step={step} />}

      {step === "service" ? (
        <div className="space-y-2.5">
          {services.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
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
                className="cursor-pointer transition-all hover:border-primary hover:shadow-sm active:scale-[0.99]"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base">{service.name}</CardTitle>
                  {service.description ? (
                    <CardDescription>{service.description}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm pt-0">
                  <span className="text-muted-foreground">{service.durationMinutes} min</span>
                  <span className="font-semibold text-primary">
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
            className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            ← Cambia trattamento
          </button>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{selectedService.name}</CardTitle>
              <CardDescription>
                {selectedService.durationMinutes} min · {currencyFormatter.format(selectedService.price)}
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
              <p className="text-center text-sm text-muted-foreground py-4">
                Caricamento orari disponibili...
              </p>
            ) : slots.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
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
            className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            ← Cambia data/ora
          </button>

          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{selectedService.name}</span>
                <span className="text-muted-foreground">
                  {dateTimeFormatter.format(new Date(selectedSlot))}
                </span>
              </div>
            </CardContent>
          </Card>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmitContact)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
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
                      <FormLabel>Cognome *</FormLabel>
                      <FormControl>
                        <Input placeholder="Rossi" {...field} />
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
                    <FormLabel>Telefono *</FormLabel>
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
                    <FormLabel>Email <span className="text-muted-foreground font-normal">(facoltativa)</span></FormLabel>
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
                    <FormLabel>Note <span className="text-muted-foreground font-normal">(facoltative)</span></FormLabel>
                    <FormControl>
                      <Textarea placeholder="Richieste particolari, allergie, preferenze..." rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Privacy consent */}
              <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={privacyConsent}
                      onChange={(e) => {
                        setPrivacyConsent(e.target.checked);
                        if (e.target.checked) setPrivacyError("");
                      }}
                      className="size-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </div>
                  <span className="text-sm text-foreground/80 leading-snug">
                    Acconsento al trattamento dei miei dati personali ai sensi del Regolamento UE 2016/679 (GDPR) per la gestione della prenotazione e la comunicazione con il centro.{" "}
                    <span className="text-muted-foreground">*</span>
                  </span>
                </label>
                {privacyError && (
                  <p className="text-sm text-destructive pl-7">{privacyError}</p>
                )}
              </div>

              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isPending}>
                {isPending ? "Conferma in corso..." : "Conferma prenotazione"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                I tuoi dati vengono trattati esclusivamente per la gestione della prenotazione.
              </p>
            </form>
          </Form>
        </div>
      ) : null}
    </div>
  );
}
