/**
 * Logique pure des ecrans « carte » : brouillon de formulaire, validation,
 * diff, echeances, et les quelques helpers d'affichage partages par la modale,
 * le panneau des membres et les pages de liste.
 *
 * Pourquoi un module a part : le formulaire porte les regles de gestion RG-19
 * (on n'assigne qu'un membre du tableau) et RG-30 (une echeance passee n'est
 * « en retard » que si la carte n'est pas close). Elles doivent etre testables
 * sans monter React — d'ou un `.ts` sans JSX, couvert par
 * `cardForm.test.ts`. Repris de co-kanban (`components/board/cardForm.ts`) ;
 * site-json ne porte que des tableaux relies (D11), mais le brouillon garde
 * ses deux sources : le diff et la validation restent ceux, testes, de co-kanban.
 *
 * UN SEUL brouillon pour les deux sources (§11) : le diff et la validation
 * recoivent la source du tableau et ne regardent que les champs qui y ont un
 * sens. Board kanban : etiquettes du tableau, statut, liens. Board-lien :
 * tags libres, date de debut, jalon, montant et temps passe — et ni statut
 * (derive de la colonne) ni liens (§11.4).
 *
 * Deux regles tiennent l'enregistrement d'une carte HERITEE de Kanban gestion
 * (assigne parti, dates inversees, montant hors bornes, sous-tache vide) :
 *  - on ne valide QUE ce qui part (`buildCardPatch`), comme le serveur : un
 *    etat herite qu'on n'a pas touche ne bloque pas un changement de titre ;
 *  - sur un board-lien, les listes partent avec la valeur vue a l'OUVERTURE
 *    (`checklistBase`, `assigneesBase`, `tagsBase`) : le serveur applique la
 *    seule difference a l'etat actuel (`lib/cardMerge`), et une ecriture faite
 *    ailleurs pendant que la fiche est ouverte n'est plus effacee.
 */
import type { UpdateCardInput } from '@/modules/kanban/api/cards';
import { dateZoneFor } from '@/modules/kanban/lib/boardSource';
import { civilDayIndex } from '@/modules/kanban/lib/dates';
import { isValidAmount, isValidMinutes } from '@/modules/kanban/lib/measures';
import { sameStringSet } from '@/modules/kanban/lib/sets';
import { CARD_TAGS_MAX, TAG_MAX_LENGTH, validateTags, type TagErrorCode } from '@/modules/kanban/lib/tags';
import type {
  BoardSource,
  Capabilities,
  Card,
  CardLink,
  CardStatus,
  ChecklistItem,
  Member,
  Priority,
} from '@/modules/kanban/types';

/* ------------------------------------------------------------------ */
/*  Capacites                                                          */
/* ------------------------------------------------------------------ */

/** Les capacites booleennes, `role` et `source` mis a part. */
export type BoardCapability = Exclude<keyof Capabilities, 'role' | 'source'>;

/**
 * Le front ne deduit JAMAIS un droit d'un role : il lit ce que le serveur a
 * calcule. Capacites absentes (chargement en cours) = rien n'est permis.
 */
export function can(
  capabilities: Capabilities | null | undefined,
  capability: BoardCapability,
): boolean {
  return capabilities?.[capability] === true;
}

/* ------------------------------------------------------------------ */
/*  Libelles                                                           */
/* ------------------------------------------------------------------ */

/**
 * Assignes ORPHELINS d'une carte : ceux qui ne sont plus parmi les membres
 * (contributeur parti ou en attente sur un board-lien, retrait que
 * l'instantane ne connait pas encore sur un board kanban), dans l'ordre de la
 * carte. Le selecteur les liste pour qu'on puisse les retirer.
 */
export function orphanAssignees(
  assignees: readonly string[],
  members: readonly Pick<Member, 'userId'>[],
): string[] {
  const memberIds = new Set(members.map((member) => member.userId));
  return assignees.filter((userId) => !memberIds.has(userId));
}

/* ------------------------------------------------------------------ */
/*  Bornes de saisie (alignees sur la validation serveur)              */
/* ------------------------------------------------------------------ */

/** Bornes d'ecriture d'une carte, propres a chaque SOURCE (§11.9). */
export interface CardFieldLimits {
  readonly title: number;
  readonly description: number;
  readonly checklistItems: number;
  readonly checklistLabel: number;
}

/**
 * Board kanban : `KanbanInput::MAX_TITLE` (titre, libelle de checklist),
 * `MAX_DESCRIPTION`, `KanbanCard::MAX_CHECKLIST_ITEMS`.
 */
