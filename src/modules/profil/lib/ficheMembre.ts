/**
 * Vue d'affichage d'un membre : la donnée de la LISTE complétée par sa fiche entière.
 *
 * Les deux sources ne portent pas la même chose. La liste (`getMembers`) donne un nom et un
 * avatar tout de suite ; la fiche (`entityBySlug`) arrive après et porte seule le rattachement,
 * l'adresse et les contacts. La fiche PRIME champ par champ, mais on n'attend pas son arrivée
 * pour rendre : sinon la grille se remplirait de trous le temps des requêtes.
 */
export interface VueMembre {
  nom: string;
  slug: string | null;
  photo: string | null;
  /** Libellé de rattachement (`territoires` chez parent62), seulement s'il est exploitable. */
  rattachement: string | null;
  /** Les deux sources fusionnées — pour les lectures qui n'ont pas de champ dédié ici. */
  donnees: Record<string, unknown>;
}

export function vueMembre(
  donneesListe: Record<string, unknown> | undefined,
  donneesFiche: Record<string, unknown> | undefined,
): VueMembre {
  const sd = { ...(donneesListe ?? {}), ...(donneesFiche ?? {}) };

  // Chaîne de replis de l'avatar, du plus grand au plus petit : une vignette pixellisée reste
  // préférable à un trou, et toutes les fiches ne portent pas les trois tailles.
  const photo = [sd.profilMediumImageUrl, sd.profilImageUrl, sd.profilThumbImageUrl].find(
    (url): url is string => typeof url === "string" && url.trim() !== "",
  );

  return {
    nom: typeof sd.name === "string" && sd.name.trim() !== "" ? sd.name : "?",
    slug: typeof sd.slug === "string" && sd.slug.trim() !== "" ? sd.slug : null,
    photo: photo ?? null,
    // `territoires` est un LIBELLÉ simple sur les profils du réseau, mais le même nom porte un
    // tableau sur d'autres collections : tout ce qui n'est pas une chaîne n'est pas exploitable ici.
    rattachement: typeof sd.territoires === "string" && sd.territoires.trim() !== "" ? sd.territoires : null,
    donnees: sd,
  };
}
