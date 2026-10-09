import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaletteIcon, UserIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { AccountSettings, AppearanceSettings } from "@/app/(app)/parametres/settings-controls";

import { PreviewShell } from "../shell";

export const metadata: Metadata = { title: "Catalogue UI · Aperçu des paramètres" };

// Même contenu que /parametres, sans session. Développement uniquement.
export default function SettingsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <PreviewShell>
      <PageContainer className="max-w-[880px]">
        <PageHeader title="Paramètres" description="Apparence de l'interface et informations du compte" />
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PaletteIcon className="size-4 text-primary" aria-hidden />
                Apparence
              </CardTitle>
              <CardDescription>Le thème s&apos;applique immédiatement et reste enregistré pour votre compte.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <AppearanceSettings initialTheme="systeme" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="size-4 text-primary" aria-hidden />
                Compte
              </CardTitle>
              <CardDescription>Votre identifiant de connexion et votre nom.</CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              <AccountSettings email="agence@dupont-immo.fr" name="Claire Martin" needsName={false} />
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </PreviewShell>
  );
}
