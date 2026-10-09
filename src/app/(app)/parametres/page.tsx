import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/session";
import { getProfil } from "@/lib/data/prospects";
import { parseTheme } from "@/lib/preferences/preferences";
import { displayName } from "@/lib/user/display-name";
import { getI18n } from "@/i18n/server";

import { AccountSettings, AppearanceSettings, LanguageSettings } from "./settings-controls";
import { SettingsSections } from "./settings-sections";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.titles.settings };
}

// Paramètres du compte : apparence (thème), langue et compte (e-mail, nom, déconnexion). Les
// préférences sont enregistrées par utilisateur (colonnes de `utilisateurs`, RLS) et sur
// l'appareil (cookies).
export default async function SettingsPage() {
  const user = await requireUser();
  const [profil, { t, locale }] = await Promise.all([getProfil(), getI18n()]);
  const email = profil?.email ?? user.email;
  const name = displayName(profil?.nom, email, locale);

  return (
    <PageContainer className="max-w-[880px]">
      <PageHeader title={t.settings.title} description={t.settings.description} />
      <SettingsSections
        appearance={<AppearanceSettings initialTheme={parseTheme(profil?.theme)} />}
        language={<LanguageSettings />}
        account={<AccountSettings email={email} name={name.full} needsName={name.isFallback} />}
        t={t}
      />
    </PageContainer>
  );
}
