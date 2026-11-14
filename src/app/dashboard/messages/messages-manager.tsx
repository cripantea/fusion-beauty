"use client";

import { AlertCircle, Check, CheckCheck, Clock, FileText, MessageCircle, Phone, Plus, Search, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  getApprovedTemplates,
  getConversations,
  getThread,
  searchClientsForChat,
  sendReply,
  sendTemplateMessage,
  type ConversationDTO,
  type InboxTemplate,
  type MessageDTO,
  type ThreadDTO,
} from "./actions";

const POLL_MS = 10_000;

const timeFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short" });

function shortTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  return date.toDateString() === today.toDateString() ? timeFormatter.format(date) : dayFormatter.format(date);
}

function firstNameOf(name: string) {
  return name.startsWith("+") ? "" : name.split(" ")[0] ?? "";
}

/** Spiegazione semplice al posto dell'errore tecnico di Meta. */
function friendlyError(error: string | null) {
  const text = (error ?? "").toLowerCase();
  if (/131026|not a valid whatsapp|undeliverable|non ha whatsapp/.test(text)) return "Non consegnato: questo numero forse non ha WhatsApp.";
  if (/131049|marketing|limit/.test(text)) return "Non consegnato: WhatsApp ha bloccato il messaggio per troppi invii promozionali. Riprova tra qualche giorno.";
  if (/131047|24|re-engagement|window/.test(text)) return "Non consegnato: è passato troppo tempo dall'ultimo messaggio della cliente. Usa un messaggio pronto.";
  return "Non consegnato. Controlla il numero o riprova più tardi.";
}

