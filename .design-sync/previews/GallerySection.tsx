import { GallerySection } from "site-forge";

// Photos : data-URI SVG (aplat pastel + formes) — l'endpoint /img n'existe pas hors app.
const photo = (bg: string, fg: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="100%" height="100%" fill="${bg}"/><circle cx="430" cy="170" r="90" fill="${fg}" opacity="0.75"/><rect x="70" y="380" width="300" height="26" rx="13" fill="${fg}" opacity="0.45"/><rect x="70" y="430" width="190" height="26" rx="13" fill="${fg}" opacity="0.3"/></svg>`
  );

// Galerie 3 colonnes avec légendes : retour en images d'un temps fort du réseau.
export const SemaineDesFamilles = () => (
  <GallerySection
    props={{
      columns: 3,
      lightbox: true,
      images: [
        { src: photo("#dbe3f5", "#4054b2"), alt: { fr: "Atelier parents-enfants" }, caption: { fr: "Atelier motricité à Arras" } },
        { src: photo("#e7f0e4", "#3f7d4e"), alt: { fr: "Café des parents" }, caption: { fr: "Café des parents, Lens" } },
        { src: photo("#f7ead9", "#b2743d"), alt: { fr: "Spectacle jeune public" }, caption: { fr: "Spectacle à Boulogne-sur-Mer" } },
        { src: photo("#e3ddf2", "#5d4a9c"), alt: { fr: "Conférence parentalité" }, caption: { fr: "Conférence « Écrans et ados »" } },
        { src: photo("#dcedf0", "#2f7f8e"), alt: { fr: "Forum des initiatives" }, caption: { fr: "Forum des initiatives, Calais" } },
        { src: photo("#f5e2e0", "#a8443a"), alt: { fr: "Jeux en famille" }, caption: { fr: "Après-midi jeux, Ternois" } },
      ],
    }}
  />
);

// Galerie 2 colonnes sans légendes ni lightbox (usage éditorial simple).
export const DeuxColonnes = () => (
  <GallerySection
    props={{
      columns: 2,
      lightbox: false,
      images: [
        { src: photo("#dbe3f5", "#4054b2"), alt: { fr: "Rencontre départementale" } },
        { src: photo("#e7f0e4", "#3f7d4e"), alt: { fr: "Groupe de parole" } },
        { src: photo("#f7ead9", "#b2743d"), alt: { fr: "Atelier cuisine en famille" } },
        { src: photo("#e3ddf2", "#5d4a9c"), alt: { fr: "Sortie nature parents-enfants" } },
      ],
    }}
  />
);
