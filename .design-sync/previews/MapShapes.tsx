import { MapShapes } from "site-forge";

// Contours géographiques RÉELS rendus en SVG hors carte : chaque territoire est un lien vers une
// page de recherche filtrée. À ne pas confondre avec `map.shapes`, qui superpose les MÊMES couches
// à la carte MapLibre (fond de plan, marqueurs, résultats).
//
// Section DATA-DRIVEN : les contours viennent du legacy (`co2/zone/getshape`, `co2/zone/getzoniris`)
// via `useGeoShapes`, dont les requêtes sont gated sur `entity` — nul dans le DsProvider. Hors de
// l'app, la carte affiche donc son état vide : ce que ces stories montrent, c'est la COMPOSITION DE
// PROPS de référence (celle à recopier en config), pas le rendu peint.
//
// Usage réel des couches : `config.prod.saint-paul-sport.json` (bassins de vie zoniris + zone
// englobante), transposé ici en navigation par territoire.

// Les 24 communes de La Réunion (57 Ko, toutes avec contour), posées sur le contour régional laissé
// en DÉCOR : `target.layers` restreint la cliquabilité à la couche `communes`, sinon un clic sur le
// pourtour de l'île poserait un filtre `?commune=Réunion` que la page cible jetterait.
export const CommunesDeLaReunion = () => (
  <MapShapes
    props={{
      title: { fr: "Explorer par commune", en: "Browse by town" },
      description: {
        fr: "Cliquez sur un territoire pour voir les structures qui s'y trouvent.",
        en: "Click a territory to see the venues located there.",
      },
      bg: "muted",
      maxHeight: 520,
      shapes: [
        {
          id: "reunion",
          source: "zones",
          simplify: 20,
          filters: { countryCode: "RE", level: "4" },
          style: { fill: "none", stroke: "border", strokeWidth: 1 },
        },
        {
          id: "communes",
          source: "cities",
          simplify: 10,
          showNames: true,
          // `parentId` + `parentLevel` sont OBLIGATOIRES sur `cities` : sans eux le legacy renvoie
          // `[]` sans rien lire (BUG-L-213). Ici la zone Réunion, niveau 4.
          filters: { countryCode: "RE", parentId: "58be4af494ef47df1d0ddbcc", parentLevel: "4" },
          label: { fr: "Communes", en: "Towns" },
          style: {
            fill: "primary",
            fillOpacity: 0.12,
            stroke: "primary",
            strokeWidth: 1.5,
            strokeOpacity: 0.9,
          },
        },
      ],
      // ⚠️ La page `/lieux` doit porter un groupe de filtres `id: "commune"` dont les `options[].name`
      // portent la graphie EXACTE du contour ("Saint-Paul"), sinon `computeFiltersFromUrl` jette le
      // paramètre en silence : le lien « marche » mais ne filtre rien.
      target: { path: "/lieux", filterId: "commune", valueFrom: "name", layers: ["communes"] },
    }}
  />
);

// Découpage infra-communal (zoniris) : une seule couche, tout est cliquable, pas de décor. Fond
// `default` et pas de titre — le bloc est pensé pour se poser sous un hero qui porte déjà le sien.
export const BassinsDeVie = () => (
  <MapShapes
    props={{
      description: { fr: "Choisissez votre bassin de vie pour filtrer les activités." },
      maxHeight: 420,
      shapes: [
        {
          id: "bassins-vie",
          source: "zoniris",
          simplify: 10,
          showNames: true,
          // `zoniris` exige au moins un filtre IDENTIFIANT (ici `spec`) : `level` seul ne suffit pas,
          // la collection compte plus de 49 000 documents et n'est jamais renvoyée en entier.
          filters: { spec: "bassins_vie_saintpaul" },
          label: { fr: "Bassins de vie", en: "Living areas" },
          style: {
            fill: "accent",
            fillOpacity: 0.18,
            stroke: "accent",
            strokeWidth: 1.5,
            strokeOpacity: 0.9,
          },
        },
      ],
      target: { path: "/agenda", filterId: "bassin", valueFrom: "name" },
    }}
  />
);
