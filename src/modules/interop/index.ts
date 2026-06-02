/**
 * Module Interop
 *
 * Module pour l'interopérabilité avec des services tiers (Discourse, Mediawiki, etc.).
 *
 * @remarks
 * Statut des exports (vérifié 2026-05-17 via `grep -rn` sur `src/`) :
 *  - **Seul `useInteropConfig` est consommé en externe** (1 import dans `ProfileAbout.tsx`).
 *  - Les autres exports ne sont pas consommés *via ce barrel*, mais plusieurs
 *    (hooks `useInteropUserLinks`/`useDiscourseProfilQuery`, mutations Discourse,
 *    composants pods/sections) SONT activement utilisés en interne par chemin
 *    profond — voir les annotations par export ci-dessous. Suppression non recommandée.
 *  - Les consommateurs internes (`RootLayout.tsx`, `DiscourseSection.tsx`) importent
 *    directement par chemin profond — ils ne dépendent pas de ce barrel.
 */

// Query keys centralisés (single source of truth)
export { INTEROP_QUERY_KEYS } from "./constants/queryKeys";
export type { InteropQueryKeyType } from "./constants/queryKeys";

// Composants Discourse
/** @unused Pas de consommateur dans le repo au 2026-05-17. Conservé pour usage futur prévu. */
export { default as DiscourseLink } from "./components/DiscourseLink";
/** @unused Pas de consommateur dans le repo au 2026-05-17. Conservé pour usage futur prévu. */
export { default as DiscoursePod } from "./components/DiscoursePod";
/** @unused Pas de consommateur via le barrel — `RootLayout.tsx` importe par chemin profond. Conservé. */
export { default as DiscourseSection } from "./DiscourseSection";

// Composants Mediawiki
/** @unused Pas de consommateur dans le repo au 2026-05-17. Conservé pour usage futur prévu. */
export { default as MediawikiLink } from "./components/MediawikiLink";
/** @unused Pas de consommateur dans le repo au 2026-05-17. Conservé pour usage futur prévu. */
export { default as MediawikiPod } from "./components/MediawikiPod";
/** @unused Pas de consommateur via le barrel — importé par chemin profond. Conservé. */
export { default as MediawikiSection } from "./MediawikiSection";

// Hooks
export { useInteropConfig } from "./hooks/useInteropConfigQuery";
/** Consommé en interne (import par chemin profond) par DiscourseSection / MediawikiSection / DiscoursePod / MediawikiPod — pas via ce barrel. */
export { useInteropUserLinks } from "./hooks/useUserInteropLinks";
/** Consommé en interne (import par chemin profond) par DiscoursePod — pas via ce barrel. */
export { useDiscourseProfilQuery } from "./hooks/useDiscourseProfil";
/** @unused Type de retour de `useDiscourseProfilQuery` — Conservé avec son hook. */
export type { DiscourseProfilResult } from "./hooks/useDiscourseProfil";
/**
 * Mutations Discourse (link / unlink / dismiss / checkEmail). Elles utilisent
 * `useMutationWithToast` (via `createInteropMutation`). Consommées en interne par
 * chemin profond : `useDiscourseLink` (DiscourseLink, DiscourseAutoLinkModal),
 * `useDiscourseUnlink` (DiscoursePod), `useDiscourseDismiss` (DiscourseAutoLinkModal).
 * Seul `useDiscourseCheckEmail` n'a aucun consommateur actuel.
 */
export {
  useDiscourseLink,
  useDiscourseUnlink,
  useDiscourseCheckEmail,
  useDiscourseDismiss,
} from "./hooks/useInteropMutation";
