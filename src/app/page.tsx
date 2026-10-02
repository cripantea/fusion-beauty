import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Fusion Beauty — Gestionale CRM per centri estetici",
  description:
    "Organizza clienti, lead, follow-up e attività commerciali del tuo centro estetico con Fusion Beauty, il CRM progettato per il settore beauty.",
  openGraph: {
    title: "Fusion Beauty — Gestionale CRM per centri estetici",
    description:
      "Organizza clienti, lead, follow-up e attività commerciali del tuo centro estetico con un CRM progettato per il settore beauty.",
    type: "website",
  },
};

export default function Home() {
  return <LandingPage />;
}
