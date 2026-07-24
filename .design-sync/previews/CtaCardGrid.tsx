import { CtaCardGrid } from "site-forge";

// Type "cta-card-grid" — usage réel : « Rejoignez la communauté » (Rézo la mer,
// Cyber Réunion). Icônes lucide en nom canonique kebab-case (DynamicIcon).
// 3 cellules courtes : actions / image accent / stats — l'image (h-100) et les
// stats ensemble dépassent la hauteur de la fiche.
const communauteImg =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="640"><rect width="100%" height="100%" fill="#bcd7e8"/><path d="M0 420 Q 400 340 800 420 T 1600 420 V 640 H 0 Z" fill="#5d99c0"/><path d="M0 500 Q 400 440 800 500 T 1600 500 V 640 H 0 Z" fill="#2e6f9e" opacity="0.85"/><circle cx="1240" cy="180" r="90" fill="#f4e9c8"/></svg>'
  );

export const Communaute = () => (
  <CtaCardGrid
    props={{
      headline: { fr: "Rejoignez la communauté" },
      subhead: { fr: "Ensemble, nous construisons un écosystème vivant au service de l'océan." },
      actions: [
        {
          icon: "anchor",
          title: { fr: "Proposer un projet" },
          description: { fr: "Partagez votre initiative et trouvez du soutien dans le réseau." },
          ctaLabel: { fr: "Soumettre un projet" },
          href: "/proposer-projet",
        },
        {
          icon: "lightbulb",
          title: { fr: "Contribuer aux données" },
          description: { fr: "Participez à la science citoyenne océanique près de chez vous." },
          ctaLabel: { fr: "Participer" },
          href: "/participer",
        },
      ],
    }}
  />
);

export const AccentAvecImage = () => (
  <CtaCardGrid
    props={{
      variant: "accent",
      headline: { fr: "La coopérative en images" },
      subhead: { fr: "Une agriculture nourricière, locale et solidaire dans l'océan Indien." },
      image: communauteImg,
      imageAlt: { fr: "Littoral stylisé au soleil couchant" },
    }}
  />
);

export const Chiffres = () => (
  <CtaCardGrid
    props={{
      headline: { fr: "Le réseau en chiffres" },
      stats: [
        { value: "34", label: { fr: "Fermes accompagnées" }, color: "primary" },
        { value: "1 200", label: { fr: "Coopérateur·rices" }, color: "accent" },
        { value: "18 ha", label: { fr: "Terres cultivées" }, color: "chart-2" },
        { value: "6", label: { fr: "Îles partenaires" }, color: "primary" },
      ],
    }}
  />
);
