"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  ChevronDown,
  Check,
  Play,
  Users,
  Calendar,
  Bell,
  BarChart3,
  ClipboardList,
  ArrowRight,
  Star,
  Clock,
  TrendingUp,
  Shield,
  MessageSquare,
  Sparkles,
} from "lucide-react";

// Dual-flame logo matching the FusionWA / Fusion Beauty brand mark
function FusionFlame({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 62 78"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M 24 74 C 6 68 0 50 10 32 C 16 20 22 12 22 2 C 34 12 42 30 38 50 C 36 60 28 66 26 72 Z"
        fill="currentColor"
      />
      <path
        d="M 36 74 C 34 64 34 56 38 48 C 44 36 52 24 52 12 C 52 4 50 0 52 0 C 66 10 74 32 68 52 C 62 68 52 76 38 76 Z"
        fill="currentColor"
      />
    </svg>
  );
}
import Link from "next/link";

// ─── Utilities ─────────────────────────────────────────────────────────────

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── Animation helpers ──────────────────────────────────────────────────────

function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

// ─── Mock UI components ─────────────────────────────────────────────────────

function BrowserFrame({
  children,
  url = "app.beautycrm.it",
}: {
  children: React.ReactNode;
  url?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 shadow-2xl shadow-zinc-200/60 bg-white">
      <div className="flex items-center gap-3 bg-zinc-50 border-b border-zinc-200 px-4 py-3">
        <div className="flex gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-zinc-400 border border-zinc-200 font-mono truncate">
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}

function MockDashboard() {
  const kpis = [
    { label: "Appuntamenti oggi", value: "8", sub: "3 completati", color: "text-zinc-900" },
    { label: "Incasso oggi", value: "€340", sub: "💳 €180 · 💵 €160", color: "text-zinc-900" },
    { label: "Nuove clienti", value: "5", sub: "127 totali in archivio", color: "text-zinc-900" },
    { label: "Clienti inattive", value: "12", sub: "non tornano da 90+ gg", color: "text-amber-600", border: "border-amber-200" },
  ];
  const appointments = [
    { time: "09:00", name: "Sofia Ferretti", service: "Pulizia viso profonda", price: "€65", status: "Completato", statusColor: "bg-green-100 text-green-700" },
    { time: "10:30", name: "Maria Bianchi", service: "Filo sopracciglia", price: "€25", status: "Confermato", statusColor: "bg-blue-100 text-blue-700" },
    { time: "11:30", name: "Giulia Moretti", service: "Peeling ossigenante", price: "€120", status: "Confermato", statusColor: "bg-blue-100 text-blue-700" },
    { time: "14:00", name: "Anna Russo", service: "Ricostruzione unghie", price: "€55", status: "Prenotato", statusColor: "bg-zinc-100 text-zinc-600" },
  ];
  return (
    <div className="p-4 space-y-4 bg-[oklch(0.987_0.005_80)]" style={{ fontSize: "12px" }}>
      <div className="grid grid-cols-4 gap-2">
        {kpis.map((k) => (
          <div key={k.label} className={cn("bg-white rounded-lg border p-2.5", k.border ?? "border-zinc-200")}>
            <div className="text-zinc-500 text-[10px] leading-tight">{k.label}</div>
            <div className={cn("text-xl font-bold mt-0.5", k.color)}>{k.value}</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-zinc-100 flex justify-between items-center">
          <span className="font-semibold text-zinc-800">Appuntamenti di oggi</span>
          <span className="text-[10px] text-primary font-medium">Apri agenda →</span>
        </div>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-zinc-100">
              {["Ora", "Cliente", "Trattamento", "€", "Stato"].map((h) => (
                <th key={h} className="text-left px-3 py-1.5 text-zinc-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.time} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                <td className="px-3 py-1.5 font-medium text-zinc-800">{a.time}</td>
                <td className="px-3 py-1.5 text-primary font-medium">{a.name}</td>
                <td className="px-3 py-1.5 text-zinc-700">{a.service}</td>
                <td className="px-3 py-1.5 text-zinc-700">{a.price}</td>
                <td className="px-3 py-1.5">
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", a.statusColor)}>{a.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MockClientCard() {
  return (
    <div className="p-4 space-y-3 bg-[oklch(0.987_0.005_80)]" style={{ fontSize: "12px" }}>
      <div className="bg-white rounded-lg border border-zinc-200 p-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">SF</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-zinc-900 text-sm">Sofia Ferretti</span>
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded font-medium">VIP</span>
            </div>
            <div className="text-zinc-500 text-[11px] mt-0.5">📱 333 234 5678 · 📧 sofia.ferretti@email.it</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-100">
          {[
            { label: "Visite", value: "24" },
            { label: "Totale speso", value: "€2.340" },
            { label: "Segmento", value: "VIP" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-bold text-zinc-900 text-sm">{s.value}</div>
              <div className="text-[10px] text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-lg border border-zinc-200 p-3 space-y-2">
        <div className="font-semibold text-zinc-800 text-[11px] uppercase tracking-wide">Note</div>
        <div className="text-zinc-600 text-[11px] italic">"Sensibile agli acidi. Preferisce Marta come operatrice. Occhio ai rossori post-trattamento."</div>
      </div>
      <div className="bg-white rounded-lg border border-zinc-200 p-3">
        <div className="font-semibold text-zinc-800 text-[11px] uppercase tracking-wide mb-2">Ultimi appuntamenti</div>
        {[
          { date: "15 ott 2024", service: "Trattamento ossigenante", price: "€120" },
          { date: "22 set 2024", service: "Filo sopracciglia + tinta", price: "€35" },
          { date: "08 set 2024", service: "Peeling viso delicato", price: "€90" },
        ].map((a) => (
          <div key={a.date} className="flex justify-between items-center py-1 border-b border-zinc-50 last:border-0">
            <div>
              <span className="text-zinc-800 font-medium">{a.service}</span>
              <span className="text-zinc-400 ml-1">· {a.date}</span>
            </div>
            <span className="text-zinc-600 font-medium">{a.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockRequests() {
  const rows = [
    { name: "Alessia Conti", service: "Pulizia viso profonda", date: "Lunedì 10:00", status: "In attesa", statusColor: "bg-yellow-100 text-yellow-700" },
    { name: "Marco Ferrari", service: "Sopracciglia filo", date: "Martedì 15:30", status: "In attesa", statusColor: "bg-yellow-100 text-yellow-700" },
    { name: "Sara Martini", service: "Percorso viso 6 app.", date: "Mercoledì 11:00", status: "Confermata", statusColor: "bg-green-100 text-green-700" },
    { name: "Laura De Luca", service: "Ricostruzione unghie", date: "Giovedì 14:00", status: "In attesa", statusColor: "bg-yellow-100 text-yellow-700" },
  ];
  return (
    <div className="p-4 bg-[oklch(0.987_0.005_80)]" style={{ fontSize: "12px" }}>
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-800">Richieste di prenotazione</span>
            <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">3</span>
          </div>
          <div className="flex gap-1">
            {["In attesa", "Confermate", "Tutte"].map((f, i) => (
              <span key={f} className={cn("px-2 py-0.5 rounded text-[10px] font-medium border", i === 0 ? "bg-zinc-800 text-white border-zinc-800" : "border-zinc-200 text-zinc-600")}>{f}</span>
            ))}
          </div>
        </div>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-zinc-100">
              {["Cliente", "Trattamento", "Preferenza", "Stato", ""].map((h) => (
                <th key={h} className="text-left px-3 py-1.5 text-zinc-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                <td className="px-3 py-1.5 font-medium text-zinc-800">{r.name}</td>
                <td className="px-3 py-1.5 text-zinc-600">{r.service}</td>
                <td className="px-3 py-1.5 text-zinc-500">{r.date}</td>
                <td className="px-3 py-1.5">
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", r.statusColor)}>{r.status}</span>
                </td>
                <td className="px-3 py-1.5">
                  {r.status === "In attesa" && (
                    <div className="flex gap-1">
                      <span className="px-2 py-0.5 rounded border border-green-600 text-green-700 text-[10px] font-medium cursor-pointer hover:bg-green-50">Conferma</span>
                      <span className="px-2 py-0.5 rounded border border-red-400 text-red-600 text-[10px] font-medium cursor-pointer hover:bg-red-50">Rifiuta</span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MockFollowUp() {
  const clients = [
    { initials: "LB", name: "Laura Bianchi", inactive: "4 mesi fa", service: "Trattamento viso", visits: 12 },
    { initials: "EC", name: "Emma Colombo", inactive: "3 mesi fa", service: "Percorso corpo", visits: 8 },
    { initials: "AR", name: "Alice Romano", inactive: "5 mesi fa", service: "Ricostruzione unghie", visits: 6 },
    { initials: "VG", name: "Valentina Greco", inactive: "3 mesi fa", service: "Pulizia viso", visits: 18 },
  ];
  return (
    <div className="p-4 bg-[oklch(0.987_0.005_80)] space-y-3" style={{ fontSize: "12px" }}>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="font-semibold text-amber-900">12 clienti non tornano da 90+ giorni</div>
        <div className="text-amber-700 text-[11px] mt-0.5">Queste clienti potrebbero aver bisogno di un contatto.</div>
      </div>
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="px-3 py-2 border-b border-zinc-100 flex items-center justify-between">
          <span className="font-semibold text-zinc-800">Clienti inattive</span>
          <span className="text-[10px] text-zinc-500">Ultima visita 90+ giorni fa</span>
        </div>
        <div className="divide-y divide-zinc-50">
          {clients.map((c) => (
            <div key={c.name} className="flex items-center px-3 py-2 hover:bg-zinc-50/50">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0 mr-2">{c.initials}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-800">{c.name}</div>
                <div className="text-[10px] text-zinc-500">Ultima visita: {c.inactive} · {c.service}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-zinc-400">{c.visits} visite</span>
                <span className="px-2 py-0.5 rounded border border-primary text-primary text-[10px] font-medium cursor-pointer">Richiama</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Demo Modal ─────────────────────────────────────────────────────────────

type DemoModalProps = { open: boolean; onClose: () => void };

function DemoModal({ open, onClose }: DemoModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", center: "", email: "", phone: "",
    preferredTime: "", collaborators: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    setLoading(false);
    setSubmitted(true);
  }

  useEffect(() => {
    if (!open) {
      setTimeout(() => { setSubmitted(false); setForm({ name: "", center: "", email: "", phone: "", preferredTime: "", collaborators: "" }); }, 300);
    }
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <div>
                  <div className="font-bold text-lg text-zinc-900">Prenota una demo</div>
                  <div className="text-sm text-zinc-500 mt-0.5">Ti mostriamo Fusion Beauty sul tuo processo reale.</div>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {submitted ? (
                <div className="px-6 py-10 text-center">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-xl font-bold text-zinc-900 mb-2">Richiesta ricevuta!</div>
                  <div className="text-zinc-500 text-sm">Ti contatteremo entro 24 ore per confermare giorno e orario della demo.</div>
                  <button onClick={onClose} className="mt-6 px-6 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
                    Chiudi
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Nome e cognome *</label>
                      <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Sofia Ferretti" className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Centro estetico *</label>
                      <input required value={form.center} onChange={(e) => setForm((f) => ({ ...f, center: e.target.value }))}
                        placeholder="Il Tuo Centro Beauty" className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Email *</label>
                      <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="sofia@tuocentro.it" className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Telefono *</label>
                      <input required type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="333 123 4567" className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Fascia oraria preferita</label>
                      <select value={form.preferredTime} onChange={(e) => setForm((f) => ({ ...f, preferredTime: e.target.value }))}
                        className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
                        <option value="">Qualsiasi</option>
                        <option value="mattina">Mattina (9–12)</option>
                        <option value="pomeriggio">Pomeriggio (14–18)</option>
                        <option value="sera">Tardo pomeriggio (18–20)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">N. collaboratori <span className="text-zinc-400">(opz.)</span></label>
                      <select value={form.collaborators} onChange={(e) => setForm((f) => ({ ...f, collaborators: e.target.value }))}
                        className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all">
                        <option value="">—</option>
                        <option value="solo">Solo io</option>
                        <option value="2-3">2–3 persone</option>
                        <option value="4-6">4–6 persone</option>
                        <option value="7+">7 o più</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                    {loading ? "Invio in corso…" : <><span>Prenota la demo</span><ArrowRight className="w-4 h-4" /></>}
                  </button>
                  <p className="text-xs text-zinc-400 text-center">Nessun impegno. Ti contatteremo entro 24 ore.</p>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Navbar ─────────────────────────────────────────────────────────────────

function Navbar({ onDemoClick }: { onDemoClick: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "#come-funziona", label: "Come funziona" },
    { href: "#funzionalita", label: "Funzionalità" },
    { href: "#prezzi", label: "Prezzi" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
      scrolled ? "bg-white/95 backdrop-blur-md border-b border-zinc-100 shadow-sm" : "bg-white/90 backdrop-blur-sm"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2 font-bold text-xl text-zinc-900">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <FusionFlame className="w-[18px] h-[22px] text-white" />
            </div>
            <span>Fusion<span className="text-primary">Beauty</span></span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors font-medium">{l.label}</a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors font-medium px-3 py-2 rounded-lg hover:bg-zinc-50">Accedi</Link>
            <button onClick={onDemoClick} className="text-sm font-semibold bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary/90 active:scale-[0.98] transition-all">
              Prenota una demo
            </button>
          </div>
          <button className="md:hidden p-2 rounded-lg text-zinc-600 hover:bg-zinc-100" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="md:hidden bg-white border-t border-zinc-100 px-4 pb-4"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="space-y-1 pt-3">
              {navLinks.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                  className="block py-2.5 px-3 rounded-xl text-zinc-700 hover:bg-zinc-50 font-medium text-sm">{l.label}</a>
              ))}
              <div className="pt-3 space-y-2">
                <Link href="/login" className="block py-2.5 px-3 rounded-xl text-zinc-700 hover:bg-zinc-50 font-medium text-sm text-center border border-zinc-200">Accedi</Link>
                <button onClick={() => { setMobileOpen(false); onDemoClick(); }}
                  className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm">
                  Prenota una demo
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero({ onDemoClick }: { onDemoClick: () => void }) {
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/8 text-primary rounded-full text-sm font-medium mb-6">
                <FusionFlame className="w-3.5 h-4 text-primary" />
                <span>CRM progettato per centri estetici</span>
              </div>
            </motion.div>
            <motion.h1
              className="text-4xl sm:text-5xl lg:text-5xl xl:text-6xl font-bold text-zinc-900 leading-[1.1] tracking-tight"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.07 }}
            >
              Ogni cliente.<br />
              Ogni follow-up.<br />
              <span className="text-primary">Tutto sotto controllo.</span>
            </motion.h1>
            <motion.p
              className="mt-5 text-lg text-zinc-500 leading-relaxed max-w-lg"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.13 }}
            >
              Fusion Beauty ti aiuta a organizzare clienti, trattamenti, follow-up e richieste online in un unico sistema pensato per il tuo centro estetico.
            </motion.p>
            <motion.div
              className="flex flex-wrap gap-3 mt-8"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
            >
              <button onClick={onDemoClick}
                className="flex items-center gap-2 px-6 py-3.5 bg-primary text-white rounded-xl font-semibold text-base hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20">
                Prenota una demo
                <ArrowRight className="w-4 h-4" />
              </button>
              <a href="#video-demo"
                className="flex items-center gap-2 px-6 py-3.5 border border-zinc-200 text-zinc-700 rounded-xl font-semibold text-base hover:bg-zinc-50 hover:border-zinc-300 active:scale-[0.98] transition-all">
                <Play className="w-4 h-4" />
                Guarda come funziona
              </a>
            </motion.div>
            <motion.div
              className="flex flex-wrap items-center gap-5 mt-8 pt-8 border-t border-zinc-100"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {[
                "Nessun costo di attivazione",
                "Pensato per centri estetici",
                "Demo sul tuo processo reale",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-zinc-500">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </motion.div>
          </div>
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          >
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/5 to-accent/30 rounded-3xl -z-10" />
            <BrowserFrame url="app.beautycrm.it/dashboard">
              <MockDashboard />
            </BrowserFrame>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Social Proof ────────────────────────────────────────────────────────────

function SocialProof() {
  return (
    <section className="py-10 border-y border-zinc-100 bg-zinc-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
          <p className="text-sm font-medium text-zinc-500 shrink-0">Già utilizzato da centri estetici reali</p>
          <div className="w-px h-6 bg-zinc-200 hidden sm:block" />
          <div className="flex flex-wrap justify-center gap-4">
            <div className="px-5 py-2.5 bg-white rounded-xl border border-zinc-200 text-zinc-400 text-sm font-medium">
              Centro Estetico ·  <span className="text-zinc-600 font-semibold">Milano</span>
            </div>
            <div className="px-5 py-2.5 bg-white rounded-xl border border-zinc-200 text-zinc-400 text-sm font-medium">
              Beauty Center ·  <span className="text-zinc-600 font-semibold">Roma</span>
            </div>
            <div className="px-5 py-2.5 bg-white rounded-xl border border-zinc-200 text-zinc-400 text-sm font-medium text-xs italic">
              + altri centri in onboarding
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Problem ─────────────────────────────────────────────────────────────────

function Problem() {
  const problems = [
    {
      icon: MessageSquare,
      title: "Una nuova cliente scrive su WhatsApp. Finisce dimenticata.",
      desc: "Senza un sistema, i nuovi contatti si perdono nelle chat personali. Nessuno sa chi deve rispondere, né quando.",
    },
    {
      icon: Clock,
      title: "Una cliente chiude un percorso. Nessuno la ricontatta.",
      desc: "Il momento migliore per proporre il prossimo trattamento passa. La cliente non torna, non per scelta, ma perché nessuno si è fatto sentire.",
    },
    {
      icon: Users,
      title: "Le informazioni di ogni cliente sono ovunque tranne che in un posto.",
      desc: "Agenda, chat, fogli Excel, note sul cellulare. Quando arriva la cliente, il team non ha subito il quadro completo di quello che ha fatto.",
    },
  ];

  return (
    <section className="py-20 md:py-28" id="come-funziona">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-block px-3 py-1 bg-red-50 text-red-600 rounded-full text-sm font-medium mb-4">Il problema</div>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 leading-tight">
              Il problema non è trovare clienti.<br />È ricordarsi cosa fare dopo.
            </h2>
            <p className="mt-4 text-lg text-zinc-500">Ogni titolare di centro estetico conosce bene queste situazioni.</p>
          </div>
        </FadeIn>
        <div className="grid md:grid-cols-3 gap-6">
          {problems.map((p, i) => (
            <FadeIn key={p.title} delay={i * 0.1}>
              <div className="bg-white rounded-2xl border border-zinc-200 p-6 hover:border-zinc-300 hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                  <p.icon className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="font-semibold text-zinc-900 text-base leading-snug mb-2">{p.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{p.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Feature: Scheda Cliente ─────────────────────────────────────────────────

function ClienteAlCentro() {
  const features = [
    "Nome, contatti, segmento e note in un secondo",
    "Storico completo di trattamenti e pagamenti",
    "Visita precedente e prossimo appuntamento sempre visibili",
    "Consensi privacy e trattamento documentati",
    "Operatrice preferita e annotazioni operative",
  ];
  return (
    <section className="py-20 md:py-28 bg-zinc-50/40" id="funzionalita">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <FadeIn>
            <div className="inline-block px-3 py-1 bg-primary/8 text-primary rounded-full text-sm font-medium mb-5">Scheda cliente</div>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 leading-tight mb-4">
              Tutta la storia del cliente, in un solo posto.
            </h2>
            <p className="text-lg text-zinc-500 mb-8">
              Ogni cliente ha una scheda completa. Il team vede subito trattamenti, pagamenti, note e prossimo appuntamento senza dover cercare da nessuna parte.
            </p>
            <ul className="space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5 shrink-0">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-zinc-700 text-sm">{f}</span>
                </li>
              ))}
            </ul>
          </FadeIn>
          <FadeIn delay={0.15}>
            <BrowserFrame url="app.beautycrm.it/dashboard/clients/sofia-ferretti">
              <MockClientCard />
            </BrowserFrame>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

// ─── Feature: Pipeline / Richieste ───────────────────────────────────────────

function PipelineSection() {
  const steps = [
    { label: "Arriva la richiesta online", icon: ClipboardList },
    { label: "Il team la vede e la gestisce", icon: Users },
    { label: "Si conferma e si crea l'appuntamento", icon: Calendar },
    { label: "La cliente diventa cliente attiva", icon: Star },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <FadeIn className="order-2 lg:order-1">
            <BrowserFrame url="app.beautycrm.it/dashboard/requests">
              <MockRequests />
            </BrowserFrame>
          </FadeIn>
          <FadeIn delay={0.15} className="order-1 lg:order-2">
            <div className="inline-block px-3 py-1 bg-primary/8 text-primary rounded-full text-sm font-medium mb-5">Richieste online</div>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 leading-tight mb-4">
              Dal primo contatto al cliente.
            </h2>
            <p className="text-lg text-zinc-500 mb-8">
              Le richieste di prenotazione arrivano direttamente nel CRM. Il team le vede, le gestisce e le trasforma in appuntamenti confermati — senza WhatsApp, senza fogli.
            </p>
            <div className="space-y-3">
              {steps.map((s, i) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                  <div className="flex items-center gap-2">
                    <s.icon className="w-4 h-4 text-primary/60" />
                    <span className="text-zinc-700 text-sm">{s.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

// ─── Feature: Follow-Up ──────────────────────────────────────────────────────

function FollowUpSection() {
  const items = [
    { icon: Bell, text: "Vedi le clienti che non tornano da 90+ giorni" },
    { icon: Users, text: "Identifica chi non ha un prossimo appuntamento" },
    { icon: Star, text: "Segmenta le VIP da quelle inattive" },
    { icon: TrendingUp, text: "Riduci il turnover delle clienti storiche" },
  ];
  return (
    <section className="py-20 md:py-28 bg-zinc-50/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <FadeIn>
            <div className="inline-block px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium mb-5">Clienti inattive</div>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 leading-tight mb-4">
              Il follow-up non deve dipendere dalla memoria.
            </h2>
            <p className="text-lg text-zinc-500 mb-8">
              Fusion Beauty identifica automaticamente le clienti che non tornano da più di 90 giorni. Sai subito chi ricontattare, senza dover ricordare o cercare.
            </p>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.text} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-white">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-amber-600" />
                  </div>
                  <span className="text-zinc-700 text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={0.15}>
            <BrowserFrame url="app.beautycrm.it/dashboard/clients?segment=inactive">
              <MockFollowUp />
            </BrowserFrame>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

// ─── Benefits ─────────────────────────────────────────────────────────────────

function Benefits() {
  const items = [
    { icon: Users, title: "Non perdere nuovi contatti", desc: "Le richieste online entrano nel sistema e vengono assegnate." },
    { icon: Bell, title: "Ricontatta al momento giusto", desc: "Vedi chi è inattivo. Sai quando e perché farlo." },
    { icon: BarChart3, title: "Centralizza le informazioni", desc: "Tutto il cliente in un posto. Storico, note, trattamenti, pagamenti." },
    { icon: Calendar, title: "Organizza l'agenda del centro", desc: "Appuntamenti, operatrici, trattamenti. Panoramica operativa ogni giorno." },
    { icon: TrendingUp, title: "Costruisci uno storico utile", desc: "Nel tempo accumuli informazioni che rendono il servizio migliore." },
    { icon: Shield, title: "Consensi privacy in ordine", desc: "Documenta e gestisci i consensi delle clienti in modo strutturato." },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center max-w-xl mx-auto mb-14">
            <div className="inline-block px-3 py-1 bg-primary/8 text-primary rounded-full text-sm font-medium mb-4">Benefici concreti</div>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 leading-tight">
              Meno memoria. Più controllo.
            </h2>
            <p className="mt-4 text-zinc-500">
              Fusion Beauty non aggiunge complessità — toglie il lavoro che oggi affidate alla fortuna.
            </p>
          </div>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.07}>
              <div className="p-6 rounded-2xl border border-zinc-100 bg-white hover:border-primary/30 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center mb-4 group-hover:bg-primary/12 transition-colors">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-zinc-900 mb-2">{item.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Prima / Dopo ─────────────────────────────────────────────────────────────

function PrimaDopo() {
  const prima = [
    { icon: MessageSquare, label: "WhatsApp personali" },
    { icon: Calendar, label: "Agenda cartacea" },
    { icon: Users, label: "Fogli Excel sparsi" },
    { icon: Clock, label: "Note sul telefono" },
    { icon: Bell, label: "Follow-up affidati alla memoria" },
    { icon: BarChart3, label: "Statistiche mai aggiornate" },
  ];
  const dopo = [
    { icon: Users, label: "Scheda cliente completa" },
    { icon: ClipboardList, label: "Richieste online centralizzate" },
    { icon: Calendar, label: "Agenda e appuntamenti integrati" },
    { icon: Bell, label: "Clienti inattive sempre visibili" },
    { icon: TrendingUp, label: "Storico e statistiche automatiche" },
    { icon: Shield, label: "Consensi e pagamenti documentati" },
  ];
  return (
    <section className="py-20 md:py-28 bg-zinc-50/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 leading-tight">
              Com'era. Com'è ora.
            </h2>
          </div>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-4">
          <FadeIn delay={0}>
            <div className="rounded-2xl border border-red-100 bg-red-50/50 p-6">
              <div className="text-sm font-semibold text-red-600 mb-5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-xs">✕</span>
                Prima
              </div>
              <div className="space-y-3">
                {prima.map((item) => (
                  <div key={item.label} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/60 border border-red-100/50">
                    <item.icon className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-zinc-600 text-sm">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="rounded-2xl border border-primary/20 bg-primary/4 p-6">
              <div className="text-sm font-semibold text-primary mb-5 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">✓</span>
                Con Fusion Beauty
              </div>
              <div className="space-y-3">
                {dopo.map((item) => (
                  <div key={item.label} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white border border-primary/10">
                    <item.icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-zinc-700 text-sm font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

// ─── Per chi è ────────────────────────────────────────────────────────────────

function PerChiE() {
  const cards = [
    {
      title: "Centro estetico indipendente",
      desc: "Lavori da sola o con una collaboratrice. Hai bisogno di tenere tutto in ordine senza strumenti complicati.",
      icon: Sparkles,
    },
    {
      title: "Beauty center con team",
      desc: "Hai più operatrici e vuoi che ognuna abbia le informazioni giuste sulle clienti assegnate.",
      icon: Users,
    },
    {
      title: "Centro con percorsi e pacchetti",
      desc: "Vendi trattamenti a pacchetto e hai bisogno di tracciare ogni sessione e ogni pagamento.",
      icon: Calendar,
    },
    {
      title: "Molti lead da ricontattare",
      desc: "Ricevi richieste dal sito, dai social, da WhatsApp e hai bisogno di non perderne nessuna.",
      icon: ClipboardList,
    },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center max-w-xl mx-auto mb-14">
            <div className="inline-block px-3 py-1 bg-primary/8 text-primary rounded-full text-sm font-medium mb-4">Per chi è</div>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 leading-tight">
              Fusion Beauty è pensato per…
            </h2>
            <p className="mt-4 text-zinc-500 text-sm">
              Non è un software di prenotazione appuntamenti. È uno strumento per gestire clienti, lead e processo commerciale del tuo centro.
            </p>
          </div>
        </FadeIn>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {cards.map((c, i) => (
            <FadeIn key={c.title} delay={i * 0.08}>
              <div className="p-6 rounded-2xl border border-zinc-100 bg-white hover:border-primary/30 hover:shadow-md transition-all h-full">
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center mb-4">
                  <c.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-zinc-900 mb-2 text-sm leading-snug">{c.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{c.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Video Demo ───────────────────────────────────────────────────────────────

function VideoDemo() {
  const [playing, setPlaying] = useState(false);
  return (
    <section id="video-demo" className="py-20 md:py-28 bg-zinc-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-10">
            <div className="inline-block px-3 py-1 bg-white/10 text-white/70 rounded-full text-sm font-medium mb-4">Demo del prodotto</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">Guarda Fusion Beauty in azione.</h2>
            <p className="mt-4 text-white/60 max-w-xl mx-auto">
              Un workflow reale: arriva un lead, entra nel sistema, la cliente viene seguita fino al trattamento successivo.
            </p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div
            className="relative aspect-video rounded-2xl overflow-hidden bg-zinc-800 border border-white/10 cursor-pointer group"
            onClick={() => setPlaying(true)}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.div
                className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform"
                whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.96 }}
              >
                <Play className="w-7 h-7 md:w-8 md:h-8 text-zinc-900 ml-1" />
              </motion.div>
              <p className="mt-4 text-white/50 text-sm">Demo disponibile a breve</p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

function Pricing({ onDemoClick }: { onDemoClick: () => void }) {
  const [annual, setAnnual] = useState(false);
  const features = [
    "Anagrafica clienti completa con segmentazione",
    "Scheda cliente con storico trattamenti e pagamenti",
    "Agenda e gestione appuntamenti",
    "Richieste di prenotazione online",
    "Dashboard operativa con KPI giornalieri",
    "Statistiche e report mensili",
    "Gestione consensi privacy",
    "Staff e operatrici multiple",
    "Widget prenotazione per il sito",
    "Assistenza dedicata",
  ];
  return (
    <section id="prezzi" className="py-20 md:py-28 bg-zinc-50/50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-10">
            <div className="inline-block px-3 py-1 bg-primary/8 text-primary rounded-full text-sm font-medium mb-4">Prezzi</div>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 leading-tight">Un piano. Nessuna sorpresa.</h2>
            <p className="mt-4 text-zinc-500">Nessun costo di attivazione. Disdici quando vuoi.</p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-lg overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="font-bold text-lg text-zinc-900">Fusion Beauty</div>
                <div className="flex items-center gap-2 bg-zinc-100 rounded-xl p-1">
                  <button onClick={() => setAnnual(false)} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-all", !annual ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500")}>Mensile</button>
                  <button onClick={() => setAnnual(true)} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5", annual ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500")}>
                    Annuale
                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-md font-semibold">−2 mesi</span>
                  </button>
                </div>
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={annual ? "annual" : "monthly"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-5xl font-bold text-zinc-900">{annual ? "€990" : "€99"}</span>
                    <span className="text-zinc-500 mb-2 text-base">/{annual ? "anno" : "mese"}</span>
                  </div>
                  {annual && <p className="text-sm text-primary font-medium mb-4">Equivale a €82,50/mese — due mesi gratuiti rispetto al mensile.</p>}
                </motion.div>
              </AnimatePresence>
              <ul className="space-y-2.5 my-6">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-zinc-700 text-sm">{f}</span>
                  </li>
                ))}
              </ul>
              <button onClick={onDemoClick}
                className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all">
                Prenota una demo
              </button>
              <p className="text-xs text-zinc-400 text-center mt-3">Ti mostriamo Fusion Beauty sul tuo processo reale. Nessun impegno.</p>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const faqs = [
  {
    q: "Fusion Beauty sostituisce il mio gestionale attuale?",
    a: "Fusion Beauty si concentra sulla gestione clienti, follow-up e richieste online. Se usi già un sistema per appuntamenti, puoi valutare se affiancarlo o sostituirlo — durante la demo ti mostriamo nel concreto com'è la migrazione.",
  },
  {
    q: "Posso importare i clienti che ho già?",
    a: "Sì. È possibile caricare i clienti esistenti. Durante l'onboarding ti supportiamo nel processo di importazione.",
  },
  {
    q: "Possono utilizzarlo più persone?",
    a: "Sì. Fusion Beauty supporta più operatrici con accesso differenziato. Ogni membro del team vede le informazioni rilevanti per il proprio ruolo.",
  },
  {
    q: "È adatto anche a un centro piccolo?",
    a: "Assolutamente. Fusion Beauty è pensato per centri di tutte le dimensioni, incluso chi lavora da solo o con una sola collaboratrice.",
  },
  {
    q: "Come funziona la demo?",
    a: "La demo è una video call di circa 30–45 minuti in cui ti mostriamo il prodotto applicato al tuo modo di lavorare. Nessuna presentazione generica — partiamo dal tuo centro.",
  },
  {
    q: "Quanto costa e ci sono costi di attivazione?",
    a: "€99/mese oppure €990/anno (equivale a due mesi gratuiti). Nessun costo di attivazione, nessuna commissione aggiuntiva.",
  },
  {
    q: "Posso disdire?",
    a: "Sì. Non ci sono vincoli di durata. Puoi disdire in qualsiasi momento dal tuo account.",
  },
  {
    q: "Serve installare qualcosa?",
    a: "No. Fusion Beauty è un'applicazione web — funziona su qualsiasi browser da computer, tablet o smartphone. Nessuna installazione richiesta.",
  },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-12">
            <div className="inline-block px-3 py-1 bg-primary/8 text-primary rounded-full text-sm font-medium mb-4">FAQ</div>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900">Domande frequenti</h2>
          </div>
        </FadeIn>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <FadeIn key={i} delay={i * 0.04}>
              <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-50 transition-colors"
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  <span className="font-medium text-zinc-900 text-sm pr-4">{faq.q}</span>
                  <ChevronDown className={cn("w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200", open === i && "rotate-180")} />
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4 text-zinc-500 text-sm leading-relaxed border-t border-zinc-100 pt-3">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Finale ───────────────────────────────────────────────────────────────

function CTAFinale({ onDemoClick }: { onDemoClick: () => void }) {
  return (
    <section className="py-20 md:py-28 bg-primary relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, white 0%, transparent 60%), radial-gradient(circle at 70% 50%, white 0%, transparent 60%)" }} />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        <FadeIn>
          <Sparkles className="w-8 h-8 text-white/60 mx-auto mb-5" />
          <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
            Scopri come Fusion Beauty può adattarsi al tuo centro.
          </h2>
          <p className="text-white/70 text-lg mb-8">
            Prenota una demo e guarda il prodotto applicato al tuo modo di lavorare. Nessuna presentazione generica.
          </p>
          <button
            onClick={onDemoClick}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary rounded-xl font-bold text-base hover:bg-white/95 active:scale-[0.98] transition-all shadow-lg"
          >
            Prenota una demo
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="mt-4 text-white/50 text-sm">Nessun impegno. Risposta entro 24 ore.</p>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-zinc-900 text-white/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid sm:grid-cols-3 gap-8 pb-8 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 font-bold text-white text-base mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <FusionFlame className="w-[15px] h-[18px] text-white" />
              </div>
              Fusion<span className="text-primary/80">Beauty</span>
            </div>
            <p className="text-sm leading-relaxed">Gestionale CRM progettato per centri estetici e beauty center.</p>
          </div>
          <div>
            <div className="font-semibold text-white/80 text-sm mb-3">Prodotto</div>
            <div className="space-y-2">
              {["Come funziona", "Funzionalità", "Prezzi", "FAQ"].map((l) => (
                <a key={l} href={`#${l.toLowerCase().replace(" ", "-")}`} className="block text-sm hover:text-white/80 transition-colors">{l}</a>
              ))}
            </div>
          </div>
          <div>
            <div className="font-semibold text-white/80 text-sm mb-3">Account</div>
            <div className="space-y-2">
              <Link href="/login" className="block text-sm hover:text-white/80 transition-colors">Accedi</Link>
              <a href="#" className="block text-sm hover:text-white/80 transition-colors">Prenota una demo</a>
            </div>
          </div>
        </div>
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span>© {new Date().getFullYear()} Fusion Beauty. Tutti i diritti riservati.</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white/80 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white/80 transition-colors">Termini di utilizzo</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo = () => setDemoOpen(true);

  return (
    <>
      <Navbar onDemoClick={openDemo} />
      <main>
        <Hero onDemoClick={openDemo} />
        <SocialProof />
        <Problem />
        <ClienteAlCentro />
        <PipelineSection />
        <FollowUpSection />
        <Benefits />
        <PrimaDopo />
        <PerChiE />
        <VideoDemo />
        <Pricing onDemoClick={openDemo} />
        <FAQSection />
        <CTAFinale onDemoClick={openDemo} />
      </main>
      <Footer />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </>
  );
}
