/**
 * Logique pure de l'onglet « Structures » du profil : les créneaux (réponses CoForm) des
 * structures que l'utilisateur administre, et ceux qu'il a déposés ailleurs. Le statut d'un créneau
 * vient de `normalizeStatus` (`search/lib/coformAnswer`) — un seul vocabulaire, celui du détail et
 * des cartes.
 */
import getValueByPath from "@/helpers/getValueByPath";
import { isPlainObj } from "@/lib/costumLists";
import { normalizeStatus, type ActivityStatusKey, type CitedStructure } from "@/modules/search/lib/coformAnswer";
import type { Translate } from "@/modules/search/lib/openingHoursDays";
import { DAY_KEYS, type DaySchedule } from "@/modules/search/lib/schedules";
import type { SearchType } from "@/modules/search/schema";

/** Ordre des compteurs de l'en-tête : ce qui attend une action d'abord. */
export const STATUS_DISPLAY_ORDER: readonly ActivityStatusKey[] = ["pending", "inProgress", "validated", "refused"];

/** Nombre de créneaux par statut — tous les statuts présents, à zéro compris. */
export function countByStatus(keys: readonly ActivityStatusKey[]): Record<ActivityStatusKey, number> {
  const counts: Record<ActivityStatusKey, number> = { pending: 0, inProgress: 0, validated: 0, refused: 0 };
  for (const key of keys) counts[key] += 1;
  return counts;
}

/** Résumé des créneaux dans l'en-tête d'une structure. */
export type SlotsSummary =
  | { kind: "none" }
  | { kind: "partial"; count: number }
  | { kind: "counts"; counts: { key: ActivityStatusKey; count: number }[] };

/**
 * Résumé des créneaux CHARGÉS d'une structure. Tant que la liste n'est pas complète (d'autres pages
 * restent à charger), seul le nombre chargé est donné, comme un minimum (« 50+ ») : des compteurs
 * par statut se liraient comme des totaux et seraient faux.
 */
export function summarizeSlots(keys: readonly ActivityStatusKey[], complete: boolean): SlotsSummary {
  if (!complete) return { kind: "partial", count: keys.length };
  if (keys.length === 0) return { kind: "none" };
  const counts = countByStatus(keys);
  return { kind: "counts", counts: STATUS_DISPLAY_ORDER.filter((key) => counts[key] > 0).map((key) => ({ key, count: counts[key] })) };
}

/**
 * Filtres SERVEUR « créneaux de la structure `structureId` » : le formulaire, et le finder qui la
 * cite (`<chemin Mongo du finder>.<id> : { $exists: true }`). `$exists` vaut TOUJOURS `true` :
 * `SearchNew::searchFilters` colle au chemin toute autre valeur. C'est aussi la condition, posée en
 * `$and`, qui permet au hook serveur de montrer les créneaux non validés aux admins de la structure.
 * `finderPath` accepte `answers.<étape>.<clé>` ou `<étape>.<clé>`.
 */
export function structureAnswersFilters(formId: string, finderPath: string, structureId: string): Record<string, unknown> {
  const chemin = finderPath.startsWith("answers.") ? finderPath : `answers.${finderPath}`;
  return { form: formId, [`${chemin}.${structureId}`]: { $exists: true } };
}

/** Une page suffit au cas courant ; le défilement infini prend le relais au-delà. */
const ANSWERS_PAGE = 50;

/**
 * `baseParams` d'une liste de créneaux de l'onglet : les réponses du formulaire, les plus récentes
 * d'abord, toutes provenances — un créneau d'une autre provenance qui cite la structure reste le
 * sien, le formulaire borne déjà la recherche.
 */
export function managedAnswersParams(defaultFilters: Record<string, unknown>, defaultFields?: string[]) {
  return {
    defaultTypes: ["answers"] as SearchType[],
    notSourceKey: true,
    indexStepList: ANSWERS_PAGE,
    defaultSortBy: { created: -1 as const },
    defaultFilters,
    ...(defaultFields ? { defaultFields } : {}),
  };
}

/**
 * Filtres SERVEUR « créneaux DÉPOSÉS par `userId` », sous n'importe quelle structure ou sans. `user`
 * en CHAÎNE : `SearchNew::searchFilters` en fait `{$or: [{user}, {user}]}` dans le `$and`, la forme
 * que le hook SSBE reconnaît pour montrer à l'auteur ses créneaux non validés (`isBoundToOwnAnswers`).
 */
export function submittedAnswersFilters(formId: string, userId: string): Record<string, unknown> {
  return { form: formId, user: userId };
}

