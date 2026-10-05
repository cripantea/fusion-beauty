"use client";

import { MessageCircle, Phone, Search, Send } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ── Demo data ─────────────────────────────────────────────────────────────────

type Message = {
  id: number;
  from: "client" | "center";
  text: string;
  time: string;
  read?: boolean;
};

type Conversation = {
  id: number;
  name: string;
  initials: string;
  phone: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
  messages: Message[];
};

const DEMO_CONVERSATIONS: Conversation[] = [
  {
    id: 1,
    name: "Sofia Ferretti",
    initials: "SF",
    phone: "+39 333 234 5678",
    lastMessage: "Perfetto, a lunedì allora! 😊",
    lastTime: "10:32",
    unread: 0,
    messages: [
      { id: 1, from: "client", text: "Ciao! Volevo prenotare una pulizia viso per la prossima settimana 🌿", time: "Lun 09:14" },
      { id: 2, from: "center", text: "Ciao Sofia! Certo, abbiamo disponibilità lunedì 7 alle 10:30 o martedì 8 alle 15:00. Quale preferisci?", time: "Lun 09:22" },
      { id: 3, from: "client", text: "Lunedì alle 10:30 perfetto!", time: "Lun 09:25" },
      { id: 4, from: "center", text: "Ottimo! Ti confermo la prenotazione: Pulizia viso profonda — lunedì 7 ottobre alle 10:30. A presto! ✨", time: "Lun 09:26" },
      { id: 5, from: "client", text: "Perfetto, a lunedì allora! 😊", time: "Lun 10:32" },
    ],
  },
  {
    id: 2,
    name: "Giulia Moretti",
    initials: "GM",
    phone: "+39 347 891 2345",
    lastMessage: "Ok grazie mille!!",
    lastTime: "Ieri",
    unread: 2,
    messages: [
      { id: 1, from: "client", text: "Buongiorno! Avete ancora posti per la laminazione ciglia questa settimana?", time: "Mar 11:05" },
      { id: 2, from: "center", text: "Buongiorno Giulia! Sì, abbiamo giovedì 10 alle 14:00 disponibile. Va bene?", time: "Mar 11:18" },
      { id: 3, from: "client", text: "Sì perfetto! Quanto dura?", time: "Mar 11:20" },
      { id: 4, from: "center", text: "La laminazione ciglia dura circa 60 minuti. Il prezzo è €60.", time: "Mar 11:22" },
      { id: 5, from: "client", text: "Ok grazie mille!!", time: "Mar 11:23" },
      { id: 6, from: "client", text: "Ah, devo portare qualcosa?", time: "Ieri 18:41" },
      { id: 7, from: "client", text: "O c'è qualcosa che devo evitare prima?", time: "Ieri 18:42" },
    ],
  },
  {
    id: 3,
    name: "Laura Bianchi",
    initials: "LB",
    phone: "+39 328 456 7890",
    lastMessage: "Vi mando il modulo firmato!",
    lastTime: "Ieri",
    unread: 1,
    messages: [
      { id: 1, from: "center", text: "Ciao Laura! Ti ricordiamo che hai il laser 808 domani alle 11:00 🌟 Ti aspettiamo!", time: "Mer 15:00" },
      { id: 2, from: "client", text: "Grazie del promemoria! A domani 😊", time: "Mer 15:45" },
      { id: 3, from: "center", text: "Laura, ti inviamo il consenso informato da firmare digitalmente prima della seduta: beauty.fusionsoft.it/c/abc123", time: "Mer 16:00" },
      { id: 4, from: "client", text: "Vi mando il modulo firmato!", time: "Mer 16:30" },
    ],
  },
  {
    id: 4,
    name: "Anna Russo",
    initials: "AR",
    phone: "+39 335 123 4567",
    lastMessage: "Grazie! Ci vediamo venerdì 🙏",
    lastTime: "Lun",
    unread: 0,
    messages: [
      { id: 1, from: "client", text: "Ciao! Posso spostare l'appuntamento di venerdì alle 10 invece delle 9?", time: "Lun 08:30" },
      { id: 2, from: "center", text: "Certo Anna! Ho spostato alle 10:00. A venerdì!", time: "Lun 09:05" },
      { id: 3, from: "client", text: "Grazie! Ci vediamo venerdì 🙏", time: "Lun 09:10" },
    ],
  },
  {
    id: 5,
    name: "Emma Colombo",
    initials: "EC",
    phone: "+39 392 678 9012",
    lastMessage: "Non vedo l'ora ✨",
    lastTime: "Dom",
    unread: 0,
    messages: [
      { id: 1, from: "center", text: "Ciao Emma! Sono passati 3 mesi dall'ultimo trattamento. Vuoi prenotare un nuovo appuntamento? 🌿", time: "Dom 10:00" },
      { id: 2, from: "client", text: "Sì! Avevo bisogno di questo messaggio haha. Avete posto mercoledì?", time: "Dom 11:22" },
      { id: 3, from: "center", text: "Assolutamente! Mercoledì 9 alle 16:30 — perfetto per un trattamento viso ossigenante 🌸", time: "Dom 11:30" },
      { id: 4, from: "client", text: "Non vedo l'ora ✨", time: "Dom 11:35" },
    ],
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function MessagesManager() {
  const [conversations, setConversations] = useState(DEMO_CONVERSATIONS);
  const [selected, setSelected] = useState<Conversation>(DEMO_CONVERSATIONS[0]);
  const [search, setSearch] = useState("");
  const [newMessage, setNewMessage] = useState("");

  function selectConversation(conv: Conversation) {
    setSelected(conv);
    // Mark as read
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread: 0 } : c))
    );
  }

  function sendMessage() {
    const text = newMessage.trim();
    if (!text) return;
    const msg: Message = {
      id: Date.now(),
      from: "center",
      text,
      time: new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
    };
    const updated = { ...selected, messages: [...selected.messages, msg], lastMessage: text, lastTime: "Ora" };
    setSelected(updated);
    setConversations((prev) => prev.map((c) => (c.id === selected.id ? updated : c)));
    setNewMessage("");
  }

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-[#25D366]/10">
          <MessageCircle className="size-5 text-[#25D366]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Conversazioni WhatsApp</h1>
          <p className="text-xs text-muted-foreground">
            {totalUnread > 0 ? `${totalUnread} messaggi non letti` : "Tutte le chat aggiornate"} · Demo
          </p>
        </div>
        <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
          Demo — integrazione WhatsApp Business in arrivo
        </span>
      </div>

      <div className="flex h-[calc(100vh-220px)] min-h-[500px] overflow-hidden rounded-2xl border border-border shadow-sm">
        {/* Conversation list */}
        <div className="flex w-72 shrink-0 flex-col border-r bg-card">
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
            {filtered.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => selectConversation(conv)}
                className={cn(
                  "flex w-full items-start gap-3 border-b p-3 text-left transition-colors hover:bg-muted/50",
                  selected.id === conv.id && "bg-mint-soft hover:bg-mint-soft"
                )}
              >
                <div className="relative shrink-0">
                  <Avatar initials={conv.initials} className="size-9 text-xs" />
                  {conv.unread > 0 && (
                    <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[#25D366] text-[9px] font-bold text-white">
                      {conv.unread}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-sm", conv.unread > 0 ? "font-bold text-foreground" : "font-medium text-foreground")}>
                      {conv.name}
                    </span>
                    <span className={cn("text-[10px] shrink-0", conv.unread > 0 ? "text-[#25D366] font-semibold" : "text-muted-foreground")}>
                      {conv.lastTime}
                    </span>
                  </div>
                  <p className={cn("truncate text-xs", conv.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
                    {conv.lastMessage}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat window */}
        <div className="flex flex-1 flex-col bg-[#f0f2f5]">
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b bg-card px-4 py-3 shadow-sm">
            <Avatar initials={selected.initials} className="size-9 text-xs" />
            <div className="flex-1">
              <div className="text-sm font-semibold">{selected.name}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="size-3" />
                {selected.phone}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-2 p-4">
            {selected.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.from === "center" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl px-3.5 py-2 shadow-sm",
                    msg.from === "center"
                      ? "rounded-tr-sm bg-[#dcf8c6] text-zinc-900"
                      : "rounded-tl-sm bg-white text-zinc-900"
                  )}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  <p className="mt-1 text-right text-[10px] text-zinc-400">{msg.time}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Message input */}
          <div className="border-t bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Scrivi un messaggio..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                className="flex-1 rounded-full border-muted bg-muted/50 text-sm"
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                className="size-10 shrink-0 rounded-full bg-[#25D366] text-white hover:bg-[#20bd5a]"
              >
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
