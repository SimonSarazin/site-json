import { makeVariantRegistry, staticVariant } from "@/lib/variants";
import { EDITORIAL_VARIANTS } from "../../../variants/lazyVariants";
import type { AacDirectoryReadyVM } from "../../../hooks/useAacDirectoryController";
import AacDirectoryShellDefault from "./AacDirectoryShellDefault";

/** Props de toute disposition d'annuaire : ancre de la section et view-model prêt. */
export interface AacDirectoryShellProps {
  id?: string;
  vm: AacDirectoryReadyVM;
}

/**
 * Dispositions de l'annuaire (en-tête, filtres, compteur, bascule), aux modes complet et vitrine.
 * Clé : `shellVariant` de section, sinon `config.aac.directory.defaultShellVariant`.
 * `directory.conformance.test.tsx` exige un contrôle par filtre activé.
 */
export const AAC_DIRECTORY_SHELL_VARIANTS = makeVariantRegistry<AacDirectoryShellProps>(
  {
    default: staticVariant(AacDirectoryShellDefault),
    editorial: EDITORIAL_VARIANTS.shell,
  },
  "aac directory shell"
);
