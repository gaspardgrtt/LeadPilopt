"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { LogOutIcon, MenuIcon, UserPenIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { NAV_GROUPS, NAV_ITEMS } from "@/components/layout/navigation";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { signOut } from "@/lib/auth/actions";
import { updateDisplayName } from "@/app/(app)/actions";
import { useT } from "@/i18n/client";

// Barre latérale : fond ardoise profond avec halo indigo, logo lumineux et badge Beta, navigation
// en 3 groupes, pastille active animée (filet dégradé à gauche), compte en pied séparé par un filet.
// Sous 768 px : barre compacte + menu en tiroir avec les mêmes groupes.
type AppSidebarProps = {
  /** Compteurs affichés à droite des liens, indexés par href (valeurs réelles uniquement). */
  counts?: Partial<Record<string, number>>;
  user?: SidebarUser;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavGroups({
  counts,
  layoutId,
  onNavigate,
}: {
  counts?: AppSidebarProps["counts"];
  layoutId: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav className="flex flex-col gap-5" aria-label={t.nav.main}>
      {NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.hidden),
      }))
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[11px] leading-4 font-semibold tracking-[0.08em] text-sidebar-muted uppercase">
              {t.nav.groups[group.label]}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                if (item.soon) {
                  return (
                    <li key={item.label}>
                      <span
                        aria-disabled="true"
                        className="flex min-h-9 cursor-default items-center gap-2.5 rounded-lg px-3 py-1.5 text-[14px] leading-5 font-medium text-sidebar-muted"
                      >
                        <item.icon
                          className="size-[17px] shrink-0"
                          strokeWidth={1.85}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 break-words">
                          {t.nav.items[item.label]}
                        </span>
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] leading-4 font-semibold text-sidebar-foreground">
                          {t.common.soon}
                        </span>
                      </span>
                    </li>
                  );
                }

                const active = isActive(pathname, item.href);
                const count = counts?.[item.href];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex min-h-9 items-center gap-2.5 rounded-lg px-3 py-1.5 text-[14px] leading-5 font-medium transition-colors duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40",
                        active
                          ? "text-sidebar-foreground-active"
                          : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground-active",
                      )}
                    >
                      {active && (
                        // Pastille active partagée : elle glisse d'un lien à l'autre lors de la navigation.
                        <motion.span
                          layoutId={layoutId}
                          aria-hidden
                          className="absolute inset-0 -z-10 rounded-lg bg-sidebar-active shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] ring-1 ring-white/10"
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 40,
                          }}
                        >
                          <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-primary-light to-accent-violet shadow-[0_0_12px_var(--primary)]" />
                        </motion.span>
                      )}
                      <item.icon
                        className={cn(
                          "size-[17px] shrink-0 transition-colors duration-200",
                          active
                            ? "text-primary-light"
                            : "text-sidebar-muted group-hover:text-sidebar-foreground-active",
                        )}
                        strokeWidth={1.85}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 break-words">
                        {t.nav.items[item.label]}
                      </span>
                      {count !== undefined && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-caption font-medium text-sidebar-foreground-active tabular-nums">
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </nav>
  );
}

export type SidebarUser = {
  name: string;
  email: string;
  /** Aucun nom enregistré : le nom affiché vient de l'adresse email. */
  needsName?: boolean;
};

