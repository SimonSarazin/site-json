import { useMemo } from "react";

import { useCocolight } from "@/hooks/useCocolight";
import { useVisibilityList } from "@/lib/visibility";
import { profileUrlOf } from "@/modules/auth/hooks/useAuthActions";
import type { Footer, FooterLink } from "@/types/site-schema";

/**
 * Jeton remplacé par la fiche de l'utilisateur connecté (`/profil/<slug>`) : un `href` de config
 * est une chaîne fixe. Le lien disparaît tant que le slug est inconnu.
 */
export const FOOTER_PROFILE_HREF = "@profile";

export type FooterColumn = NonNullable<Footer["columns"]>[number];

export interface VisibleFooterColumn {
  column: FooterColumn;
  links: FooterLink[];
}

/** Garde les liens visibles et résout `@profile` ; un lien sans adresse est retiré. */
function resolveLinks(links: FooterLink[], visible: boolean[], profileUrl: string | null): FooterLink[] {
  return links
    .filter((_, index) => visible[index])
    .map((link) => (link.href === FOOTER_PROFILE_HREF ? { ...link, href: profileUrl ?? "" } : link))
    .filter((link) => link.href !== "");
}

/** Filtre une liste de liens de footer par `visibility` (cf. doc/19) et résout `@profile`. */
export function useFooterLinks(links?: FooterLink[]): FooterLink[] {
  const { me } = useCocolight();
  const profileUrl = profileUrlOf(me);

  const source = useMemo(() => links ?? [], [links]);
  const conditions = useMemo(() => source.map((link) => link.visibility), [source]);
  const visible = useVisibilityList(conditions);

  return useMemo(() => resolveLinks(source, visible, profileUrl), [source, visible, profileUrl]);
}

/**
 * Les colonnes d'un footer, filtrées en une seule évaluation de visibilité pour toutes leurs
 * lignes. Une colonne sans lien visible est omise.
 */
export function useFooterColumns(columns?: FooterColumn[]): VisibleFooterColumn[] {
  const { me } = useCocolight();
  const profileUrl = profileUrlOf(me);

  const source = useMemo(() => columns ?? [], [columns]);
  const conditions = useMemo(
    () => source.flatMap((column) => column.links.map((link) => link.visibility)),
    [source],
  );
  const visible = useVisibilityList(conditions);

  return useMemo(() => {
    const result: VisibleFooterColumn[] = [];
    let start = 0;
    for (const column of source) {
      const end = start + column.links.length;
      const links = resolveLinks(column.links, visible.slice(start, end), profileUrl);
      if (links.length > 0) result.push({ column, links });
      start = end;
    }
    return result;
  }, [source, visible, profileUrl]);
}
