"use client";

import { useEffect } from "react";
import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";

// Erreur récupérable dans l'espace connecté : message clair, bouton « Réessayer », la barre
// latérale reste utilisable. Le détail technique part dans la console, jamais à l'écran.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer>
      <EmptyState
        icon={TriangleAlertIcon}
        title="Le chargement a échoué"
        description="Vos données n'ont pas pu être récupérées. Vérifiez votre connexion puis réessayez."
        action={<Button onClick={reset}>Réessayer</Button>}
      />
    </PageContainer>
  );
}
