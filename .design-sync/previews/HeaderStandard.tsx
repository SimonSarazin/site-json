import { HeaderStandard } from "site-forge";

// Header horizontal sticky (design "standard") — barre bg-background bordée,
// nav desktop visible dès md (capture 900px). Utilities TOUTES à false
// (déterminisme : pas de widgets auth/notifications/thème).
const svg = (s: string) => "data:image/svg+xml," + encodeURIComponent(s);

const logoParents = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 150 40"><circle cx="20" cy="20" r="14" fill="#4f46e5"/><circle cx="32" cy="11" r="6" fill="#818cf8"/><text x="44" y="26" font-family="Arial, sans-serif" font-size="17" font-weight="bold" fill="#1e1b4b">Parents 62</text></svg>'
);

const utilitiesOff = {
  themeSwitch: false,
  langSwitch: false,
  search: false,
  auth: false,
  cart: false,
  notifications: false,
  piggyBank: false,
};

export const AvecAnnonce = () => (
  <HeaderStandard
    header={{
      type: "standard",
      logo: logoParents,
      logoAlt: { fr: "Parents 62" },
      nav: [
        { label: { fr: "Accueil" }, path: "/" },
        { label: { fr: "Le réseau" }, path: "/reseau" },
        { label: { fr: "Ateliers" }, path: "/ateliers", badge: { text: { fr: "Nouveau" } } },
        {
          label: { fr: "Ressources" },
          children: [
            { label: { fr: "Guides parentalité" }, path: "/ressources/guides", description: { fr: "Fiches pratiques par âge" } },
            { label: { fr: "Annuaire des structures" }, path: "/ressources/annuaire", description: { fr: "Les lieux d'accueil près de chez vous" } },
            { label: { fr: "Questions fréquentes" }, path: "/ressources/faq" },
          ],
        },
      ],
      sticky: true,
      transparent: false,
      height: "md",
      utilities: utilitiesOff,
      announcement: {
        text: { fr: "Semaine de la parentalité du 12 au 18 octobre — le programme territoire par territoire" },
        href: "/agenda",
        dismissible: true,
        variant: "info",
      },
    }}
  />
);

export const AvecMegaMenu = () => (
  <HeaderStandard
    header={{
      type: "standard",
      logoIcon: "building-2",
      logoIconTone: "primary",
      nav: [
        { label: { fr: "Accueil" }, path: "/", icon: "house" },
        {
          label: { fr: "Les lieux" },
          megaMenu: {
            width: "md",
            columns: [
              {
                title: { fr: "Explorer" },
                links: [
                  { label: { fr: "Carte des tiers-lieux" }, path: "/lieux", icon: "map-pin" },
                  { label: { fr: "Par territoire" }, path: "/territoires" },
                  { label: { fr: "Labels & réseaux" }, path: "/labels" },
                ],
              },
              {
                title: { fr: "Participer" },
                links: [
                  { label: { fr: "Proposer un lieu" }, path: "/proposer" },
                  { label: { fr: "Devenir bénévole" }, path: "/benevolat" },
                ],
              },
            ],
          },
        },
        { label: { fr: "Agenda" }, path: "/agenda" },
        { label: { fr: "Contact" }, path: "/contact" },
      ],
      sticky: true,
      transparent: false,
      height: "lg",
      utilities: utilitiesOff,
    }}
  />
);

export const CompactIcone = () => (
  <HeaderStandard
    header={{
      type: "standard",
      logoIcon: "heart-handshake",
      logoIconTone: "primary",
      nav: [
        { label: { fr: "Le réseau" }, path: "/reseau" },
        { label: { fr: "Trouver de l'aide" }, path: "/aide" },
        { label: { fr: "Contact" }, path: "/contact" },
      ],
      sticky: false,
      transparent: false,
      height: "sm",
      utilities: utilitiesOff,
    }}
  />
);
