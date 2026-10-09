import Link from "next/link";
import { SearchXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/shared/empty-state";
import { getI18n } from "@/i18n/server";

export default async function ProspectNotFound() {
  const { t } = await getI18n();
  return (
    <PageContainer>
      <EmptyState
        icon={SearchXIcon}
        title={t.errors.prospectNotFoundTitle}
        description={t.errors.prospectNotFoundDescription}
        action={
          <Button asChild>
            <Link href="/prospects">{t.errors.backToList}</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
