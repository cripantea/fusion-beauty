"use client";

import { ClipboardList, MessageCircle } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";

import { createQuestionnaireLink } from "../actions";

type QuestionnaireCardProps = {
  clientId: string;
  status: "none" | "sent" | "completed";
  date: Date | null;
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" });

export function QuestionnaireCard({ clientId, status, date }: QuestionnaireCardProps) {
  const [isPending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await createQuestionnaireLink(clientId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      window.open(result.questionnaire.whatsappUrl, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <Panel title="Questionario cliente" icon={ClipboardList}>
      <div className="space-y-3 p-5 text-sm">
        <div className="flex items-center gap-2">
          {status === "completed" ? (
            <Pill>Compilato{date ? ` il ${dateFormatter.format(date)}` : ""}</Pill>
          ) : status === "sent" ? (
            <Pill tone="amber">Inviato{date ? ` il ${dateFormatter.format(date)}` : ""} · in attesa</Pill>
          ) : (
            <Pill tone="slate">Non ancora inviato</Pill>
          )}
        </div>
        <p className="text-muted-foreground">
          {status === "completed"
            ? "Le risposte hanno già popolato la scheda. Puoi inviarne uno nuovo per aggiornarle."
            : "Un link su WhatsApp: la cliente risponde dal telefono e la scheda si compila da sola."}
        </p>
        <Button
          className="h-10 w-full rounded-xl bg-[#25D366] font-semibold text-white hover:bg-[#1fb857]"
          disabled={isPending}
          onClick={send}
        >
          <MessageCircle className="size-4" />
          {status === "none" ? "Invia questionario su WhatsApp" : "Invia di nuovo"}
        </Button>
      </div>
    </Panel>
  );
}
