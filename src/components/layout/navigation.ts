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

// Navigation de l'espace de travail, en 3 groupes. Une rubrique « soon » n'est ni un lien ni un
// compteur : elle s'affiche discrète avec « Bientôt », pour ne jamais laisser croire qu'elle existe.
// `hidden` retire une rubrique de la barre latérale sans supprimer sa page : la navigation reste
// limitée à l'essentiel (une page prête reste accessible par la palette ⌘K).

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Seconde touche du raccourci « G puis … » (spéc. UX/UI §10). */
  goKey: string;
};

export type NavEntry = ((NavItem & { soon?: false }) | { label: string; icon: LucideIcon; soon: true }) & {
  hidden?: boolean;
};

export type NavGroup = { label: string; items: NavEntry[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Espace de travail",
    items: [
      { label: "Dashboard", href: "/tableau-de-bord", icon: HouseIcon, goKey: "D" },
      { label: "Mes priorités", href: "/priorites", icon: TargetIcon, goKey: "R" },
      { label: "Mes dossiers", href: "/dossiers", icon: SquareKanbanIcon, goKey: "K" },
      { label: "Dossiers à risque", href: "/dossiers-a-risque", icon: TriangleAlertIcon, goKey: "A", hidden: true },
    ],
  },
  {
    label: "Gestion commerciale",
    items: [
      { label: "Contacts & prospects", href: "/prospects", icon: UsersIcon, goKey: "P" },
      { label: "Agenda de relances", icon: CalendarClockIcon, soon: true, hidden: true },
      { label: "Messages & relances", icon: MailIcon, soon: true, hidden: true },
      { label: "Performance", icon: ChartLineIcon, soon: true, hidden: true },
    ],
  },
  {
    label: "Données & configuration",
    items: [
      { label: "Importer mes données", href: "/import", icon: DownloadIcon, goKey: "I" },
      { label: "Intégrations CRM", icon: PlugIcon, soon: true, hidden: true },
      { label: "Paramètres", href: "/parametres", icon: SettingsIcon, goKey: "S" },
    ],
  },
];

/** Rubriques disponibles (palette ⌘K, raccourcis « G puis … »). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) =>
  group.items.filter((item): item is NavItem & { soon?: false; hidden?: boolean } => !item.soon)
);
