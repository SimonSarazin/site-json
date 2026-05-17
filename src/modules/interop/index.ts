/**
 * Module Interop
 *
 * Module pour l'interopérabilité avec des services tiers (Discourse, Mediawiki, etc.).
 *
 * @remarks
 * Statut des exports (vérifié 2026-05-17 via `grep -rn` sur `src/`) :
 *  - **Seul `useInteropConfig` est consommé en externe** (1 import dans `ProfileAbout.tsx`).
 *  - Tous les autres exports sont `@unused` actuellement : ils sont conservés car
 *    l'intention est de les exploiter dans une future intégration (modale globale
 *    Discourse, vue dédiée Mediawiki, etc.). Suppression non recommandée.
 *  - Les consommateurs internes (`RootLayout.tsx`, `DiscourseSection.tsx`) importent
 *    directement par chemin profond — ils ne dépendent pas de ce barrel.
 */

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
/** @unused Pas de consommateur dans le repo au 2026-05-17. Conservé pour usage futur prévu. */
export { useInteropUserLinks } from "./hooks/useUserInteropLinks";
/** @unused Pas de consommateur dans le repo au 2026-05-17. Conservé pour usage futur prévu. */
export { useDiscourseProfilQuery } from "./hooks/useDiscourseProfil";
/** @unused Type de retour de `useDiscourseProfilQuery` — Conservé avec son hook. */
export type { DiscourseProfilResult } from "./hooks/useDiscourseProfil";
/**
 * @unused Aucune des 4 mutations n'a de consommateur externe via ce barrel au 2026-05-17.
 * Conservées pour usage futur prévu (link/unlink/dismiss/checkEmail Discourse).
 * Note : ces mutations n'utilisent pas `useMutationWithToast` — TODO sprint suivant.
 */
export {
  useDiscourseLink,
  useDiscourseUnlink,
  useDiscourseCheckEmail,
  useDiscourseDismiss,
} from "./hooks/useInteropMutation";
