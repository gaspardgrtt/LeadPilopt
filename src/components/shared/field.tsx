import * as React from "react";
import { CircleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

// Spéc. UX/UI §3 — Champ : libellé au-dessus en 13/500, aide en dessous en 12 tertiaire,
// erreur en 12 danger avec icône.
type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-dense font-medium text-foreground">
        {label}
        {required && <span className="text-foreground-tertiary">*</span>}
      </Label>
      {React.isValidElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean }>(children)
        ? React.cloneElement(children, {
            "aria-describedby": describedBy,
            "aria-invalid": error ? true : undefined,
          })
        : children}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-center gap-1 text-caption font-normal text-danger">
          <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${htmlFor}-hint`} className="text-caption font-normal text-foreground-tertiary">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
