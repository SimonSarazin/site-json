import { useProfileEntity } from "./useProfileEntity";
import { useT } from "@/hooks/useT";

/**
 * Hook pour le setup commun des sections de profil
 * Élimine la duplication des 3-4 lignes de setup dans chaque composant
 * Note: useLoadNamespace est appelé dans ProfilePage.tsx, pas besoin de le répéter ici
 *
 * @example
 * function ProfileSection() {
 *   const { entity, config, entityType, t } = useProfileSetup();
 *   // ...
 * }
 */
export function useProfileSetup() {
  const { entity, config, entityType } = useProfileEntity();
  const t = useT("modules/profil");

  return {
    entity,
    config,
    entityType,
    t,
  };
}