export const KANBAN_CARD_LIMITS: CardFieldLimits = {
  title: 200,
  description: 5000,
  checklistItems: 50,
  checklistLabel: 200,
};

/**
 * Board-lien : bornes ELARGIES des actions (`ActionCards::MAX_NAME`,
 * `MAX_TASKS`, `MAX_TASK_LABEL`). La base contient des noms de 436 caracteres
 * et une action de 559 sous-taches : avec les bornes kanban, une carte renvoyee
 * telle qu'affichee ne s'enregistrerait pas.
 */
export const ACTION_CARD_LIMITS: CardFieldLimits = {
  title: 500,
  description: 5000,
  checklistItems: 1000,
  checklistLabel: 500,
};

export function cardFieldLimits(source: BoardSource = 'kanban'): CardFieldLimits {
  return source === 'communecter' ? ACTION_CARD_LIMITS : KANBAN_CARD_LIMITS;
}

/* ------------------------------------------------------------------ */
/*  Brouillon de formulaire                                            */
/* ------------------------------------------------------------------ */

export interface CardFormDraft {
  title: string;
  description: string;
  /** `null` = aucune priorite (board-lien seulement). */
  priority: Priority | null;
  dueDate: number | null;
  assignees: string[];
  checklist: ChecklistItem[];
  /* --- board kanban --- */
  labelIds: string[];
  status: CardStatus;
  links: CardLink[];
  /* --- board-lien Communecter (§11.4) --- */
  tags: string[];
  startDate: number | null;
  milestoneId: string | null;
  /** Montant ; `null` = champ vide. */
  credits: number | null;
  /** Minutes entieres ; `null` = champ vide. */
  timeSpent: number | null;
}

/**
 * Charge utile de `card/update` sans ses identifiants : uniquement les champs
 * modifies (et, sur un board-lien, la base des listes modifiees). Derivee du
 * contrat d'API pour ne pas en devenir une copie qui derive.
 */
export type CardUpdatePatch = Omit<UpdateCardInput, 'cardId' | 'boardId'>;

export type CardFormField =
  | 'title'
  | 'description'
  | 'dueDate'
  | 'assignees'
  | 'labelIds'
  | 'checklist'
  | 'tags'
  | 'startDate'
  | 'milestoneId'
  | 'credits'
  | 'timeSpent';

/**
 * Ordre VISUEL des champs de la modale : apres un refus, le focus va au
 * PREMIER champ fautif de l'ecran (`firstInvalidCardField`), sans quoi un clic
 * sur « Enregistrer » dont l'erreur s'affiche hors de la vue semble sans effet.
 */
export const CARD_FORM_FIELD_ORDER: readonly CardFormField[] = [
  'title',
  'description',
  'dueDate',
  'startDate',
  'milestoneId',
  'tags',
  'labelIds',
  'assignees',
  'credits',
  'timeSpent',
  'checklist',
];

export function firstInvalidCardField(errors: CardFormErrors): CardFormField | null {
  return CARD_FORM_FIELD_ORDER.find((field) => errors[field] !== undefined) ?? null;
}

/**
 * Champ de la modale vise par un refus du SERVEUR (`detail.field`), pour
 * afficher le message SOUS ce champ plutot qu'en pied de formulaire. Le serveur
 * nomme l'echeance d'une action `endDate` (son nom en base).
 */
export function cardFieldOfServerField(field: string | null): CardFormField | null {
  if (field === null) return null;
  if (field === 'endDate') return 'dueDate';
  return CARD_FORM_FIELD_ORDER.find((entry) => entry === field) ?? null;
}

/** Codes d'erreur ; ceux des tags reprennent ceux de `lib/tags` prefixes (`tagEmpty`…). */
export type CardFormErrorCode =
  | 'required'
  | 'tooLong'
  | 'tooManyItems'
  | 'notMember'
  | 'unknownLabel'
  | 'emptyItem'
  | 'invalidDate'
  | 'dateRange'
  | 'startAfterDue'
  | 'unknownMilestone'
  | 'invalidAmount'
  | 'invalidDuration'
  | 'tagEmpty'
  | 'tagTooLong'
  | 'tagReserved'
  | 'tagDuplicate'
  | 'tagTooMany';

export type CardFormErrors = Partial<Record<CardFormField, CardFormErrorCode>>;

/**
 * Valeurs d'interpolation du message d'erreur d'un champ (`card.errors.<code>`) :
 * la borne depend du champ ET de la source (un titre d'action va a 500
 * caracteres, celui d'une carte kanban a 200).
 */
