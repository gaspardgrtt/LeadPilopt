import {
  CalendarClockIcon,
  ChartLineIcon,
  DownloadIcon,
  HouseIcon,
  MailIcon,
  PlugIcon,
  SettingsIcon,
  SquareKanbanIcon,
  TargetIcon,
  TriangleAlertIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

// Navigation de l'espace de travail, en 3 groupes (libellés : clés du dictionnaire, t.nav). Une rubrique « soon » n'est ni un lien ni un
// compteur : elle s'affiche discrète avec « Bientôt », pour ne jamais laisser croire qu'elle existe.
// `hidden` retire une rubrique de la barre latérale sans supprimer sa page : la navigation reste
// limitée à l'essentiel (une page prête reste accessible par la palette ⌘K).

/** Clé du libellé dans le dictionnaire (`t.nav.items`). */
export type NavLabelKey = "dashboard" | "priorities" | "deals" | "risk" | "prospects" | "agenda" | "messages" | "performance" | "import" | "crm" | "settings";

export type NavItem = {
  label: NavLabelKey;
  href: string;
  icon: LucideIcon;
  /** Seconde touche du raccourci « G puis … » (spéc. UX/UI §10). */
  goKey: string;
};

export type NavEntry = ((NavItem & { soon?: false }) | { label: NavLabelKey; icon: LucideIcon; soon: true }) & {
  hidden?: boolean;
};

export type NavGroup = { label: "workspace" | "sales" | "data"; items: NavEntry[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "workspace",
    items: [
      { label: "dashboard", href: "/tableau-de-bord", icon: HouseIcon, goKey: "D" },
      { label: "priorities", href: "/priorites", icon: TargetIcon, goKey: "R" },
      { label: "deals", href: "/dossiers", icon: SquareKanbanIcon, goKey: "K" },
      { label: "risk", href: "/dossiers-a-risque", icon: TriangleAlertIcon, goKey: "A", hidden: true },
    ],
  },
  {
    label: "sales",
    items: [
      { label: "prospects", href: "/prospects", icon: UsersIcon, goKey: "P" },
      { label: "agenda", icon: CalendarClockIcon, soon: true, hidden: true },
      { label: "messages", icon: MailIcon, soon: true, hidden: true },
      { label: "performance", icon: ChartLineIcon, soon: true, hidden: true },
    ],
  },
  {
    label: "data",
    items: [
      { label: "import", href: "/import", icon: DownloadIcon, goKey: "I" },
      { label: "crm", icon: PlugIcon, soon: true, hidden: true },
      { label: "settings", href: "/parametres", icon: SettingsIcon, goKey: "S" },
    ],
  },
];

/** Rubriques disponibles (palette ⌘K, raccourcis « G puis … »). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) =>
  group.items.filter((item): item is NavItem & { soon?: false; hidden?: boolean } => !item.soon)
);
