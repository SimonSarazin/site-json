/**
 * Query keys du module coform — centralisées (single source of truth).
 *
 * Convention : préfixe figé `"coform"`, méthodes en `SCREAMING_SNAKE_CASE`,
 * chaque producteur a sa clé complète + une variante `_PREFIX` minimaliste
 * pour invalidation cross-contexte.
 *
 * Params tolèrent `null` pour permettre les hooks `enabled: false` (RQ exige
 * une clé même quand la query n'est pas activée).
 */
export const COFORM_QUERY_KEYS = {
  /**
   * Définition d'un formulaire (form schema, fields, config).
   *
   * Producteur : `useCoFormQuery` (hook principal de lecture form)
   * Consommateurs invalidants : `useCoFormFinalMutation` (après save answer,
   *   le backend peut enrichir le form ; voir `actions/mutations/file.ts`)
   */
  FORM: (formId: string | null) => ["coform", "form", formId] as const,
  /** Invalide la définition d'un form donné (ou tous les forms si `formId` omis). */
  FORM_PREFIX: (formId: string | null = null) =>
    formId === null
      ? (["coform", "form"] as const)
      : (["coform", "form", formId] as const),

  /**
   * Liste des réponses d'un formulaire (toutes les answers pour un form donné).
   *
   * Producteur : `useCoFormQuery` (mode liste), `prefetch/index.ts`
   * Consommateurs invalidants : `useCoFormFinalMutation` (save/update),
   *   `createCoFormMutation` (factory utilisée par `useDeleteAnswer`, etc.)
   */
  FORM_ANSWERS: (formId: string | null) => ["coform", "answers", formId] as const,
  /** Invalide toutes les answers d'un form donné (ou tous les forms si omis). */
  FORM_ANSWERS_PREFIX: (formId: string | null = null) =>
    formId === null
      ? (["coform", "answers"] as const)
      : (["coform", "answers", formId] as const),

  /**
   * Réponse unique (answer.data complet pour un answer donné).
   *
   * Producteur : `useCoFormQuery` (mode answer)
   * Consommateurs invalidants : `useCoFormFinalMutation` (après save)
   *
   * `userId` est inclus pour éviter une fuite de cache cross-user : sans cette
   * dimension, user A submit un answer, puis user B se logger dans la même
   * session (sans full reload) → B verrait l'answer de A en cache. Le même
   * pattern est appliqué à `CAGNOTTE_QUERY_KEYS.FUNDING_ENVELOPE`.
   *
   * Les hooks doivent passer `me?.id ?? null` (récupéré via `useCocolight()`).
   */
  FORM_ANSWER: (
    formId: string | null,
    answerId: string | null,
    userId: string | null = null,
  ) => ["coform", "answer", formId, answerId, userId] as const,
  /** Invalide une answer précise ou toutes les answers d'un form (si `answerId` omis). */
  FORM_ANSWER_PREFIX: (formId: string | null, answerId: string | null = null) =>
    answerId === null
      ? (["coform", "answer", formId] as const)
      : (["coform", "answer", formId, answerId] as const),

  /**
   * Fichiers attachés à un answer (liste des docs uploadés pour une question
   * de type "uploader").
   *
   * Producteur : `useCoFormAnswerFiles`
   * Consommateurs invalidants : `UploaderField` (après delete) — invalidation
   *   manuelle via `queryClient.invalidateQueries`
   *
   * `userId` inclus pour la même raison que `FORM_ANSWER` (fuite de cache
   * cross-user).
   */
  ANSWER_FILES: (
    answerId: string | null,
    subKey: string | null,
    userId: string | null = null,
  ) => ["coform", "answerFiles", answerId, subKey, userId] as const,
  ANSWER_FILES_PREFIX: (answerId: string | null) =>
    ["coform", "answerFiles", answerId] as const,

  /**
   * Catalogues collaboratifs (lecture seule) des inputs `commonTable` d'un
   * formulaire — fetch batch agrégeant criterias + comptages cross-réponses.
   *
   * Producteur : `useCoFormCatalogs` (appelé par `SmartCoForm`)
   * Consommateurs invalidants : `useCoFormFinalMutation` (la save peut créer
   *   de nouveaux usages via `addUsageToCatalog`) — invalidation via le PREFIX.
   *
   * `inputKeys` est inclus dans la clé pour qu'un changement de form (avec un
   * autre set d'inputs commonTable) ne ré-utilise pas un cache obsolète. Le
   * tableau est trié pour stabilité de la clé.
   */
  COMMONTABLE_CATALOG: (formId: string | null, inputKeys: readonly string[]) =>
    ["coform", "commonTableCatalog", formId, [...inputKeys].sort()] as const,
  /** Invalide tous les catalogues d'un form donné (ou tous les forms si omis). */
  COMMONTABLE_CATALOG_PREFIX: (formId: string | null = null) =>
    formId === null
      ? (["coform", "commonTableCatalog"] as const)
      : (["coform", "commonTableCatalog", formId] as const),

  /**
   * Arbre d'options d'un `categorizedCheckbox` alimenté par des questions commonTable DISTANTES.
   *
   * Producteur : `useCategorizedCheckboxOptions`
   * Consommateurs invalidants : aucun à ce jour — les options sont la DÉFINITION des formulaires
   *   sources (structure + criterias de leurs répondants), qu'aucune mutation de ce module ne
   *   touche. Une réponse enregistrée ici ne modifie pas l'arbre. `staleTime` 5 min + le
   *   `*_PREFIX` suffisent ; si un jour l'input permet d'ajouter un usage à la source, c'est cette
   *   mutation-là qui devra invalider le préfixe.
   *
   * PAS de dimension `userId` : la donnée est publique (les deux endpoints sont `auth: none`), la
   * scoper casserait la mutualisation du cache entre visiteurs sans rien protéger.
   *
   * La clé porte les chemins de questions et NON le form courant : l'arbre ne dépend que des
   * formulaires SOURCES. Deux inputs (voire deux formulaires) branchés sur la même source
   * partagent donc légitimement le cache. L'ordre des chemins est signifiant — il détermine
   * l'index des clés persistées — donc il n'est PAS trié ici, contrairement au catalogue.
   */
  CATEGORIZED_OPTIONS: (questionPaths: readonly string[]) =>
    ["coform", "categorizedOptions", [...questionPaths]] as const,
  /** Invalide tous les arbres d'options categorizedCheckbox. */
  CATEGORIZED_OPTIONS_PREFIX: () => ["coform", "categorizedOptions"] as const,

  /**
   * Liste des contributeurs (users + leur happiness/note/comment) pour une
   * ligne d'un commonTable — fetch lazy au clic du compteur dans la colonne
   * solution.
   *
   * Producteur : `useCommonTableContributors`
   * `criteriaIds` est trié pour stabilité ; une ligne peut agréger plusieurs
   *   criteriaId (voir groupKeyResolver côté React).
   */
  COMMONTABLE_CONTRIBUTORS: (
    formId: string | null,
    inputKey: string | null,
    criteriaIds: readonly string[],
  ) =>
    [
      "coform",
      "commonTableContributors",
      formId,
      inputKey,
      [...criteriaIds].sort(),
    ] as const,
  /** Invalide tous les contributeurs d'un (formId, inputKey) ou plus large. */
  COMMONTABLE_CONTRIBUTORS_PREFIX: (
    formId: string | null = null,
    inputKey: string | null = null,
  ) => {
    if (formId === null) return ["coform", "commonTableContributors"] as const;
    if (inputKey === null)
      return ["coform", "commonTableContributors", formId] as const;
    return ["coform", "commonTableContributors", formId, inputKey] as const;
  },

  /**
   * Datasets agrégés des évaluations multiples (radar) pour une réponse coform.
   *
   * Producteur : `useMultiEvalData` (fetché à l'ouverture de `MultiEvalChartDialog`)
   * `stepKey` est tolérant à `null` : si omis, le backend retourne toutes les
   *   steps avec multi-eval.
   * `userId` inclus pour la même raison que `FORM_ANSWER` (fuite de cache
   *   cross-user : l'accès est contrôlé côté serveur par user, le cache doit
   *   l'être aussi).
   */
  MULTIEVAL_DATA: (
    answerId: string | null,
    stepKey: string | null = null,
    userId: string | null = null,
  ) => ["coform", "multiEvalData", answerId, stepKey, userId] as const,
  MULTIEVAL_DATA_PREFIX: (answerId: string | null = null) =>
    answerId === null
      ? (["coform", "multiEvalData"] as const)
      : (["coform", "multiEvalData", answerId] as const),

  /**
   * Historique d'audit d'une réponse coform (au plus 200 entrées, du plus
   * récent au plus ancien).
   *
   * Producteur : `useCoFormAnswerHistory` (fetché à l'ouverture de
   *   `AnswerActivityDialog`)
   * Auth côté serveur : propriétaire OU admin du parent OU admin/membre du
   *   finder selon `membersCanEditSharedAnswer`.
   * `userId` inclus pour la même raison que `FORM_ANSWER` (fuite de cache
   *   cross-user).
   */
  ANSWER_HISTORY: (answerId: string | null, userId: string | null = null) =>
    ["coform", "answerHistory", answerId, userId] as const,
  ANSWER_HISTORY_PREFIX: (answerId: string | null = null) =>
    answerId === null
      ? (["coform", "answerHistory"] as const)
      : (["coform", "answerHistory", answerId] as const),

  /**
   * Résumé PUBLIC d'un élément (nom + image de profil), résolu live via le SDK
   * (`api.<type>({id})`). Sert à afficher les chips finder et le nom d'un lieu
   * (`PlaceFormView`) sans persister l'image dans la réponse (elle se périme).
   *
   * Producteurs : `useElementSummary` (1 élément), `useFinderElementImages` (bulk).
   * **Non scopée `userId`** (contrairement à `FORM_ANSWER`/`MULTIEVAL_DATA`) :
   *   donnée publique, `auth: none` → cache mutualisé cross-user/cross-onglet
   *   VOULU (c'est ce qui déduplique les fetchs des deux producteurs).
   */
  ELEMENT_SUMMARY: (type: string | null, id: string | null) =>
    ["coform", "elementSummary", type, id] as const,
  ELEMENT_SUMMARY_PREFIX: () => ["coform", "elementSummary"] as const,

  /**
   * Recherche autocomplete du Finder (`searchCostum`). Clé éphémère paramétrée
   * par les critères de recherche (type, texte debouncé, filtres, sourceKey).
   * Donnée publique → non scopée `userId`.
   *
   * Producteur : `useFinderSearchResults`.
   */
  FINDER_SEARCH: (
    searchType: readonly string[],
    query: string,
    filters: Record<string, unknown> | undefined,
    notSourceKey: boolean,
  ) => ["coform", "finderSearch", searchType, query, filters, notSourceKey] as const,
  FINDER_SEARCH_PREFIX: () => ["coform", "finderSearch"] as const,

  /**
   * Recherche de tags dans l'index GLOBAL de la plateforme (`api.searchTags`).
   *
   * N'est interrogée que par les champs `tags` dont le formulaire n'a pas encore
   * de vocabulaire propre : quand `params.<inputKey>.list` est peuplé, les
   * suggestions en sortent directement (elle arrive avec le formulaire), sans
   * aucune requête. Clé éphémère paramétrée par le terme debouncé.
   *
   * Donnée publique (`auth: none`) → non scopée `userId`, cache mutualisé
   * cross-user comme `ELEMENT_SUMMARY` et `FINDER_SEARCH`.
   *
   * Producteur : `useTagSuggestions`.
   * Consommateurs invalidants : aucun (lecture seule, index global).
   */
  TAG_SEARCH: (query: string | null) => ["coform", "tagSearch", query] as const,
  TAG_SEARCH_PREFIX: () => ["coform", "tagSearch"] as const,
} as const;

export type CoformQueryKeyType = ReturnType<
  (typeof COFORM_QUERY_KEYS)[keyof typeof COFORM_QUERY_KEYS]
>;
