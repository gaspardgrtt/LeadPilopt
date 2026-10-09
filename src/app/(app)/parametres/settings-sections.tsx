import { LanguagesIcon, PaletteIcon, UserIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { getMessages } from "@/i18n";

type SettingsT = ReturnType<typeof getMessages>;

/** Les trois sections, partagées avec l'aperçu de développement. */
export function SettingsSections({
  appearance,
  language,
  account,
  t,
}: {
  appearance: React.ReactNode;
  language: React.ReactNode;
  account: React.ReactNode;
  t: SettingsT;
}) {
  const section = (icon: React.ReactNode, title: string, description: string, content: React.ReactNode, contentClass = "pt-4") => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={contentClass}>{content}</CardContent>
    </Card>
  );
  return (
    <div className="flex flex-col gap-6">
      {section(<PaletteIcon className="size-4 text-primary" aria-hidden />, t.settings.appearance, t.settings.appearanceDescription, appearance)}
      {section(<LanguagesIcon className="size-4 text-primary" aria-hidden />, t.settings.language, t.settings.languageDescription, language)}
      {section(<UserIcon className="size-4 text-primary" aria-hidden />, t.settings.account, t.settings.accountDescription, account, "pt-1")}
    </div>
  );
}
