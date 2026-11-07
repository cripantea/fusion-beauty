"use client";

// Fusion Kit — carica il widget Assistenza nel browser e lo toglie quando il layout
// riservato si smonta (logout, navigazione client di Next): un <script> nel layout non
// partirebbe dopo una navigazione senza ricaricare la pagina.
import { useEffect } from "react";

type FusionDeskWindow = Window & { FusionDesk?: { destroy?: () => void } };

export function FusionSupportClient({ src, attrs }: { src: string; attrs: Record<string, string> }) {
  const token = attrs["data-token"];
  useEffect(() => {
    const w = window as FusionDeskWindow;
    w.FusionDesk?.destroy?.();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    for (const [k, v] of Object.entries(attrs)) script.setAttribute(k, v);
    document.body.appendChild(script);
    return () => {
      (window as FusionDeskWindow).FusionDesk?.destroy?.();
      script.remove();
    };
    // Il token cambia solo se cambia l'utente: è l'unica dipendenza che conta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, token]);
  return null;
}
