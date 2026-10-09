import * as React from "react"

import { cn } from "@/lib/utils"

// Tableaux de la maquette : en-tête gris très clair en 13/500, lignes de 56 px
// séparées par un filet discret, colonnes numériques alignées à droite.
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-body", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("sticky top-0 z-10 bg-surface-subtle/80 backdrop-blur-sm [&_tr]:border-b [&_tr]:hover:shadow-none [&_tr]:hover:bg-transparent", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-surface-subtle font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group/row h-row border-b border-border/70 transition-[background-color,box-shadow] duration-200 ease-standard hover:bg-primary-soft/45 hover:shadow-[inset_3px_0_0_var(--primary)] data-[state=selected]:bg-primary-soft data-[state=selected]:shadow-[inset_3px_0_0_var(--primary)]",
        className
      )}
      {...props}
    />
  )
}

type TableHeadProps = React.ComponentProps<"th"> & { numeric?: boolean }

function TableHead({ className, numeric, ...props }: TableHeadProps) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-3 text-left align-middle text-caption font-semibold tracking-wide whitespace-nowrap text-foreground-secondary uppercase first:pl-5 last:pr-5",
        numeric && "text-right",
        className
      )}
      {...props}
    />
  )
}

type TableCellProps = React.ComponentProps<"td"> & { numeric?: boolean }

function TableCell({ className, numeric, ...props }: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 align-middle whitespace-nowrap text-foreground-secondary first:pl-5 last:pr-5",
        numeric && "text-right tabular-nums",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-dense text-foreground-secondary", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
