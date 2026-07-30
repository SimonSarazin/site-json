import { HeroParallax } from "site-forge";

// Usage réel : home de Rézo la mer / Cyber Réunion (type "hero-parallax").
// Fond en data-URI (l'endpoint /img n'existe pas hors app) — formes plates sans
// parenthèses (le SVG passe dans un attribut src, mais on reste prudent).
const oceanBg =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="100%" height="100%" fill="#0d4a75"/><circle cx="1220" cy="210" r="220" fill="#1d7db0" opacity="0.55"/><circle cx="360" cy="680" r="280" fill="#0a3a5e" opacity="0.7"/><path d="M0 640 Q 400 560 800 640 T 1600 640 V 900 H 0 Z" fill="#0a3a5e" opacity="0.5"/></svg>'
  );

const wavesIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>';

const anchorIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/></svg>';

const fishIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M2 12s2-4 4.5-4S2 12 2 12s2 4 4.5 4S2 12 2 12Z"/></svg>';

export const Ocean = () => (
  <HeroParallax
    props={{
      headline: { fr: "Rézo la mer" },
      subhead: { fr: "Outiller et connecter le réseau de passionné·es de la mer pour construire ensemble un océan vivant et résilient." },
      logoIcon: wavesIcon,
      backgroundImage: oceanBg,
      backgroundImageAlt: { fr: "Fond océan stylisé" },
      badges: [
        { label: { fr: "Réseau littoral atlantique" }, icon: anchorIcon },
        { label: { fr: "120 projets accompagnés" }, icon: fishIcon },
      ],
      ctaButtons: [
        { label: { fr: "Découvrir le réseau" }, path: "/explorer", variant: "default" },
        { label: { fr: "Proposer un projet" }, path: "/proposer-projet", variant: "secondary" },
      ],
      showScrollIndicator: true,
    }}
  />
);

export const AccentSansImage = () => (
  <HeroParallax
    props={{
      variant: "accent",
      headline: { fr: "Jardins Communs" },
      subhead: { fr: "La coopérative citoyenne d'une agriculture nourricière et solidaire dans l'océan Indien." },
      logoIcon:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8Z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-3.7.3-4.6 1.4-4.9 2Z"/></svg>',
      ctaButtons: [{ label: { fr: "Rejoindre la coopérative" }, path: "/adherer", variant: "accent" }],
      showScrollIndicator: false,
    }}
  />
);
