import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Registre générique de VARIANTS lazy (patron des cartes de search / layouts formEngine). Chaque variant est
 * un composant chargé à la demande (code-split Vite) ; `get(key)` retourne le variant demandé ou le `default`
 * (fallback jamais cassé). `preload(key)` déclenche le chunk (vite-preload) sans rendre.
 *
 * ⚠️ Pour que vite-preload fonctionne, les `loaders` DOIVENT être des `() => import("chemin/statique")`
 * (chaîne littérale) au point d'appel (cf. `cards.ts`, `readers.ts`) — pas d'import dynamique calculé.
 */
export interface VariantRegistry<P> {
  get: (key?: string) => LazyExoticComponent<ComponentType<P>>;
  has: (key: string) => boolean;
  keys: () => string[];
  preload: (key?: string) => void;
}

export function makeVariantRegistry<P>(
  loaders: Record<string, () => Promise<{ default: ComponentType<P> }>>,
): VariantRegistry<P> {
  if (!loaders.default) throw new Error("[blog] un registre de variants exige une entrée 'default'");
  const lazyMap = Object.fromEntries(
    Object.entries(loaders).map(([k, loader]) => [k, lazy(loader)]),
  ) as Record<string, LazyExoticComponent<ComponentType<P>>>;
  return {
    get: (key) => lazyMap[key ?? "default"] ?? lazyMap.default,
    has: (key) => key in lazyMap,
    keys: () => Object.keys(lazyMap),
    preload: (key) => { void (loaders[key ?? "default"] ?? loaders.default)(); },
  };
}
