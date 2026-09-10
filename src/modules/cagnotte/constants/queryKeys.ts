/**
 * Constantes centralisées pour les query keys React Query du module cagnotte.
 * Évite les magic strings et assure la cohérence des invalidations.
 *
 * Convention : `*_PREFIX` matche toutes les variantes d'une query (utile pour
 * invalidateQueries où l'on veut toucher toutes les pages/contextes).
 */
/** Premier segment de `CAGNOTTE_QUERY_KEYS.COMMUN_RAW_DEPENSES*` (valeur historique, conservée). */
export const COMMUN_RAW_DEPENSES_QUERY_KEY = "aac-milestone-list-depenses";

export const CAGNOTTE_QUERY_KEYS = {
  // FundingEnvelope — récupère la "fundingEnvelope" complète d'un projet
  // (milestones, actions, contributors, funders, finance, rawEnvelope).
  // Producteur : useFundingEnvelope
  // Préfixe complet pour les producteurs : ["funding-envelope", entityId, contextType, projectId, profileSlug, userId]
  //
  // `userId` est inclus car `useFundingEnvelope` enrichit la réponse via `getFormData`
  // côté backend en passant `financerId: me.id` (cf. useFundingEnvelope.ts). Sans cette
  // dimension dans la clé, deux utilisateurs distincts dans la même session pourraient
  // se voir servir les données enrichies du premier depuis le cache.
  FUNDING_ENVELOPE: (
    entityId: string | null,
    contextType: string | null,
    projectId: string | null,
    profileSlug: string | null = null,
    userId: string | null = null
  ) => ["funding-envelope", entityId, contextType, projectId, profileSlug, userId] as const,
  // Préfixe minimaliste pour invalidations cross-contexte (matche toutes les fundingEnvelope)
  FUNDING_ENVELOPE_PREFIX: () => ["funding-envelope"] as const,

  // Liste des projets d'une organisation avec leurs réponses CoForm.
  // Producteur : modules/cagnotte/hooks/useOrganizationProjectsWithAnswers
  // Consommateurs invalidants : PaymentConfigPage, CagnotteDialog
  ORGANIZATION_PROJECTS_WITH_ANSWERS: (entityId: string | null) =>
    ["organization-projects-with-answers", entityId] as const,
  ORGANIZATION_PROJECTS_WITH_ANSWERS_PREFIX: () =>
    ["organization-projects-with-answers"] as const,

  // ID du projet sélectionné par défaut pour la modale cagnotte (préférence org).
  // Producteur : useProjectModalCagnotte
  // Stocké côté serveur dans `organization.preferences.projectModalId` + localStorage fallback.
  PROJECT_MODAL_CAGNOTTE: (entityId: string | null, projectModalId: string | null) =>
    ["projectModalCagnotte", entityId, projectModalId] as const,
  PROJECT_MODAL_CAGNOTTE_PREFIX: () => ["projectModalCagnotte"] as const,

  // `answers.<step>.depense` d'une réponse, TEL QUE le document le porte — la
  // seconde entrée de cache par laquelle la fiche commun et `MilestoneListField`
  // relisent les paliers (staleTime 60 s), distincte de l'enveloppe.
  // Producteur : modules/aac/hooks/useCommunRawDepenses (qui ré-exporte la constante)
  // Consommateurs invalidants : la réparation des dépenses orphelines
  // (`useOrphanDepenseRepair`), les mutations paliers via `extraInvalidate`
  // (fiche commun), `useGenerateAacProject`, `useAssociateExistingAacProject`.
  // La clé vit ICI parce que c'est cagnotte qui l'invalide : aac dépend de
  // cagnotte, jamais l'inverse.
  COMMUN_RAW_DEPENSES: (answerId: string | null | undefined, step: string) =>
    [COMMUN_RAW_DEPENSES_QUERY_KEY, answerId, step] as const,
  // Préfixe `[clé, answerId]` : React Query invalide par préfixe, l'étape (3ᵉ segment) est couverte.
  COMMUN_RAW_DEPENSES_PREFIX: (answerId: string | null | undefined) =>
    [COMMUN_RAW_DEPENSES_QUERY_KEY, answerId] as const,
} as const;

export type CagnotteQueryKeyType = ReturnType<
  (typeof CAGNOTTE_QUERY_KEYS)[keyof typeof CAGNOTTE_QUERY_KEYS]
>;
