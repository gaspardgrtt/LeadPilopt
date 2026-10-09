import { Logo } from "@/components/brand/logo";
import { AuthVisual } from "@/components/layout/auth-visual";
import { getI18n } from "@/i18n/server";

// Layout E1 de la maquette : colonne formulaire à gauche (logo, accroche, carte à onglets),
// panneau visuel arrondi à droite (masqué sous 1 024 px).
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-dvh bg-surface">
      <main className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-[52%] lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-[420px]">
          <Logo size="lg" />
          <h1 className="mt-9 text-display text-foreground">{t.auth.headline}</h1>
          <p className="mt-3 text-[16px] leading-6 text-foreground-secondary">
            {t.auth.tagline}
          </p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
      <div className="hidden flex-1 p-4 lg:block">
        <AuthVisual />
      </div>
    </div>
  );
}
