"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckIcon, LanguagesIcon, LogOutIcon, MonitorIcon, MoonIcon, SunIcon, UserPenIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NameDialog } from "@/components/layout/app-sidebar";
import { signOut } from "@/lib/auth/actions";
import { LANGUES, LANGUE_COOKIE, THEME_COOKIE, applyTheme, preferenceCookie, type Langue, type Theme } from "@/lib/preferences/preferences";
import { useLocale, useT } from "@/i18n/client";

import { updatePreferences } from "../actions";

const THEME_OPTIONS: { value: Theme; icon: typeof SunIcon }[] = [
  { value: "clair", icon: SunIcon },
  { value: "sombre", icon: MoonIcon },
  { value: "systeme", icon: MonitorIcon },
];

/** Aperçu miniature d'un thème (barre latérale + cartes) : couleurs fixes, c'est une illustration. */
function ThemePreview({ theme }: { theme: Theme }) {
  const swatch = (dark: boolean) => (
    <span className={cn("flex h-full flex-1 gap-1 p-1.5", dark ? "bg-[#0a0e17]" : "bg-[#f6f7fb]")}>
      <span className="w-3 rounded-sm bg-[#141b26]" />
      <span className="flex flex-1 flex-col gap-1">
        <span className="h-2.5 rounded-sm bg-gradient-to-r from-[#5d64f4] to-[#8b5cf6]" />
        <span className={cn("flex-1 rounded-sm", dark ? "bg-[#121826]" : "bg-white")} />
      </span>
    </span>
  );
  return (
    <span aria-hidden className="flex h-16 overflow-hidden rounded-md ring-1 ring-border">
      {theme === "systeme" ? (
        <>
          {swatch(false)}
          {swatch(true)}
        </>
      ) : (
        swatch(theme === "sombre")
      )}
    </span>
  );
}

/** Choix du thème : appliqué immédiatement, enregistré dans le compte et sur l'appareil. */
export function AppearanceSettings({ initialTheme }: { initialTheme: Theme }) {
  const t = useT();
  const [theme, setTheme] = React.useState<Theme>(initialTheme);
  const [pending, startTransition] = React.useTransition();

  function choose(next: Theme) {
    if (next === theme) return;
    const previous = theme;
    setTheme(next);
    applyTheme(next);
    document.cookie = preferenceCookie(THEME_COOKIE, next, window.location.protocol === "https:");
    startTransition(async () => {
      const result = await updatePreferences({ theme: next });
      if (!result.ok) {
        setTheme(previous);
        applyTheme(previous);
        document.cookie = preferenceCookie(THEME_COOKIE, previous, window.location.protocol === "https:");
        toast.error(result.message);
      }
    });
  }

  return (
    <div role="radiogroup" aria-label={t.settings.themeGroup} aria-busy={pending || undefined} className="grid gap-3 sm:grid-cols-3">
      {THEME_OPTIONS.map((option) => {
        const selected = option.value === theme;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => choose(option.value)}
            className={cn(
              "group relative flex flex-col gap-3 rounded-xl border bg-surface p-3 text-left outline-none transition-[border-color,box-shadow] duration-200 hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/30",
              selected ? "border-primary shadow-glow" : "border-border"
            )}
          >
            <ThemePreview theme={option.value} />
            <span className="flex items-start gap-2.5">
              <option.icon className={cn("mt-0.5 size-4 shrink-0", selected ? "text-primary" : "text-foreground-tertiary")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold text-foreground">{t.settings.themes[option.value].label}</span>
                <span className="block text-dense text-foreground-secondary">{t.settings.themes[option.value].hint}</span>
              </span>
              {selected && (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-solid text-primary-foreground">
                  <CheckIcon className="size-3.5" strokeWidth={2.5} aria-hidden />
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Compte : e-mail, nom affiché (modifiable) et déconnexion. */
export function AccountSettings({ email, name, needsName }: { email: string; name: string; needsName: boolean }) {
  const t = useT();
  const [editing, setEditing] = React.useState(false);
  const [signingOut, startSignOut] = React.useTransition();

  return (
    <dl className="divide-y divide-border">
      <div className="grid gap-1 py-3.5 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-4">
        <dt className="text-dense text-foreground-secondary">{t.settings.email}</dt>
        <dd className="min-w-0 text-body font-medium break-all text-foreground">{email}</dd>
      </div>
      <div className="grid gap-1 py-3.5 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-4">
        <dt className="text-dense text-foreground-secondary">{t.settings.displayName}</dt>
        <dd className="flex flex-wrap items-center justify-between gap-3">
          <span className={cn("text-body", needsName ? "text-foreground-tertiary" : "font-medium text-foreground")}>
            {needsName ? t.settings.notSet : name}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <UserPenIcon />
            {needsName ? t.settings.add : t.settings.edit}
          </Button>
        </dd>
      </div>
      <div className="grid gap-1 py-3.5 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-4">
        <dt className="text-dense text-foreground-secondary">{t.settings.connection}</dt>
        <dd className="text-body text-foreground">{t.settings.connectionValue}</dd>
      </div>
      <div className="pt-4">
        <Button variant="secondary" onClick={() => startSignOut(() => signOut())} loading={signingOut}>
          <LogOutIcon />
          {t.account.signOut}
        </Button>
      </div>
      <NameDialog user={{ name, email, needsName }} open={editing} onOpenChange={setEditing} />
    </dl>
  );
}

/**
 * Langue de l'interface : enregistrée dans le compte et sur l'appareil, puis l'affichage est
 * rechargé dans la nouvelle langue (les pages serveur la lisent dans le cookie).
 */
export function LanguageSettings() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function choose(next: Langue) {
    if (next === locale) return;
    startTransition(async () => {
      const result = await updatePreferences({ langue: next });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      document.cookie = preferenceCookie(LANGUE_COOKIE, next, window.location.protocol === "https:");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={t.settings.languageGroup} aria-busy={pending || undefined} className="grid gap-3 sm:grid-cols-2">
        {LANGUES.map((value) => {
          const selected = value === locale;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={value}
              disabled={pending}
              onClick={() => choose(value)}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-left outline-none transition-[border-color,box-shadow] duration-200 hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/30 disabled:opacity-70",
                selected ? "border-primary shadow-glow" : "border-border"
              )}
            >
              <LanguagesIcon className={cn("size-4 shrink-0", selected ? "text-primary" : "text-foreground-tertiary")} aria-hidden />
              <span className="flex-1 text-body font-semibold text-foreground">{t.settings.languages[value]}</span>
              <span className="text-caption font-semibold text-foreground-tertiary uppercase">{value}</span>
              {selected && (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-solid text-primary-foreground">
                  <CheckIcon className="size-3.5" strokeWidth={2.5} aria-hidden />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-dense text-foreground-tertiary">{t.settings.languageNote}</p>
    </div>
  );
}
