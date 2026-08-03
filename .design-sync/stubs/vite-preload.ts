// Stub design-sync : vite-preload (plugin node) n'est pas bundlable par esbuild.
// En preview, `lazy` de React suffit — esbuild inline les import() dynamiques
// quand le splitting est coupé. `preloadAll` est un no-op (pas de SSR ici).
export { lazy } from "react";
export const preloadAll = async (): Promise<void> => {};
