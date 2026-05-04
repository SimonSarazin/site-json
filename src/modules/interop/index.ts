/**
 * Module Interop
 *
 * Module pour l'interopérabilité avec des services tiers (Discourse, Mediawiki, etc.).
 */

// Composants Discourse
export { default as DiscoursLink } from "./components/DiscourseLink";
export { default as DiscoursePod } from "./components/DiscoursePod";
export { default as DiscourseSection } from "./DiscourseSection";

// Composants Mediawiki
export { default as MediawikiLink } from "./components/MediawikiLink";
export { default as MediawikiPod } from "./components/MediawikiPod";
export { default as MediawikiSection } from "./MediawikiSection";

// Hooks
export { useInteropConfig } from "./hooks/useInteropConfigQuery";
export { useInteropUserLinks } from "./hooks/useUserInteropLinks";
export { useDiscourseProfilQuery } from "./hooks/useDiscourseProfil";
export type { DiscourseProfilResult } from "./hooks/useDiscourseProfil";
export {
  useDiscourseLink,
  useDiscourseUnlink,
  useDiscourseCheckEmail,
  useDiscourseDismiss,
} from "./hooks/useInteropMutation";