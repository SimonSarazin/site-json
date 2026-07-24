import { HeroWithIconSection } from "site-forge";

// Type "heroWithIcon" — icône lucide (DynamicIcon) dans une pastille primaire.
// Pas d'image de fond : la section vit très bien sur le fond du thème.
export const AvecIcone = () => (
  <HeroWithIconSection
    props={{
      headline: { fr: "Le sport-santé près de chez vous" },
      subhead: { fr: "Trouvez une activité physique adaptée, encadrée par des éducateurs formés, partout sur le territoire." },
      icon: { show: true, name: "heart-pulse", size: 64, backdrop: true },
      align: "center",
      overlay: false,
      cta: [
        { label: { fr: "Trouver une activité" }, href: "/activites" },
        { label: { fr: "Devenir structure partenaire" }, href: "/partenaires", variant: "secondary" },
      ],
    }}
  />
);

export const AvecListe = () => (
  <HeroWithIconSection
    props={{
      headline: { fr: "Des tiers-lieux vivants, partout" },
      subhead: { fr: "Cartographie, ressources et communauté des lieux partagés en France." },
      icon: { show: true, name: "map-pin", size: 56, backdrop: false },
      align: "center",
      overlay: false,
      listContent: {
        layout: "rows",
        items: [
          { title: { fr: "180 lieux référencés" }, icon: "map-pin", iconPosition: "left" },
          { title: { fr: "40 réseaux territoriaux" }, icon: "users", iconPosition: "left" },
          { title: { fr: "Ouvert à toutes et tous" }, icon: "door-open", iconPosition: "left" },
        ],
      },
    }}
  />
);
