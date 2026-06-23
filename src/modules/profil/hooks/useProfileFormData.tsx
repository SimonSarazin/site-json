import { useMemo } from "react";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import type { ProfileFormData } from "../schemaForm";
import { seedProfileFormValues } from "../forms/editProfilePayload";

/**
 * Hook pour extraire les données d'un profil et les formater pour React Hook Form.
 *
 * READ profil (S5) : entité serveur → defaultValues via le pipeline générique
 * (`seedProfileFormValues` = `seedEntity` sur le descripteur UNIFIÉ read+write de chaque type).
 * Remplace l'ancien mapping manuel (extractAddressFields 14 / extractSocialFields 9 / dates /
 * openingHours / public / urls / parent / organizer) — byte-identique (prouvé par
 * seedProfileFormValues.test.ts). cf. doc/refactor-field-treatment.md (S5).
 *
 * @param entity - L'entité dont on veut extraire les données
 * @returns `{ defaultValues, entityType }` (defaultValues = null si pas de serverData ou type non géré)
 *
 * @example
 * const { defaultValues } = useProfileFormData(entity);
 * const form = useForm({ defaultValues });
 */
export function useProfileFormData(entity: EntityTypes | null) {
  return useMemo(() => {
    if (!entity || !entity.serverData) {
      return { defaultValues: null, entityType: null };
    }
    const entityType = entity.getEntityType();
    const values = seedProfileFormValues(entityType, { serverData: entity.serverData as Record<string, unknown> });
    return { defaultValues: (values as unknown as ProfileFormData) ?? null, entityType };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, entity?.serverData?.updated]);
}
