import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/layout/page-container";

// Squelette à la forme des écrans (titre, cartes, tableau) pendant le chargement des données.
export default function AppLoading() {
  return (
    <PageContainer aria-busy>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-80" />
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
      </div>
      <Skeleton className="mt-5 h-80 rounded-lg" />
    </PageContainer>
  );
}
