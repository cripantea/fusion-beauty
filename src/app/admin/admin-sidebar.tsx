"use client";

import { Building2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BeautyLogo } from "@/components/beauty-logo";
import { sidebarHeadClass, sidebarItemClass, sidebarShellClass } from "@/components/fusionsoft-ui";

const NAV_ITEMS = [
  { href: "/admin/tenants", label: "Centri estetici", icon: Building2 },
  { href: "/admin/users", label: "Utenti", icon: Users },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className={sidebarShellClass}>
      <div className={sidebarHeadClass}>
        <BeautyLogo />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={sidebarItemClass(pathname.startsWith(item.href))}>
              <Icon />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
