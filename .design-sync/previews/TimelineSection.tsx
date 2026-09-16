import { TimelineSection } from "site-forge";

// Usage réel : histoire du réseau (config parent62) — cartes alternées,
// années portées par les titres.
export const Historique = () => (
  <TimelineSection
    props={{
      alternating: true,
      events: [
        {
          title: { fr: "1999 — Le 62, département pionnier" },
          text: { fr: "Dès la première circulaire REAAP du 9 mars 1999, une organisation multi-partenariale pilotée par la DDASS voit le jour dans le Pas-de-Calais." },
        },
        {
          title: { fr: "2004 — La charte du REAAP 62" },
          text: { fr: "Le Préfet, la DDASS, le Conseil Général, la Fé.Dé.Caf 62 et l'Éducation Nationale signent la charte : 8 valeurs partagées." },
        },
        {
          title: { fr: "2014 — La CAF prend le pilotage" },
          text: { fr: "La CAF du Pas-de-Calais crée 9 postes de coordination répartis sur les territoires et impulse une nouvelle dynamique." },
        },
        {
          title: { fr: "Aujourd'hui — Le Réseau Parentalité 62" },
          text: { fr: "Parents, centres sociaux, associations, institutions : un maillage vivant sur les neuf territoires du département." },
        },
      ],
    }}
  />
);

// Fil simple (non alterné) avec dates formatées (badge calendrier).
export const FilAvecDates = () => (
  <TimelineSection
    props={{
      alternating: false,
      events: [
        {
          date: "2026-09-12",
          title: { fr: "Lancement de la saison" },
          text: { fr: "Présentation du programme annuel aux structures membres, à Arras." },
        },
        {
          date: "2026-10-05",
          title: { fr: "Semaine des familles" },
          text: { fr: "Une semaine d'ateliers et de spectacles dans les dix territoires." },
        },
        {
          date: "2026-11-14",
          title: { fr: "Journée départementale" },
          text: { fr: "Conférence « Écrans et adolescence » et forum des initiatives locales." },
        },
      ],
    }}
  />
);
