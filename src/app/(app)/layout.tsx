import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";
import { CommandMenuProvider } from "@/components/layout/command-menu";
import { requireUser } from "@/lib/auth/session";
import { getProfil, getProspectCounts } from "@/lib/data/prospects";

// Toutes les pages connectées dépendent de la session : jamais de pré-rendu statique.
export const dynamic = "force-dynamic";

// Layout E2 à E5 : barre latérale + zone de contenu, réservé aux utilisateurs connectés.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [profil, counts] = await Promise.all([getProfil(), getProspectCounts()]);
  const email = profil?.email ?? user.email;
  const name = profil?.nom?.trim() || email.split("@")[0] || "Mon compte";

  return (
    <CommandMenuProvider>
      <div className="flex min-h-dvh bg-background">
        <AppSidebar user={{ name, email }} counts={counts.oublies ? { "/prospects": counts.oublies } : undefined} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav />
          {children}
        </div>
      </div>
    </CommandMenuProvider>
  );
}
