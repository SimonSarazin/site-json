import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router';

/**
 * Adresses du module sous le site. Une seule source : les routes (`routes.tsx`), le sélecteur de
 * vues, les liens des cartes et la fermeture de leur fiche doivent tomber sur la même chaîne.
 *
 * Sans icône ni libellé : `routes.tsx`, chargé par tous les sites qui activent le module, en lit
 * les segments. Le registre des vues (`components/actions/actionsViews.ts`) porte le reste.
 */

/** Accueil du module : la liste des kanbans de l'élément porteur (aussi la cible du menu du compte). */
export const KANBAN_HOME_PATH = '/kanban';

/** Tableau des actions de l'élément porteur. */
export const KANBAN_ACTIONS_PATH = `${KANBAN_HOME_PATH}/actions`;

/** Segment de la route fille d'une carte, sous la vue qui l'ouvre. */
export const CARD_ROUTE_SEGMENT = 'carte';

/** Les vues du tableau des actions (reprises de co-kanban, sans la vue Rôles : elle a sa page). */
export type ActionsViewId = 'overview' | 'kanban' | 'milestones' | 'list' | 'table' | 'timeline';

/**
 * Segment de chaque vue sous `/kanban/actions`, les mots de co-kanban : vide pour le Tableau, qui
 * est l'index ; `jalons` est aussi celui de Kanban gestion (`?kanbanview=jalons`).
 */
export const ACTIONS_VIEW_SEGMENTS: Readonly<Record<ActionsViewId, string>> = {
  overview: 'vue-ensemble',
  kanban: '',
  milestones: 'jalons',
  list: 'liste',
  table: 'table',
  timeline: 'chronologie',
};

/** Ordre de co-kanban : la synthèse, puis les lectures du même contenu. */
export const ACTIONS_VIEW_IDS: readonly ActionsViewId[] = ['overview', 'kanban', 'milestones', 'list', 'table', 'timeline'];

/** La vue ouvre-t-elle des cartes ? La vue d'ensemble résume le tableau : elle n'en montre aucune. */
export function viewOpensCards(view: ActionsViewId): boolean {
  return view !== 'overview';
}

/** Adresse d'une vue. Le Tableau est l'index : pas de segment. */
export function actionsViewPath(view: ActionsViewId = 'kanban'): string {
  const segment = ACTIONS_VIEW_SEGMENTS[view];
  return segment === '' ? KANBAN_ACTIONS_PATH : `${KANBAN_ACTIONS_PATH}/${segment}`;
}

/**
 * Fiche d'une carte : une ROUTE fille de la vue qui l'ouvre, pour qu'un lien la rouvre, que
 * « Précédent » la referme et que la fermer ramène à cette vue (la Liste reste la Liste).
 */
export function actionCardPath(cardId: string, view: ActionsViewId = 'kanban'): string {
  return `${actionsViewPath(view)}/${CARD_ROUTE_SEGMENT}/${encodeURIComponent(cardId)}`;
}

export interface ActionsLocation {
  view: ActionsViewId;
  /** Carte ouverte, `null` sans fiche. */
  cardId: string | null;
}

/**
 * Vue et carte désignées par le reste du chemin après `/kanban/actions/`. Lu par la mise en page
 * sur l'adresse plutôt que sur `useParams` : elle est le parent des routes de vue et ne doit pas
 * dépendre de ce qu'il hérite de ses enfants.
 *
 * Un premier segment qui n'est pas une vue retombe sur le Tableau : c'est le cas de
 * `carte/:cardId`, la fiche ouverte depuis le Tableau.
 */
export function parseActionsPath(rest: string | undefined): ActionsLocation {
  const parts = (rest ?? '').split('/').filter((part) => part !== '');
  const view = ACTIONS_VIEW_IDS.find((id) => ACTIONS_VIEW_SEGMENTS[id] !== '' && ACTIONS_VIEW_SEGMENTS[id] === parts[0]) ?? 'kanban';
  const tail = view === 'kanban' ? parts : parts.slice(1);
  if (tail[0] !== CARD_ROUTE_SEGMENT || tail[1] === undefined || !viewOpensCards(view)) return { view, cardId: null };
  try {
    return { view, cardId: decodeURIComponent(tail[1]) };
  } catch {
    // Séquence `%` invalide tapée à la main : la vue s'affiche, sans fiche.
    return { view, cardId: null };
  }
}

/**
 * Routes filles de `/kanban/actions` : une par vue, et la fiche d'une carte sous chaque vue qui en
 * montre (`<vue>/carte/:cardId`). Le MÊME élément sert à la vue et à sa fiche : React réconcilie
 * la vue au lieu de la démonter, et ouvrir ou fermer une fiche change l'adresse sans perdre l'état
 * de la vue (défilement, groupes repliés). Même parti que co-kanban.
 *
 * `elementOf` donne l'élément d'une vue : paresseux dans `routes.tsx`, direct dans les tests, qui
 * montent ainsi exactement les mêmes chemins.
 */
export function actionsChildRoutes(elementOf: (view: ActionsViewId) => ReactNode): RouteObject[] {
  return ACTIONS_VIEW_IDS.flatMap((view): RouteObject[] => {
    const element = elementOf(view);
    const segment = ACTIONS_VIEW_SEGMENTS[view];
    const base: RouteObject = segment === '' ? { index: true, element } : { path: segment, element };
    if (!viewOpensCards(view)) return [base];
    return [base, { path: segment === '' ? `${CARD_ROUTE_SEGMENT}/:cardId` : `${segment}/${CARD_ROUTE_SEGMENT}/:cardId`, element }];
  });
}
