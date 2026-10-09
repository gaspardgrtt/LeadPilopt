"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PercentIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputWithSuffix } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Field } from "@/components/shared/field";
import { updateCommissionRate } from "@/app/(app)/actions";

// Réglage du taux de commission depuis le brief : un lien discret ouvre un petit formulaire.
export function CommissionEditor({ rate, trigger }: { rate: number | null; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(rate === null ? "" : String(rate).replace(".", ","));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save(next: number | null) {
    startTransition(async () => {
      const result = await updateCommissionRate(next);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setError(null);
      toast.success(next === null ? "Commission masquée" : `Taux de commission enregistré : ${String(next).replace(".", ",")} %`);
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = value.trim() === "" ? null : Number(value.replace(/\s/g, "").replace(",", "."));
            if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100)) {
              setError("Entre 0,01 et 100 %");
              return;
            }
            save(parsed);
          }}
          className="flex flex-col gap-3"
        >
          <p className="flex items-center gap-2 text-body font-semibold text-foreground">
            <PercentIcon className="size-4 text-primary" aria-hidden />
            Votre taux de commission
          </p>
          <Field
            label="Taux"
            htmlFor="taux-commission"
            hint="Appliqué à l'argent récupérable pour estimer votre commission."
            error={error ?? undefined}
          >
            <InputWithSuffix
              id="taux-commission"
              suffix="%"
              inputMode="decimal"
              placeholder="Ex. 4"
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between gap-2">
            {rate !== null ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => save(null)} disabled={pending}>
                Ne plus afficher
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" loading={pending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
