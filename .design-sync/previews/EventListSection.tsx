import { EventListSection } from "site-forge";

// Agenda statique (type "eventList") : filtre par défaut « À venir » →
// dates futures pour que les cartes s'affichent. Images : data-URI SVG.

const visuel = (label: string, bg: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="${bg}"/><text x="300" y="158" font-family="sans-serif" font-size="26" fill="#ffffff" text-anchor="middle">${label}</text></svg>`
  );

const evenements = [
  {
    id: "1",
    title: { fr: "Café des parents : la rentrée approche" },
    description: { fr: "Un temps convivial pour échanger entre parents autour de l'entrée à l'école : rythmes, séparation, cartable… Accueil libre, café offert." },
    startDate: "2026-09-12T09:30:00",
    endDate: "2026-09-12T11:30:00",
    location: { fr: "Centre social d'Arras, salle des familles" },
    image: visuel("Café des parents", "#3b6ea5"),
    registrationUrl: "https://exemple.org/inscription-cafe",
    price: "Gratuit",
    tags: [{ fr: "Échange" }, { fr: "Rentrée" }],
  },
  {
    id: "2",
    title: { fr: "Atelier massage bébé (0-12 mois)" },
    description: { fr: "Cycle de trois séances animé par une instructrice certifiée : gestes simples pour apaiser bébé et renforcer le lien parent-enfant." },
    startDate: "2026-10-03T10:00:00",
    endDate: "2026-10-03T11:00:00",
    location: { fr: "Maison de la petite enfance, Lens" },
    image: visuel("Massage bébé", "#2e8b6e"),
    registrationUrl: "https://exemple.org/inscription-massage",
    price: "5€ le cycle",
    tags: [{ fr: "Atelier" }, { fr: "0-1 an" }],
  },
  {
    id: "3",
    title: { fr: "Conférence : comprendre l'adolescence" },
    description: { fr: "Une psychologue clinicienne décrypte les besoins des 11-17 ans et répond aux questions de la salle. Ouvert à tous les parents du territoire." },
    startDate: "2026-11-18T18:30:00",
    endDate: "2026-11-18T20:30:00",
    location: { fr: "Auditorium de la médiathèque, Boulogne-sur-Mer" },
    price: "Gratuit",
    tags: [{ fr: "Conférence" }, { fr: "Ados" }],
  },
];

export const Liste = () => (
  <EventListSection
    props={{
      events: evenements.slice(0, 2),
      layout: "list",
      showPastEvents: false,
    }}
  />
);

export const Grille = () => (
  <EventListSection
    props={{
      events: evenements,
      layout: "grid",
      showPastEvents: true,
    }}
  />
);
