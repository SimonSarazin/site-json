/**
 * Ligne meta d'une carte et pied de colonne — logique PURE (DESIGN §6.3, §6.4).
 *
 * La fiche affiche des donnees derivees (echeance courte, premier assigne,
 * total des montants d'une colonne). Les calculer ici plutot que dans le JSX
 * les rend testables (`tests/unit/cardMeta.test.ts`) et garantit que la carte
 * posee dans la pile et l'apercu souleve par le glisser disent la meme chose.
 */
import { isCardOverdue } from '@/modules/kanban/lib/boardStats';
import { formatDate, formatDayMonth, sameCivilYear, type DateLocale, type DateZone } from '@/modules/kanban/lib/dates';
import type { Card } from '@/modules/kanban/types';

/**
 * « En retard » d'une carte du tableau — la MEME regle que le filtre
 * « Échéance », les vues Liste, Table et Chronologie et la vue d'ensemble :
 *  - jour civil du moteur (`isOverdue`, RG-25) et non la seconde : une carte
 *    due aujourd'hui n'est pas en retard a 10 h, sinon elle s'afficherait « En
 *    retard » tout en etant comptee dans « Aujourd'hui » par le filtre ;
 *  - une carte CLOSE ne l'est jamais (`isCardDone` : `completedAt` OU statut
 *    termine — une action Communecter close avant l'historique n'a pas de date
 *    de cloture, E11) ;
 *  - horloge inconnue (`now === 0`, rendu serveur et premier rendu client) :
 *    rien n'est en retard, le HTML ne change pas a l'hydratation.
 *
 * Delegue a `isCardOverdue` (`lib/boardStats`), la regle unique, et n'y ajoute
 * que la garde d'horloge propre au rendu.
 *
 * @param zone fuseau du jour civil du tableau (`dateZoneFor` de sa source).
 */
export function isCardOverdueAt(
  card: Pick<Card, 'dueDate' | 'completedAt' | 'status'>,
  now: number,
  zone: DateZone = 'utc',
): boolean {
  return now > 0 && isCardOverdue(card, now, zone);
}

/**
 * Echeance courte de la carte : « 22 oct. » dans l'annee en cours, « 22 oct.
 * 2027 » sinon — la maquette omet l'annee, mais une echeance d'une autre annee
 * qui la perdrait mentirait.
 *
 * `now === 0` = horloge inconnue (rendu serveur, premier rendu client) : on
 * ecrit alors l'annee, la seule forme qui ne change pas a l'hydratation.
 *
 * @param zone fuseau du jour civil du tableau (`dateZoneFor` de sa source).
 */
export function shortDueLabel(dueDate: number, locale: DateLocale, now: number, zone: DateZone = 'utc'): string {
  if (now > 0 && sameCivilYear(dueDate, now, zone)) return formatDayMonth(dueDate, locale, zone);
  return formatDate(dueDate, locale, zone);
}

/**
 * Total des montants d'une colonne d'un board-lien, sur les cartes AFFICHEES
 * (le compteur de la colonne compte les memes : un total qui ignorerait le
 * filtre ne correspondrait a rien de visible).
 *
 * Chaque carte compte pour le montant qu'elle AFFICHE (`displayedCredits`) :
 * le `1` par defaut du serveur vaut 0, comme dans les totaux de Kanban gestion
 * (`creditDisplayVal`). Sinon quatre cartes sans montant saisi totalisaient
 * « 4 » — un nombre qui ne correspond a aucun montant visible et qui differe
 * de celui de gestion pour le meme projet. Toujours un nombre : gestion
 * affiche aussi « 0 » sur une colonne sans montant.
 */
export function creditsTotal(cards: readonly Pick<Card, 'credits'>[]): number {
  let total = 0;
  for (const card of cards) total += displayedCredits(card) ?? 0;
  // Arrondi au centime : 0.1 + 0.2 ne doit pas s'afficher 0,30000000000000004.
  return Math.round(total * 100) / 100;
}

/** Forme minimale d'un membre indexe (cf. `indexMembers`). */
export interface MetaMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
}

export interface AssigneeSummary {
  /** Premier assigne CONNU, celui dont le nom s'ecrit sur la carte. */
  lead: MetaMember;
  /** Assignes connus au-dela du premier (« +2 »). */
  others: number;
}

/**
 * Assigne mis en avant sur la carte : la maquette ecrit UN nom et un portrait.
 * Les identifiants inconnus de l'index (compte retire) sont ignores plutot que
 * d'afficher un identifiant brut ; `null` si personne de connu.
 */
export function assigneeSummary(
  assignees: readonly string[],
  memberIndex: ReadonlyMap<string, MetaMember>,
): AssigneeSummary | null {
  const known = assignees
    .map((userId) => memberIndex.get(userId))
    .filter((member): member is MetaMember => member !== undefined);
  if (known.length === 0) return null;
  return { lead: known[0], others: known.length - 1 };
}

/** Commentaires non lus d'une carte : absent (board kanban) = 0, jamais negatif. */
export function unseenComments(card: Pick<Card, 'unseenComments'>): number {
  const value = card.unseenComments;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * Montant a afficher sur la carte. Le serveur Communecter pose `1` par defaut
 * sur toute action : l'afficher sur chaque carte serait du bruit, il ne
 * s'ecrit donc qu'au-dela du defaut (un montant reellement saisi).
 */
export const DEFAULT_CREDITS = 1;

export function displayedCredits(card: Pick<Card, 'credits'>): number | null {
  const value = card.credits;
  if (typeof value !== 'number' || !Number.isFinite(value) || value === DEFAULT_CREDITS) return null;
  return value;
}

/** Temps passe a afficher : seulement s'il y en a (le defaut serveur est 0). */
export function displayedTimeSpent(card: Pick<Card, 'timeSpent'>): number | null {
  const value = card.timeSpent;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
