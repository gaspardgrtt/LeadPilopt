import { HouseIcon, DownloadIcon, UsersIcon, type LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Seconde touche du raccourci « G puis … » (spéc. UX/UI §10). */
  goKey: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/tableau-de-bord", icon: HouseIcon, goKey: "D" },
  { label: "Prospects", href: "/prospects", icon: UsersIcon, goKey: "P" },
  { label: "Importer", href: "/import", icon: DownloadIcon, goKey: "I" },
];
