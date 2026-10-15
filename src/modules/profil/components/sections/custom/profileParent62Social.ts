/**
 * Réseaux sociaux d'une organisation parent62 : deux formes coexistent en base — FLAT
 * (`serverData.facebook`, orgs importées/« normales », cf. `ProfileTiersLieuxInfo.tsx`) et IMBRIQUÉE
 * (`serverData.socialNetwork.facebook`, écrite par `parent62-acteur`/`parent62-partenaire` via le codec
 * `social:write`). On lit la flat en priorité puis on retombe sur l'imbriquée, pour afficher les liens
 * quelle que soit la voie d'écriture — même patron que `ProfileTiersLieuxInfo.tsx:82`.
 */
export function toSocialLinks(flat: {
  socialNetwork: Record<string, string>;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
}): Array<{ platform: string; url: string }> {
  const byPlatform: Record<string, string | undefined> = {
    facebook: flat.facebook,
    instagram: flat.instagram,
    linkedin: flat.linkedin,
    youtube: flat.youtube,
  };
  return Object.entries(byPlatform)
    .map(([platform, value]) => {
      const url = (typeof value === "string" && value.trim() !== "" ? value : flat.socialNetwork[platform])?.trim();
      return url ? { platform, url } : null;
    })
    .filter((v): v is { platform: string; url: string } => v !== null);
}
