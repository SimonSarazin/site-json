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
export interface GatedPageLike {
  auth?: { required?: boolean; roles?: string[]; mode?: string } | null;
  middleware?: string[] | null;
}

export function isGatedPage(page: GatedPageLike | null | undefined): boolean {
  if (!page) return false;
  if (page.auth?.required === true) return true;
  if (Array.isArray(page.auth?.roles) && page.auth.roles.length > 0) return true;
  // `middleware` est un tableau de NOMS libres résolus contre le registre d'`usePageGuards`.
  // Seuls ces deux-là conditionnent l'accès ; `redirect-if-authenticated` fait l'inverse
  // (il éloigne un connecté d'une page publique) et ne rend donc pas la page gardée.
  const mw = page.middleware;
  return Array.isArray(mw) && (mw.includes("auth-required") || mw.includes("admin-only"));
}

/**
 * Comportement d'une page gardée quand l'accès n'est pas accordé.
 *  - `prompt`   : on RESTE sur la page ; les sections cèdent la place à une invitation à se
 *                 connecter et la modale s'ouvre par-dessus. Rien n'est perdu (ni la destination,
 *                 ni l'historique) puisqu'on ne navigue pas. C'est la convention déjà appliquée
 *                 aux ACTIONS du produit (news, profil, search, CoForm : `openLogin()`), enfin
 *                 étendue aux pages.
 *  - `redirect` : navigation vers `/login`, avec la destination mémorisée (cf. authRedirect).
 *  - `hide`     : rien n'est rendu, un refus est affiché. Le patron de `/admin` (AdminPage.tsx),
 *                 le seul endroit du dépôt qui le faisait correctement.
 */
export type PageGateMode = "prompt" | "redirect" | "hide";

/** Défaut CODÉ EN DUR : la config n'est jamais parsée par Zod au runtime, un `.default()` n'y tourne pas. */
export const DEFAULT_GATE_MODE: PageGateMode = "prompt";

export function gateMode(page: GatedPageLike | null | undefined): PageGateMode {
  const m = page?.auth?.mode;
  return m === "redirect" || m === "hide" || m === "prompt" ? m : DEFAULT_GATE_MODE;
}

/** Pourquoi l'accès est refusé — détermine ce qu'on montre. */
export type GateReason = "anonymous" | "role";

export interface PageAccess {
  /** La page est-elle soumise à une garde ? */
  gated: boolean;
  mode: PageGateMode;
  /** L'accès est-il accordé ? (toujours `true` sur une page publique) */
  granted: boolean;
  /** Renseigné seulement si `granted` est faux. */
  reason: GateReason | null;
}

interface MeLike {
  isConnected?: boolean;
  serverData?: { roles?: Record<string, unknown> } | null;
}

/**
 * Décision d'accès — PURE et testable hors React, partagée par `usePageGuards` (qui décide de
 * naviguer ou non) et `SiteRenderer` (qui décide de rendre ou non les sections). Les deux
 * répondaient à la question séparément ; elles ne peuvent plus diverger.
 *
 * ⚠️ Le test de rôle reproduit l'existant (`roles[r] === true`). Il est probablement inopérant —
 * le SDK ne connaît que `superAdmin`/`adminPlatform` — mais c'est le sujet d'un autre lot : le
 * corriger ici mélangerait deux changements de comportement.
 */
export function evaluatePageAccess(
  page: GatedPageLike | null | undefined,
  me: MeLike | null | undefined,
): PageAccess {
  const mode = gateMode(page);
  if (!isGatedPage(page)) return { gated: false, mode, granted: true, reason: null };
  if (!me?.isConnected) return { gated: true, mode, granted: false, reason: "anonymous" };

  const roles = page?.auth?.roles;
  if (Array.isArray(roles) && roles.length > 0) {
    const ok = roles.some((r) => me?.serverData?.roles?.[r] === true);
    if (!ok) return { gated: true, mode, granted: false, reason: "role" };
  }
  return { gated: true, mode, granted: true, reason: null };
}
