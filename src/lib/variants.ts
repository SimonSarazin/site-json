import type { ComponentType } from "react";

/**
 * Registre générique de variants : des composants `lazy` de `vite-preload` (modulepreload SSR et
 * `.preload()`), indexés par clé ; `get(key)` retombe sur `default`.
 *
 * ⚠️ Chaque variant est déclaré `lazy(() => import("chemin/statique"))` directement, sans loader en
 * variable : sinon le plugin `vite-preload` ne trace pas le chunk.
 */
export type LazyVariant<P> = ComponentType<P> & {
  preload: () => Promise<unknown>;
  /** Posé par `staticVariant` : variant embarqué, qui ne suspend jamais. */
  embedded?: true;
};

export interface VariantRegistry<P> {
  get: (key?: string) => LazyVariant<P>;
  has: (key: string) => boolean;
  keys: () => string[];
  /** Précharge le chunk du variant (ou du `default`). */
  preload: (key?: string) => Promise<unknown>;
}

/** Variant embarqué dans le chunk de l'appelant, pour le `default` d'un registre déjà chargé en `lazy`. */
export function staticVariant<P>(component: ComponentType<P>): LazyVariant<P> {
  return Object.assign(component, { preload: () => Promise.resolve(component), embedded: true as const });
}

/** Vrai si tous ces variants sont embarqués : l'appelant n'a alors pas besoin de frontière `Suspense`. */
export function allEmbedded(...variants: Array<{ embedded?: true }>): boolean {
  return variants.every((v) => v.embedded === true);
}

/** @param label nom du registre, en préfixe des messages d'erreur. */
export function makeVariantRegistry<P>(
  variants: Record<string, LazyVariant<P>>,
  label = "variants",
): VariantRegistry<P> {
  if (!variants.default) throw new Error(`[${label}] un registre de variants exige une entrée 'default'`);
  // `hasOwnProperty` : une clé comme `"constructor"` ne doit pas lire le prototype.
  const has = (key: string) => Object.prototype.hasOwnProperty.call(variants, key);
  const pick = (key?: string) => (key !== undefined && has(key) ? variants[key] : variants.default);
  return {
    get: pick,
    has,
    keys: () => Object.keys(variants),
    preload: (key) => pick(key).preload(),
  };
}
