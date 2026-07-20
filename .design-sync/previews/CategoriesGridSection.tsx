import { CategoriesGridSection } from "site-forge";

// Usage réel : grille de thématiques (config sport-sante / equipements-sportifs),
// transposée réseau parentalité.
export const Thematiques = () => (
  <CategoriesGridSection
    props={{
      headline: { fr: "Les grandes thématiques du réseau" },
      subhead: { fr: "Des actions pour chaque étape de la vie de famille, portées par les acteurs du Pas-de-Calais." },
      variant: "primary",
      columns: 3,
      cards: [
        { icon: "baby", title: { fr: "Petite enfance" }, subtitle: { fr: "0 – 6 ans" }, link: "/thematiques/petite-enfance" },
        { icon: "graduation-cap", title: { fr: "Scolarité" }, subtitle: { fr: "Accompagnement et lien école-famille" }, link: "/thematiques/scolarite" },
        { icon: "smartphone", title: { fr: "Numérique" }, subtitle: { fr: "Écrans et usages en famille" }, link: "/thematiques/numerique" },
        { icon: "heart-handshake", title: { fr: "Soutien aux parents" }, subtitle: { fr: "Écoute, répit, entraide" }, link: "/thematiques/soutien" },
        { icon: "users-round", title: { fr: "Adolescence" }, subtitle: { fr: "Dialogue et prévention" }, link: "/thematiques/adolescence" },
        { icon: "puzzle", title: { fr: "Handicap" }, subtitle: { fr: "Parentalité et besoins spécifiques" }, link: "/thematiques/handicap" },
      ],
    }}
  />
);

// Variante frosted (verre dépoli) : 4 colonnes, cartes minimalistes.
export const Givre = () => (
  <CategoriesGridSection
    props={{
      headline: { fr: "Un réseau, dix territoires" },
      variant: "frosted",
      columns: 4,
      cards: [
        { icon: "map-pin", title: { fr: "Arrageois" }, subtitle: { fr: "Arras et ses environs" } },
        { icon: "map-pin", title: { fr: "Artois" }, subtitle: { fr: "Béthune – Bruay" } },
        { icon: "map-pin", title: { fr: "Boulonnais" }, subtitle: { fr: "Boulogne-sur-Mer" } },
        { icon: "map-pin", title: { fr: "Ternois" }, subtitle: { fr: "Saint-Pol-sur-Ternoise" } },
      ],
    }}
  />
);
