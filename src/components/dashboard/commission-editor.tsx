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
import { useLocale, useT } from "@/i18n/client";

// Réglage du taux de commission depuis le brief : un lien discret ouvre un petit formulaire.
export function CommissionEditor({ rate, trigger }: { rate: number | null; trigger: React.ReactNode }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const decimal = (n: number) => (locale === "en" ? String(n) : String(n).replace(".", ","));
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
      toast.success(next === null ? t.brief.commissionHidden : t.brief.commissionSaved(decimal(next)));
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
              setError(t.brief.commissionRange);
              return;
            }
            save(parsed);
          }}
          className="flex flex-col gap-3"
        >
          <p className="flex items-center gap-2 text-body font-semibold text-foreground">
            <PercentIcon className="size-4 text-primary" aria-hidden />
            {t.brief.commissionTitle}
          </p>
          <Field
            label={t.brief.commissionRate}
            htmlFor="taux-commission"
            hint={t.brief.commissionHint}
            error={error ?? undefined}
          >
            <InputWithSuffix
              id="taux-commission"
              suffix="%"
              inputMode="decimal"
              placeholder={t.brief.commissionPlaceholder}
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between gap-2">
            {rate !== null ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => save(null)} disabled={pending}>
                {t.brief.commissionHide}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" loading={pending}>
              {t.common.save}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
