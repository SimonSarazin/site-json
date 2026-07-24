import { ContentSection } from "site-forge";

// Visuels : data-URI SVG uniquement (l'endpoint /img n'existe pas hors app).
const photo = (bg: string, fg: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="${bg}"/><circle cx="560" cy="180" r="110" fill="${fg}" opacity="0.75"/><rect x="90" y="380" width="420" height="30" rx="15" fill="${fg}" opacity="0.5"/><rect x="90" y="440" width="280" height="30" rx="15" fill="${fg}" opacity="0.35"/></svg>`
  );

// Usage réel : présentation du réseau (config parent62, page /reseau) —
// catégorie + stats + carte de liens, image à droite.
export const ImageDroite = () => (
  <ContentSection
    props={{
      category: { fr: "Qui sommes-nous ?" },
      title: { fr: "Un réseau piloté par la CAF, animé au quotidien" },
      description: {
        fr: "Le Réseau Parentalité 62 soutient les parents dans leur rôle éducatif, rompt l'isolement, valorise les ressources des familles et met en réseau les acteurs : associations et groupes de parents, centres sociaux, CAF, Éducation Nationale, Conseil Départemental, UDAF et collectivités locales.",
      },
      imagePosition: "right",
      image: photo("#dbe3f5", "#4054b2"),
      stats: [
        { value: "1", label: { fr: "pilote : la CAF du Pas-de-Calais" } },
        { value: "2", label: { fr: "coordonnateurs départementaux" } },
        { value: "9", label: { fr: "coordinations territoriales" } },
      ],
      links: [
        { label: { fr: "Rencontrer l'équipe" }, href: "/equipe" },
        { label: { fr: "Lire la charte du REAAP 62" }, href: "/charte" },
      ],
    }}
  />
);

// Image à gauche + tags + texte d'information + carrés décoratifs.
export const ImageGauche = () => (
  <ContentSection
    props={{
      category: { fr: "Nos actions" },
      title: { fr: "Des rencontres près de chez vous, toute l'année" },
      description: {
        fr: "Cafés des parents, ateliers parents-enfants, conférences et groupes de parole : chaque territoire construit son programme avec les familles. Toutes les actions sont gratuites et ouvertes à tous.",
      },
      imagePosition: "left",
      image: photo("#e7f0e4", "#3f7d4e"),
      tags: [
        { fr: "Cafés des parents" },
        { fr: "Ateliers en famille" },
        { fr: "Groupes de parole" },
        { fr: "Conférences" },
      ],
      infoText: { fr: "Programme mis à jour chaque trimestre par les coordinations territoriales." },
      decorativeElements: { type: "colored-squares" },
    }}
  />
);
