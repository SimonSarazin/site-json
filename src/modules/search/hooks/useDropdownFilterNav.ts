import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useSite } from "@/hooks/useSite";
import { usePageFiltersOptional } from "@/modules/search/contexts/pageFilters";
import { usePreviewNav } from "@/modules/search/contexts/previewNav";
import {
  dropdownFilterToParam,
  dropdownFilterToState,
  findFilterByField,
  getDropdownFilterOwner,
  resolveDropdownOption,
} from "@/modules/search/lib/dropdownFilters";

/**
 * Applique un filtre de listing depuis n'importe quel composant (typiquement une
 * valeur cliquable de preview), **route-aware** et **agnostique de l'entité** :
 *
 * - Le filtre + sa page propriétaire sont dérivés de la config (aucun path/id en
 *   dur) — le lien champ→filtre vient de `filter.field`.
 * - Même route : UNE mutation `setSearchParams` atomique (supprime `previewParam`
 *   + pose le filtre) + écriture de l'état `PageFilters` (obligatoire :
 *   l'hydratation URL→état du header est one-time au montage) + fermeture brute.
 * - Route différente (observatoire, command palette, autre page) : `navigate`
 *   (PUSH → Back revient à l'origine) ; l'hydratation au montage de la page cible
 *   applique le filtre depuis l'URL. On n'écrit PAS `PageFilters` (provider hors
 *   scope).
 *
 * Fonctionne SANS provider ; le `PreviewNavContext` optionnel n'apporte que
 * `previewParam` + une fermeture brute pour le chemin optimisé même-route.
 */
export function useDropdownFilterNav() {
  const { config } = useSite();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const pageFilters = usePageFiltersOptional();
  const previewNav = usePreviewNav();

  const navigateToFilter = useCallback(
    (filterId: string, value: string, onClose?: () => void): boolean => {
      const owner = getDropdownFilterOwner(config, filterId, pathname);
      if (!owner) return false;
      const option = resolveDropdownOption(owner.filter, value);
      if (!option) {
        if (import.meta.env.DEV) {
          console.warn(`[dropdownFilterNav] filtre "${filterId}" : aucune option pour "${value}"`);
        }
        return false;
      }

      const close = previewNav?.closeRaw ?? onClose;

      if (owner.pathname === pathname) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            if (previewNav?.previewParam) next.delete(previewNav.previewParam);
            dropdownFilterToParam(next, owner.filter, [option.id]);
            return next;
          },
          { replace: true, preventScrollReset: true },
        );
        if (pageFilters) {
          dropdownFilterToState(
            pageFilters.setSelectedFilters,
            pageFilters.setSearchByFields,
            owner.filter,
            [option.id],
          );
        }
      } else {
        const params = new URLSearchParams();
        params.set(owner.filter.id, option.id);
        navigate(`${owner.pathname}?${params.toString()}`);
      }

      close?.();
      return true;
    },
    [config, pathname, navigate, setSearchParams, pageFilters, previewNav],
  );

  const navigateToFacet = useCallback(
    (field: string, value: string, onClose?: () => void): boolean => {
      const owner = findFilterByField(config, field, pathname);
      if (!owner) return false;
      return navigateToFilter(owner.filter.id, value, onClose);
    },
    [config, pathname, navigateToFilter],
  );

  return { navigateToFilter, navigateToFacet };
}
