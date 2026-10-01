import { ActionTiles } from "site-forge";

// Type "action-tiles" — usage réel : « Explorer par thème » (parent62) et
// « Passez à l'action » (Rézo la mer). Icônes lucide canoniques (DynamicIcon).
export const ParTheme = () => (
  <ActionTiles
    props={{
      headline: { fr: "Explorer par thème" },
      subhead: { fr: "Des ressources et des actions pour chaque étape de la vie de parent." },
      columns: { sm: 2, lg: 4 },
      actions: [
        {
          icon: "baby",
          title: { fr: "La petite enfance" },
          subtitle: { fr: "0-6 ans" },
          href: "/theme/la-petite-enfance",
          color: "primary",
        },
        {
          icon: "users",
          title: { fr: "L'adolescence" },
          subtitle: { fr: "Grandir ensemble" },
          href: "/theme/ladolescence",
          color: "teal",
        },
        {
          icon: "heart-pulse",
          title: { fr: "La santé" },
          subtitle: { fr: "Bien-être des familles" },
          href: "/theme/la-sante",
          color: "chart-2",
        },
        {
          icon: "accessibility",
          title: { fr: "Le handicap" },
          subtitle: { fr: "Accompagner chacun" },
          href: "/theme/le-handicap",
          color: "accent",
        },
      ],
    }}
  />
);

export const TroisColonnesFondMuted = () => (
  <ActionTiles
    props={{
      headline: { fr: "Passez à l'action" },
      subhead: { fr: "Engagez-vous concrètement pour l'océan selon vos envies et disponibilités." },
      bg: "muted",
      columns: { sm: 2, lg: 3 },
      actions: [
        {
          icon: "sprout",
          title: { fr: "Soumettre un projet" },
          subtitle: { fr: "Proposez votre initiative" },
          href: "/proposer-projet",
          color: "eco",
        },
        {
          icon: "users",
          title: { fr: "Participer" },
          subtitle: { fr: "Études participatives" },
          href: "/participer",
          color: "primary",
        },
        {
          icon: "coins",
          title: { fr: "Co-financer" },
          subtitle: { fr: "Soutenir les actions" },
          href: "/cofinancer",
          color: "amber",
        },
      ],
    }}
  />
);

// Usage réel : « Par où commencer ? » de /parents (parent62) — grandes tuiles sur grille élargie, fond plein
// de marque et son encre (jetons de index-parent62.css, contraste mesuré 7,56:1).
export const GrandesTuilesFondPlein = () => (
  <ActionTiles
    props={{
      headline: { fr: "Par où commencer ?" },
      columns: { sm: 2, lg: 4 },
      size: "lg",
      width: "wide",
      actions: [
        {
          icon: "message-circle-heart",
          title: { fr: "Retrouvez des témoignages de parents du Pas-de-Calais" },
          subtitle: { fr: "Des audios et des écrits pour découvrir leurs réalités." },
          href: "/temoignages",
          background: "var(--p62-vert)",
          textColor: "var(--p62-vert-encre)",
        },
        {
          icon: "search",
          title: { fr: "Trouver une action près de chez moi" },
          subtitle: { fr: "Mise en place par les partenaires du territoire" },
          href: "/recherche",
          background: "var(--p62-vert)",
          textColor: "var(--p62-vert-encre)",
        },
        {
          icon: "calendar",
          title: { fr: "Voir l'agenda" },
          subtitle: { fr: "La semaine ou le weekend, découvrez les actions proches de chez vous" },
          href: "/agenda",
          background: "var(--p62-vert)",
          textColor: "var(--p62-vert-encre)",
        },
        {
          icon: "folder",
          title: { fr: "Ressources" },
          subtitle: { fr: "Retrouvez ici des outils, des sites ressources et des contacts de partenaires" },
          href: "/ressources",
          background: "var(--p62-vert)",
          textColor: "var(--p62-vert-encre)",
        },
      ],
    }}
  />
);
