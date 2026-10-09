import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";

/** Coquille de l'application (barre latérale + navigation mobile) pour les aperçus sans session. */
export function PreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <AppSidebar user={{ name: "Agence Dupont", email: "agence@dupont-immo.fr" }} counts={{ "/prospects": 8 }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        {children}
      </div>
    </div>
  );
}
