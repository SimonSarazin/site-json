import { useMemo } from "react";

import { useCocolight } from "@/hooks/useCocolight";
import { useVisibilityList } from "@/lib/visibility";
import type { FooterLink } from "@/types/site-schema";

/**
 * Jeton remplacé par la fiche de l'utilisateur connecté (`/profil/<slug>`) : un `href` de config
 * est une chaîne fixe. Le lien disparaît tant que le slug est inconnu.
 */
export const FOOTER_PROFILE_HREF = "@profile";

/**
 * Filtre une liste de liens de footer par `visibility` (cf. doc/19) et résout `@profile`.
 * Partagé par les quatre designs qui rendent des liens.
 */
export function useFooterLinks(links?: FooterLink[]): FooterLink[] {
  const { me } = useCocolight();
  const slug = (me?.serverData as { slug?: string } | undefined)?.slug ?? null;

  const source = useMemo(() => links ?? [], [links]);
  const visible = useVisibilityList(source.map((link) => link.visibility));

  return useMemo(
    () =>
      source
        .filter((_, index) => visible[index])
        .map((link) =>
          link.href === FOOTER_PROFILE_HREF
            ? { ...link, href: slug ? `/profil/${slug}` : "" }
            : link,
        )
        .filter((link) => link.href !== ""),
    [source, visible, slug],
  );
}