/** Saisie du prénom et du nom affichés (colonne `utilisateurs.nom`). */
export function NameDialog({ user, open, onOpenChange }: { user: SidebarUser; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const t = useT();
  const [firstName, lastName] = user.needsName ? ["", ""] : [user.name.split(" ")[0], user.name.split(" ").slice(1).join(" ")];
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t.account.nameDialogTitle}</DialogTitle>
          <DialogDescription>{t.account.nameDialogDescription}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await updateDisplayName(String(data.get("prenom") ?? ""), String(data.get("nom") ?? ""));
              if (!result.ok) {
                setError(result.message);
                return;
              }
              setError(null);
              onOpenChange(false);
              toast.success(t.account.nameSaved);
              router.refresh();
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.account.firstName} htmlFor="compte-prenom" error={error ?? undefined}>
              <Input id="compte-prenom" name="prenom" defaultValue={firstName} autoComplete="given-name" autoFocus maxLength={60} />
            </Field>
            <Field label={t.account.lastName} htmlFor="compte-nom">
              <Input id="compte-nom" name="nom" defaultValue={lastName} autoComplete="family-name" maxLength={60} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              {t.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountMenu({ user }: { user: SidebarUser }) {
  const t = useT();
  const [signingOut, startSignOut] = React.useTransition();
  const [editing, setEditing] = React.useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors duration-200 hover:bg-sidebar-hover focus-visible:ring-[3px] focus-visible:ring-primary/40">
          <InitialsAvatar name={user.name} size="sm" className="text-body font-medium" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-dense font-semibold text-sidebar-foreground-active">{user.name}</span>
            <span className="block truncate text-caption font-normal text-sidebar-muted">{user.email}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <UserPenIcon />
            {user.needsName ? t.account.addName : t.account.editName}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={signingOut} onSelect={() => startSignOut(() => signOut())}>
            <LogOutIcon />
            {t.account.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NameDialog user={user} open={editing} onOpenChange={setEditing} />
    </>
  );
}

function SidebarBackdrop() {
  return (
    <>
      {/* Profondeur : halo indigo/violet en haut, dégradé vers le bas, liseré lumineux à droite. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(120%_80%_at_20%_-10%,color-mix(in_srgb,var(--primary)_32%,transparent),transparent_70%)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(180deg,transparent_40%,rgb(0_0_0/0.25))]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/15 via-white/5 to-transparent"
      />
    </>
  );
}

function Brand() {
  const t = useT();
  return (
    <div className="flex h-[72px] shrink-0 items-center gap-2.5 px-5">
      <Link
        href="/tableau-de-bord"
        className="relative rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40"
      >
        <span
          aria-hidden
          className="absolute -left-2 top-1/2 -z-10 size-10 -translate-y-1/2 rounded-full bg-primary/40 blur-xl"
        />
        <Logo onDark />
      </Link>
      <span className="rounded-full border border-white/15 bg-gradient-to-r from-primary/30 to-accent-violet/30 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white/90 uppercase">
        {t.common.beta}
      </span>
    </div>
  );
}

export function AppSidebar({ counts, user }: AppSidebarProps) {
  return (
    <aside className="sticky top-0 isolate hidden h-dvh w-sidebar shrink-0 flex-col overflow-hidden bg-sidebar md:flex">
      <SidebarBackdrop />
      <Brand />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-4 [scrollbar-width:thin]">
        <NavGroups counts={counts} layoutId="sidebar-active" />
      </div>
      {user && (
        <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
          <AccountMenu user={user} />
        </div>
      )}
    </aside>
  );
}

/** Barre compacte sous 768 px : logo, rubrique en cours et menu en tiroir (mêmes groupes). */
export function MobileNav({ counts, user }: AppSidebarProps = {}) {
  const pathname = usePathname();
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const current = NAV_ITEMS.find((item) => isActive(pathname, item.href));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-sidebar px-4 pt-[env(safe-area-inset-top,0px)] md:hidden">
        <Link
          href="/tableau-de-bord"
          aria-label={t.nav.items.dashboard}
          className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40"
        >
          <Logo onDark size="sm" />
        </Link>
        <span className="min-w-0 flex-1 truncate text-body font-semibold text-sidebar-foreground-active">
          {current ? t.nav.items[current.label] : null}
        </span>
        <DialogPrimitive.Trigger
          aria-label={t.nav.openMenu}
          className="flex size-10 items-center justify-center rounded-lg text-sidebar-foreground outline-none hover:bg-sidebar-hover focus-visible:ring-[3px] focus-visible:ring-primary/40"
        >
          <MenuIcon className="size-5" aria-hidden />
        </DialogPrimitive.Trigger>
      </div>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 md:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 isolate z-50 flex w-[86vw] max-w-[320px] flex-col overflow-hidden bg-sidebar outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left md:hidden">
          <DialogPrimitive.Title className="sr-only">
            {t.nav.menu}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t.nav.menuDescription}
          </DialogPrimitive.Description>
          <SidebarBackdrop />
          <div className="flex items-center justify-between pr-3">
            <Brand />
            <DialogPrimitive.Close
              aria-label={t.nav.closeMenu}
              className="flex size-10 items-center justify-center rounded-lg text-sidebar-foreground outline-none hover:bg-sidebar-hover focus-visible:ring-[3px] focus-visible:ring-primary/40"
            >
              <XIcon className="size-5" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-4">
            <NavGroups
              counts={counts}
              layoutId="mobile-active"
              onNavigate={() => setOpen(false)}
            />
          </div>
          {user && (
            <div className="shrink-0 border-t border-sidebar-border px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <AccountMenu user={user} />
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
