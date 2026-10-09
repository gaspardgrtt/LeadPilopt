import type { Metadata } from "next";
import { PaletteIcon, UserIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/session";
import { getProfil } from "@/lib/data/prospects";
import { parseTheme } from "@/lib/preferences/preferences";
import { displayName } from "@/lib/user/display-name";

import { AccountSettings, AppearanceSettings } from "./settings-controls";

export const metadata: Metadata = { title: "Paramètres" };

// Paramètres du compte : apparence (thème) et compte (e-mail, nom, déconnexion). Les préférences
// sont enregistrées par utilisateur (colonnes de `utilisateurs`, RLS) et sur l'appareil (cookie).
export default async function SettingsPage() {
  const user = await requireUser();
  const profil = await getProfil();
  const email = profil?.email ?? user.email;
  const name = displayName(profil?.nom, email);

  return (
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
            <AppearanceSettings initialTheme={parseTheme(profil?.theme)} />
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
            <AccountSettings email={email} name={name.full} needsName={name.isFallback} />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
