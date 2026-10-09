import type { Metadata } from "next";

import { safeRedirectPath } from "@/lib/auth/routes";
import { linkErrorMessage } from "@/lib/auth/link-errors";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

type ConnexionPageProps = {
  searchParams: Promise<{ suivant?: string; erreur?: string }>;
};

// E1 — connexion et inscription par lien magique.
export default async function ConnexionPage({ searchParams }: ConnexionPageProps) {
  const { suivant, erreur } = await searchParams;
  return <LoginForm next={safeRedirectPath(suivant) ?? undefined} linkError={linkErrorMessage(erreur)} />;
}
