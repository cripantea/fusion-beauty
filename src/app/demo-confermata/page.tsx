import type { Metadata } from "next";
import Link from "next/link";
import { Check, Calendar, MessageSquare, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Demo confermata — Fusion Beauty",
  description: "Richiesta di demo ricevuta. Ti contatteremo entro 24 ore.",
};

export default function DemoConfermataPage() {
  const steps = [
    {
      icon: MessageSquare,
      title: "Conferma via email",
      desc: "Riceverai un'email con i dettagli della demo.",
    },
    {
      icon: Calendar,
      title: "Scelta di giorno e orario",
      desc: "Ti proporremo un orario in base alla tua preferenza.",
    },
    {
      icon: Clock,
      title: "Demo personalizzata",
      desc: "Circa 30–45 minuti per vedere Fusion Beauty sul tuo processo reale.",
    },
  ];

  return (
    <div className="min-h-screen bg-[oklch(0.987_0.005_80)] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 mb-3">Richiesta ricevuta!</h1>
        <p className="text-zinc-500 text-base leading-relaxed mb-10">
          Ti contatteremo entro <strong className="text-zinc-700">24 ore</strong> per confermare giorno e orario della demo.
        </p>

        <div className="space-y-3 text-left mb-10">
          {steps.map((step) => (
            <div key={step.title} className="flex items-start gap-4 p-4 rounded-xl bg-white border border-zinc-200">
              <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                <step.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-zinc-900 text-sm">{step.title}</div>
                <div className="text-zinc-500 text-sm mt-0.5">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/"
          className="flex items-center justify-center gap-2 px-6 py-3 border border-zinc-200 rounded-xl text-zinc-700 font-medium text-sm hover:bg-zinc-50 transition-colors"
        >
          Torna alla home
        </Link>
      </div>

      <div className="mt-12 flex items-center gap-2 text-zinc-400 text-sm font-medium">
        <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
          <svg viewBox="0 0 62 78" className="w-3.5 h-4 text-white" fill="currentColor">
            <path d="M 24 74 C 6 68 0 50 10 32 C 16 20 22 12 22 2 C 34 12 42 30 38 50 C 36 60 28 66 26 72 Z"/>
            <path d="M 36 74 C 34 64 34 56 38 48 C 44 36 52 24 52 12 C 52 4 50 0 52 0 C 66 10 74 32 68 52 C 62 68 52 76 38 76 Z"/>
          </svg>
        </div>
        <span>Fusion<span className="text-primary">Beauty</span></span>
      </div>
    </div>
  );
}
