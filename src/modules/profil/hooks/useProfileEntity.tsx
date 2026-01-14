import { useContext } from "react";
import { ProfileEntityContext, type ProfileEntityContextType } from "../contexts/ProfileEntityContext";

/**
 * Hook pour accéder aux données du profil depuis le contexte
 * Throw une erreur si utilisé hors du Provider
 *
 * @example
 * ```tsx
 * function MyProfileComponent() {
 *   const { entity, config, entityType } = useProfileEntity();
 *   return <div>{entity.serverData?.name}</div>;
 * }
 * ```
 */
export function useProfileEntity(): ProfileEntityContextType {
  const context = useContext(ProfileEntityContext);
  if (!context) {
    throw new Error('useProfileEntity must be used within a ProfileEntityProvider');
  }
  return context;
}

/**
 * Hook optionnel qui ne throw pas d'erreur si utilisé hors du Provider
 * Utile pour les composants qui peuvent fonctionner avec/sans contexte
 *
 * @example
 * ```tsx
 * function OptionalProfileInfo() {
 *   const context = useOptionalProfileEntity();
 *   if (!context) return null;
 *   return <div>{context.entity.serverData?.name}</div>;
 * }
 * ```
 */
export function useOptionalProfileEntity(): ProfileEntityContextType | null {
  return useContext(ProfileEntityContext);
}