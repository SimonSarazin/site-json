import { SearchBubbleChart } from "site-forge";

// Chart de bulles d3 (pack hierarchy) des résultats de recherche : bulles =
// items (vignette ou initiales), cercles pointillés = groupes (pays/région ou
// type d'acteur), sidebar de zoom par groupe avec compteurs. Un item n'est
// affiché que si un de ses tags matche `categories`.
//
// Astuce capture : getBaseUrl() préfixe toute URL d'image ne commençant pas
// par http — on détourne la base vers "data:image/svg+xml," pour que les
// vignettes data-URI passent intactes (aucun réseau).
if (typeof window !== "undefined") {
  (window as unknown as { __ENV__: Record<string, string> }).__ENV__ = {
    VITE_BASE_URL_BACKEND: "data:image/svg+xml,",
  };
}

// Corps SVG encodé (sans le préfixe data:, fourni par la base ci-dessus).
const vignette = (bg: string, initiales: string) =>
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='${bg}'/><text x='40' y='41' font-family='sans-serif' font-size='30' font-weight='700' fill='#ffffff' text-anchor='middle' dominant-baseline='central'>${initiales}</text></svg>`
  );

const TEINTES = ["#6366f1", "#0d9488", "#f59e0b", "#ec4899", "#8b5cf6", "#0ea5e9", "#84cc16", "#f97316"];

let seq = 0;
const item = (name: string, region: string, ville: string, tags: string[]) => {
  const initiales = name
    .split(" ")
    .filter((m) => m.length > 2 || /^[A-Z]/.test(m))
    .map((m) => m[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  seq += 1;
  return {
    serverData: {
      _id: { $id: `mock-${seq}` },
      name,
      slug: `mock-${seq}`,
      tags,
      profilImageUrl: vignette(TEINTES[seq % TEINTES.length], initiales),
      address: { level1Name: region, addressCountry: "France", addressLocality: ville },
    },
  };
};

// Réseau parentalité / tiers-lieux : 24 structures sur 4 régions.
const THEMES = ["Parentalité", "Tiers-lieux", "Éducation populaire", "Inclusion numérique"];

const resultats = [
  item("La Maison des Familles", "Bretagne", "Brest", ["Parentalité"]),
  item("Café des Parents", "Bretagne", "Quimper", ["Parentalité"]),
  item("Grandir Ensemble", "Bretagne", "Rennes", ["Parentalité", "Éducation populaire"]),
  item("Tiers-Lieu du Port", "Bretagne", "Lorient", ["Tiers-lieux"]),
  item("La Fabrique Citoyenne", "Bretagne", "Morlaix", ["Tiers-lieux", "Inclusion numérique"]),
  item("Ludothèque du Ponant", "Bretagne", "Brest", ["Éducation populaire"]),
  item("Parents en Réseau", "Île-de-France", "Montreuil", ["Parentalité"]),
  item("Le Kiosque Numérique", "Île-de-France", "Paris", ["Inclusion numérique"]),
  item("La Ruche des Lilas", "Île-de-France", "Les Lilas", ["Tiers-lieux"]),
  item("Atelier des Possibles", "Île-de-France", "Pantin", ["Tiers-lieux", "Éducation populaire"]),
  item("SOS Devoirs", "Île-de-France", "Créteil", ["Éducation populaire"]),
  item("Cité des Parents", "Île-de-France", "Évry", ["Parentalité"]),
  item("Web Solidaire", "Île-de-France", "Saint-Denis", ["Inclusion numérique"]),
  item("Kaz à Marmailles", "La Réunion", "Saint-Denis", ["Parentalité"]),
  item("Ti Lab Péi", "La Réunion", "Saint-Pierre", ["Tiers-lieux"]),
  item("Case Numérique", "La Réunion", "Le Port", ["Inclusion numérique"]),
  item("Lékol Ansanm", "La Réunion", "Saint-Paul", ["Éducation populaire"]),
  item("Fanm é Zanfan", "La Réunion", "Saint-Benoît", ["Parentalité"]),
  item("La Halle aux Idées", "Occitanie", "Toulouse", ["Tiers-lieux"]),
  item("Parenthèse 31", "Occitanie", "Toulouse", ["Parentalité"]),
  item("Le Tiers-Temps", "Occitanie", "Montpellier", ["Tiers-lieux", "Parentalité"]),
  item("Récré'Action", "Occitanie", "Albi", ["Éducation populaire"]),
  item("Clic & Lien", "Occitanie", "Nîmes", ["Inclusion numérique"]),
  item("Les Petits Pas", "Occitanie", "Perpignan", ["Parentalité"]),
];

// Groupement par territoire (mode "country" : couleurs par index de groupe).
export const ParTerritoire = () => (
  <SearchBubbleChart
    results={resultats}
    categories={THEMES}
    height={460}
    defaultGroupMode="country"
    onItemClick={() => {}}
  />
);

// Groupement par type d'acteur (mode "category" : couleurs de la palette
// CATEGORY_COLORS intégrée, indexée par libellé exact).
const TYPES_ACTEURS = [
  "Association/ONG",
  "Organismes de formation",
  "Réseaux/cluster",
  "Structure d'accompagnement et financement",
];

let seq2 = 0;
const acteur = (name: string, type: string, region: string, ville: string) => {
  seq2 += 1;
  return item(name, region, ville, [type]);
};

const annuaire = [
  acteur("Familles Rurales 29", "Association/ONG", "Bretagne", "Quimper"),
  acteur("Ligue de l'Enseignement", "Association/ONG", "Bretagne", "Rennes"),
  acteur("Ptits Doudous", "Association/ONG", "Bretagne", "Brest"),
  acteur("Collectif Parentalité 34", "Association/ONG", "Occitanie", "Montpellier"),
  acteur("UNAF Réunion", "Association/ONG", "La Réunion", "Saint-Denis"),
  acteur("CNAM Bretagne", "Organismes de formation", "Bretagne", "Rennes"),
  acteur("École des Parents", "Organismes de formation", "Île-de-France", "Paris"),
  acteur("Institut Petite Enfance", "Organismes de formation", "Île-de-France", "Paris"),
  acteur("Réseau Tiers-Lieux Occitanie", "Réseaux/cluster", "Occitanie", "Toulouse"),
  acteur("Bretagne Tiers-Lieux", "Réseaux/cluster", "Bretagne", "Lorient"),
  acteur("France Tiers-Lieux", "Réseaux/cluster", "Île-de-France", "Paris"),
  acteur("La Compagnie des Tiers-Lieux", "Réseaux/cluster", "Occitanie", "Nîmes"),
  acteur("France Active", "Structure d'accompagnement et financement", "Île-de-France", "Paris"),
  acteur("CAF de la Réunion", "Structure d'accompagnement et financement", "La Réunion", "Saint-Denis"),
  acteur("Fondation de France", "Structure d'accompagnement et financement", "Île-de-France", "Paris"),
];

export const ParTypeDacteur = () => (
  <SearchBubbleChart
    results={annuaire}
    categories={TYPES_ACTEURS}
    height={420}
    defaultGroupMode="category"
    enableCountryGrouping={false}
    onItemClick={() => {}}
  />
);
