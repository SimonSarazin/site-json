import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import { isPlainObj, type CarrierLike } from "@/lib/costumLists";

/** Référence STABLE pour le cas "aucune liste" — un littéral `{}` serait un objet NEUF à chaque appel
 *  (jamais égal à lui-même par référence), ce qui invaliderait en boucle le `useMemo` de tout
 *  consommateur qui met ce retour en dépendance (`useDynamicFilterOptions`) → boucle de rendu infinie
 *  sur n'importe quel site SANS `costum.lists`/`lists` statique (donc la plupart des sites, pas que
 *  parent62). Même patron que `CocolightProvider.tsx` (`DEFAULT_CLIENT_OPTIONS = Object.freeze({})`). */
const AUCUNE_LISTE: Record<string, unknown> = Object.freeze({});

/**
 * Version RÉACTIVE de `costumListsOf` (cf. `@/lib/costumLists`) — mêmes règles de précédence
 * (`costum.lists` puis repli `lists` racine), mais abonnée aux signaux réactifs natifs du SDK
 * (`useReactiveProperty`, déjà utilisé ~14 fois ailleurs dans le repo) plutôt qu'une lecture figée au
 * rendu.
 *
 * INTÉRÊT : un `carrier.refresh()` réussi (cf. `growCostumLists`, `profil/forms/costum/parent62/fns.ts`)
 * réassigne les clés `costum`/`lists` sur le MÊME proxy réactif (`_setData` du SDK, doc : « preserves
 * reactive signals ») — ce hook redéclenche donc automatiquement le rendu des consommateurs (filtres,
 * `ValueSelectField`) sans store maison ni `setEntity`/nouveau contexte : la réactivité native du SDK
 * suffit, il fallait juste s'y abonner au lieu de lire `carrier.serverData` une fois pour toutes.
 *
 * Duplique la précédence de `costumListsOf` (2 lignes) plutôt que de la réutiliser telle quelle : cette
 * dernière reste une lecture PURE, appelée hors React (`growCostumLists`, contexte `afterSubmit` sans
 * hooks) — les deux doivent rester d'accord, cf. leurs docstrings respectives.
 */
export function useCostumListsReactive(carrier: CarrierLike): Record<string, unknown> {
  const costum = useReactiveProperty<Record<string, unknown>>(carrier?.serverData, "costum");
  const racine = useReactiveProperty<Record<string, unknown>>(carrier?.serverData, "lists");
  const depuisCostum = isPlainObj(costum?.lists) ? costum.lists as Record<string, unknown> : undefined;
  if (depuisCostum) return depuisCostum;
  return isPlainObj(racine) ? racine : AUCUNE_LISTE;
}