export function cardFormErrorValues(
  field: CardFormField,
  code: CardFormErrorCode,
  limits: CardFieldLimits,
): Record<string, number> {
  if (field === 'title') return { max: limits.title };
  if (field === 'description') return { max: limits.description };
  if (field === 'checklist') return { max: code === 'tooManyItems' ? limits.checklistItems : limits.checklistLabel };
  if (field === 'tags') return { max: TAG_MAX_LENGTH, maxTags: CARD_TAGS_MAX };
  return {};
}

export interface CardFormContext {
  /** Identifiants des membres du tableau — RG-19 (contributeurs valides sur un board-lien). */
  memberIds: readonly string[];
  /** Identifiants des etiquettes declarees sur le tableau (board kanban). */
  labelIds: readonly string[];
  /** Absent = `kanban`. */
  source?: BoardSource;
  /** Jalons que la carte peut viser (board-lien) ; absent = pas de controle. */
  milestoneIds?: readonly string[];
}

export function cardDraftFromCard(card: Card): CardFormDraft {
  return {
    title: card.title,
    description: card.description,
    priority: card.priority,
    dueDate: card.dueDate,
    assignees: [...card.assignees],
    checklist: card.checklist.map((item) => ({ ...item })),
    labelIds: [...card.labelIds],
    status: card.status,
    links: card.links.map((link) => ({ ...link })),
    tags: [...(card.tags ?? [])],
    startDate: card.startDate ?? null,
    milestoneId: card.milestone?.milestoneId ?? null,
    credits: card.credits ?? null,
    timeSpent: card.timeSpent ?? null,
  };
}

const TAG_ERROR_CODES: Record<TagErrorCode, CardFormErrorCode> = {
  empty: 'tagEmpty',
  tooLong: 'tagTooLong',
  reserved: 'tagReserved',
  duplicate: 'tagDuplicate',
  tooMany: 'tagTooMany',
};

function isFiniteOrNull(value: number | null | undefined): boolean {
  return value === null || value === undefined || Number.isFinite(value);
}

/**
 * Points de checklist a CONTROLER parmi ceux qui partent. Board kanban : tous —
 * le serveur remplace la liste et jette en silence un point vide. Board-lien :
 * les points neufs ou dont le libelle a change — la fusion du serveur laisse
 * intact un point herite que personne n'a touche, libelle vide compris.
 */
function checklistItemsToCheck(
  initial: readonly ChecklistItem[],
  sent: readonly ChecklistItem[],
  source: BoardSource,
): readonly ChecklistItem[] {
  if (source !== 'communecter') return sent;
  const before = new Map(initial.map((item) => [item.id, item.label]));
  return sent.filter((item) => before.get(item.id) !== item.label);
}

/**
 * Valide, cote client, les champs que l'enregistrement va ENVOYER — et eux
 * seuls (les cles de `buildCardPatch`).
 *
 * Le serveur ne controle que les champs recus : revalider ici tout le
 * brouillon bloquait l'enregistrement d'une action heritee de Kanban gestion
 * pour un champ que personne n'avait touche (467 actions visibles avec un
 * assigne hors contributeurs, 74 aux dates inversees…), parfois sans aucun
 * message — un montant hors bornes est en lecture seule pour un contributeur.
 * Ce controle evite l'aller-retour et place l'erreur SOUS le champ fautif.
 */
