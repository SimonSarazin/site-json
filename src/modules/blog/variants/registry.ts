import type { ComponentType } from "react";

/**
 * Registre générique de VARIANTS (patron des cartes de search / layouts formEngine). Les variants sont des
 * composants **`lazy` de `vite-preload`** (`PreloadableComponent`) : chunk code-splitté, tracé par le plugin
 * `vite-preload` (→ `<link modulepreload>` injectés en SSR, `preloadAll` serveur) ET méthode `.preload()`
 * (préchauffe le chunk, ex. au survol — cf. `Agenda.tsx`). `get(key)` retourne le variant ou le `default`
 * (fallback jamais cassé).
 *
 * ⚠️ Les variants DOIVENT être déclarés `lazy(() => import("chemin/statique"))` DIRECTEMENT au point de
 * définition (`cards.ts`, `readers.ts`) — jamais via une indirection (loader passé en variable), sinon le
 * plugin `vite-preload` ne trace pas le chunk (même piège que `lazyNamed`). Le registre ne fait qu'INDEXER
 * des composants déjà `lazy`.
 */
export type BlogVariant<P> = ComponentType<P> & { preload: () => Promise<unknown> };

export interface VariantRegistry<P> {
  get: (key?: string) => BlogVariant<P>;
  has: (key: string) => boolean;
  keys: () => string[];
  preload: (key?: string) => void;
}

export function makeVariantRegistry<P>(variants: Record<string, BlogVariant<P>>): VariantRegistry<P> {
  if (!variants.default) throw new Error("[blog] un registre de variants exige une entrée 'default'");
  const pick = (key?: string) => variants[key ?? "default"] ?? variants.default;
  return {
    get: pick,
    has: (key) => key in variants,
    keys: () => Object.keys(variants),
    preload: (key) => { void pick(key).preload(); },
  };
}
