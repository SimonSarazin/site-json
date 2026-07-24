import { CardResourceCard } from "site-forge";

// Card « médiathèque » (design resource) — HÉROS ADAPTATIF AU TYPE :
//  • avec image (Vidéo/Photo) → vignette + pastille-type ; overlay play (vidéo) ou « N photos » (galerie) ;
//  • sans image (Document/Lien) → COUVERTURE TYPÉE (surface teintée + grande icône) + domaine pour un Lien.
// Aucune carte n'est jamais vide. Données lues sur `item.serverData` via `list.resource` (config parent62).
// Images = data-URI SVG (pas de service /img dans les aperçus).

const cover = (bg: string, dot: string, label: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300">` +
      `<rect width="480" height="300" fill="${bg}"/>` +
      `<circle cx="392" cy="70" r="70" fill="${dot}" opacity="0.5"/>` +
      `<circle cx="70" cy="250" r="52" fill="${dot}" opacity="0.35"/>` +
      `<text x="28" y="168" font-family="sans-serif" font-size="26" font-weight="700" fill="#ffffff">${label}</text>` +
      `</svg>`,
  );

const list = {
  resource: {
    design: "card",
    titleField: "name",
    descriptionField: "description",
    dateField: "created",
    imageField: "profilMediumImageUrl",
    cityField: "address.addressLocality",
    urlsField: "urls",
    badge: {
      field: "category",
      colors: {
        "Vidéo": "var(--chart-1)",
        "Photo": "var(--chart-2)",
        "Compte-rendu": "var(--chart-3)",
        "Jeu": "var(--chart-4)",
        "Document": "var(--chart-5)",
        "Lien": "var(--primary)",
      },
    },
    facets: [
      { field: "territoires", label: { fr: "Territoires", en: "Territories" } },
      { field: "themes", label: { fr: "Thèmes", en: "Themes" } },
    ],
  },
};

const item = (serverData: Record<string, unknown>) => ({ serverData });

export const Video = () => (
  <div style={{ maxWidth: 380, margin: "0 auto" }}>
    <CardResourceCard
      list={list}
      item={item({
        name: "Le portage physiologique en 4 minutes",
        description: "Une sage-femme du réseau montre les gestes sûrs pour porter bébé au quotidien.",
        created: 1747094400000,
        category: "Vidéo",
        profilMediumImageUrl: cover("#3b6fb0", "#8fb8e8", "Vidéo"),
        address: { addressLocality: "Lens" },
        urls: ["https://www.youtube.com/watch?v=demo"],
        territoires: "Lens Liévin",
        themes: "Petite enfance",
      })}
    />
  </div>
);

export const Photo = () => (
  <div style={{ maxWidth: 380, margin: "0 auto" }}>
    <CardResourceCard
      list={list}
      item={item({
        name: "Fête de la parentalité 2025 — l'album",
        description: "Retour en images sur une journée d'ateliers et de rencontres à Béthune.",
        created: 1751328000000,
        category: "Photo",
        profilMediumImageUrl: cover("#b06a3b", "#e8b98f", "Photo"),
        address: { addressLocality: "Béthune" },
        // 8 médias image → chip « 8 photos »
        medias: Array.from({ length: 8 }, (_, i) => ({ type: "image", url: cover("#b06a3b", "#e8b98f", `#${i + 1}`) })),
        territoires: "Artois",
        themes: "Événement",
      })}
    />
  </div>
);

export const Document = () => (
  <div style={{ maxWidth: 380, margin: "0 auto" }}>
    <CardResourceCard
      list={list}
      item={item({
        name: "Guide « Accompagner le sommeil de 0 à 3 ans »",
        description: "Un livret de 12 pages avec les repères des professionnelles de PMI, à imprimer et partager.",
        created: 1743552000000,
        category: "Document",
        // pas d'image → couverture typée (grande icône)
        medias: [{ type: "file", url: "data:application/pdf,%23", name: "guide-sommeil.pdf" }],
        territoires: "Audomarois",
        themes: "Sommeil",
      })}
    />
  </div>
);

export const Lien = () => (
  <div style={{ maxWidth: 380, margin: "0 auto" }}>
    <CardResourceCard
      list={list}
      item={item({
        name: "Annuaire des lieux d'accueil enfants-parents",
        description: "La carte interactive des LAEP du département, filtrable par territoire et par horaire.",
        created: 1749081600000,
        category: "Lien",
        // pas d'image → couverture typée + domaine
        urls: ["https://reseau-parents62.fr/laep"],
        territoires: "Calaisis",
        themes: "Accueil",
      })}
    />
  </div>
);
