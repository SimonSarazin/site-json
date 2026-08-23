import { HeaderStacked } from "site-forge";

// Header "stacked" : 2 bandeaux sur image de fond — logo + wordmark plein écran
// (`50vh`) centrés, PUIS la nav en dessous. Au scroll, la section 1 collapse à 0
// et le logo remonte dans la barre compacte (même mécanique que
// HeaderTransparentScroll, cf. useScrollAware). `backgroundImage` habille les
// deux bandeaux ; le composant réserve lui-même son spacer (le header est
// `fixed`) — pas besoin d'un wrapper dédié comme les autres headers `fixed`.
const svg = (s: string) => "data:image/svg+xml," + encodeURIComponent(s);

const fondPhoto = svg(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1fae98"/><stop offset="1" stop-color="#0f3d3a"/></linearGradient></defs><rect width="1440" height="900" fill="url(#g)"/><circle cx="1180" cy="180" r="260" fill="#ffffff" fill-opacity="0.08"/><circle cx="220" cy="760" r="320" fill="#000000" fill-opacity="0.12"/></svg>'
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

export const SurImage = () => (
  <HeaderStacked
    header={{
      type: "stacked",
      backgroundImage: fondPhoto,
      textColor: "#0f3d3a",
      logoIcon: "compass",
      logoTitle: { fr: "sentiers" },
      // Wordmark 2 segments : `logoTitle` (contour, `textColor`) + `logoTitleAccent`
      // (plein, blanc fixe) — cf. commentaire du composant.
      logoTitleAccent: { fr: "solidaires" },
      logoSubtitle: { fr: "Un réseau de bénévoles\npour l'entretien des chemins du territoire" },
      nav: [
        { label: { fr: "Le réseau" }, path: "/reseau" },
        {
          label: { fr: "Territoires" },
          path: "/territoires/nord",
          children: [
            { label: { fr: "Nord" }, path: "/territoires/nord", icon: "map-pin" },
            { label: { fr: "Sud" }, path: "/territoires/sud", icon: "map-pin" },
          ],
        },
        { label: { fr: "Agenda" }, path: "/agenda" },
      ],
      sticky: true,
      transparent: true,
      height: "md",
      utilities: utilitiesOff,
    }}
  />
);
