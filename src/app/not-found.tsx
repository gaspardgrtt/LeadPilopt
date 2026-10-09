import Link from "next/link";
import { SearchXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { getI18n } from "@/i18n/server";

// Page 404 (lien vers un dossier supprimé, adresse mal saisie) : en français, dans le style de l'app.
export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <EmptyState
        icon={SearchXIcon}
        title={t.errors.notFoundTitle}
        description={t.errors.notFoundDescription}
        action={
          <Button asChild>
            <Link href="/tableau-de-bord">{t.errors.backToDashboard}</Link>
          </Button>
        }
        className="w-full max-w-md"
      />
    </main>
  );
}
