"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Config = { enabled: boolean; google: boolean; legacy: boolean };

/**
 * Pulsanti di Fusion ID sopra il vecchio modulo email/password (children), che resta
 * finché FUSION_ID_LEGACY_LOGIN non è "off".
 */
export function FusionLogin({ returnTo, children, dark = false }: { returnTo?: string; children: React.ReactNode; dark?: boolean }) {
  const params = useSearchParams();
  const error = params.get("error");
  const [config, setConfig] = useState<Config | null>(null);
  useEffect(() => {
    fetch("/auth/fusion/config").then((r) => r.json()).then(setConfig).catch(() => setConfig({ enabled: false, google: false, legacy: true }));
  }, []);

  const q = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
  const btn = dark
    ? "flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-700 px-4 text-sm font-medium text-white hover:bg-slate-600"
    : "flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted";

  return (
    <>
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {config?.enabled && (
        <div className="mb-2 flex flex-col gap-2">
          {config.google && (
            <a href={`/auth/fusion/login?google=1${q}`} className={btn}>
              <svg aria-hidden width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" /></svg>
              Continua con Google
            </a>
          )}
          <a href={`/auth/fusion/login?x=1${q}`} className={btn}>Accedi con Fusion ID</a>
          {config.legacy && (
            <div className={`my-3 flex items-center gap-3 text-xs ${dark ? "text-slate-400" : "text-muted-foreground"}`}>
              <span className={`h-px flex-1 ${dark ? "bg-slate-600" : "bg-border"}`} />
              oppure con la password di prima
              <span className={`h-px flex-1 ${dark ? "bg-slate-600" : "bg-border"}`} />
            </div>
          )}
        </div>
      )}
      {(!config?.enabled || config.legacy) && children}
    </>
  );
}
