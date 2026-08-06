import { HeroCarousel } from "site-forge";

// Usage réel envisagé : home de RéseauSanté (type "hero-carousel") — les 4 thématiques
// de santé globale en diapositives, sur le modèle des heros `hero-tinted-overlay` des
// pages /theme/*.
//
// ⚠ Deux contraintes portées par ces fonds, pas décoratives :
//  - data-URI SVG obligatoire : OptimizedImage (donc HeroBackgroundImage) ne fonctionne
//    qu'avec des `src` en `data:` ou `.svg` dans le design-system ;
//  - MÊME taille intrinsèque pour toutes les diapositives (ici 1600×900). Le candidat
//    LCP n'est remplacé que par un élément PLUS GRAND : des tailles inégales feraient
//    basculer le LCP sur une diapositive affichée bien plus tard.
const fond = (ciel: string, sol: string, astre: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">` +
      `<rect width="100%" height="100%" fill="${ciel}"/>` +
      `<path d="M0 640 L220 500 L380 580 L540 450 L720 560 L920 420 L1120 540 L1320 460 L1600 580 V900 H0 Z" fill="${sol}"/>` +
      `<circle cx="1280" cy="190" r="88" fill="${astre}" opacity="0.35"/>` +
      `</svg>`
  );

const diapositives = [
  {
    headline: { fr: "Nutrition", en: "Nutrition" },
    subhead: {
      fr: "Jardins créoles, cuisine du quotidien, éducation au goût.",
      en: "Creole gardens, everyday cooking, taste education.",
    },
    backgroundImage: fond("#2f5d3a", "#22452c", "#f2e9c9"),
    backgroundImageAlt: { fr: "Paysage maraîcher stylisé", en: "Stylised market garden" },
    ctaLabel: { fr: "Voir les acteurs", en: "See the actors" },
    ctaPath: "/theme/nutrition",
  },
  {
    headline: { fr: "Activité physique", en: "Physical activity" },
    subhead: {
      fr: "Bouger chaque jour, à son rythme, près de chez soi.",
      en: "Move every day, at your own pace, close to home.",
    },
    backgroundImage: fond("#8c4a3f", "#6d382f", "#f6d9b0"),
    backgroundImageAlt: { fr: "Sentier de randonnée stylisé", en: "Stylised hiking trail" },
    ctaLabel: { fr: "Voir les acteurs", en: "See the actors" },
    ctaPath: "/theme/activite-physique",
  },
  {
    headline: { fr: "Sommeil", en: "Sleep" },
    subhead: { fr: "Mieux dormir, mieux vivre.", en: "Sleep better, live better." },
    backgroundImage: fond("#2b3a63", "#1e2a49", "#dfe6f5"),
    backgroundImageAlt: { fr: "Ciel nocturne stylisé", en: "Stylised night sky" },
    ctaLabel: { fr: "Voir les acteurs", en: "See the actors" },
    ctaPath: "/theme/sommeil",
  },
  {
    headline: { fr: "Bien-être mental", en: "Mental wellbeing" },
    subhead: {
      fr: "Écoute, entraide, lutte contre l'isolement.",
      en: "Listening, mutual aid, tackling isolation.",
    },
    backgroundImage: fond("#4a3a63", "#372b49", "#efe4f7"),
    backgroundImageAlt: { fr: "Cercle de parole stylisé", en: "Stylised talking circle" },
    ctaLabel: { fr: "Voir les acteurs", en: "See the actors" },
    ctaPath: "/theme/bien-etre-mental",
  },
];

// `autoplay` reste à false : c'est le défaut du composant, ET la condition d'une capture
// déterministe pour le design-system — une rotation ferait varier l'image d'un rendu à
// l'autre. C'est aussi la recommandation de fond : les carrousels statiques sont cliqués
// environ deux fois plus que les rotatifs.
export const CinqPortes = () => (
  <HeroCarousel
    props={{
      badge: { fr: "Santé globale · La Réunion", en: "Global health · Reunion Island" },
      slides: diapositives,
      autoplay: false,
      ariaLabel: { fr: "Les thématiques du réseau", en: "Network topics" },
    }}
  />
);

// Diapositive unique : puces et flèches disparaissent, la section se comporte alors comme
// un hero plein écran ordinaire. C'est le cas de dégradation à ne pas casser.
export const Unique = () => (
  <HeroCarousel
    props={{
      slides: [diapositives[0]],
      autoplay: false,
    }}
  />
);
