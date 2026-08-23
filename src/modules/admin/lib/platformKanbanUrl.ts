/**
 * URL de la vue kanban « actions » de la plateforme communecter pour un costum :
 * `<serverUrl>/#@<costumSlug>.view.actions`.
 *
 * Routing legacy en hash : `#@<slug>` cible l'élément (le carrier du costum),
 * `.view.actions` ouvre son kanban d'actions. Base = `getServerUrl()`
 * (`VITE_SERVER_URL`, `www.communecter.org` sur tout le parc) — même sémantique
 * que l'embed co2 / la cagnotte, PAS l'URL publique du site-json.
 */
export function platformKanbanUrl(serverUrl: string, costumSlug: string): string {
  return `${serverUrl.replace(/\/+$/, "")}/#@${costumSlug}.view.actions`;
}
