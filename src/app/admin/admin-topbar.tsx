"use client";

import { Bell, Mail } from "lucide-react";
import { toast } from "sonner";

import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type AdminTopbarProps = {
  email: string;
};

function notifyComingSoon(feature: string) {
  toast.info(`${feature}: funzionalità in arrivo.`);
}

export function AdminTopbar({ email }: AdminTopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
      <div />
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifiche"
          onClick={() => notifyComingSoon("Notifiche")}
        >
          <Bell className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Messaggi"
          onClick={() => notifyComingSoon("Messaggi")}
        >
          <Mail className="size-4" />
        </Button>
        <Popover>
          <PopoverTrigger render={<Button variant="ghost" className="ml-1 gap-2 px-2" />}>
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {email.charAt(0).toUpperCase()}
            </span>
            <span className="max-w-40 truncate text-sm">{email}</span>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <p className="truncate px-1 text-sm text-muted-foreground">{email}</p>
            <form action={logout}>
              <Button type="submit" variant="outline" className="w-full">
                Esci
              </Button>
            </form>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
