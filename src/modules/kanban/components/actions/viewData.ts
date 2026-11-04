/**
 * Données partagées par les vues Liste, Table, Chronologie et Vue d'ensemble. Repris de co-kanban
 * (`pages/board/viewData.ts`), sur le contexte de la mise en page au lieu d'un `useBoard` par vue.
 *
 * Les vues partagent ce modèle pour une raison précise : si chacune refaisait son filtrage, un
 * même tableau afficherait « 7 cartes » dans la liste et « 8 » dans la table dès qu'un critère
 * serait interprété d'un cheveu différemment.
 */
import { useDeferredValue, useMemo } from "react";
import { hasActiveCriteria } from "@/modules/kanban/components/board/filterBar";
import { useDayClock } from "@/modules/kanban/components/board/useDayClock";
import { EMPTY_FILTER, filterCards, filterCardsByColumn } from "@/modules/kanban/lib/boardFilter";
import { dateZoneFor } from "@/modules/kanban/lib/boardSource";
import { columnBreakdown, type ColumnBreakdownEntry } from "@/modules/kanban/lib/boardStats";
import type { DateZone } from "@/modules/kanban/lib/dates";
import type { BoardSnapshot, Card } from "@/modules/kanban/types";
import { useActionsOutlet } from "./actionsOutlet";

export interface ActionsViewModel {
  /** `undefined` tant que l'instantané n'est pas chargé. */
  snapshot: BoardSnapshot | undefined;
  /** Cartes retenues par le filtre, dans l'ordre du tableau. */
  cards: Card[];
  /** Mêmes cartes, groupées par colonne (une colonne vide reste présente). */
  cardsByColumn: ReadonlyMap<string, Card[]>;
  /** Colonnes dans l'ordre d'affichage, avec leur avancement. */
  columns: ColumnBreakdownEntry[];
  /**
   * Instant courant à la JOURNÉE (`useDayClock`) : `0` au rendu serveur et au premier rendu
   * client, où rien n'est donc « en retard » (même HTML des deux côtés).
   */
  now: number;
  /** Fuseau du jour civil des dates : celui du navigateur sur un tableau relié, comme Kanban gestion. */
  zone: DateZone;
  /** `true` dès qu'un critère restreint la sélection : un écran vide vient alors du filtre. */
  isFiltered: boolean;
}

const NO_CARDS: Card[] = [];
const NO_CARDS_BY_COLUMN: ReadonlyMap<string, Card[]> = new Map();

/**
 * @param ignoreFilter la vue travaille sur le tableau ENTIER (Vue d'ensemble) : la barre de
 * filtres y est remplacée par une phrase, et un avancement calculé sur une sélection
 * contredirait cette promesse.
 */
export function useActionsViewModel({ ignoreFilter = false }: { ignoreFilter?: boolean } = {}): ActionsViewModel {
  const { snapshot, search } = useActionsOutlet();
  // DIFFÉRÉ, comme sur le Tableau : le champ de recherche se met à jour tout de suite, la vue
  // suit dans un rendu interruptible (une liste de mille actions figeait la saisie).
  const criteria = useDeferredValue(ignoreFilter ? EMPTY_FILTER : search.criteria);
  const now = useDayClock();

  const cards = useMemo(() => (snapshot ? filterCards(snapshot, criteria, now) : NO_CARDS), [snapshot, criteria, now]);
  const cardsByColumn = useMemo(() => (snapshot ? filterCardsByColumn(snapshot, criteria, now) : NO_CARDS_BY_COLUMN), [snapshot, criteria, now]);
  const columns = useMemo(() => (snapshot ? columnBreakdown(snapshot) : []), [snapshot]);

  return {
    snapshot,
    cards,
    cardsByColumn,
    columns,
    now,
    zone: snapshot ? dateZoneFor(snapshot.capabilities.source) : "utc",
    isFiltered: hasActiveCriteria(criteria),
  };
}

/** Nom affichable de chaque membre, indexé par identifiant (tri par assigné). */
export function memberNameMap(snapshot: BoardSnapshot | undefined, fallback: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const member of snapshot?.members ?? []) {
    const name = member.profile?.name?.trim();
    names.set(member.userId, name !== undefined && name.length > 0 ? name : fallback);
  }
  return names;
}
