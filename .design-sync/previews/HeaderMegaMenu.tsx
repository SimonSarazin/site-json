import { HeaderMegaMenu } from "site-forge";

// Header méga-menu (design "mega-menu") — la nav desktop n'apparaît qu'à xl
// (≥1280px) : à la largeur de capture (900px) la barre montre l'état tablette
// réel = marque + burger. Les panneaux méga-menu sont hover-only (non capturables).
const svg = (s: string) => "data:image/svg+xml," + encodeURIComponent(s);

const logoMer = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="170" height="44" viewBox="0 0 170 44"><path d="M6 28 q7 -9 14 0 q7 9 14 0 q7 -9 14 0" stroke="#0e7490" stroke-width="4" fill="none" stroke-linecap="round"/><text x="58" y="29" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#164e63">R&#233;zo la Mer</text></svg>'
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

const navMer = [
  {
    label: { fr: "Découvrir" },
    featured: true,
    path: "/decouvrir",
    children: [
      { label: { fr: "Tout le réseau" }, path: "/decouvrir" },
      { label: { fr: "Les ports partenaires" }, path: "/ports", description: { fr: "Boulogne, Étaples, Le Portel…" } },
      { label: { fr: "Métiers de la mer" }, path: "/metiers", description: { fr: "Pêche, mareyage, formation" } },
      { label: { fr: "Actualités du littoral" }, path: "/actualites", description: { fr: "La vie du réseau au fil de l'eau" } },
    ],
  },
  {
    label: { fr: "Agir" },
    children: [
      { label: { fr: "Rejoindre un équipage" }, path: "/equipages", description: { fr: "Bénévolat et entraide entre gens de mer" } },
      { label: { fr: "Proposer une sortie" }, path: "/sorties", description: { fr: "Découvertes du littoral pour les familles" } },
    ],
  },
  { label: { fr: "Agenda" }, path: "/agenda" },
];

export const MarqueImage = () => (
  <HeaderMegaMenu
    header={{
      type: "mega-menu",
      logo: logoMer,
      logoAlt: { fr: "Rézo la Mer" },
      logoSize: "md",
      nav: navMer,
      sticky: true,
      transparent: false,
      height: "md",
      utilities: utilitiesOff,
    }}
  />
);

export const MarqueIcone = () => (
  <HeaderMegaMenu
    header={{
      type: "mega-menu",
      logoIcon: "waves",
      logoIconTone: "primary",
      nav: [
        { label: { fr: "Le littoral" }, path: "/littoral" },
        {
          label: { fr: "Ressources" },
          children: [
            { label: { fr: "Cartographie" }, path: "/carte", description: { fr: "Les acteurs de la mer près de chez vous" } },
            { label: { fr: "Documentation" }, path: "/docs", description: { fr: "Guides et fiches pratiques" } },
          ],
        },
        { label: { fr: "Contact" }, path: "/contact" },
      ],
      sticky: true,
      transparent: false,
      height: "md",
      utilities: utilitiesOff,
    }}
  />
);
