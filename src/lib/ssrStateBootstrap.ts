/**
 * Restitue les parents de l'état SSR (cf. `ssrStatePacking`) AVANT tout lecteur de
 * `window.__REACT_QUERY_STATE__` : à importer EN PREMIER dans `entry-client`, les imports d'un
 * module ES s'évaluant dans l'ordre.
 */
import { unpackSsrState } from "./ssrStatePacking";

if (typeof window !== "undefined" && window.__REACT_QUERY_STATE__) {
  try {
    window.__REACT_QUERY_STATE__ = unpackSsrState(window.__REACT_QUERY_STATE__);
  } catch (error) {
    // Ne JAMAIS empêcher l'hydratation : sans parents restitués, les entités perdent leur méta de
    // parent (droits d'admin recalculés au chargement), mais la page vit.
    console.error("[ssr] restitution de l'état SSR impossible :", error);
  }
}
