"use client";

import { Eye, EyeOff } from "lucide-react";
import { useAdminView } from "@/lib/admin-view-context";

export function AdminViewToggle() {
  const { isAdminView, toggle } = useAdminView();

  return (
    <button
      type="button"
      onClick={toggle}
      title={isAdminView ? "Nascondi dati finanziari" : "Mostra dati finanziari"}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors"
      style={{
        background: isAdminView ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
        color: isAdminView ? "var(--mint)" : "rgba(255,255,255,0.35)",
        border: isAdminView ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {isAdminView ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      <span className="hidden sm:inline">{isAdminView ? "€ Admin" : "Vista operatrice"}</span>
    </button>
  );
}
