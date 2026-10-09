import type { Metadata } from "next";

import { safeRedirectPath } from "@/lib/auth/routes";
import { linkErrorMessage } from "@/lib/auth/link-errors";
import { getI18n } from "@/i18n/server";

import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.titles.login };
}

type ConnexionPageProps = {
  searchParams: Promise<{ suivant?: string; erreur?: string }>;
};

// E1 — connexion et inscription par lien magique.
export default async function ConnexionPage({ searchParams }: ConnexionPageProps) {
  const { suivant, erreur } = await searchParams;
  const { locale } = await getI18n();
  return <LoginForm next={safeRedirectPath(suivant) ?? undefined} linkError={linkErrorMessage(erreur, locale)} />;
}
