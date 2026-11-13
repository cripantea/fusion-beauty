"use client";

import { CheckCircle2, Copy, MessageCircle, PenLine, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { createConsentLink } from "./collect-actions";
import { ConsentCollectDialog } from "./consent-collect-dialog";
import { getConsentNotices, sendConsentLink, type ConsentNoticeItem } from "./notice-actions";

const dateFormatter = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" });

type ConsentNoticeProps = {
  clientId: string;
  clientName: string;
  /** Dal dettaglio appuntamento: consensi richiesti da quel trattamento. Senza: appuntamenti in arrivo della cliente. */
  appointment?: { id: string; serviceId: string; serviceName: string };
  /** Dopo una firma in cabina (es. per aggiornare la scheda). */
  onSigned?: () => void;
};

/** Consenso richiesto dal trattamento: avviso ambra se manca (con link da mandare), verde se firmato. */
export function ConsentNotice({ clientId, clientName, appointment, onSigned }: ConsentNoticeProps) {
  const [items, setItems] = useState<ConsentNoticeItem[]>([]);
  const [signingTemplateId, setSigningTemplateId] = useState<string | null>(null);
  const serviceId = appointment?.serviceId;

  const load = useCallback(() => getConsentNotices({ clientId, serviceId }), [clientId, serviceId]);

  useEffect(() => {
    let cancelled = false;
    load().then((result) => {
      if (!cancelled) setItems(result);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item) =>
        item.signed ? (
          <div
            key={item.templateId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-mint-border bg-mint-soft px-3 py-2 text-sm text-mint-ink"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>
                <span className="font-semibold">Consenso firmato</span>
                {item.signed.signedAt ? ` il ${dateFormatter.format(item.signed.signedAt)}` : ""}
                <span className="block text-xs opacity-80">{item.title}</span>
              </span>
            </span>
            {item.signed.hasPdf ? (
              <a
                href={`/api/consents/${item.signed.recordId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold underline underline-offset-2"
              >
                Vedi PDF
              </a>
            ) : null}
          </div>
        ) : (
          <MissingConsent
            key={item.templateId}
            clientId={clientId}
            item={item}
            onSignHere={() => setSigningTemplateId(item.templateId)}
          />
        )
      )}

      <ConsentCollectDialog
        open={signingTemplateId !== null}
        onOpenChange={(open) => !open && setSigningTemplateId(null)}
        clientId={clientId}
        clientName={clientName}
        appointment={appointment}
        initialTemplateId={signingTemplateId ?? undefined}
        onCollected={() => {
          load().then(setItems);
          onSigned?.();
        }}
      />
    </div>
  );
}

function MissingConsent({
  clientId,
  item,
  onSignHere,
}: {
  clientId: string;
  item: ConsentNoticeItem;
  onSignHere: () => void;
}) {
  const [isSending, startSending] = useTransition();
  const [isCopying, startCopying] = useTransition();
  const label = /laser/i.test(item.title) ? "Consenso laser da firmare" : "Consenso da firmare";

  function handleSend() {
    startSending(async () => {
      const result = await sendConsentLink({ clientId, templateId: item.templateId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.sent) {
        toast.success("Link inviato su WhatsApp.");
        return;
      }
      if (result.fallbackUrl) {
        // Senza "noopener" nelle opzioni: con quello window.open restituisce sempre null.
        const opened = window.open(result.fallbackUrl, "_blank");
        if (opened) opened.opener = null;
        const fallbackUrl = result.fallbackUrl;
        // Popup bloccato dal browser: si apre con un tocco dal messaggio.
        if (!opened) toast("Messaggio pronto", { action: { label: "Apri WhatsApp", onClick: () => window.open(fallbackUrl, "_blank", "noopener,noreferrer") } });
      }
    });
  }

  function handleCopy() {
    startCopying(async () => {
      const result = await createConsentLink({ clientId, templateId: item.templateId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      try {
        await navigator.clipboard.writeText(result.url);
        toast.success("Link copiato.");
      } catch {
        toast(result.url);
      }
    });
  }

  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-soft p-3 text-sm text-amber-ink">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <div>
          <div className="font-semibold">{label}</div>
          <div className="text-xs opacity-80">{item.title}</div>
        </div>
      </div>
      <Button className="h-10 w-full rounded-lg" disabled={isSending} onClick={handleSend}>
        <MessageCircle className="size-4" />
        {isSending ? "Invio in corso…" : "Manda link alla cliente"}
      </Button>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="h-9 flex-1 bg-card" disabled={isCopying} onClick={handleCopy}>
          <Copy className="size-3.5" />
          Copia link
        </Button>
        <Button variant="outline" size="sm" className="h-9 flex-1 bg-card" onClick={onSignHere}>
          <PenLine className="size-3.5" />
          Firma qui in cabina
        </Button>
      </div>
    </div>
  );
}
