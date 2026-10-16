import { makeVariantRegistry, staticVariant } from "@/lib/variants";
import { EDITORIAL_VARIANTS } from "../../../variants/lazyVariants";
import { AacCommunCard } from "../AacCommunCard";
import { AacCommunRow } from "../AacCommunRow";
import { AacDirectorySkeleton } from "../AacDirectorySkeleton";
import type { AacCommunCard as CommunCard } from "../../../lib/parseAacAnswer";
import type { AacDisplayMode } from "../../../schema";

/** Props d'un commun de l'annuaire, en carte comme en ligne. */
export interface AacCommunItemProps {
  commun: CommunCard;
  /** Demande la suppression du commun ; absent ⇒ aucun bouton. */
  onRequestDelete?: (commun: CommunCard) => void;
  /** Une suppression est en cours dans l'annuaire. */
  isDeleting?: boolean;
  className?: string;
  /** Libellés exacts des usages par identifiant (`readUsageLabels`) ; repli `usageLabelFromId`. */
  usageLabels?: Readonly<Record<string, string>>;
}

export interface AacDirectorySkeletonProps {
  columns?: number;
  count?: number;
  display?: AacDisplayMode;
}

/**
 * Interfaces d'un commun dans l'annuaire : trois registres jumelés sur une même clé
 * (`cardVariant`, sinon `config.aac.directory.defaultCardVariant`).
 *  - carte et ligne vont par paire (bascule grille/liste) ;
 *  - squelette aux mesures de la carte : rendu par le SSR et en repli `Suspense`.
 * `default` embarqués ; les autres entrées sont déclarées dans `variants/lazyVariants.ts`.
 */
export const AAC_DIRECTORY_CARD_VARIANTS = makeVariantRegistry<AacCommunItemProps>(
  {
    default: staticVariant(AacCommunCard),
    editorial: EDITORIAL_VARIANTS.card,
  },
  "aac directory card"
);

export const AAC_DIRECTORY_ROW_VARIANTS = makeVariantRegistry<AacCommunItemProps>(
  {
    default: staticVariant(AacCommunRow),
    editorial: EDITORIAL_VARIANTS.row,
  },
  "aac directory row"
);

export const AAC_DIRECTORY_SKELETON_VARIANTS = makeVariantRegistry<AacDirectorySkeletonProps>(
  {
    default: staticVariant(AacDirectorySkeleton),
    editorial: EDITORIAL_VARIANTS.skeleton,
  },
  "aac directory skeleton"
);