/**
 * Champs PROJETÉS en plus pour les créneaux déposés : l'auteur, que juge `canEditCoformAnswer` — le
 * hook ne renvoie sinon que answers/created/source/form. Constante de module : ne pas muter.
 */
export const ANSWER_OWNER_FIELDS: string[] = ["user"];

/**
 * Place d'un créneau DÉPOSÉ dans l'onglet : null s'il est déjà rangé sous une structure listée —
 * une ligne à un seul endroit, exclusion par TOUTES les structures citées (`getAnswerCitedStructures`) ;
 * sinon les noms de ses structures (ceux du finder, à défaut celui de la structure jointe par le
 * serveur) et leur nombre : des structures sans nom restent des structures, pas un « Sans structure ».
 */
export function submittedSlotStructures(
  cited: readonly CitedStructure[],
  joinedName: string | undefined,
  listedIds: ReadonlySet<string>,
): { names: string[]; count: number } | null {
  if (cited.some(({ id }) => listedIds.has(id))) return null;
  const noms = cited.map(({ name }) => name).filter(Boolean);
  return { names: noms.length > 0 ? noms : cited.length > 0 && joinedName ? [joinedName] : [], count: cited.length };
}

/** Statut de modération d'une STRUCTURE qui mérite d'être signalé — une structure validée n'en a pas. */
export type StructureModeration = "pending" | "refused";

/**
 * Statut de modération d'une structure, lu dans `field` (chemin pointé) : une chaîne, ou le premier
 * élément chaîne d'un tableau. « Validé » → null (rien à signaler) ; « Refusé » (et la graphie legacy
 * « Réfusé ») → "refused" ; tout le reste — « En attente », « En cours », absent, inconnu — →
 * "pending" : les pages de LISTE exigent « Validé » strict, une structure sans valeur n'y paraît pas
 * (la palette ⌘K, elle, exclut par `$nin` et la trouve — d'où « n'apparaît pas dans les listes »).
 * Deux états et non quatre : pour qui administre la structure, la conséquence est la même.
 */
export function structureModeration(data: unknown, field: string): StructureModeration | null {
  const valeur = isPlainObj(data) ? getValueByPath(data, field) : undefined;
  const brut = Array.isArray(valeur) ? valeur.find((v) => typeof v === "string") : valeur;
  const statut = normalizeStatus(typeof brut === "string" ? brut : "");
  if (statut === "Valide") return null;
  return statut === "Refuse" ? "refused" : "pending";
}

/** Libellés du résumé des créneaux d'un groupe (en-tête) : « Aucun créneau », « 50+ créneaux » ou les compteurs. */
export function slotsSummaryLabels(summary: SlotsSummary | null, t: Translate): string[] {
  if (!summary) return [];
  if (summary.kind === "none") return [t("StructuresTab.summary.none")];
  if (summary.kind === "partial") return [t("StructuresTab.summary.partial", undefined, { count: summary.count })];
  return summary.counts.map(({ key, count }) => t(`StructuresTab.counts.${key}`, undefined, { count }));
}

/** Jours où le créneau a lieu, lundi → dimanche (7 booléens, l'ordre de `DAY_KEYS`). */
export function weekdayPresence(schedules: readonly DaySchedule[]): boolean[] {
  const jours = new Set(schedules.filter((s) => s.times.length > 0).map((s) => s.dayKey));
  return DAY_KEYS.map((jour) => jours.has(jour));
}

/**
 * Résumé horaire d'une ligne : la première plage, et le nombre d'AUTRES plages distinctes. Une
 * séance tenue à la même heure plusieurs jours compte pour une seule plage — les jours, eux, sont
 * portés par la bande de la semaine.
 */
export function scheduleSummary(schedules: readonly DaySchedule[]): { first: string | null; more: number } {
  const plages = [...new Set(schedules.flatMap((s) => s.times))];
  return { first: plages[0] ?? null, more: Math.max(0, plages.length - 1) };
}

/** Au-delà de ce nombre de structures, seule la première est dépliée à l'ouverture de l'onglet. */
export const OPEN_ALL_UP_TO = 3;

/**
 * Structures dépliées à l'ouverture : toutes jusqu'à `OPEN_ALL_UP_TO` (le cas courant, une à trois
 * structures, tout se voit d'un coup), sinon la première. Chaque structure dépliée charge ses
 * créneaux : ce plafond borne les requêtes lancées d'emblée. Calculé UNE fois, à l'arrivée de la
 * première page (cf. `StructuresTab`) : une page suivante ne replie rien d'elle-même.
 */
export function defaultOpenStructures(ids: readonly string[]): string[] {
  return ids.length <= OPEN_ALL_UP_TO ? [...ids] : ids.slice(0, 1);
}
