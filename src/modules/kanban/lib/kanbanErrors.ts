/**
 * Erreurs de l'API kanban : classe d'echec, codes, raisons fines et messages.
 *
 * Reprise telle quelle de co-kanban (`src/lib/http.ts`), SANS la plomberie `fetch` : dans
 * site-json, la requete part par le SDK (`transport/sdkKanbanClient.ts`), qui traduit ses
 * propres erreurs en `KanbanApiError`. Tout ce qui DECIDE quoi montrer (classe d'echec, cle
 * i18n de la raison, perte d'acces) vit ici, et les hooks comme les ecrans n'en connaissent
 * pas d'autre.
 */

import { isOneOf, isRecord } from '@/modules/kanban/types';

/* -------------------------------------------------------------------------- */
/*  Erreurs                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Classe d'echec — CE QUI S'EST PASSE, pas ce que le backend a nomme.
 *
 * Elle existe parce que le `code` seul ne suffit pas a decider quoi montrer :
 * `invalidResponse` couvre aussi bien une page d'erreur HTML en HTTP 500
 * (le serveur est casse) qu'un corps JSON hors contrat en HTTP 200 (le
 * serveur repond, mal). Ces deux pannes n'appellent ni le meme titre ni la
 * meme sortie, et l'incident du 18/09 l'a prouve : une classe `KanbanComment`
 * absente du classmap composer faisait rendre a Yii une page d'erreur HTML en
 * 500, que l'interface presentait comme « verifiez votre connexion ».
 *
 * Chaque valeur repond a « que peut faire la personne devant l'ecran ? » :
 *  - `network`         : la requete n'a jamais atteint le serveur -> reessayer ;
 *  - `timeout`         : le serveur n'a pas fini a temps -> reessayer ;
 *  - `serverError`     : le serveur a echoue (5xx) -> prevenir un administrateur ;
 *  - `denied`          : session ou droits insuffisants -> se reconnecter / demander l'acces ;
 *  - `rejected`        : refus metier motive (4xx ou `{result:false}`) -> corriger la demande ;
 *  - `invalidResponse` : reponse hors contrat alors que le statut est bon -> signaler ;
 *  - `canceled`        : annulation de l'appelant (navigation, demontage) ;
 *  - `unknown`         : erreur qui ne vient pas du transport (bug local).
 */
export const KANBAN_FAILURE_KINDS = [
  'network',
  'timeout',
  'serverError',
  'denied',
  'rejected',
  'invalidResponse',
  'canceled',
  'unknown',
] as const;

export type KanbanFailureKind = (typeof KANBAN_FAILURE_KINDS)[number];

/**
 * Codes metier qui signifient « pas le droit », quel que soit le statut HTTP.
 *
 * Le legacy Communecter les renvoie en HTTP 200 sous `{result:false,msg}` :
 * sans cette table, un `notMember` serait classe `rejected` et l'ecran
 * proposerait de « corriger la demande » au lieu de demander l'acces.
 */
const DENIED_CODES: ReadonlySet<string> = new Set(['unauthorized', 'forbidden', 'notMember']);

/**
 * Classe un echec a partir du statut HTTP et du code normalise.
 *
 * Fonction PURE et exportee pour etre verrouillee par un test (le seul filet
 * contre la regression de l'incident : HTML en 500 doit sortir `serverError`,
 * jamais `network`). L'ordre des branches est l'ordre de priorite :
 *
 *  1. les codes de transport gagnent — sans reponse, le statut ne veut rien dire ;
 *  2. un 5xx gagne ensuite sur TOUT le reste, y compris sur `invalidResponse` :
 *     une page d'erreur HTML en 500 EST une panne serveur, le fait qu'elle soit
 *     illisible n'est qu'un symptome ;
 *  3. viennent enfin les refus (acces, puis metier).
 */
