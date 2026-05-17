/**
 * Types canoniques du module ampli.
 *
 * Centralise les structures partagées entre `useFetchAnswerQuery`,
 * `MeeteemSection`, et les helpers de transformation. Aligné avec le pattern
 * cagnotte/profil/coform.
 */

import type { Answer, User } from "@communecter/cocolight-api-client";

/** Modes d'affichage du composant MeeteemSection. */
export type MeeteemViewMode = "answers" | "map" | "split";

/**
 * Une réponse Cocolight transformée pour l'affichage côté ampli.
 * Construite par `useFetchAnswerQuery` via `extractionConfig`.
 */
export interface AmpliDataResponse {
  answer: Answer;
  data: Record<string, unknown>;
  user?: User | Record<string, string> | null;
}

/** Sous-ensemble typé des données d'une carte ampli pour les sous-composants. */
export interface MeeteemCardData {
  name?: string;
  description?: string;
  tags?: string[];
  [key: string]: unknown;
}

/** Métadonnées utilisateur enrichies par `useFetchAnswerQuery` quand `includeUserInfo: true`. */
export interface MeeteemUserInfo {
  name: string;
  initial: string;
  exists: boolean;
}

/**
 * Forme stricte attendue par les sous-composants MeeteemSection.
 * Cast depuis `AmpliDataResponse` après vérification que `extractionConfig.includeUserInfo`
 * a été activé côté `useFetchAnswerQuery`.
 */
export interface MeeteemCard {
  answer: {
    serverData: {
      id?: string;
      created?: Date;
      vote?: Record<string, unknown>;
      comments?: Record<string, unknown>;
      [key: string]: unknown;
    };
  };
  data: MeeteemCardData;
  user?: MeeteemUserInfo;
}

/** Agrégation pour la section AmpliFeatures. */
export interface UserWithContributions {
  user: string | User | Record<string, string> | null;
  contributionCount: number;
}

/** Retour de `getSummaryData` (cf. `helpers/summary.ts`). */
export interface AmpliSummaryData {
  totalAnswers: number;
  totalUsers: number;
  totalLikes: number;
  totalComments: number;
  users: UserWithContributions[];
}
