import { useProfileEntity } from "./useProfileEntity";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import "@/modules/profil/i18n";

/**
 * Hook pour le setup commun des sections de profil
 * Élimine la duplication des 3-4 lignes de setup dans chaque composant
 *
 * @example
 * function ProfileSection() {
 *   const { entity, config, entityType, t } = useProfileSetup();
 *   // ...
 * }
 */
export function useProfileSetup() {
  const { entity, config, entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");

  return {
    entity,
    config,
    entityType,
    t,
  };
}
