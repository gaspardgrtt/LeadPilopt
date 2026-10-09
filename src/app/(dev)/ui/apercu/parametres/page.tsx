import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsSections } from "@/app/(app)/parametres/settings-sections";
import { AccountSettings, AppearanceSettings, LanguageSettings } from "@/app/(app)/parametres/settings-controls";
import { getI18n } from "@/i18n/server";

import { PreviewShell } from "../shell";

export const metadata: Metadata = { title: "Catalogue UI · Aperçu des paramètres" };

// Même contenu que /parametres, sans session. Développement uniquement.
export default async function SettingsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const { t } = await getI18n();
  return (
    <PreviewShell>
      <PageContainer className="max-w-[880px]">
        <PageHeader title={t.settings.title} description={t.settings.description} />
        <SettingsSections
          appearance={<AppearanceSettings initialTheme="systeme" />}
          language={<LanguageSettings />}
          account={<AccountSettings email="agence@dupont-immo.fr" name="Claire Martin" needsName={false} />}
          t={t}
        />
      </PageContainer>
    </PreviewShell>
  );
}
