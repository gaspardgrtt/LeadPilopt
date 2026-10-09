import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";
import { DashboardPreview } from "@/app/(app)/apercu/dashboard/dashboard-preview";

export const metadata: Metadata = { title: "Catalogue UI · Aperçu du dashboard" };

// Interface complète (barre latérale + dashboard) avec des données d'exemple, sans session :
// sert à vérifier le rendu visuel. Développement uniquement.
export default function ShellPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="flex min-h-dvh">
      <AppSidebar user={{ name: "Agence Dupont", email: "agence@dupont-immo.fr" }} counts={{ "/prospects": 42 }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <DashboardPreview />
      </div>
    </div>
  );
}
