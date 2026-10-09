import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";
import { CommandMenuProvider } from "@/components/layout/command-menu";
import { requireUser } from "@/lib/auth/session";
import { getProfil, getProspectCounts } from "@/lib/data/prospects";
import { displayName } from "@/lib/user/display-name";
import { ThemeFromAccount } from "@/components/theme/theme-sync";
import { parseTheme } from "@/lib/preferences/preferences";

// Toutes les pages connectées dépendent de la session : jamais de pré-rendu statique.
export const dynamic = "force-dynamic";

// Layout E2 à E5 : barre latérale + zone de contenu, réservé aux utilisateurs connectés.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [profil, counts] = await Promise.all([getProfil(), getProspectCounts()]);
  const email = profil?.email ?? user.email;
  const name = displayName(profil?.nom, email);
  // Seul compteur affiché : les dossiers oubliés à traiter, c'est-à-dire la liste « Mes priorités ».
  const sidebarCounts = counts.oublies ? { "/priorites": counts.oublies } : undefined;

  return (
    <CommandMenuProvider>
      <ThemeFromAccount theme={parseTheme(profil?.theme)} />
      <div className="flex min-h-dvh bg-background">
        <AppSidebar user={{ name: name.full, email, needsName: name.isFallback }} counts={sidebarCounts} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav user={{ name: name.full, email, needsName: name.isFallback }} counts={sidebarCounts} />
          {children}
        </div>
      </div>
    </CommandMenuProvider>
  );
}