export function classifyKanbanFailure(status: number, code: string): KanbanFailureKind {
  if (code === 'aborted') return 'canceled';
  if (code === 'network') return 'network';
  if (code === 'timeout') return 'timeout';

  // Page d'erreur HTML d'Apache/Yii comprise : le statut prime sur le corps.
  if (status >= 500) return 'serverError';

  if (status === 401 || status === 403 || DENIED_CODES.has(code)) return 'denied';
  if (code === 'invalidResponse') return 'invalidResponse';

  // 4xx : le serveur a compris et refuse. Le `code` dit pourquoi.
  if (status >= 400) return 'rejected';
  if (status > 0) {
    // Statut de succes avec `{result:false}` : refus metier du legacy — sauf
    // quand le backend s'accuse lui-meme (`msg:'serverError'` en HTTP 200).
    return code === 'serverError' ? 'serverError' : 'rejected';
  }

  // Ni echange, ni code de transport : l'erreur ne vient pas du reseau
  // (bug local remonte dans une query, par exemple).
  return 'unknown';
}

export interface KanbanApiErrorOptions {
  status?: number;
  /** Code normalise du backend (`notMember`, `wipExceeded`…) ou code transport. */
  code?: string;
  detail?: unknown;
  cause?: unknown;
  /** URL reellement appelee — sans elle, aucun diagnostic n'est possible. */
  url?: string;
}

export class KanbanApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: unknown;
  /**
   * Route appelee (constante du registre et chemin), pour le diagnostic.
   *
   * Elle est portee par l'erreur et non reconstruite a l'affichage : l'ecran
   * qui rend l'echec ne connait ni la base d'API ni le chemin de l'appel.
   */
  readonly url: string | undefined;
  /**
   * Classe d'echec, DERIVEE de `status` + `code` (jamais passee a la main).
   *
   * La deriver ici garantit qu'elle reste coherente avec le couple qui
   * l'a produite, y compris pour les erreurs construites ailleurs.
   */
  readonly kind: KanbanFailureKind;
  /**
   * Erreur d'origine (`TypeError` reseau, `AbortError`…).
   *
   * Propriete declaree ici plutot que passee a `super(message, {cause})` : la
   * cible de compilation est ES2020, ou `Error.cause` n'existe pas encore.
   */
  readonly cause: unknown;

  constructor(message: string, options: KanbanApiErrorOptions = {}) {
    super(message);
    this.name = 'KanbanApiError';
    this.cause = options.cause;
    // `status: 0` = la requete n'a jamais atteint le serveur (reseau, delai).
    this.status = options.status ?? 0;
    this.code = options.code ?? 'serverError';
    this.detail = options.detail;
    this.url = options.url;
    this.kind = classifyKanbanFailure(this.status, this.code);
  }
}

/**
 * 401 : la session n'est plus valable.
 *
 * Dans site-json, le SDK a DEJA tente de rafraichir le jeton avant que cette erreur ne
 * remonte (intercepteur 401 de `ApiClient`) : la recevoir veut dire que le rafraichissement a
 * echoue, ou qu'aucun jeton n'etait pose. L'ecran invite a se reconnecter, sans rejouer.
 */
export class KanbanAuthError extends KanbanApiError {
  constructor(message: string, options: KanbanApiErrorOptions = {}) {
    super(message, { ...options, status: options.status ?? 401, code: options.code ?? 'unauthorized' });
    this.name = 'KanbanAuthError';
  }
}

export function isKanbanApiError(value: unknown): value is KanbanApiError {
  return value instanceof KanbanApiError;
}

/**
 * Codes normalises du module (`KanbanResponse::$statuses`, blueprint §3) : la
 * liste FERMEE de ce que `msg` peut valoir dans un refus du serveur. Elle est
 * tenue ici, et non lue du PHP, pour que le front compile sans le depot du
 * module ; `tests/contract/php-fixtures.test.ts` verifie que chaque refus
 * exporte par le harnais PHP porte bien un de ces codes.
 */
export const KANBAN_ERROR_CODES = [
  'badRequest',
  'unauthorized',
  'forbidden',
  'notMember',
  'notFound',
  'conflict',
  'boardArchived',
  'lastOwner',
  'columnNotEmpty',
  'wipExceeded',
  'rankExhausted',
  'validation',
  'visibilityRequiresParent',
  'sourceManaged',
  'unsupportedMediaType',
  'serverError',
] as const;

export type KanbanErrorCode = (typeof KANBAN_ERROR_CODES)[number];

/** Codes poses par le transport lui-meme, quand aucune enveloppe n'est lisible. */
export const KANBAN_TRANSPORT_CODES = ['network', 'timeout', 'invalidResponse'] as const;

type KanbanTransportCode = (typeof KANBAN_TRANSPORT_CODES)[number];

