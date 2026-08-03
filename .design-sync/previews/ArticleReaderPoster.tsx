import { ArticleReaderPoster } from "site-forge";

// Lecteur « poster » : la couverture (affiche A4, flyer WordPress importé) est
// montrée EN ENTIER, ratio naturel sur fond flou — pas de recadrage 16/9.
// Cellule de capture ~700px : l affiche A4 a une taille intrinsèque réduite
// (297x420) pour laisser la place au titre/méta/chapo dans la story.

const afficheA4 =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="297" height="420">` +
      `<rect width="297" height="420" fill="#334e7d"/>` +
      `<rect x="18" y="18" width="261" height="384" fill="none" stroke="#f4c95d" stroke-width="3"/>` +
      `<circle cx="148" cy="115" r="46" fill="#f4c95d"/>` +
      `<circle cx="135" cy="109" r="40" fill="#334e7d"/>` +
      `<text x="148" y="210" font-family="sans-serif" font-size="27" font-weight="bold" fill="#ffffff" text-anchor="middle">ATELIER</text>` +
      `<text x="148" y="244" font-family="sans-serif" font-size="27" font-weight="bold" fill="#ffffff" text-anchor="middle">SOMMEIL</text>` +
      `<text x="148" y="295" font-family="sans-serif" font-size="15" fill="#ffffff" text-anchor="middle">Samedi 14 juin - 10h a 12h</text>` +
      `<text x="148" y="320" font-family="sans-serif" font-size="15" fill="#ffffff" text-anchor="middle">Maison des familles - Arras</text>` +
      `<rect x="89" y="348" width="118" height="27" rx="13" fill="#f4c95d"/>` +
      `<text x="148" y="366" font-family="sans-serif" font-size="13" fill="#1f2937" text-anchor="middle">Entree libre</text>` +
    `</svg>`
  );

const flyerPaysage =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400">` +
      `<rect width="900" height="400" fill="#7c4d8f"/>` +
      `<circle cx="760" cy="90" r="56" fill="#f4c95d"/>` +
      `<text x="60" y="180" font-family="sans-serif" font-size="58" font-weight="bold" fill="#ffffff">Fete du jeu 2025</text>` +
      `<text x="60" y="250" font-family="sans-serif" font-size="30" fill="#ffffff">Dimanche 22 juin - parc des Iles - gratuit</text>` +
    `</svg>`
  );

const atelier = {
  id: "poi-atelier-sommeil",
  name: "Atelier sommeil : accompagner les nuits des tout-petits",
  shortDescription:
    "Un temps d'échange animé par une puéricultrice du réseau : cycles du sommeil, rituels du coucher, réveils nocturnes.",
  created: 1749686400, // 12 juin 2025
  profilImageUrl: afficheA4,
  parent: { org1: { type: "organizations", name: "Réseau Parentalité 62" } },
};

const flyer = {
  id: "poi-fete-jeu",
  name: "Fête du jeu : une journée pour jouer en famille",
  created: 1746662400, // 8 mai 2025
  tags: ["Événement"],
  profilImageUrl: flyerPaysage,
  parent: { org1: { type: "organizations", name: "Réseau Parentalité 62" } },
};

export const Affiche = () => (
  <div style={{ maxWidth: 700, margin: "0 auto" }}>
    <ArticleReaderPoster article={atelier} hideBack />
  </div>
);

export const FlyerSeul = () => (
  <div style={{ maxWidth: 700, margin: "0 auto" }}>
    <ArticleReaderPoster article={flyer} hideBack />
  </div>
);
