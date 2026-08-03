import { HeroTintedOverlay } from "site-forge";

// Usage réel : home de Nos Communes (type "hero-tinted-overlay") — texte blanc
// sur image + voile bg-hero-tint. Fond sombre en data-URI pour garantir le contraste.
const communeBg =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="100%" height="100%" fill="#1f4d3a"/><path d="M0 620 L200 480 L360 560 L520 430 L700 540 L900 400 L1100 520 L1300 440 L1600 560 V 900 H 0 Z" fill="#173a2c"/><circle cx="1250" cy="200" r="90" fill="#f2e9c9" opacity="0.35"/></svg>'
  );

export const MouvementCitoyen = () => (
  <HeroTintedOverlay
    props={{
      badge: { fr: "Le Mouvement national de réappropriation" },
      headline: { fr: "Nos Communes" },
      subhead: { fr: "À celles et ceux qui, par leur engagement, font exister les communes" },
      tagline: { fr: "Les communes, c'est nous." },
      taglineSubtext: { fr: "Pourquoi élire des élus si on peut construire un territoire transparent avec un conseil citoyen permanent ?" },
      backgroundImage: communeBg,
      backgroundImageAlt: { fr: "Paysage de village stylisé" },
      ctaButtons: [{ label: { fr: "+ Inviter ma commune" }, path: "/inviter" }],
    }}
  />
);

export const Minimal = () => (
  <HeroTintedOverlay
    props={{
      headline: { fr: "Un jardin partagé dans chaque quartier" },
      subhead: { fr: "Cultiver ensemble, récolter pour tous" },
      backgroundImage: communeBg,
      backgroundImageAlt: { fr: "Collines vertes stylisées" },
      ctaButtons: [{ label: { fr: "Trouver un jardin" }, path: "/jardins" }],
    }}
  />
);
