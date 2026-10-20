import { makeVariantRegistry, staticVariant } from "@/lib/variants";
import { EDITORIAL_VARIANTS } from "../../../variants/lazyVariants";
import type { CommunDetailReadyVM } from "../../../hooks/useCommunDetailController";
import CommunDetailDefault from "./CommunDetailDefault";

/** Props de toute interface de la fiche : le view-model prêt. */
export interface CommunDetailViewProps {
    vm: CommunDetailReadyVM;
}

/**
 * Interfaces de la fiche, choisies par `config.aac.detail.pageVariant` (clé = nom de design).
 * `default` embarqué ; les autres sont déclarées dans `variants/lazyVariants.ts`.
 * Toute entrée passe dans `detail.conformance.test.tsx`.
 */
export const AAC_DETAIL_VARIANTS = makeVariantRegistry<CommunDetailViewProps>(
    {
        default: staticVariant(CommunDetailDefault),
        editorial: EDITORIAL_VARIANTS.detail,
    },
    "aac detail"
);
