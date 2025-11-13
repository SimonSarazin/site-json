import { useContext } from "react";
import { ProfileEntityContext } from "../contexts/ProfileEntityContext";

/**
 * Hook pour accéder aux données du profil depuis le contexte
 * 
 * @example
 * ```tsx
 * function MyProfileComponent() {
 *   const { entity, config, entityType } = useProfileEntity();
 *   return <div>{entity.serverData?.name}</div>;
 * }
 * ```
 */
export function useProfileEntity() {
  const context = useContext(ProfileEntityContext);
  if (!context) {
    throw new Error('useProfileEntity must be used within a ProfileEntityProvider');
  }
  return context;
}