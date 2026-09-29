/**
 * Vue d'affichage d'un membre, lue sur la donnée de la LISTE.
 *
 * La liste (`getMembers`) porte tout ce que la carte affiche dès lors que la section projette les
 * champs absents de la projection par défaut (`fields: ["territoires", "telephone", …]`,
 * SDK ≥ 1.0.194). Il n'y a donc plus de seconde source : lire une fiche par membre en plus de la
 * liste, c'était une requête par carte pour des champs que la liste sait ramener.
 */
export interface VueMembre {
  nom: string;
  slug: string | null;
  photo: string | null;
  /** Libellé de rattachement (`territoires` chez parent62), seulement s'il est exploitable. */
  rattachement: string | null;
  /** La donnée brute — pour les lectures qui n'ont pas de champ dédié ici. */
  donnees: Record<string, unknown>;
}

function rattachementDe(valeur: unknown): string | null {
  const candidats = Array.isArray(valeur) ? valeur : [valeur];
  const libelle = candidats.find((v): v is string => typeof v === "string" && v.trim() !== "");
  return libelle ?? null;
}

export function vueMembre(donneesListe: Record<string, unknown> | undefined): VueMembre {
  const sd = donneesListe ?? {};

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
    // TABLEAU ailleurs — et l'égalité Mongo du filtre serveur (`{ territoires: "X" }`) apparie
    // aussi un tableau contenant X. La carte doit donc lire ce que le filtre a retenu : premier
    // libellé exploitable, sinon rien.
    rattachement: rattachementDe(sd.territoires),
    donnees: sd,
  };
}
