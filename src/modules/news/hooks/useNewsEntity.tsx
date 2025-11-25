import { useMemo } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useEntityBySlugQuery } from "@/hooks/useEntityBySlugQuery";

interface UseNewsEntityProps {
  entitySlug?: string;
}

/**
 * Hook pour résoudre l'entité à utiliser pour les news
 * Logique simple :
 * 1. Si entitySlug fourni → utiliser useEntityBySlugQuery
 * 2. Sinon → utiliser entity par défaut de useCocolight
 */
export const useNewsEntity = ({ entitySlug }: UseNewsEntityProps) => {
  const { entity: defaultEntity } = useCocolight();

  // Cas 1: Résolution par slug
  const { data: entityBySlug, isLoading: isLoadingSlug, isError: isErrorSlug } = useEntityBySlugQuery({
    slug: entitySlug,
    options: {
      enabled: !!entitySlug,
    }
  });

  // Résolution finale
  const resolvedEntity = useMemo(() => {
    if (entitySlug) {
      return entityBySlug;
    }
    return defaultEntity;
  }, [entitySlug, entityBySlug, defaultEntity]);

  const resolvedEntityType = useMemo(() => {
    if (resolvedEntity) {
      return resolvedEntity.getEntityType();
    }
    return null; // Pas d'entité = pas de type
  }, [resolvedEntity]);

  return {
    entity: resolvedEntity,
    entityType: resolvedEntityType,
    isLoading: entitySlug ? isLoadingSlug : false,
    isError: entitySlug ? isErrorSlug : false,
  };
};