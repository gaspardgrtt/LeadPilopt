"use client";

import { useEffect } from "react";

import { useT } from "@/i18n/client";
import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";

// Erreur récupérable dans l'espace connecté : message clair, bouton « Réessayer », la barre
// latérale reste utilisable. Le détail technique part dans la console, jamais à l'écran.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer>
      <EmptyState
        icon={TriangleAlertIcon}
        title={t.errors.loadFailedTitle}
        description={t.errors.loadFailedDescription}
        action={<Button onClick={reset}>{t.common.retry}</Button>}
      />
    </PageContainer>
  );
}
