"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { adoptConnection } from "./actions";

declare global {
  interface Window {
    FusionWA?: {
      init: (params: { token: string; containerId: string }) => { destroy?: () => void } | void;
    };
  }
}

const POLL_INTERVAL_MS = 3000;

/**
 * Widget di collegamento di Fusion WA (Embedded Signup / Coexistence): il suo
 * sdk/v1.js disegna il pulsante "Collega WhatsApp" e gestisce il login Meta.
 * Non ha una callback di fine, quindi (come nel CRM) si interroga lo stato
 * finché risulta CONNECTED e poi si salva il numero, riverificato lato server.
 */
export function FusionWaSignupWidget({ tenantId, token, baseUrl }: { tenantId: string; token: string; baseUrl: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const containerId = `fusionwa-widget-${tenantId}`;
  const routerRef = useRef(router);

  useEffect(() => {
    let stopped = false;
    let checking = false;
    let widget: { destroy?: () => void } | void;
    let timer: ReturnType<typeof setInterval> | null = null;

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    async function check() {
      if (stopped || checking) return;
      checking = true;
      try {
        const res = await fetch(`${baseUrl}/api/v1/widget/status?token=${encodeURIComponent(token)}`);
        if (!res.ok) throw new Error();
        const data: { status?: string; integrationEnabled?: boolean } = await res.json();
        if (stopped) return;
        setError(null);
        if (data.status !== "CONNECTED") return;
        stop();
        const result = await adoptConnection();
        if (stopped) return;
        if (!result.success) {
          setError(result.error);
          return;
        }
        toast.success("WhatsApp collegato!");
        routerRef.current.refresh();
      } catch {
        if (!stopped) setError("Verifica momentaneamente non disponibile.");
      } finally {
        checking = false;
      }
    }

    function loadSdk(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (window.FusionWA) return resolve();
        const script = document.createElement("script");
        script.src = `${baseUrl}/sdk/v1.js`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error());
        document.body.appendChild(script);
      });
    }

    loadSdk()
      .then(() => {
        if (stopped) return;
        widget = window.FusionWA?.init({ token, containerId });
        void check();
        timer = setInterval(check, POLL_INTERVAL_MS);
      })
      .catch(() => setError("Impossibile caricare il collegamento WhatsApp. Riprova."));

    return () => {
      stopped = true;
      stop();
      widget?.destroy?.();
    };
  }, [token, baseUrl, containerId, attempt]);

  return (
    <div className="space-y-2">
      <div id={containerId} />
      {error ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          >
            Riprova
          </Button>
        </div>
      ) : null}
    </div>
  );
}
