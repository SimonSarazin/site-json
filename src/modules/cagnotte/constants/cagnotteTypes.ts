/**
 * Énumération des types de cagnotte avec clés i18n associées.
 */

import type { CagnotteType } from "../types";

/**
 * Énumération des types supportés.
 * Values = chaînes exactes à utiliser en JSON config ou props.
 */
export const CAGNOTTE_TYPES = {
    STANDARD: "standard",
    AAC: "aac",
} as const;

export const CAGNOTTE_TYPE_I18N_KEYS = {
    standard: {
        label: "modules/cagnotte/types/standard/label",
        description: "modules/cagnotte/types/standard/description",
    },
    aac: {
        label: "modules/cagnotte/types/acc/label",
        description: "modules/cagnotte/types/acc/description",
    },
} as const satisfies Record<CagnotteType, { label: string; description: string }>;