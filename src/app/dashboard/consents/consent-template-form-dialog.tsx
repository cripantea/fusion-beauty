"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
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

const NO_SERVICE = "none";

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
            serviceId: template.serviceId ?? "",
            title: template.title,
            body: template.body,
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
                name="serviceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trattamento (facoltativo)</FormLabel>
                    <Select
                      value={field.value || NO_SERVICE}
                      onValueChange={(value) => field.onChange(value === NO_SERVICE ? "" : value)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value: string) =>
                              value === NO_SERVICE
                                ? "Nessuno (modello generico)"
                                : (services.find((service) => service.id === value)?.name ??
                                  template?.serviceName ??
                                  "")
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_SERVICE}>Nessuno (modello generico)</SelectItem>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Collegandolo a un trattamento, verrà proposto per quell&apos;appuntamento.
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
