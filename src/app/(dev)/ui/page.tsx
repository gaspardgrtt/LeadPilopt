import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Catalogue } from "./catalogue";

export const metadata: Metadata = { title: "Catalogue UI" };

// Catalogue des composants du design system, disponible uniquement en développement.
export default function UiCataloguePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Catalogue />;
}
