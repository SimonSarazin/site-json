/**
 * Jalons d'un projet Communecter (`projects.oceco.milestones`, §11.6) —
 * logique PURE, testee par `tests/unit/milestones.test.ts`.
 *
 * Deux usages : la boite de gestion des jalons (owner) et le selecteur de jalon
 * de la modale de carte. Ils partagent les memes regles — un jalon ferme ne se
 * propose plus, mais une carte qui y est encore rattachee doit continuer a le
 * montrer, sinon le `<select>` le ferait disparaitre en silence.
 *
 * Comme Kanban gestion, l'interface sait CREER, RENOMMER, CLORE et ROUVRIR un
 * jalon ; elle ne modifie ni ses dates ni sa description apres coup.
 */
import type { CreateMilestoneInput, UpdateMilestoneInput } from '@/modules/kanban/api/milestones';
import { fromDateInputValue, type DateZone } from '@/modules/kanban/lib/dates';
import type { CardMilestone, Milestone } from '@/modules/kanban/types';

/** Bornes alignees sur la validation serveur (`KanbanInput::MAX_TITLE` / `MAX_DESCRIPTION`). */
export const MILESTONE_NAME_MAX = 200;
export const MILESTONE_DESCRIPTION_MAX = 5000;

export interface MilestoneGroups {
  open: Milestone[];
  closed: Milestone[];
}

/** Ouverts / fermes, chacun dans l'ordre du projet (celui de Kanban gestion). */
export function splitMilestones(milestones: readonly Milestone[]): MilestoneGroups {
  return {
    open: milestones.filter((milestone) => milestone.status === 'open'),
    closed: milestones.filter((milestone) => milestone.status === 'close'),
  };
}

/**
 * Jalons proposes par le selecteur d'une carte : les ouverts, PLUS le jalon
 * actuel s'il est ferme. Sans cette exception, ouvrir puis enregistrer la
 * modale d'une carte rattachee a un jalon clos la detacherait sans que
 * personne ne l'ait demande.
 */
export function milestoneChoices(
  milestones: readonly Milestone[],
  currentMilestoneId: string | null,
): Milestone[] {
  return milestones.filter(
    (milestone) => milestone.status === 'open' || milestone.milestoneId === currentMilestoneId,
  );
}

/**
 * Copie denormalisee qu'ecrit le serveur sur l'action (§11.4) — pour l'affichage
 * optimiste d'un changement de jalon.
 *
 * `undefined` en entree = champ non touche ; `null` = detacher. Un identifiant
 * inconnu de la liste renvoie aussi `undefined` : le serveur va refuser (422),
 * inventer un jalon a l'ecran serait pire que de ne rien montrer.
 */
export function milestoneCopy(
  milestones: readonly Milestone[],
  milestoneId: string | null | undefined,
): CardMilestone | null | undefined {
  if (milestoneId === undefined) return undefined;
  if (milestoneId === null) return null;
  const found = milestones.find((milestone) => milestone.milestoneId === milestoneId);
  return found ? { milestoneId: found.milestoneId, name: found.name, status: found.status } : undefined;
}

/**
 * Jalon d'une carte, RAFRAICHI par la liste du projet quand elle le connait.
 *
 * La copie portee par l'action n'est pas reecrite quand on renomme ou clot un
 * jalon (Kanban gestion ne le fait pas non plus) : la liste est plus fraiche,
 * la copie sert de repli pour un jalon disparu.
 */
export function resolveCardMilestone(
  card: { milestone?: CardMilestone | null },
  milestones: readonly Milestone[],
): CardMilestone | null {
  const copy = card.milestone ?? null;
  if (copy === null) return null;
  const fresh = milestones.find((milestone) => milestone.milestoneId === copy.milestoneId);
  return fresh ? { milestoneId: fresh.milestoneId, name: fresh.name, status: fresh.status } : copy;
}

/** Nombre de cartes rattachees a chaque jalon (cle = `milestoneId`). */
export function countCardsByMilestone(
  cards: readonly { milestone?: CardMilestone | null }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards) {
    const id = card.milestone?.milestoneId;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/* -------------------------------------------------------------------------- */
/*  Formulaire de creation / renommage                                        */
/* -------------------------------------------------------------------------- */

export interface MilestoneDraft {
  name: string;
  description: string;
  /** Valeurs BRUTES de `<input type="date">` (« » = aucune date). */
  startDate: string;
  endDate: string;
}

export const EMPTY_MILESTONE_DRAFT: MilestoneDraft = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
};

export type MilestoneField = 'name' | 'description' | 'startDate' | 'endDate';
export type MilestoneErrorCode = 'required' | 'tooLong' | 'invalidDate' | 'dateRange';
export type MilestoneErrors = Partial<Record<MilestoneField, MilestoneErrorCode>>;

