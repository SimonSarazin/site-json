import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { useSite } from "@/hooks/useSite";
import { useDropdownFilterNav } from "@/modules/search/hooks/useDropdownFilterNav";
import { findFilterByField, resolveDropdownOption } from "@/modules/search/lib/dropdownFilters";

/**
 * Primitive **agnostique de l'entité** : une valeur affichée (`token`) qui, si un
 * dropdownFilter indexe le champ `field` ET sait résoudre le token en option,
 * devient cliquable pour filtrer le listing (via `useDropdownFilterNav`). Sinon
 * elle est rendue en texte simple — jamais de lien mort.
 *
 * `token` = la valeur brute utilisée pour la résolution/le filtre ; le contenu
 * affiché (`children`) peut différer (ex. code postal `token="97400"` mais
 * affichage « 97400 Saint-Denis »).
 */
export function ClickableFacet({
  field,
  token,
  onClose,
  className,
  children,
}: {
  field: string;
  token: string;
  onClose?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const nav = useDropdownFilterNav();
  const { config } = useSite();
  const { pathname } = useLocation();

  const owner = findFilterByField(config, field, pathname);
  const clickable = !!owner && !!resolveDropdownOption(owner.filter, token);
  const content = children ?? token;

  if (!clickable) return <>{content}</>;

  return (
    <button type="button" onClick={() => nav.navigateToFacet(field, token, onClose)} className={className}>
      {content}
    </button>
  );
}
