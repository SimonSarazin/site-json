import { PreviewResourceCard, useQueryClient } from "site-forge";

// Détail « médiathèque » (resource) — PILE DE BLOCS OPTIONNELS : en-tête adaptatif (bannière image OU bande
// typée + grande icône) → action principale (Ouvrir/Regarder/Télécharger selon le type) → description markdown
// → GALERIE → DOCUMENTS → AUDIO → LIENS → repères. La galerie/les documents/l'audio viennent de l'ENTITÉ
// complète chargée par `useResourceEntity` (about.images + about.files classés par EXTENSION). Ici l'app n'est
// pas branchée → on AMORCE le cache React Query (même instance que DsProvider, via l'export `useQueryClient`
// du bundle) sur la clé `["searchResourceEntity","byId",<id>]` pour rendre le vrai composant avec ses médias.
// Images/fichiers = data-URI (pas de service /img dans les aperçus).

const gImg = (bg: string, label: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">` +
      `<rect width="320" height="240" fill="${bg}"/>` +
      `<circle cx="250" cy="60" r="46" fill="#ffffff" opacity="0.25"/>` +
      `<text x="18" y="220" font-family="sans-serif" font-size="15" fill="#ffffff" opacity="0.85">${label}</text>` +
      `</svg>`,
  );

const AUDIO = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

// Entité POI complète telle que la lit `useResourceEntity` : `images` (galerie, contentKey "slider") +
// `files` (objet keyé, classé par EXTENSION → documents / audio / vidéo). Référence STABLE (module-scope)
// pour que l'amorçage du cache soit idempotent.
const RES_ENTITY = {
  images: [
    { contentKey: "slider", imagePath: gImg("#3b6fb0", "Atelier 1"), imageThumbPath: gImg("#3b6fb0", "Atelier 1") },
    { contentKey: "slider", imagePath: gImg("#b06a3b", "Atelier 2"), imageThumbPath: gImg("#b06a3b", "Atelier 2") },
    { contentKey: "slider", imagePath: gImg("#3f8f6b", "Goûter"), imageThumbPath: gImg("#3f8f6b", "Goûter") },
    { contentKey: "slider", imagePath: gImg("#8a5aa6", "Jeux"), imageThumbPath: gImg("#8a5aa6", "Jeux") },
    { contentKey: "slider", imagePath: gImg("#c0873b", "Clôture"), imageThumbPath: gImg("#c0873b", "Clôture") },
    { contentKey: "slider", imagePath: gImg("#4a7aa8", "Groupe"), imageThumbPath: gImg("#4a7aa8", "Groupe") },
  ],
  files: {
    f1: { _id: { $id: "f1" }, docPath: "data:application/pdf,%23", name: "compte-rendu-atelier-sommeil.pdf", size: 284000, contentKey: "pdf" },
    f2: { _id: { $id: "f2" }, docPath: "data:application/pdf,%23", name: "liste-participants.xlsx", size: 41000, contentKey: "spreadsheet" },
    f3: { _id: { $id: "f3" }, docPath: AUDIO, name: "temoignage-parent.mp3", size: 1024000, contentKey: "presentation" },
  },
};

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
      { field: "publics", label: { fr: "Publics", en: "Audiences" } },
      { field: "themes", label: { fr: "Thèmes", en: "Themes" } },
    ],
  },
};

// Amorce le cache React Query lu par `useResourceEntity({ id })` avant que l'enfant ne le lise (parent rendu
// d'abord). Référence d'entité stable → un seul set, pas de boucle de rendu.
function SeedEntity({ id, entity, children }: { id: string; entity: unknown; children: React.ReactNode }) {
  const qc = useQueryClient();
  if (qc.getQueryData(["searchResourceEntity", "byId", id]) !== entity) {
    qc.setQueryData(["searchResourceEntity", "byId", id], entity);
  }
  return <>{children}</>;
}

const panel: React.CSSProperties = {
  maxWidth: 640,
  margin: "0 auto",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius, 12px)",
  background: "var(--card)",
  overflow: "hidden",
};

// Compte-rendu RICHE : galerie + documents + audio classés depuis l'entité amorcée.
export const Ressource = () => (
  <div style={panel}>
    <SeedEntity id="res-cr-1" entity={RES_ENTITY}>
      <PreviewResourceCard
        list={list}
        item={{
          serverData: {
            id: "res-cr-1",
            name: "Atelier « Sommeil des tout-petits » — le compte-rendu",
            description:
              "Retour sur la rencontre du 12 juin à Béthune : les échanges entre parents, les repères partagés par la PMI, et les ressources à emporter.\n\nLes photos, le compte-rendu complet et l'enregistrement audio sont disponibles ci-dessous.",
            created: 1749686400000, // 12 juin 2025
            category: "Compte-rendu",
            address: { addressLocality: "Béthune" },
            territoires: "Artois",
            publics: "Parents",
            themes: "Sommeil",
          },
        }}
      />
    </SeedEntity>
  </div>
);

// Lien externe : en-tête typé + domaine, action « Ouvrir le lien », liens, repères (aucune entité à charger).
export const Lien = () => (
  <div style={panel}>
    <PreviewResourceCard
      list={list}
      item={{
        serverData: {
          id: "res-lien-1",
          name: "Annuaire des lieux d'accueil enfants-parents (LAEP)",
          description:
            "La carte interactive des LAEP du département, filtrable par territoire et par horaire — pour trouver un lieu d'écoute et de jeu près de chez soi.",
          created: 1749081600000,
          category: "Lien",
          address: { addressLocality: "Calais" },
          urls: ["https://reseau-parents62.fr/laep", "https://reseau-parents62.fr/agenda"],
          territoires: "Calaisis",
          publics: "Familles",
          themes: "Accueil",
        },
      }}
    />
  </div>
);