/**
 * Ordre VISUEL des champs de creation : `firstInvalidMilestoneField` y prend le
 * premier fautif, et la boite y porte le focus (sinon il reste sur « Créer »).
 */
export const MILESTONE_FIELD_ORDER: readonly MilestoneField[] = [
  'name',
  'startDate',
  'endDate',
  'description',
];

export function firstInvalidMilestoneField(errors: MilestoneErrors): MilestoneField | null {
  return MILESTONE_FIELD_ORDER.find((field) => errors[field] !== undefined) ?? null;
}

/**
 * Les dates d'un jalon se saisissent comme celles d'une action : debut en
 * DEBUT de jour, fin en FIN de jour, dans le fuseau du tableau (`dateZoneFor`).
 * Un jalon qui commence et finit le meme jour reste valide pour le serveur, qui
 * compare des instants (cf. `DayEdge`).
 */
function milestoneDates(draft: MilestoneDraft, zone: DateZone) {
  return {
    start: fromDateInputValue(draft.startDate, zone, 'start'),
    end: fromDateInputValue(draft.endDate, zone, 'end'),
  };
}

/**
 * Regle du NOM d'un jalon, la meme a la creation (`validateMilestoneDraft`) et
 * au renommage (`MilestoneRow`) : deux copies laissaient diverger le plafond.
 */
export function validateMilestoneName(name: string): MilestoneErrorCode | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'required';
  return trimmed.length > MILESTONE_NAME_MAX ? 'tooLong' : undefined;
}

/**
 * Plafond cite par le message `tooLong` de chaque champ texte : le nom et la
 * description n'ont pas la meme borne (une description trop longue annoncait
 * « 200 caracteres », la borne du nom).
 */
export const MILESTONE_FIELD_MAX: Readonly<Partial<Record<MilestoneField, number>>> = {
  name: MILESTONE_NAME_MAX,
  description: MILESTONE_DESCRIPTION_MAX,
};

export function validateMilestoneDraft(draft: MilestoneDraft, zone: DateZone = 'utc'): MilestoneErrors {
  const errors: MilestoneErrors = {};
  const nameError = validateMilestoneName(draft.name);
  if (nameError !== undefined) errors.name = nameError;

  if (draft.description.trim().length > MILESTONE_DESCRIPTION_MAX) errors.description = 'tooLong';

  // Une chaine non vide que le parseur refuse est une date IMPOSSIBLE : la
  // taire l'enverrait comme « pas de date » et effacerait l'echeance.
  const { start, end } = milestoneDates(draft, zone);
  if (draft.startDate !== '' && start === null) errors.startDate = 'invalidDate';
  if (draft.endDate !== '' && end === null) errors.endDate = 'invalidDate';
  if (errors.startDate === undefined && errors.endDate === undefined && start !== null && end !== null && end < start) {
    errors.endDate = 'dateRange';
  }
  return errors;
}

export function hasMilestoneErrors(errors: MilestoneErrors): boolean {
  return MILESTONE_FIELD_ORDER.some((field) => errors[field] !== undefined);
}

/**
 * Corps de `milestone/create` sans le tableau — DERIVE du contrat d'API pour ne
 * pas en devenir une copie qui derive.
 */
export type MilestoneCreatePayload = Omit<CreateMilestoneInput, 'boardId'>;

/** Corps de `milestone/create` : les champs vides ne sont pas envoyes. */
export function milestoneCreatePayload(draft: MilestoneDraft, zone: DateZone = 'utc'): MilestoneCreatePayload {
  const payload: MilestoneCreatePayload = { name: draft.name.trim() };
  const description = draft.description.trim();
  if (description !== '') payload.description = description;
  const { start, end } = milestoneDates(draft, zone);
  if (start !== null) payload.startDate = start;
  if (end !== null) payload.endDate = end;
  return payload;
}

/** Modification d'un jalon (nom, dates, statut clore / rouvrir) — derivee du contrat d'API. */
export type MilestoneChanges = Omit<UpdateMilestoneInput, 'boardId' | 'milestoneId'>;

/**
 * Applique une modification a un jalon, pour l'affichage optimiste.
 *
 * Un champ `undefined` n'est pas touche ; `null` sur une date l'EFFACE — la
 * meme nuance que le corps de `milestone/update`.
 */
export function applyMilestoneChanges(milestone: Milestone, changes: MilestoneChanges): Milestone {
  return {
    ...milestone,
    ...(changes.name !== undefined ? { name: changes.name } : {}),
    ...(changes.description !== undefined ? { description: changes.description } : {}),
    ...(changes.startDate !== undefined ? { startDate: changes.startDate } : {}),
    ...(changes.endDate !== undefined ? { endDate: changes.endDate } : {}),
    ...(changes.status !== undefined ? { status: changes.status } : {}),
  };
}
