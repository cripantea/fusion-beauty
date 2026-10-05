"use client";

import { Copy, ExternalLink, MessageCircle, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";

import { Avatar, EmptyState, PageHeader, Panel, Pill } from "@/components/boutique";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEuro, getInitials, whatsappUrl } from "@/lib/format";
import { cn } from "@/lib/utils";

import { toast } from "sonner";

import { getClients, type ClientListItemDTO } from "./actions";
import { toNewClientListItem } from "./list-item";
import { QuickClientDialog } from "./quick-client-dialog";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

type Filter = "all" | "inactive";

type ClientsManagerProps = {
  initialClients: ClientListItemDTO[];
  tenantSlug: string | null;
};

export function ClientsManager({ initialClients, tenantSlug }: ClientsManagerProps) {
  const [clients, setClients] = useState(initialClients);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function refresh(nextSearch: string) {
    startTransition(async () => {
      setClients(await getClients({ search: nextSearch }));
    });
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => refresh(value), 250);
  }

  const inactiveCount = clients.filter((client) => client.isInactive).length;
  const visible = filter === "inactive" ? clients.filter((client) => client.isInactive) : clients;

  const registerUrl = tenantSlug
    ? (typeof window !== "undefined" ? window.location.origin : "https://beauty.fusionsoft.it") + `/registra/${tenantSlug}`
    : null;

  function copyRegisterLink() {
    if (!registerUrl) return;
    navigator.clipboard
      .writeText(registerUrl)
      .then(() => toast.success("Link copiato negli appunti."))
      .catch(() => toast.error("Impossibile copiare il link."));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Anagrafica"
        title="Tutte le clienti, sempre sotto controllo."
        description="Quando una cliente torna, sai subito cosa ha fatto e cosa le serve."
        actions={
          <div className="flex items-center gap-2">
            {registerUrl && (
              <div className="hidden items-center gap-1.5 rounded-xl border border-mint-border bg-mint-soft px-3 py-2 text-xs font-medium text-forest sm:flex">
                <ExternalLink className="size-3.5 shrink-0" />
                <span className="max-w-[180px] truncate font-mono text-[11px]">{registerUrl.replace("https://", "")}</span>
                <button
                  type="button"
                  onClick={copyRegisterLink}
                  className="ml-1 rounded p-0.5 hover:bg-mint-border/60 transition-colors"
                  title="Copia link registrazione"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            )}
            <Button className="h-10 rounded-xl px-4" onClick={() => setDialogOpen(true)}>
              <UserPlus className="size-4" />
              Nuova cliente
            </Button>
          </div>
        }
      />

      <Panel
        title={
          <span>
            Le tue clienti <span className="font-normal text-muted-foreground">· {clients.length}</span>
          </span>
        }
        action={
          <div className="flex gap-1.5">
            {(
              [
                ["all", "Tutte"],
                ["inactive", `Da ricontattare (${inactiveCount})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  filter === value
                    ? "border-forest bg-forest text-forest-foreground"
                    : "border-mint-border bg-card hover:bg-mint-soft"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        <div className="border-b border-mint-border/70 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cerca per nome, cognome o telefono..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              className="h-10 pl-9"
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState>{isPending ? "Caricamento..." : "Nessuna cliente trovata."}</EmptyState>
        ) : (
          <ul className="divide-y divide-mint-border/60">
            {visible.map((client) => (
              <li key={client.id} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-mint-soft/40">
                <Link
                  href={`/dashboard/clients/${client.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <Avatar initials={getInitials(client.firstName, client.lastName)} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">
                        {client.firstName} {client.lastName}
                      </span>
                      {client.visits >= 5 ? <Pill>Cliente fedele</Pill> : null}
                      {client.isInactive ? <Pill tone="amber">Non torna da tempo</Pill> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {client.phone}
                      {client.lastVisit
                        ? ` · ultima visita ${dateFormatter.format(client.lastVisit)}`
                        : client.lastAppointment
                          ? ` · ${client.lastAppointment.serviceName}`
                          : " · nessuna visita"}
                    </span>
                  </span>
                </Link>
                <div className="hidden text-right text-sm sm:block">
                  <div className="font-semibold">{formatEuro(client.totalSpent)}</div>
                  <div className="text-xs text-muted-foreground">
                    {client.visits} {client.visits === 1 ? "trattamento" : "trattamenti"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-lg"
                  aria-label={`WhatsApp a ${client.firstName}`}
                  nativeButton={false}
                  render={<a href={whatsappUrl(client.phone)} target="_blank" rel="noopener noreferrer" />}
                >
                  <MessageCircle className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <QuickClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(client) => setClients((current) => [toNewClientListItem(client), ...current])}
      />
    </div>
  );
}
