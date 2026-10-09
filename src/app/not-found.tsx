import Link from "next/link";
import { SearchXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

// Page 404 (lien vers un dossier supprimé, adresse mal saisie) : en français, dans le style de l'app.
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <EmptyState
        icon={SearchXIcon}
        title="Page introuvable"
        description="Cette page n'existe pas ou n'est plus disponible. Le dossier a peut-être été supprimé lors d'un nouvel import."
        action={
          <Button asChild>
            <Link href="/tableau-de-bord">Retour au dashboard</Link>
          </Button>
        }
        className="w-full max-w-md"
      />
    </main>
  );
}
