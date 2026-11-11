/**
 * Les vues du tableau des actions, et ce que la barre d'outils peut y faire. Repris de co-kanban
 * (`components/layout/boardViews.ts`), réduit à un tableau relié : la vue Rôles a sa propre page
 * (`/kanban/roles`), et il n'y a qu'une source.
 *
 * Module PUR (aucune dépendance à React ni au routeur) : le sélecteur de vues, le menu « ⋯ »,
 * « Grouper / Trier » et la barre de filtres lisent la même table, et quatre copies divergeraient
 * au premier ajout de vue. Les segments d'adresse vivent dans `lib/kanbanPaths` (lus par les
 * routes, sans icône).
 *
 * Une commande sans effet sur une vue qui en accepte d'autres reste VISIBLE, DÉSACTIVÉE avec la
 * raison : un bouton qui disparaît d'une vue voisine fait douter de son existence.
 */
import { Flag, GanttChart, LayoutDashboard, LayoutGrid, List, Table2, type LucideIcon } from 'lucide-react';
import type { ActionsViewId } from '@/modules/kanban/lib/kanbanPaths';
import type { ParentType } from '@/modules/kanban/types';

/** Commandes de la barre d'outils : filtrer, puis grouper et trier. */
export type BoardControlId = 'filter' | 'group' | 'sort';

export interface ActionsViewDescriptor {
  id: ActionsViewId;
  labelKey: string;
  icon: LucideIcon;
  /** Une entrée = commande inapplicable ici ; la valeur est la clé i18n de la raison. */
  unavailable: Partial<Record<BoardControlId, string>>;
  /** Types d'élément où la vue existe ; absent = tous. */
  parentTypes?: readonly ParentType[];
  /** La vue applique-t-elle le masquage local des colonnes ? Le Tableau seulement. */
  hidesColumns?: boolean;
}

/** Ordre de co-kanban : la synthèse, puis les lectures du même contenu, de la plus visuelle à la plus temporelle. */
export const ACTIONS_VIEWS: readonly ActionsViewDescriptor[] = [
  {
    id: 'overview',
    labelKey: 'boardViews.overview',
    icon: LayoutDashboard,
    unavailable: {
      // La synthèse porte sur le tableau ENTIER : la filtrer donnerait un avancement qui ne
      // correspond à aucune réalité mesurable.
      filter: 'boardViews.unavailable.overviewFilter',
      group: 'boardViews.unavailable.overviewGroup',
      sort: 'boardViews.unavailable.overviewSort',
    },
  },
  {
    id: 'kanban',
    labelKey: 'boardViews.kanban',
    icon: LayoutGrid,
    hidesColumns: true,
    unavailable: { group: 'boardViews.unavailable.kanbanGroup', sort: 'boardViews.unavailable.kanbanSort' },
  },
  {
    id: 'milestones',
    labelKey: 'boardViews.milestones',
    icon: Flag,
    // Une organisation n'a pas de jalons : la vue disparaît de son menu.
    parentTypes: ['projects'],
    unavailable: { group: 'boardViews.unavailable.milestonesGroup', sort: 'boardViews.unavailable.milestonesSort' },
  },
  { id: 'list', labelKey: 'boardViews.list', icon: List, unavailable: {} },
  { id: 'table', labelKey: 'boardViews.table', icon: Table2, unavailable: { group: 'boardViews.unavailable.tableGroup' } },
  {
    id: 'timeline',
    labelKey: 'boardViews.timeline',
    icon: GanttChart,
    unavailable: { group: 'boardViews.unavailable.timelineGroup', sort: 'boardViews.unavailable.timelineSort' },
  },
];

export function actionsViewById(id: ActionsViewId): ActionsViewDescriptor {
  // `ACTIONS_VIEWS` couvre tout le type : l'absence est impossible, mais un repli explicite vaut
  // mieux qu'un `!` qui mentirait au typage.
  return ACTIONS_VIEWS.find((view) => view.id === id) ?? ACTIONS_VIEWS[1];
}

/** Les deux vues du sélecteur de la maquette de co-kanban : « Tableau » et « Liste ». */
export const SEGMENT_VIEW_IDS: readonly ActionsViewId[] = ['kanban', 'list'];

/**
 * Vues du sélecteur : les deux de la maquette, PLUS la vue courante quand elle n'en fait pas
 * partie. Arriver sur « Table » par le menu sans que rien ne l'indique laisserait le sélecteur
 * sans sélection : on ne saurait plus où l'on est.
 */
export function segmentViews(currentId: ActionsViewId): ActionsViewDescriptor[] {
  const ids = SEGMENT_VIEW_IDS.includes(currentId) ? SEGMENT_VIEW_IDS : [...SEGMENT_VIEW_IDS, currentId];
  return ids.map(actionsViewById);
}

/**
 * La vue existe-t-elle pour ce type d'élément ? Type INCONNU (tableau pas encore chargé) : seules
 * les vues communes, pour ne jamais offrir une vue qui dirait aussitôt « indisponible ici ». Un
 * tableau relié sans `parentType` sur le fil est un projet (liens antérieurs aux organisations).
 */
export function isViewAvailable(view: ActionsViewDescriptor, parentType: ParentType | null | undefined): boolean {
  if (view.parentTypes === undefined) return true;
  if (parentType === undefined) return false;
  return view.parentTypes.includes(parentType ?? 'projects');
}

/** Vues du menu « ⋯ » : celles que le sélecteur ne montre pas, et qui existent ici. */
export function menuViews(parentType: ParentType | null | undefined): ActionsViewDescriptor[] {
  return ACTIONS_VIEWS.filter((view) => !SEGMENT_VIEW_IDS.includes(view.id) && isViewAvailable(view, parentType));
}
