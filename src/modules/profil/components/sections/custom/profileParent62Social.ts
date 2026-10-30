/**
 * Réseaux sociaux d'une organisation parent62 : deux formes coexistent en base — FLAT
 * (`serverData.facebook`, orgs importées/« normales », cf. `ProfileTiersLieuxInfo.tsx`) et IMBRIQUÉE
 * (`serverData.socialNetwork.facebook`, écrite par `parent62-acteur`/`parent62-partenaire` via le codec
 * `social:write`). On lit la flat en priorité puis on retombe sur l'imbriquée, pour afficher les liens
 * quelle que soit la voie d'écriture — même patron que `ProfileTiersLieuxInfo.tsx:82`.
 */
export function toSocialLinks(flat: {
  socialNetwork: Record<string, unknown>;
  facebook?: unknown;
  instagram?: unknown;
  linkedin?: unknown;
  youtube?: unknown;
}): Array<{ platform: string; url: string }> {
  const byPlatform: Record<string, unknown> = {
    facebook: flat.facebook,
    instagram: flat.instagram,
    linkedin: flat.linkedin,
    youtube: flat.youtube,
  };
  return Object.entries(byPlatform)
    .map(([platform, value]) => {
      // Les deux formes (plate ET imbriquée) sont de forme serveur non garantie (legacy, autre costum
      // sur la collection) : un `socialNetwork.facebook` objet/nombre ne doit PAS faire planter `.trim()`.
      const nested = flat.socialNetwork[platform];
      const raw = typeof value === "string" && value.trim() !== "" ? value : typeof nested === "string" ? nested : undefined;
      const url = raw?.trim();
      return url ? { platform, url } : null;
    })
    .filter((v): v is { platform: string; url: string } => v !== null);
}
