import { HeroQuickAccess } from "site-forge";

// Usage réel : home parent62 (cartes public/pro) et equipements-Sportifs
// (cartes-raccourci label + icon seuls). Type "hero-quick-access".
const carteBg =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="100%" height="100%" fill="#dce7f7"/><circle cx="1180" cy="260" r="150" fill="#9db9e8" opacity="0.8"/><circle cx="1330" cy="480" r="110" fill="#7fa4de" opacity="0.7"/><circle cx="1050" cy="560" r="90" fill="#b7ccf0" opacity="0.9"/><circle cx="1250" cy="700" r="70" fill="#8fb0e4" opacity="0.8"/></svg>'
  );

const heartIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';

const usersIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';

const mapIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';

const calendarIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>';

export const AvecCartes = () => (
  <HeroQuickAccess
    props={{
      headline: { fr: "Le réseau des parents du Pas-de-Calais" },
      backgroundImage: carteBg,
      backgroundImageAlt: { fr: "Carte du département, territoires en bulles colorées" },
      backgroundPosition: "right center",
      overlayOpacity: "62%",
      quickAccessCards: [
        {
          path: "/parents",
          label: { fr: "Je suis parent" },
          title: { fr: "Trouver de l'aide" },
          description: { fr: "Ateliers et lieux d'accueil parents-enfants près de chez vous." },
          icon: heartIcon,
        },
        {
          path: "/professionnels",
          label: { fr: "Je suis professionnel·le" },
          title: { fr: "Rejoindre le réseau" },
          description: { fr: "Ressources, formations et rencontres entre acteurs." },
          icon: usersIcon,
        },
      ],
    }}
  />
);

export const RaccourcisSimples = () => (
  <HeroQuickAccess
    props={{
      headline: { fr: "Tous les équipements sportifs de la commune, en un coup d'œil" },
      subhead: { fr: "Recherchez, filtrez et localisez chaque équipement sportif. Ajoutez vos sites en quelques clics." },
      quickAccessCards: [
        { path: "/carte", label: { fr: "La carte" }, icon: mapIcon },
        { path: "/annuaire", label: { fr: "L'annuaire" }, icon: usersIcon },
        { path: "/agenda", label: { fr: "L'agenda" }, icon: calendarIcon },
        { path: "/ajouter", label: { fr: "Ajouter un lieu" }, icon: heartIcon },
      ],
    }}
  />
);
