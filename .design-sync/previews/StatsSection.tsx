import { StatsSection } from "site-forge";

// `animated: false` → valeurs finales affichées immédiatement (capture nette,
// pas de compteur JS à mi-course).
export const Horizontal = () => (
  <StatsSection
    props={{
      layout: "horizontal",
      animated: false,
      items: [
        { value: "10", label: { fr: "territoires" }, description: { fr: "couvrant tout le Pas-de-Calais" }, icon: "map" },
        { value: "350+", label: { fr: "structures membres" }, description: { fr: "associations, centres sociaux, institutions" }, icon: "building-2" },
        { value: "1 200", label: { fr: "actions par an" }, description: { fr: "ateliers, cafés des parents, conférences" }, icon: "calendar-days" },
        { value: "25 000", label: { fr: "familles touchées" }, description: { fr: "sur l'ensemble du département" }, icon: "users" },
      ],
    }}
  />
);

// Layout vertical : icône à gauche, texte aligné à gauche, 2 colonnes.
export const Vertical = () => (
  <StatsSection
    props={{
      layout: "vertical",
      animated: false,
      items: [
        { value: "9", label: { fr: "coordinations territoriales" }, description: { fr: "un interlocuteur dédié par bassin de vie" }, icon: "map-pin" },
        { value: "8", label: { fr: "valeurs partagées" }, description: { fr: "inscrites dans la charte du REAAP 62" }, icon: "heart" },
        { value: "27", label: { fr: "années d'existence" }, description: { fr: "depuis la circulaire fondatrice de 1999" }, icon: "history" },
        { value: "100 %", label: { fr: "d'actions gratuites" }, description: { fr: "ouvertes à toutes les familles" }, icon: "hand-heart" },
      ],
    }}
  />
);

// Design `tiles` : tuiles arrondies, la première sur l'aplat primaire. Valeurs ÉCRITES ici
// (une story ne fetch pas) ; en config, chaque tuile porte plutôt `source` — compte vivant.
// Usage réel : « Le réseau en direct » de l'accueil d'Open Atlas.
export const Tiles = () => (
  <StatsSection
    props={{
      design: "tiles",
      layout: "horizontal",
      animated: false,
      columns: { sm: 3 },
      items: [
        { value: "144", label: { fr: "projets publiés" }, highlight: true },
        { value: "91", label: { fr: "membres" } },
        { value: "18", label: { fr: "organisations" } },
      ],
    }}
  />
);
