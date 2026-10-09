/**
 * Forme d'un dictionnaire : mêmes clés que le français, valeurs libres (chaînes ou fonctions de
 * même signature). L'anglais doit respecter cette forme : une clé oubliée bloque la compilation.
 */
export type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { [K in keyof T]: Widen<T[K]> };
