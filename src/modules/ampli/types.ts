/**
 * Types canoniques du module ampli.
 *
 * Centralise les structures partagées entre `useFetchAnswerQuery`,
 * `MeeteemSection`, et les helpers de transformation. Aligné avec le pattern
 * cagnotte/profil/coform.
 */

import type { Answer, User } from "@communecter/cocolight-api-client";
import type { AmpliPath } from "./schema";

/**
 * Un ampli prêt à l'emploi — le modèle UNIQUE que consomment la page, la liste
 * et les sections, quelle que soit la source (`costum.ampli` ou la forme tableau
 * historique de la config). Construit par `lib/costumAmpli.ts`.
 */
export interface AmpliModel {
  /** Segment d'URL : `/ampli/<slug>`. */
  slug: string;
  /** Nom affiché (titre du hero, carte de la liste). Absent en forme historique. */
  name?: string;
  description?: string;
  tags: string[];
  path: AmpliPath;
  /** Formulaire des propositions. `null` = non configuré : la page le DIT au
   *  lieu d'interroger le backend avec un id vide. */
  coform: string | null;
}

/** Un ampli dont le formulaire est connu — seul type que reçoivent le contexte
 *  et les sections : aucune d'elles n'a à se demander si `coform` existe. */
export type ConfiguredAmpli = AmpliModel & { coform: string };

export function isConfiguredAmpli(ampli: AmpliModel): ampli is ConfiguredAmpli {
  return ampli.coform !== null;
}

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
      /** Réactions par utilisateur : `userId -> { status, date }`. */
      vote?: Record<string, unknown>;
      comments?: Record<string, unknown>;
      [key: string]: unknown;
    };
    /**
     * Bascule d'une réaction (`Answer.addVote` du SDK) — un seul appel ajoute
     * OU retire. OPTIONNELLE : au runtime les résultats sont de vraies entités
     * `Answer` et la méthode est là, mais les fixtures de test construisent des
     * objets nus. Son absence désactive simplement l'action (compteur figé).
     */
    addVote?: (status: string) => Promise<{ removedVoteStatus?: string; inc?: number }>;
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