export function validateCardForm(
  initial: CardFormDraft,
  draft: CardFormDraft,
  context: CardFormContext,
): CardFormErrors {
  const source = context.source ?? 'kanban';
  const patch = buildCardPatch(initial, draft, source);
  const errors: CardFormErrors = {};
  const limits = cardFieldLimits(source);

  if (patch.title !== undefined) {
    if (patch.title.length === 0) errors.title = 'required';
    else if (patch.title.length > limits.title) errors.title = 'tooLong';
  }
  if (patch.description !== undefined && patch.description.length > limits.description) {
    errors.description = 'tooLong';
  }
  if (!isFiniteOrNull(patch.dueDate)) errors.dueDate = 'invalidDate';

  if (patch.assignees !== undefined) {
    const members = new Set(context.memberIds);
    // Board-lien : seuls les AJOUTS doivent etre des contributeurs valides — un
    // assigne deja present qui a quitte le projet reste admis, comme cote
    // serveur (`SourceRights::assertAssignable`). Board kanban : le serveur
    // controle la liste entiere (`notBoardMembers`).
    const checked =
      source === 'communecter'
        ? patch.assignees.filter((userId) => !initial.assignees.includes(userId))
        : patch.assignees;
    if (checked.some((userId) => !members.has(userId))) errors.assignees = 'notMember';
  }

  if (source === 'communecter') {
    // Les etiquettes d'un board-lien sont ses TAGS : `labelIds` n'est pas
    // edite, il n'y a rien a confronter a `board.labels`. Seuls les tags
    // AJOUTES sont controles : la fusion garde les autres tels qu'en base.
    if (patch.tags !== undefined) {
      const tagError =
        patch.tags.length > CARD_TAGS_MAX
          ? 'tooMany'
          : validateTags(patch.tags.filter((tag) => !initial.tags.includes(tag)));
      if (tagError !== null) errors.tags = TAG_ERROR_CODES[tagError];
    }

    if (!isFiniteOrNull(patch.startDate)) errors.startDate = 'invalidDate';
    // Debut <= echeance sur les valeurs EFFECTIVES (la borne envoyee contre
    // l'autre telle qu'en base), comme le serveur, et A LA JOURNEE dans le
    // fuseau du tableau : une echeance le jour meme du debut est permise. La
    // saisie pose le debut en DEBUT de jour et l'echeance en FIN de jour
    // (`DayEdge`), donc le serveur, qui compare des instants, est d'accord.
    // L'erreur va sur le champ que la personne vient de toucher.
    const datesSent = 'startDate' in patch || 'dueDate' in patch;
    if (datesSent && errors.startDate === undefined && errors.dueDate === undefined) {
      const start = 'startDate' in patch ? (patch.startDate ?? null) : initial.startDate;
      const due = 'dueDate' in patch ? (patch.dueDate ?? null) : initial.dueDate;
      const zone = dateZoneFor(source);
      if (start !== null && due !== null && civilDayIndex(due, zone) < civilDayIndex(start, zone)) {
        if ('dueDate' in patch) errors.dueDate = 'dateRange';
        else errors.startDate = 'startAfterDue';
      }
    }

    if (
      patch.milestoneId !== undefined &&
      patch.milestoneId !== null &&
      context.milestoneIds !== undefined &&
      !context.milestoneIds.includes(patch.milestoneId)
    ) {
      errors.milestoneId = 'unknownMilestone';
    }
    // Montant et temps passe ne s'EFFACENT pas : le serveur refuse `null` (422)
    // plutot que de retirer le champ en silence. Un champ vide ici, c'est un
    // champ que l'on a vide.
    if ('credits' in patch) {
      if (patch.credits === null || patch.credits === undefined) errors.credits = 'required';
      else if (!isValidAmount(patch.credits)) errors.credits = 'invalidAmount';
    }
    if ('timeSpent' in patch) {
      if (patch.timeSpent === null || patch.timeSpent === undefined) errors.timeSpent = 'required';
      else if (!isValidMinutes(patch.timeSpent)) errors.timeSpent = 'invalidDuration';
    }
  } else if (patch.labelIds !== undefined) {
    const labels = new Set(context.labelIds);
    if (patch.labelIds.some((labelId) => !labels.has(labelId))) errors.labelIds = 'unknownLabel';
  }

  if (patch.checklist !== undefined) {
    if (patch.checklist.length > limits.checklistItems) errors.checklist = 'tooManyItems';
    for (const item of checklistItemsToCheck(initial.checklist, patch.checklist, source)) {
      if (errors.checklist !== undefined) break;
      const label = item.label.trim();
      if (label.length === 0) errors.checklist = 'emptyItem';
      else if (label.length > limits.checklistLabel) errors.checklist = 'tooLong';
    }
  }

  return errors;
}

/**
 * Meme checklist ? Les libelles se comparent SANS leurs espaces de bord : un
 * espace ajoute en fin de libelle n'est pas une modification a enregistrer.
 */
function sameChecklist(left: readonly ChecklistItem[], right: readonly ChecklistItem[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    return item.id === other.id && item.label.trim() === other.label.trim() && item.done === other.done;
  });
}

/**
 * Checklist a ENVOYER : un libelle retouche part nettoye de ses espaces de
 * bord ; un libelle que personne n'a touche part TEL QU'AFFICHE. Sur un
 * board-lien, la fusion du serveur compare base et cible champ par champ : un
 * simple « trim » d'un libelle herite y passerait pour une modification et
 * ecraserait un renommage fait entre-temps dans Kanban gestion.
 */
function checklistToSend(initial: readonly ChecklistItem[], draft: readonly ChecklistItem[]): ChecklistItem[] {
  const before = new Map(initial.map((item) => [item.id, item.label]));
  return draft.map((item) => {
    const original = before.get(item.id);
    const label = original !== undefined && original.trim() === item.label.trim() ? original : item.label.trim();
    return { ...item, label };
  });
}