/**
 * Messages de repli, en francais, pour les codes normalises du contrat (§3).
 *
 * Ils servent de `defaultValue` a i18next : l'interface reste comprehensible
 * avant que les cles `errors.*` soient traduites, et le jour ou elles le sont
 * c'est la traduction qui gagne. `satisfies` impose un message par code : un
 * code ajoute au module sans message ici ne compile pas.
 */
export const KANBAN_ERROR_MESSAGES_FR: Record<string, string> = {
  badRequest: 'Requete invalide.',
  unauthorized: 'Session expiree, reconnectez-vous.',
  forbidden: "Vous n'avez pas les droits pour cette action.",
  notFound: 'Element introuvable.',
  conflict: 'Cette action entre en conflit avec un changement recent.',
  validation: 'Certaines informations saisies sont invalides.',
  boardArchived: 'Ce tableau est archive : il est en lecture seule.',
  lastOwner: 'Il doit rester au moins un proprietaire sur le tableau.',
  columnNotEmpty: "Cette colonne contient des cartes : choisissez ou les deplacer.",
  notMember: "Vous n'etes pas membre de ce tableau.",
  wipExceeded: 'La limite de cartes en cours est depassee.',
  // Rangs fractionnaires epuises entre deux voisins malgre la renumerotation.
  rankExhausted: "Impossible de placer la carte a cet endroit. Rechargez le tableau.",
  visibilityRequiresParent: 'La visibilite communautaire demande un collectif parent.',
  // §11.6 : un board-lien ne se configure pas ici — colonnes, membres et
  // reglages vivent sur le projet Communecter.
  sourceManaged: 'Ce reglage se gere sur Communecter.',
  // 415 : corps hors `application/json`. Le transport envoie toujours du JSON :
  // ce refus trahirait un proxy qui reecrit la requete.
  unsupportedMediaType: 'Requete refusee par le serveur (format inattendu).',
  serverError: 'Le serveur a rencontre une erreur.',
  network: 'Serveur injoignable. Verifiez votre connexion.',
  timeout: 'Le serveur met trop de temps a repondre.',
  invalidResponse: 'Reponse inattendue du serveur.',
} satisfies Record<KanbanErrorCode | KanbanTransportCode, string>;

export function kanbanErrorCode(error: unknown): string {
  return isKanbanApiError(error) ? error.code : 'serverError';
}

/**
 * Raisons FINES d'un refus que l'interface sait traduire (`detail.reason`).
 *
 * Le code normalise reste volontairement grossier — un 409 `conflict` couvre
 * aussi bien une ecriture concurrente sur une action (`concurrentUpdate`) qu'un
 * jalon demande sur un board kanban (`notSourceBoard`) : la reponse HTTP est la
 * meme, le geste a proposer ne l'est pas. Liste FERMEE : une raison inconnue
 * retombe sur le message du code, jamais sur une cle absente du catalogue.
 */
export const KANBAN_ERROR_REASONS = [
  'concurrentUpdate',
  // Bornes min / max de participants d'une action (`set_contributors` de
  // Kanban gestion), appliquees au resultat de la fusion des assignes.
  'contributorsLimit',
  'notSourceBoard',
  'ownerFieldNotAllowed',
  'notCommentAuthor',
  // Les trois refus d'un lecteur seul (viewer) sur un board kanban : carte qui
  // ne lui est pas assignee, champ autre que la checklist, deplacement hors de
  // la colonne de fin.
  'viewerNotAssignee',
  'viewerFieldNotAllowed',
  'viewerMoveNotAllowed',
  'archived',
  'sourceMissing',
  // Assignes refuses : contributeurs du projet ou membres de l'organisation
  // (board-lien, selon `parentType`), membres du tableau (board kanban) — la
  // meme regle, une raison par source et par type d'element (§12, D26).
  'notProjectContributors',
  'notOrganizationMembers',
  'notBoardMembers',
  // Reference disparue entre l'ouverture de la fiche et l'enregistrement.
  'unknownMilestone',
  'unknownLabels',
  'alreadyMember',
  'lastColumn',
  'inheritedMembership',
  'notAttached',
  // §12 : jalons demandes sur le board-lien d'une ORGANISATION, qui n'en a pas
  // (D22) ; roles d'un element Communecter (D29) — libelle refuse, ecriture
  // reservee a l'administrateur, membre qui n'est plus lie a l'element.
  'milestonesUnavailable',
  'invalidRole',
  'roleManagementNotAllowed',
  'notLinked',
  // §12 E42 : deux 500 `serverError` propres aux roles — `role/delete` arrete
  // par un porteur delie en cours de route (`{role, memberId, removedFrom,
  // cause}` : les porteurs deja traites le restent), et une liste qui n'a pu
  // s'ecrire sur la fiche du membre (`{memberId, memberType}`). Dans les deux
  // cas la liste est relue au reglement ; le message doit le dire, pas « le
  // serveur n'a pas repondu correctement ». `concurrentUpdate` existe aussi sur
  // `role/assign|unassign` (`{boardId, memberId, memberType}`, trois essais de
  // compare-and-set perdus) : meme raison, texte decline (`kanbanErrorTranslation`).
  'roleWriteFailed',
  'memberWriteFailed',
  // §12.8 D35 b : `source/children` (projets d'une organisation depuis son
  // tableau) — reservee a l'administrateur de l'organisation (403 `forbidden`
  // `{boardId, reason}`), et sans objet sur le lien d'un projet (422
  // `validation` `{field:"boardId", reason}`).
  'ownerOnly',
  'notOrganization',
] as const;

