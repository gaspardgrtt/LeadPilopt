import Link from "next/link";
import { SearchXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";

export default function ProspectNotFound() {
  return (
    <PageContainer>
      <EmptyState
        icon={SearchXIcon}
        title="Prospect introuvable"
        description="Ce prospect n'existe pas ou a été supprimé lors d'un nouvel import."
        action={
          <Button asChild>
            <Link href="/prospects">Retour à la liste</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