function sameLinks(left: readonly CardLink[], right: readonly CardLink[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((link, index) => {
    const other = right[index];
    return link.id === other.id && link.url === other.url && link.label === other.label;
  });
}

/**
 * Construit le diff du formulaire, pour la SOURCE du tableau.
 *
 * Meme principe que la regle « un seul `element/save` » du SDK : on envoie ce
 * qui a change, pas tout le document — sinon deux personnes qui editent deux
 * champs differents s'ecrasent mutuellement. Un champ sans objet pour la
 * source (un statut sur un board-lien, un tag sur un board kanban) ne part
 * jamais, meme si le brouillon le porte.
 *
 * Board-lien : chaque liste modifiee (checklist, assignes, tags) part avec sa
 * BASE, la valeur vue a l'ouverture, de meme forme — c'est elle qui permet au
 * serveur de n'appliquer que la difference (cf. l'en-tete). Un board kanban
 * garde le remplacement : sa liste n'a pas d'autre ecrivain que co-kanban.
 */
export function buildCardPatch(
  initial: CardFormDraft,
  draft: CardFormDraft,
  source: BoardSource = 'kanban',
): CardUpdatePatch {
  const patch: CardUpdatePatch = {};
  const communecter = source === 'communecter';

  const title = draft.title.trim();
  if (title !== initial.title.trim()) patch.title = title;

  const description = draft.description.trim();
  if (description !== initial.description.trim()) patch.description = description;

  if (draft.priority !== initial.priority) patch.priority = draft.priority;
  if (draft.dueDate !== initial.dueDate) patch.dueDate = draft.dueDate;
  if (!sameStringSet(draft.assignees, initial.assignees)) {
    patch.assignees = [...draft.assignees];
    if (communecter) patch.assigneesBase = [...initial.assignees];
  }
  if (!sameChecklist(draft.checklist, initial.checklist)) {
    patch.checklist = checklistToSend(initial.checklist, draft.checklist);
    if (communecter) patch.checklistBase = initial.checklist.map((item) => ({ ...item }));
  }

  if (communecter) {
    if (!sameStringSet(draft.tags, initial.tags)) {
      patch.tags = [...draft.tags];
      patch.tagsBase = [...initial.tags];
    }
    if (draft.startDate !== initial.startDate) patch.startDate = draft.startDate;
    if (draft.milestoneId !== initial.milestoneId) patch.milestoneId = draft.milestoneId;
    if (draft.credits !== initial.credits) patch.credits = draft.credits;
    if (draft.timeSpent !== initial.timeSpent) patch.timeSpent = draft.timeSpent;
    return patch;
  }

  if (!sameStringSet(draft.labelIds, initial.labelIds)) patch.labelIds = [...draft.labelIds];
  // Le statut choisi dans la modale l'emporte : `card/update` ne le deduit pas.
  if (draft.status !== initial.status) patch.status = draft.status;
  // `links: []` EFFACE cote serveur, `undefined` laisse en place : le tableau
  // ne part que s'il a reellement change.
  if (!sameLinks(draft.links, initial.links)) patch.links = draft.links.map((link) => ({ ...link }));
  return patch;
}

export function isCardFormDirty(
  initial: CardFormDraft,
  draft: CardFormDraft,
  source: BoardSource = 'kanban',
): boolean {
  return Object.keys(buildCardPatch(initial, draft, source)).length > 0;
}

/* ------------------------------------------------------------------ */
/*  Checklist                                                          */
/* ------------------------------------------------------------------ */

export interface Progress {
  done: number;
  total: number;
  percent: number;
}

export function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

export function checklistProgress(items: readonly ChecklistItem[]): Progress {
  const done = items.filter((item) => item.done).length;
  return { done, total: items.length, percent: progressPercent(done, items.length) };
}

/**
 * Identifiant du prochain point de checklist.
 *
 * Deterministe (`ck_<max+1>`) et sans aleatoire : un id tire au hasard cote
 * client differerait entre le rendu serveur et le rendu client, et casserait
 * l'hydratation si la carte est pre-rendue.
 */
export function nextChecklistItemId(items: readonly ChecklistItem[]): string {
  let max = 0;
  for (const item of items) {
    const matched = /^ck_(\d+)$/.exec(item.id);
    if (!matched) continue;
    const value = Number.parseInt(matched[1], 10);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return `ck_${max + 1}`;
}