export type KanbanErrorReason = (typeof KANBAN_ERROR_REASONS)[number];

const isKanbanErrorReason = isOneOf(KANBAN_ERROR_REASONS);

/** Raison fine connue d'un refus du module, ou `null`. */
export function kanbanErrorReason(error: unknown): KanbanErrorReason | null {
  if (!isKanbanApiError(error) || !isRecord(error.detail)) return null;
  const reason = error.detail.reason;
  return isKanbanErrorReason(reason) ? reason : null;
}

/**
 * Cle i18n du message d'un echec : `errors.reasons.<raison>` quand le serveur
 * a precise une raison connue, sinon `errors.<code>`. A passer a `t()` avec
 * `kanbanErrorMessage(error)` en `defaultValue`, pour les codes que le
 * catalogue ne connait pas encore.
 */
export function kanbanErrorI18nKey(error: unknown): string {
  const reason = kanbanErrorReason(error);
  return reason === null ? `errors.${kanbanErrorCode(error)}` : `errors.reasons.${reason}`;
}

/** Traducteur minimal : la cle et ses valeurs (signature compatible avec `t` d'i18next). */
export type KanbanTranslate = (key: string, options: Record<string, string | number>) => string;

export interface KanbanErrorTranslation {
  key: string;
  /** Valeurs d'interpolation ; `count` pilote aussi le pluriel d'i18next. */
  values: Record<string, number>;
}

function readCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Cle i18n ET valeurs du message d'un echec — la regle de `kanbanErrorI18nKey`,
 * plus les raisons dont le message cite des nombres (`contributorsLimit`,
 * `roleWriteFailed`).
 *
 * `contributorsLimit` (`detail: {min, max, count}`, une borne nulle quand elle
 * n'existe pas) dit QUELLE borne est franchie et laquelle respecter : « au plus
 * 2 participants » se corrige, « nombre de participants invalide » non.
 */
export function kanbanErrorTranslation(error: unknown): KanbanErrorTranslation {
  if (kanbanErrorReason(error) === 'concurrentUpdate' && isKanbanApiError(error) && isRecord(error.detail) && typeof error.detail.memberId === 'string') {
    // `role/assign` / `role/unassign` (§12, E49) : le detail nomme un MEMBRE
    // (`{boardId, memberId, memberType}`), pas une carte — le message de la
    // raison, ecrit pour `card/update`, dirait « cette carte ».
    return { key: 'errors.reasons.concurrentUpdateRole', values: {} };
  }
  if (kanbanErrorReason(error) === 'roleWriteFailed' && isKanbanApiError(error) && isRecord(error.detail)) {
    // `removedFrom` : a combien de porteurs le role a deja ete retire quand la
    // suppression s'est arretee (E42) — le pluriel suit ce nombre.
    const removed = readCount(error.detail.removedFrom);
    if (removed !== null && removed >= 0) return { key: 'errors.reasons.roleWriteFailedCount', values: { count: removed } };
  }
  if (kanbanErrorReason(error) === 'contributorsLimit' && isKanbanApiError(error) && isRecord(error.detail)) {
    const requested = readCount(error.detail.count);
    const min = readCount(error.detail.min);
    const max = readCount(error.detail.max);
    if (requested !== null && max !== null && max >= 1 && requested > max) {
      return { key: 'errors.reasons.contributorsLimitMax', values: { count: max, requested } };
    }
    if (requested !== null && min !== null && min >= 1 && requested < min) {
      return { key: 'errors.reasons.contributorsLimitMin', values: { count: min, requested } };
    }
  }
  return { key: kanbanErrorI18nKey(error), values: {} };
}

/**
 * Message TRADUIT d'un echec, pret a afficher : un seul appel pour tous les
 * ecrans (toasts des mutations, bandeaux des boites), au lieu de recopier
 * partout `t(kanbanErrorI18nKey(x), { defaultValue: kanbanErrorMessage(x) })`.
 * Le message de repli francais du transport sert aux codes que le catalogue ne
 * connait pas encore.
 */
export function kanbanErrorText(t: KanbanTranslate, error: unknown): string {
  const { key, values } = kanbanErrorTranslation(error);
  return t(key, { ...values, defaultValue: kanbanErrorMessage(error) });
}

/**
 * Champ vise par un refus de validation (`detail.field`), ou `null` : il permet
 * d'afficher le message SOUS le champ concerne plutot qu'en pied de formulaire.
 */
export function kanbanErrorField(error: unknown): string | null {
  if (!isKanbanApiError(error) || !isRecord(error.detail)) return null;
  return typeof error.detail.field === 'string' ? error.detail.field : null;
}

/**
 * Classe d'echec de n'importe quelle valeur levee.
 *
 * Une erreur qui ne vient pas du transport (bug local remonte par une query)
 * est `unknown` et NON `serverError` : lui coller le serveur sur le dos serait
 * exactement la faute que ce chantier corrige. `kanbanErrorCode` garde, lui,
 * son repli historique en `serverError` — les appelants existants en dependent.
 */
export function kanbanFailureKind(error: unknown): KanbanFailureKind {
  return isKanbanApiError(error) ? error.kind : 'unknown';
}

/**
 * L'appelant a-t-il PERDU l'acces a la ressource ? Refus d'acces (403
 * `notMember`, `forbidden`) ou ressource disparue (404 `notFound`) — mais pas
 * une session expiree (401), qui appelle une reconnexion (cf. `kanbanAccessState`).
 *
 * Sert au polling d'un tableau : ces echecs-la ne se resolvent pas en
 * reessayant. Sur un board-lien, les droits changent dans Communecter, hors du
 * journal : un contributeur retire, ou un lien supprime par l'owner, gardait un
 * tableau fige sans le savoir.
 */
export function isAccessLostFailure(error: unknown): boolean {
  if (!isKanbanApiError(error) || error.status === 401) return false;
  return error.kind === 'denied' || error.code === 'notFound';
}

/** Message affichable a l'utilisateur pour n'importe quelle erreur d'appel. */
export function kanbanErrorMessage(error: unknown): string {
  const code = kanbanErrorCode(error);
  const known = KANBAN_ERROR_MESSAGES_FR[code];
  if (known) return known;
  // Code inconnu (backend plus recent que le front) : on montre le message brut
  // plutot qu'un texte generique qui empecherait tout diagnostic.
  return error instanceof Error && error.message ? error.message : KANBAN_ERROR_MESSAGES_FR.serverError;
}


/** Échecs passagers : les seuls qu'une nouvelle tentative peut réparer. */
const TRANSIENT_FAILURES: ReadonlySet<KanbanFailureKind> = new Set(['network', 'timeout', 'serverError']);

/**
 * `retry` des requêtes du module : UNE nouvelle tentative, et seulement sur un échec passager.
 *
 * co-kanban réglait `retry: 1` pour toute l'application ; site-json garde le défaut de TanStack
 * (trois tentatives, toutes erreurs). Un refus (403 `notMember`, 404) ne se répare pas en
 * réessayant : avec trois tentatives espacées, l'écran attendait 7 s avant de dire « réservé aux
 * membres ». Pure et testée.
 */
export function shouldRetryKanbanQuery(failureCount: number, error: Error): boolean {
  return failureCount < 1 && TRANSIENT_FAILURES.has(kanbanFailureKind(error));
}