function initials(name: string) {
  if (name.startsWith("+")) return "#";
  const parts = name.split(" ").filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function MessagesManager({
  connected,
  phoneNumber,
  isAdmin,
  initialConversations,
  initialClient,
}: {
  connected: boolean;
  phoneNumber: string | null;
  isAdmin: boolean;
  initialConversations: ConversationDTO[];
  /** Arrivando dalla scheda cliente: si apre la sua chat, o il primo messaggio se non c'è ancora. */
  initialClient: { id: string; name: string; phone: string } | null;
}) {
  const hasInitialChat = initialClient !== null && initialConversations.some((c) => c.phone === initialClient.phone);
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(
    hasInitialChat ? initialClient!.phone : initialConversations[0]?.phone ?? null
  );
  const [thread, setThread] = useState<ThreadDTO | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [isSending, startSending] = useTransition();
  const [templateFor, setTemplateFor] = useState<{ phone?: string; clientId?: string; name: string } | null>(
    connected && initialClient && !hasInitialChat ? { clientId: initialClient.id, name: initialClient.name } : null
  );
  const [newChatOpen, setNewChatOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const unreadRef = useRef(initialConversations.reduce((sum, c) => sum + c.unread, 0));

  const refresh = useCallback(
    async (phone: string | null) => {
      // Prima la chat (che segna come letti i messaggi), poi l'elenco aggiornato.
      const nextThread = phone ? await getThread(phone) : null;
      const nextConversations = await getConversations();
      setThread(nextThread);
      setConversations(nextConversations);
      // Il contatore nella barra laterale arriva dal layout: va ricaricato se i non letti cambiano.
      const unread = nextConversations.reduce((sum, c) => sum + c.unread, 0);
      if (unread !== unreadRef.current) {
        unreadRef.current = unread;
        router.refresh();
      }
    },
    [router]
  );

  useEffect(() => {
    if (!connected) return;
    let active = true;
    const tick = () => {
      if (active && document.visibilityState === "visible") void refresh(selectedPhone);
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [connected, selectedPhone, refresh]);

  const messageCount = thread?.messages.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messageCount, selectedPhone]);

  if (!connected) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#25D366]/10">
          <MessageCircle className="size-7 text-[#25D366]" />
        </div>
        <h1 className="text-2xl font-semibold">Conversazioni WhatsApp</h1>
        <p className="text-muted-foreground">
          Collega il numero WhatsApp del centro per leggere e rispondere alle clienti da qui, e per inviare conferme e promemoria
          automatici.
        </p>
        {isAdmin ? (
          <Button nativeButton={false} render={<Link href="/dashboard/whatsapp" />}>
            Collega WhatsApp
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Chiedi all&apos;amministratrice del centro di collegarlo.</p>
        )}
      </div>
    );
  }

  const selected = conversations.find((c) => c.phone === selectedPhone) ?? null;
  const filtered = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.phone.includes(q.replace(/\D/g, "") || "§");
  });
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  function send() {
    const text = draft.trim();
    if (!text || !selectedPhone) return;
    startSending(async () => {
      const result = await sendReply(selectedPhone, text);
      if (!result.success) {
        toast.error("Messaggio non inviato. Riprova tra poco.");
        return;
      }
      setDraft("");
      await refresh(selectedPhone);
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-[#25D366]/10">
          <MessageCircle className="size-5 text-[#25D366]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Conversazioni WhatsApp</h1>
          <p className="text-xs text-muted-foreground">
            {phoneNumber} · {totalUnread > 0 ? `${totalUnread} messaggi non letti` : "Tutte le chat lette"}
          </p>
        </div>
        <Button onClick={() => setNewChatOpen(true)}>
          <Plus className="size-4" />
          Scrivi a una cliente
        </Button>
      </div>

      <div className="flex h-[calc(100vh-220px)] min-h-[500px] overflow-hidden rounded-2xl border border-border shadow-sm">
        <div className={cn("flex w-full shrink-0 flex-col border-r bg-card md:w-72", selected && "hidden md:flex")}>
          <div className="border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cerca conversazione..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9 text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {conversations.length === 0 ? "Nessuna conversazione ancora: i messaggi delle clienti arriveranno qui." : "Nessun risultato."}
              </p>
            ) : null}
            {filtered.map((conv) => (
              <button
                key={conv.phone}
                type="button"
                onClick={() => {
                  setSelectedPhone(conv.phone);
                  setThread(null);
                }}
                className={cn(
                  "flex w-full items-start gap-3 border-b p-3 text-left transition-colors hover:bg-muted/50",
                  selectedPhone === conv.phone && "bg-mint-soft hover:bg-mint-soft"
                )}
              >
                <div className="relative shrink-0">
                  <Avatar initials={initials(conv.name)} className="size-9 text-xs" />
                  {conv.unread > 0 && (
                    <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[#25D366] text-[9px] font-bold text-white">
                      {conv.unread}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-sm", conv.unread > 0 ? "font-bold" : "font-medium")}>{conv.name}</span>
                    <span className={cn("shrink-0 text-[10px]", conv.unread > 0 ? "font-semibold text-[#25D366]" : "text-muted-foreground")}>
                      {shortTime(conv.lastAt)}
                    </span>
                  </div>
                  <p className={cn("truncate text-xs", conv.unread > 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {conv.lastDirection === "OUTBOUND" ? "Tu: " : ""}
                    {conv.lastMessage}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className={cn("flex flex-1 flex-col bg-[#f0f2f5]", !selected && "hidden md:flex")}>
          {selected ? (
            <>
              <div className="flex items-center gap-3 border-b bg-card px-4 py-3 shadow-sm">
                <button type="button" className="text-sm text-muted-foreground md:hidden" onClick={() => setSelectedPhone(null)}>
                  ←
                </button>
                <Avatar initials={initials(selected.name)} className="size-9 text-xs" />
                <div className="min-w-0 flex-1">
                  {selected.clientId ? (
                    <Link href={`/dashboard/clients/${selected.clientId}`} className="text-sm font-semibold hover:underline">
                      {selected.name}
                    </Link>
                  ) : (
                    <div className="text-sm font-semibold">{selected.name}</div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="size-3" />+{selected.phone}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {thread === null ? <p className="text-center text-sm text-muted-foreground">Caricamento…</p> : null}
                {thread?.messages.map((msg) => <Bubble key={msg.id} message={msg} />)}
                <div ref={bottomRef} />
              </div>

              <div className="border-t bg-card px-4 py-3">
                {thread && !thread.windowOpen ? (
                  <div className="flex flex-col items-center gap-2 py-1 text-center sm:flex-row sm:text-left">
                    <p className="flex-1 text-sm text-muted-foreground">
                      Per riaprire la chat scegli uno dei messaggi pronti. Appena {firstNameOf(selected.name) || "la cliente"} risponde,
                      potrai scriverle quello che vuoi.
                    </p>
                    <Button
                      size="lg"
                      className="bg-[#25D366] text-white hover:bg-[#20bd5a]"
                      onClick={() => setTemplateFor({ phone: selected.phone, clientId: selected.clientId ?? undefined, name: selected.name })}
                    >
                      <FileText className="size-4" />
                      Scegli un messaggio pronto
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={`Scrivi a ${firstNameOf(selected.name) || "questa cliente"}…`}
                      value={draft}
                      disabled={!thread}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      className="flex-1 rounded-full border-muted bg-muted/50 text-sm"
                    />
                    <Button
                      size="icon"
                      onClick={send}
                      disabled={!draft.trim() || isSending}
                      aria-label="Invia"
                      className="size-10 shrink-0 rounded-full bg-[#25D366] text-white hover:bg-[#20bd5a]"
                    >
                      <Send className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Seleziona una conversazione</div>
          )}
        </div>
      </div>

      <TemplateSendDialog
        target={templateFor}
        onClose={() => setTemplateFor(null)}
        onSent={(phone) => {
          setTemplateFor(null);
          setSelectedPhone(phone);
          void refresh(phone);
        }}
      />

      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onPick={(target) => {
          setNewChatOpen(false);
          setTemplateFor(target);
        }}
      />
    </div>
  );
}

/** Vocale da ascoltare, foto da vedere, file da aprire (scaricati al momento tramite Fusion WA). */
function MediaPreview({ media }: { media: NonNullable<MessageDTO["media"]> }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <p className="text-xs text-zinc-500">File non più disponibile (WhatsApp lo tiene circa 30 giorni).</p>;
  }
  if (media.kind === "audio") {
    return <audio controls preload="none" src={media.url} onError={() => setFailed(true)} className="my-1 h-10 w-64 max-w-full" />;
  }
  if (media.kind === "image") {
    return (
      <a href={media.url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media.url} alt="Foto" loading="lazy" onError={() => setFailed(true)} className="my-1 max-h-64 rounded-lg object-cover" />
      </a>
    );
  }
  if (media.kind === "video") {
    return <video controls preload="none" src={media.url} onError={() => setFailed(true)} className="my-1 max-h-64 rounded-lg" />;
  }
  return (
    <a href={media.url} target="_blank" rel="noopener noreferrer" className="my-1 block text-sm font-medium text-sky-700 underline">
      Apri il file
    </a>
  );
}

function Bubble({ message }: { message: MessageDTO }) {
  const outbound = message.direction === "OUTBOUND";
  const StatusIcon =
    message.status === "READ" || message.status === "DELIVERED" ? CheckCheck : message.status === "FAILED" ? AlertCircle : message.status === "SENT" ? Check : Clock;
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2 shadow-sm",
          outbound ? "rounded-tr-sm bg-[#dcf8c6] text-zinc-900" : "rounded-tl-sm bg-white text-zinc-900",
          message.status === "FAILED" && "ring-1 ring-red-300"
        )}
      >
        {message.automatic ? (
          <p className="mb-0.5 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">Messaggio automatico</p>
        ) : null}
        {message.media ? <MediaPreview media={message.media} /> : null}
        {message.media && /^(🎤 Messaggio vocale|📷 Foto|🎥 Video|Sticker)$/.test(message.body) ? null : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.body}</p>
        )}
        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-zinc-400">
          {timeFormatter.format(new Date(message.createdAt))}
          {outbound ? <StatusIcon className={cn("size-3", message.status === "READ" && "text-sky-500", message.status === "FAILED" && "text-red-500")} /> : null}
        </p>
        {message.status === "FAILED" ? (
          <p className="mt-1 text-[11px] text-red-600" title={message.error ?? undefined}>
            {friendlyError(message.error)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Testo del messaggio pronto con le parti già compilate (le mancanti restano "…"). */
function fillPreview(body: string, values: string[]) {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => values[Number(n) - 1]?.trim() || "…");
}

/**
 * Messaggi pronti (template approvati da Meta) mostrati come cartoline da toccare:
 * il nome della cliente e quello del centro si compilano da soli, eventuali altre
 * parti si scrivono in un campo con il testo intorno ben visibile.
 */
function TemplateSendDialog({
  target,
  onClose,
  onSent,
}: {
  target: { phone?: string; clientId?: string; name: string } | null;
  onClose: () => void;
  onSent: (phone: string) => void;
}) {
  const [templates, setTemplates] = useState<InboxTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<InboxTemplate | null>(null);
  const [values, setValues] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const open = target !== null;
  const firstName = target ? firstNameOf(target.name) : "";

  useEffect(() => {
    if (!open || templates) return;
    getApprovedTemplates(target?.clientId).then((result) => {
      if (result.success) setTemplates(result.templates);
      else setError("Non riesco a caricare i messaggi pronti. Riprova tra poco.");
    });
  }, [open, templates, target?.clientId]);

  function close() {
    setChosen(null);
    setValues([]);
    // La prossima cliente può avere altri valori già compilati.
    setTemplates(null);
    onClose();
  }

  function choose(template: InboxTemplate) {
    setChosen(template);
    setValues(defaultsFor(template));
  }

  const missing = chosen ? values.some((v) => !v.trim()) : true;

  // Valori noti dal server; per un numero senza scheda il nome lo prendiamo da quello della chat.
  function defaultsFor(template: InboxTemplate) {
    return template.defaults.map((value, i) => value || (i === 0 && !target?.clientId ? firstName : ""));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{chosen ? "Controlla e invia" : `Cosa vuoi mandare a ${target?.name ?? ""}?`}</DialogTitle>
          <DialogDescription>
            {chosen ? "Ecco il messaggio che riceverà. Se manca qualcosa, completalo qui sotto." : "Tocca il messaggio che vuoi inviare."}
          </DialogDescription>
        </DialogHeader>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {templates === null && !error ? <p className="text-sm text-muted-foreground">Un attimo…</p> : null}
        {templates && templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Non ci sono ancora messaggi pronti. Chiedi a chi gestisce il gestionale di prepararli.
          </p>
        ) : null}

        {templates && templates.length > 0 && !chosen ? (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {templates.map((template) => (
              <button
                key={`${template.name}|${template.language}`}
                type="button"
                onClick={() => choose(template)}
                className="w-full rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-4 py-3 text-left text-sm whitespace-pre-line text-zinc-900 shadow-sm transition hover:brightness-95"
              >
                {fillPreview(template.body, defaultsFor(template))}
              </button>
            ))}
          </div>
        ) : null}

        {chosen ? (
          <div className="space-y-4">
            <div className="rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-4 py-3 text-sm whitespace-pre-line text-zinc-900 shadow-sm">
              {fillPreview(chosen.body, values)}
            </div>
            {values.map((value, i) => {
              // Le parti già note restano nascoste: si chiede solo quello che manca.
              if (defaultsFor(chosen)[i]) return null;
              const hint = chosen.hints[i];
              const around = chosen.body.split(`{{${i + 1}}}`);
              const before = (around[0] ?? "").replace(/\{\{\d+\}\}/g, "…").slice(-30);
              const after = (around[1] ?? "").replace(/\{\{\d+\}\}/g, "…").slice(0, 30);
              return (
                <div key={i} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {hint ? (
                      <span className="font-semibold text-foreground">{hint}</span>
                    ) : (
                      <>
                        Completa: «{before.trimStart()} <span className="font-semibold text-foreground">______</span> {after.trimEnd()}»
                      </>
                    )}
                  </Label>
                  <Input
                    autoFocus={values.findIndex((v) => !v.trim()) === i}
                    value={value}
                    onChange={(e) => {
                      const next = [...values];
                      next[i] = e.target.value;
                      setValues(next);
                    }}
                    placeholder="Scrivi qui"
                  />
                </div>
              );
            })}
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setChosen(null)}>
                ← Altri messaggi
              </Button>
              <Button
                size="lg"
                className="bg-[#25D366] text-white hover:bg-[#20bd5a]"
                disabled={missing || isPending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await sendTemplateMessage({
                      phone: target?.phone,
                      clientId: target?.clientId,
                      templateName: chosen.name,
                      language: chosen.language,
                      params: values,
                    });
                    if (!result.success) {
                      toast.error("Messaggio non inviato. Riprova tra poco.");
                      return;
                    }
                    toast.success("Messaggio inviato!");
                    setChosen(null);
                    setValues([]);
                    setTemplates(null);
                    onSent(result.phone);
                  })
                }
              >
                <Send className="size-4" />
                {isPending ? "Invio…" : missing ? "Completa il messaggio" : "Invia"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NewChatDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (target: { clientId: string; name: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; firstName: string; lastName: string; phone: string }[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => {
      searchClientsForChat(query).then(setResults);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>A chi vuoi scrivere?</DialogTitle>
          <DialogDescription>Scrivi il nome o il numero della cliente e toccala.</DialogDescription>
        </DialogHeader>
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Es. Giulia o 333…" />
        <ul className="max-h-72 divide-y overflow-y-auto">
          {(query.trim().length < 2 ? [] : results).map((client) => (
            <li key={client.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-sm hover:bg-muted"
                onClick={() => onPick({ clientId: client.id, name: `${client.firstName} ${client.lastName}`.trim() })}
              >
                <span className="font-medium">
                  {client.firstName} {client.lastName}
                </span>
                <span className="text-xs text-muted-foreground">{client.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
