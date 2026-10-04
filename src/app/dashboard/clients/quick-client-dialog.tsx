"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  createQuickClient,
  type ClientDTO,
  type QuestionnaireLink,
} from "./actions";
import { quickClientSchema, type QuickClientValues } from "./schema";

type QuickClientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chiamato appena la cliente è stata creata. */
  onCreated: (client: ClientDTO) => void;
  /** Precompila il nome (es. testo digitato nella ricerca). */
  initialValues?: Partial<QuickClientValues>;
};

const emptyValues: QuickClientValues = {
  firstName: "",
  lastName: "",
  phone: "",
};

/**
 * Nuova cliente in 10 secondi: nome, cognome, telefono. Poi si invia su WhatsApp il questionario
 * che popola da solo la scheda (data di nascita, città, allergie, interessi...).
 */
export function QuickClientDialog({
  open,
  onOpenChange,
  onCreated,
  initialValues,
}: QuickClientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <QuickClientBody
          onClose={() => onOpenChange(false)}
          onCreated={onCreated}
          initialValues={initialValues}
        />
      </DialogContent>
    </Dialog>
  );
}

function QuickClientBody({
  onClose,
  onCreated,
  initialValues,
}: {
  onClose: () => void;
  onCreated: (client: ClientDTO) => void;
  initialValues?: Partial<QuickClientValues>;
}) {
  const [isPending, startTransition] = useTransition();
  const [created, setCreated] = useState<{
    client: ClientDTO;
    link: QuestionnaireLink;
  } | null>(null);

  const form = useForm<QuickClientValues>({
    resolver: zodResolver(quickClientSchema),
    defaultValues: { ...emptyValues, ...initialValues },
  });

  function onSubmit(values: QuickClientValues) {
    startTransition(async () => {
      const result = await createQuickClient(values);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setCreated({ client: result.client, link: result.questionnaire });
      onCreated(result.client);
    });
  }

  return (
    <>
      {created ? (
        <div className="space-y-5 py-2 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint-soft text-mint-ink">
            <CheckCircle2 className="size-7" />
          </div>
          <div>
            <h2 className="font-heading text-2xl font-bold">
              {created.client.firstName} è in archivio
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Mandale il questionario su WhatsApp: le risposte compilano da sole
              la sua scheda.
            </p>
          </div>
          <div className="space-y-2">
            <Button
              size="lg"
              className="h-11 w-full bg-[#25D366] text-base font-semibold text-white hover:bg-[#1fb857]"
              nativeButton={false}
              render={
                <a
                  href={created.link.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <MessageCircle className="size-5" />
              Invia questionario su WhatsApp
            </Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>
              Più tardi
            </Button>
          </div>
        </div>
      ) : (
        <>
          <DialogHeader>
            <DialogTitle className="text-lg">Nuova cliente</DialogTitle>
            <DialogDescription>
              Bastano nome e telefono. Il resto lo compila lei dal questionario.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input
                          autoFocus
                          className="h-10"
                          placeholder="Giulia"
                          {...field}
                        />
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
                        <Input
                          className="h-10"
                          placeholder="Rossi"
                          {...field}
                        />
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
                    <FormLabel>Telefono (WhatsApp)</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        inputMode="tel"
                        className="h-10"
                        placeholder="338 912 3456"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                size="lg"
                className="h-11 w-full text-base"
                disabled={isPending}
              >
                {isPending ? "Salvataggio..." : "Aggiungi cliente"}
              </Button>
            </form>
          </Form>
        </>
      )}
    </>
  );
}
