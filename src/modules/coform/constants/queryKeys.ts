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
} as const;

export type CoformQueryKeyType = ReturnType<
  (typeof COFORM_QUERY_KEYS)[keyof typeof COFORM_QUERY_KEYS]
>;
