"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { NAV_ITEMS } from "@/components/layout/navigation";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";

// Barre latérale : fond ardoise profond avec halo indigo, logo lumineux et badge Beta, pastille
// active animée (filet dégradé à gauche), compte en pied séparé par un filet.
type AppSidebarProps = {
  /** Compteurs affichés à droite des liens, indexés par href. */
  counts?: Partial<Record<string, number>>;
  user?: { name: string; email: string };
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ counts, user }: AppSidebarProps) {
  const pathname = usePathname();
  const [signingOut, startSignOut] = React.useTransition();

  return (
    <aside className="sticky top-0 isolate hidden h-dvh w-sidebar shrink-0 flex-col overflow-hidden bg-sidebar md:flex">
      {/* Profondeur : halo indigo/violet en haut, dégradé vers le bas, liseré lumineux à droite. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(120%_80%_at_20%_-10%,color-mix(in_srgb,var(--primary)_32%,transparent),transparent_70%)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(180deg,transparent_40%,rgb(0_0_0/0.25))]"
      />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/15 via-white/5 to-transparent" />

      <div className="flex h-[76px] items-center gap-2.5 px-5">
        <Link
          href="/tableau-de-bord"
          className="relative rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40"
        >
          <span aria-hidden className="absolute -left-2 top-1/2 -z-10 size-10 -translate-y-1/2 rounded-full bg-primary/40 blur-xl" />
          <Logo inverted />
        </Link>
        <span className="rounded-full border border-white/15 bg-gradient-to-r from-primary/30 to-accent-violet/30 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white/90 uppercase">
          Beta
        </span>
      </div>

      <nav className="flex flex-col gap-1 px-3 pt-2" aria-label="Navigation principale">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const count = counts?.[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-11 items-center gap-3 rounded-lg px-3.5 text-[15px] leading-5 font-medium transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40",
                active
                  ? "text-sidebar-foreground-active"
                  : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground-active"
              )}
            >
              {active && (
                // Pastille active partagée : elle glisse d'un lien à l'autre lors de la navigation.
                <motion.span
                  layoutId="sidebar-active"
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-lg bg-sidebar-active shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] ring-1 ring-white/10"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                >
                  <span className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-primary-light to-accent-violet shadow-[0_0_12px_var(--primary)]" />
                </motion.span>
              )}
              <item.icon
                className={cn(
                  "size-[18px] shrink-0 transition-colors duration-200",
                  active ? "text-primary-light" : "text-sidebar-muted group-hover:text-sidebar-foreground-active"
                )}
                strokeWidth={1.85}
                aria-hidden
              />
              <span className="flex-1 truncate">{item.label}</span>
              {count !== undefined && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-caption font-medium text-sidebar-foreground-active tabular-nums">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="mt-auto border-t border-sidebar-border px-3 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors duration-200 hover:bg-sidebar-hover focus-visible:ring-[3px] focus-visible:ring-primary/40">
              <InitialsAvatar name={user.name} size="sm" className="text-body font-medium" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-dense font-semibold text-sidebar-foreground-active">
                  {user.name}
                </span>
                <span className="block truncate text-caption font-normal text-sidebar-muted">{user.email}</span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
              <DropdownMenuItem
                disabled={signingOut}
                onSelect={() => startSignOut(() => signOut())}
              >
                <LogOutIcon />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </aside>
  );
}

/** Navigation compacte sous 768 px (le produit vise d'abord le desktop). */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-20 flex h-14 items-center gap-1 bg-sidebar px-4 md:hidden">
      <Logo compact className="mr-2" />
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-md px-3 text-dense font-medium",
              active ? "bg-sidebar-active text-sidebar-foreground-active" : "text-sidebar-foreground"
            )}
          >
            <item.icon className="size-4" strokeWidth={1.85} aria-hidden />
            <span className="sr-only sm:not-sr-only">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
