import "server-only";

import { cookies, headers } from "next/headers";

import { LANGUE_COOKIE, type Langue } from "@/lib/preferences/preferences";
import { createFormat } from "@/lib/format";

import { getMessages, resolveLocale } from "./index";

/** Langue de la requête (voir resolveLocale). */
export async function getLocale(): Promise<Langue> {
  return resolveLocale((await cookies()).get(LANGUE_COOKIE)?.value, (await headers()).get("accept-language"));
}

/** Dictionnaire et formateurs de la langue courante (Server Components, actions, routes). */
export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: getMessages(locale), format: createFormat(locale) };
}
