"use client";

import * as React from "react";

import type { Langue } from "@/lib/preferences/preferences";
import { createFormat } from "@/lib/format";

import { getMessages } from "./index";

const LocaleContext = React.createContext<Langue>("fr");

/** Langue de l'interface pour les composants client (fournie par le layout racine). */
export function I18nProvider({ locale, children }: { locale: Langue; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Langue {
  return React.useContext(LocaleContext);
}

/** Dictionnaire de la langue courante. */
export function useT() {
  return getMessages(useLocale());
}

/** Formateurs (montants, dates, durées) de la langue courante. */
export function useFormat() {
  const locale = useLocale();
  return React.useMemo(() => createFormat(locale), [locale]);
}
