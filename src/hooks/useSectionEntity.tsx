import { useMemo } from "react";
import { useCocolight } from "@/hooks/useCocolight";
import { useEntityBySlugQuery } from "@/hooks/useEntityBySlugQuery";
import { useOptionalProfileEntity } from "@/modules/profil/hooks/useProfileEntity";

interface UseSectionEntityProps {
  /** Slug de l'entité à afficher. Si absent, on retombe sur l'entité du contexte. */
  slug?: string;
}

/**
 * Résout l'entité à utiliser par une section (membres, etc.) :
 *  1. `slug` fourni → fetch générique via `useEntityBySlugQuery` (n'importe quel type).
 *  2. sinon → entité du contexte profil (`useOptionalProfileEntity`, page de profil)
 *     puis, à défaut, l'entité courante Cocolight (`useCocolight().entity`).
 *
 * Généralise le pattern de `modules/news/hooks/useNewsEntity` en ajoutant le
 * fallback sur le contexte profil (page `/profil/:slug`).
 */
export function useSectionEntity({ slug }: UseSectionEntityProps) {
  const profileCtx = useOptionalProfileEntity();
  const { entity: cocolightEntity } = useCocolight();

  const {
    data: entityBySlug,
    isLoading: isLoadingSlug,
    isError: isErrorSlug,
  } = useEntityBySlugQuery({ slug, options: { enabled: !!slug } });

  const resolvedEntity = useMemo(() => {
    if (slug) return entityBySlug ?? null;
    return profileCtx?.entity ?? cocolightEntity ?? null;
  }, [slug, entityBySlug, profileCtx?.entity, cocolightEntity]);

  const entityType = useMemo(
    () => resolvedEntity?.getEntityType?.() ?? null,
    [resolvedEntity]
  );

  return {
    entity: resolvedEntity,
    entityType,
    isLoading: slug ? isLoadingSlug : false,
    isError: slug ? isErrorSlug : false,
  };
}
