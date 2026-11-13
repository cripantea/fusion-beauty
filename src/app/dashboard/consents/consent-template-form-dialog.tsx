"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
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
  FormDescription,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  createConsentTemplate,
  updateConsentTemplate,
  type ConsentTemplateDTO,
} from "./actions";
import {
  consentTemplateFormDefaultValues,
  consentTemplateFormSchema,
  consentTypeLabels,
  type ConsentTemplateFormValues,
} from "./schema";

export type ServiceOption = { id: string; name: string };

type ConsentTemplateFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: ConsentTemplateDTO | null;
  services: ServiceOption[];
  onSuccess: (template: ConsentTemplateDTO) => void;
};

export function ConsentTemplateFormDialog({
  open,
  onOpenChange,
  template,
  services,
  onSuccess,
}: ConsentTemplateFormDialogProps) {
  const isEditing = Boolean(template);
  const [isPending, startTransition] = useTransition();

  const form = useForm<ConsentTemplateFormValues>({
    resolver: zodResolver(consentTemplateFormSchema),
    defaultValues: consentTemplateFormDefaultValues,
  });

  const type = useWatch({ control: form.control, name: "type" });

  useEffect(() => {
    if (!open) return;

    form.reset(
      template
        ? {
            type: template.type,
            serviceIds: template.serviceIds,
            title: template.title,
            body: template.body,
            checklist: template.checklist.join("\n"),
            isActive: template.isActive,
          }
        : consentTemplateFormDefaultValues
    );
  }, [open, template, form]);

  function onSubmit(values: ConsentTemplateFormValues) {
    startTransition(async () => {
      const result =
        isEditing && template
          ? await updateConsentTemplate(template.id, values)
          : await createConsentTemplate(values);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(isEditing ? "Modello aggiornato." : "Modello creato.");
      onSuccess(result.template);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Modifica modello" : "Nuovo modello di consenso"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Se modifichi titolo o testo verrà creata una nuova versione. I consensi già firmati restano invariati."
              : "Il testo sarà mostrato alla cliente prima della firma."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo di consenso</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEditing}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(value: string) =>
                            consentTypeLabels[value as ConsentTemplateFormValues["type"]]
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(consentTypeLabels).map(([value, label]) => (
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
            {type === "TREATMENT" ? (
              <FormField
                control={form.control}
                name="serviceIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trattamenti che lo richiedono</FormLabel>
                    <ServicesPicker services={services} value={field.value} onChange={field.onChange} />
                    <FormDescription>
                      Quando si prenota uno di questi trattamenti, il link da firmare è già pronto. Una firma vale
                      per tutti, finché non cambi il testo. Nessuno spuntato = modello generico.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titolo</FormLabel>
                  <FormControl>
                    <Input placeholder="Es. Informativa privacy" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Testo</FormLabel>
                  <FormControl>
                    <Textarea rows={10} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {type === "TREATMENT" ? (
              <FormField
                control={form.control}
                name="checklist"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domande di salute (facoltativo)</FormLabel>
                    <FormControl>
                      <Textarea rows={5} placeholder={"Pace-maker\nGravidanza o allattamento\nDiabete"} {...field} />
                    </FormControl>
                    <FormDescription>
                      Una condizione per riga: prima di firmare la cliente spunta quelle che ha, oppure
                      &quot;Nessuna di queste&quot;, e può aggiungere una nota.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <FormLabel className="pr-4">Modello attivo</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked)}
                    />
                  </FormControl>
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

/** Lista di trattamenti con spunta; la ricerca serve a spuntare tutti quelli che contengono una parola. */
function ServicesPicker({
  services,
  value,
  onChange,
}: {
  services: ServiceOption[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle ? services.filter((service) => service.name.toLowerCase().includes(needle)) : services;
  const selected = new Set(value);
  // Collegati ma non più in listino (disattivati): restano collegati, si mostrano solo nel conteggio.
  const hidden = value.filter((id) => !services.some((service) => service.id === id)).length;

  function toggle(id: string) {
    onChange(selected.has(id) ? value.filter((item) => item !== id) : [...value, id]);
  }

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Cerca, es. Laser 808"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {value.length} spuntati{hidden > 0 ? ` (${hidden} non più in listino)` : ""}
        </span>
        <span className="space-x-3">
          <button
            type="button"
            className="underline"
            onClick={() => onChange([...new Set([...value, ...visible.map((service) => service.id)])])}
          >
            {needle ? `Seleziona tutti quelli che contengono "${query.trim()}"` : "Tutti"}
          </button>
          <button
            type="button"
            className="underline"
            onClick={() => {
              const ids = new Set(visible.map((service) => service.id));
              onChange(value.filter((id) => !ids.has(id)));
            }}
          >
            Nessuno
          </button>
        </span>
      </div>
      <div className="max-h-56 divide-y overflow-y-auto rounded-xl border">
        {visible.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">Nessun trattamento trovato.</p>
        ) : (
          visible.map((service) => (
            <label
              key={service.id}
              className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-mint-soft/40"
            >
              <input
                type="checkbox"
                className="size-4 accent-forest"
                checked={selected.has(service.id)}
                onChange={() => toggle(service.id)}
              />
              {service.name}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
