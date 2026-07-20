import { TeamSection } from "site-forge";

// Avatar OBLIGATOIRE (schéma) → data-URI SVG : cercle coloré + initiales.
const avatar = (initials: string, bg: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="${bg}"/><text x="80" y="86" font-family="Verdana,sans-serif" font-size="56" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`
  );

// Usage réel : coordination départementale (config parent62, page /equipe).
export const Coordination = () => (
  <TeamSection
    props={{
      layout: "grid",
      columns: 2,
      members: [
        {
          name: { fr: "Antoine Legrand" },
          role: { fr: "Coordonnateur départemental" },
          bio: { fr: "06 98 99 93 09 · Fédération des Centres Sociaux Nord-Pas-de-Calais, Lille" },
          avatar: avatar("AL", "#4054b2"),
          socials: [{ platform: "mail", url: "mailto:antoine.legrand@parent62.org" }],
        },
        {
          name: { fr: "Clarisse Feutry" },
          role: { fr: "Coordonnatrice départementale" },
          bio: { fr: "06 11 21 40 75 · Fédération des Centres Sociaux Nord-Pas-de-Calais, Lille" },
          avatar: avatar("CF", "#3f7d4e"),
          socials: [{ platform: "mail", url: "mailto:clarisse.feutry@parent62.org" }],
        },
      ],
    }}
  />
);

// Grille 3 colonnes : coordinations territoriales, réseaux sociaux variés.
export const CoordinationsTerritoriales = () => (
  <TeamSection
    props={{
      layout: "grid",
      columns: 3,
      members: [
        {
          name: { fr: "Karim Benhaddou" },
          role: { fr: "Coordinateur — Arrageois" },
          bio: { fr: "Centre social d'Achicourt · Permanences le mardi matin" },
          avatar: avatar("KB", "#5d4a9c"),
          socials: [
            { platform: "mail", url: "mailto:arrageois@parent62.org" },
            { platform: "facebook", url: "https://facebook.com/parent62" },
          ],
        },
        {
          name: { fr: "Élodie Vasseur" },
          role: { fr: "Coordinatrice — Boulonnais" },
          bio: { fr: "Maison des familles de Boulogne-sur-Mer · Café des parents mensuel" },
          avatar: avatar("ÉV", "#2f7f8e"),
          socials: [
            { platform: "mail", url: "mailto:boulonnais@parent62.org" },
            { platform: "instagram", url: "https://instagram.com/parent62" },
          ],
        },
        {
          name: { fr: "Julien Delcourt" },
          role: { fr: "Coordinateur — Artois" },
          bio: { fr: "Centre social de Bruay-la-Buissière · Ateliers parents-ados" },
          avatar: avatar("JD", "#b2743d"),
          socials: [
            { platform: "mail", url: "mailto:artois@parent62.org" },
            { platform: "globe", url: "https://parent62.org/artois" },
          ],
        },
      ],
    }}
  />
);
