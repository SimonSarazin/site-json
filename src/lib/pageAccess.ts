import type { Page } from "@/types/site-schema";

/**
 * Une page est-elle GARDÉE (accès conditionné à une session ou à un rôle) ?
 *
 * Point de vérité de la question « cette page est-elle publique ? », posée par trois surfaces qui
 * répondaient jusqu'ici chacune à sa façon — ou pas du tout :
 *  1. `SiteRenderer` : ne doit PAS sérialiser les sections d'une page gardée ;
 *  2. `Seo` : doit émettre `robots: noindex` sur une page gardée ;
 *  3. `server/lib/sitemap.js` : ne doit pas la lister (miroir JS de ce prédicat — voir plus bas).
 *
 * POURQUOI : la garde d'accès (`usePageGuards`) vit dans un `useEffect`, donc elle ne s'exécute
 * JAMAIS au rendu serveur. Le HTML complet d'une page gardée était donc streamé à un visiteur
 * anonyme en HTTP 200 (mesuré : 165 ko, 5 sections, ~1 s de contenu privé affiché avant la
 * redirection client), la page était listée dans `sitemap.xml` et ne portait aucune balise
 * `robots`. Ce prédicat est ce qui permet aux trois surfaces de cesser de la traiter en page
 * publique — sans rien attendre d'une vraie garde serveur, aujourd'hui impossible : `initApi()`
 * n'est pas appelé avec les cookies de la requête et le stockage de jeton au SSR est `"memory"`,
 * donc `me` vaut toujours `null` au rendu.
 *
 * ⚠️ MIROIR : `server/lib/sitemap.js` réimplémente cette règle en JS pur (il est chargé
 * directement par node, sans transformation TypeScript). Les deux implémentations sont tenues
 * d'accord par `server/__tests__/sitemap.test.ts`, qui les confronte sur la même matrice de cas.
 * Toute évolution de la règle doit toucher les DEUX.
 */
export function isGatedPage(page: Pick<Page, "auth" | "middleware"> | null | undefined): boolean {
  if (!page) return false;
  if (page.auth?.required === true) return true;
  if (Array.isArray(page.auth?.roles) && page.auth.roles.length > 0) return true;
  // `middleware` est un tableau de NOMS libres résolus contre le registre d'`usePageGuards`.
  // Seuls ces deux-là conditionnent l'accès ; `redirect-if-authenticated` fait l'inverse
  // (il éloigne un connecté d'une page publique) et ne rend donc pas la page gardée.
  const mw = page.middleware;
  return Array.isArray(mw) && (mw.includes("auth-required") || mw.includes("admin-only"));
}
