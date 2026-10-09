"use client";

import Link from "next/link";
import { ArrowLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion/motion";
import { useT } from "@/i18n/client";

// En-tête de page de la maquette : pas de barre du haut, le titre (28/700) et sa description
// ouvrent la page ; actions à droite. Variante fiche : fil d'Ariane + lien « Retour ».
type Crumb = { label: string; href?: string };

type PageHeaderProps = {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: Crumb[];
  backHref?: string;
  className?: string;
};

export function PageHeader({ title, description, actions, breadcrumb, backHref, className }: PageHeaderProps) {
  const t = useT();
  return (
    <FadeIn y={4} className={cn("mb-8", className)}>
      <header>
        {breadcrumb && (
          <nav aria-label={t.common.breadcrumb} className="mb-3">
            <ol className="flex items-center gap-1.5 text-dense">
              {breadcrumb.map((crumb, index) => {
                const last = index === breadcrumb.length - 1;
                return (
                  <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                    {index > 0 && (
                      <ChevronRightIcon className="size-3.5 shrink-0 text-foreground-tertiary" aria-hidden />
                    )}
                    {crumb.href && !last ? (
                      <Link
                        href={crumb.href}
                        className="rounded-sm text-foreground-secondary outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-primary/25"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate font-medium text-foreground" aria-current={last ? "page" : undefined}>
                        {crumb.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
        {backHref && (
          <Link
            href={backHref}
            className="mb-2 inline-flex items-center gap-1.5 rounded-sm text-dense text-foreground-secondary outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-primary/25"
          >
            <ArrowLeftIcon className="size-4" aria-hidden />
            {t.common.back}
          </Link>
        )}
        {(title || actions) && (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {title && <h1 className="text-[24px] leading-8 font-bold tracking-[-0.02em] text-foreground sm:text-title">{title}</h1>}
              {description && <p className="mt-1.5 text-[15px] leading-[22px] text-foreground-secondary">{description}</p>}
            </div>
            {actions && <div className="flex max-w-full shrink-0 items-center gap-2.5">{actions}</div>}
          </div>
        )}
      </header>
    </FadeIn>
  );
}
