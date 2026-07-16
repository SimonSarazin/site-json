import { CardsSection } from "site-forge";

// Visuels : data-URI SVG uniquement (l'endpoint /img n'existe pas hors app).
const photo = (bg: string, fg: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="100%" height="100%" fill="${bg}"/><circle cx="620" cy="120" r="70" fill="${fg}" opacity="0.8"/><rect x="80" y="270" width="360" height="26" rx="13" fill="${fg}" opacity="0.5"/><rect x="80" y="320" width="240" height="26" rx="13" fill="${fg}" opacity="0.35"/></svg>`
  );

// Usage réel : cartes d'accueil (services du réseau parentalité).
export const GrilleIcones = () => (
  <CardsSection
    props={{
      variant: "default",
      layout: "grid",
      columns: 3,
      showHeader: false,
      showResultCount: false,
      showViewToggle: false,
      items: [
        {
          icon: "users",
          title: { fr: "Groupes de parents" },
          text: { fr: "Des temps d'échange entre parents, animés par les centres sociaux du territoire." },
          href: "/actions/groupes",
        },
        {
          icon: "baby",
          title: { fr: "Lieux d'accueil enfants-parents" },
          text: { fr: "Des espaces de jeu et de parole pour les enfants de moins de 6 ans accompagnés d'un adulte." },
          href: "/actions/laep",
        },
        {
          icon: "graduation-cap",
          title: { fr: "Accompagnement à la scolarité" },
          text: { fr: "Un soutien aux enfants et une place reconnue aux parents dans le suivi de la scolarité." },
          href: "/actions/clas",
        },
      ],
    }}
  />
);

// Usage réel : annuaire des lieux (config tiers-lieux) — image + avatar + badges.
export const TiersLieux = () => (
  <CardsSection
    props={{
      variant: "tiers-lieux",
      layout: "grid",
      columns: 3,
      showHeader: true,
      headerTitle: { fr: "Les lieux du réseau" },
      showResultCount: true,
      showViewToggle: true,
      items: [
        {
          image: photo("#dbe3f5", "#4054b2"),
          title: { fr: "La Maison des Familles d'Arras" },
          text: { fr: "Lieu ressource ouvert à tous les parents." },
          location: { fr: "Arras — Centre-ville" },
          avatarIcon: "home",
          avatarColor: "blue",
          badges: [{ icon: "heart", label: "Suivre" }],
          href: "/lieux/maison-familles-arras",
        },
        {
          image: photo("#e7f0e4", "#3f7d4e"),
          title: { fr: "Centre social Chico Mendès" },
          text: { fr: "Ateliers parents-enfants chaque mercredi." },
          location: { fr: "Lens — Quartier de la Grande Résidence" },
          avatarIcon: "coffee",
          avatarColor: "green",
          badges: [{ icon: "heart", label: "Suivre" }],
          href: "/lieux/chico-mendes",
        },
        {
          image: photo("#f7ead9", "#b2743d"),
          title: { fr: "Espace de vie sociale du Ternois" },
          text: { fr: "Permanences d'écoute et café des parents." },
          location: { fr: "Saint-Pol-sur-Ternoise" },
          avatarIcon: "sun",
          avatarColor: "orange",
          badges: [{ icon: "heart", label: "Suivre" }],
          href: "/lieux/evs-ternois",
        },
      ],
    }}
  />
);

// Usage réel : agenda visuel (variant event) — date + organisateur.
export const Evenements = () => (
  <CardsSection
    props={{
      variant: "event",
      layout: "grid",
      columns: 3,
      showHeader: false,
      showResultCount: false,
      showViewToggle: false,
      items: [
        {
          image: photo("#e3ddf2", "#5d4a9c"),
          title: { fr: "Café des parents" },
          text: { fr: "Temps d'échange autour du sommeil du jeune enfant." },
          eventTitle: { fr: "Café des parents" },
          organizerName: { fr: "Centre social de Béthune" },
          location: { fr: "Béthune" },
          date: "12 sept. 2026",
          avatarIcon: "coffee",
          avatarColor: "purple",
          href: "/agenda/cafe-des-parents",
        },
        {
          image: photo("#dcedf0", "#2f7f8e"),
          title: { fr: "Semaine des familles" },
          text: { fr: "Ateliers, spectacles et jeux pour toute la famille." },
          eventTitle: { fr: "Semaine des familles" },
          organizerName: { fr: "Réseau Parentalité 62" },
          location: { fr: "Boulogne-sur-Mer" },
          date: "5 – 10 oct. 2026",
          avatarIcon: "users",
          avatarColor: "teal",
          href: "/agenda/semaine-des-familles",
        },
        {
          image: photo("#f5e2e0", "#a8443a"),
          title: { fr: "Conférence parentalité numérique" },
          text: { fr: "Écrans et adolescence : comprendre pour accompagner." },
          eventTitle: { fr: "Écrans & ados" },
          organizerName: { fr: "UDAF du Pas-de-Calais" },
          location: { fr: "Arras — Cité Nature" },
          date: "14 nov. 2026",
          avatarIcon: "message-circle",
          avatarColor: "red",
          href: "/agenda/ecrans-ados",
        },
      ],
    }}
  />
);

// Variante icon-card : accès rapides illustrés par icône.
export const CartesIcone = () => (
  <CardsSection
    props={{
      variant: "icon-card",
      layout: "grid",
      columns: 4,
      showHeader: false,
      showResultCount: false,
      showViewToggle: false,
      items: [
        { icon: "map-pin", title: { fr: "Près de chez vous" }, text: { fr: "Trouvez les actions de votre territoire." }, href: "/carte" },
        { icon: "calendar-days", title: { fr: "Agenda" }, text: { fr: "Les prochains rendez-vous du réseau." }, href: "/agenda" },
        { icon: "book-open", title: { fr: "Ressources" }, text: { fr: "Guides et outils pour les parents." }, href: "/ressources" },
        { icon: "phone", title: { fr: "Être écouté" }, text: { fr: "Les permanences d'écoute près de chez vous." }, href: "/ecoute" },
      ],
    }}
  />
);
