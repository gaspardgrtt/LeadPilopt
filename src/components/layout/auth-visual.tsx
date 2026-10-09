import { ClockIcon, SparklesIcon, UsersIcon } from "lucide-react";

import { getI18n } from "@/i18n/server";

// Panneau visuel de la page de connexion. La maquette utilise une photo plein cadre avec une carte
// en verre dépoli ; on reprend la composition (cadre arrondi, carte flottante en bas) avec un fond
// aux couleurs de la marque et un aperçu du produit. Une photo HD pourra remplacer le fond.
export async function AuthVisual() {
  const { t, format } = await getI18n();
  return (
    <div className="relative flex h-full min-h-[560px] flex-col justify-end overflow-hidden rounded-xl bg-sidebar p-10">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 75% 20%, color-mix(in srgb, var(--primary) 55%, transparent) 0%, transparent 70%), radial-gradient(50% 45% at 15% 85%, color-mix(in srgb, var(--violet) 35%, transparent) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(70% 60% at 60% 40%, black, transparent)",
        }}
      />

      <div aria-hidden className="relative mx-auto mb-auto mt-16 w-full max-w-[440px] rotate-[-2deg]">
        <div className="light rounded-lg border border-white/10 bg-surface p-5 shadow-overlay">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-warning-soft text-warning">
              <ClockIcon className="size-5" strokeWidth={1.9} />
            </span>
            <div>
              <p className="text-kpi text-foreground tabular-nums">{format.euro(184300)}</p>
              <p className="text-body text-foreground-secondary">{t.auth.visual.recoverable}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2.5">
            {["Nordwind GmbH", "Atelier Lumen", "Kairos Conseil"].map((name, index) => (
              <div key={name} className="flex items-center justify-between rounded-md bg-surface-subtle px-3 py-2.5">
                <span className="flex items-center gap-2.5 text-body font-medium text-foreground">
                  <UsersIcon className="size-4 text-foreground-tertiary" />
                  {name}
                </span>
                <span className="rounded-sm bg-danger-soft px-2 py-0.5 text-caption text-danger">
                  {t.auth.visual.days([26, 41, 63][index])}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative rounded-lg border border-white/15 bg-white/10 p-6 backdrop-blur-md">
        <SparklesIcon className="size-5 text-white/80" strokeWidth={1.75} aria-hidden />
        <p className="mt-3 text-[17px] leading-7 font-medium text-white">{t.auth.visual.pitch}</p>
        <p className="mt-3 text-body text-white/65">{t.auth.visual.pitchHint}</p>
      </div>
    </div>
  );
}
