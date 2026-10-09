import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DashboardPreview } from "./dashboard-preview";

export const metadata: Metadata = { title: "Aperçu · Dashboard" };

// Aperçu de développement : E3 rempli avec des données d'exemple, pour comparer à la maquette.
export default function DashboardPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DashboardPreview />;
}
