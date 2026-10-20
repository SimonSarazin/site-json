import { z } from "zod";
import { LocalizedString } from "./locale-schema";

/**
 * Couches de CONTOURS géographiques (`geoShape`) déclarées en config.
 *
 * Contrat PARTAGÉ, dans une feuille neutre (ne dépend que de `locale-schema`) pour que
 * `modules/search` (carte de recherche/agenda) et `site-schema` (section `map`) l'importent
 * sans dépendance croisée — même motif qu'`action-button-schema`.
 *
 * Deux endpoints legacy PUBLICS derrière trois `source`, et eux seuls renvoient `geoShape`
 * (`co2/search/getzone`, l'autocomplete villes… le projettent DEHORS) :
 *  - `zones` / `cities` → `co2/zone/getshape` (`BaseEntity.getZoneShape`). Même action : c'est
 *    `level` qui choisit la collection, `level:"cities"` étant injecté par le résolveur pour
 *    `source:"cities"` — la config n'a pas à connaître ce détour.
 *  - `zoniris`          → `co2/zone/getzoniris` (`BaseEntity.getZoniris`) : IRIS, grands
 *    quartiers, bassins de vie.
 *
 * Les filtres sont ANDés côté serveur, il n'existe AUCUN `OR` : plusieurs couches dans le
 * tableau = autant d'appels, fusionnés et dédoublonnés par `id` de document côté client.
 */

/**
 * QUAND la couche est chargée. À déclarer en connaissance de la volumétrie (mesures live sur
 * www.communecter.org, 2026-08) : 24 communes de La Réunion = 57 Ko, mais les 7 bassins de vie
 * de Saint-Paul = 395 Ko (98 % de géométrie, 10 779 points à 13 décimales) et le dump national
 * des QPV = 9,4 Mo.
 *  - `map`  (défaut) : à l'ouverture de la vue carte — même politique que le périmètre carte
 *    (`useSearchAllResults`, désactivé hors vue carte). Rien n'est payé par qui reste en liste.
 *  - `idle` : à l'entrée de la page, mais APRÈS le premier paint (`requestIdleCallback`) — la
 *    donnée est prête quand l'utilisateur bascule, sans disputer le chemin critique à la liste.
 *  - `page` : à l'entrée de la page, sans attendre. À réserver aux couches légères (< ~60 Ko).
 * Jamais de préchargement SSR : `getzoniris` est un POST (aucun cache HTTP) et déshydrater
 * des polygones dans le HTML pèserait autant que la page entière.
 */
export const GeoShapeLoadSchema = z.enum(["map", "page", "idle"]);
export type GeoShapeLoad = z.infer<typeof GeoShapeLoadSchema>;

/**
 * Peinture de la couche. Les couleurs sont des TOKENS CSS (`primary`, `muted`, `accent`…),
 * jamais des littéraux hex — convention design-sync. `fill: "none"` = contour seul.
 */
export const GeoShapeStyleSchema = z
  .object({
    fill: z.string(),
    fillOpacity: z.number().min(0).max(1),
    stroke: z.string(),
    strokeWidth: z.number().min(0),
    strokeOpacity: z.number().min(0).max(1),
  })
  .partial();
export type GeoShapeStyle = z.infer<typeof GeoShapeStyleSchema>;

const GeoShapeCommon = {
  /** Identifiant de la couche : clé de cache React Query, de dédoublonnage et de légende. */
  id: z.string().min(1),
  /** Libellé de légende. Absent = couche muette (décor). */
  label: LocalizedString.optional(),
  load: GeoShapeLoadSchema.optional(),
  /**
   * Tolérance de simplification Douglas-Peucker, EN MÈTRES, appliquée après réception
   * (le téléchargement, lui, ne bouge pas — seuls le coût de rendu et la mémoire baissent).
   * Mesuré sur les 7 bassins de vie : brut 389 Ko / 10 779 points → 5 m : 57 Ko → 10 m : 37 Ko
   * (÷10, différence invisible à l'échelle d'une commune) → 20 m : 23 Ko. Absent ou 0 = brut.
   */
  simplify: z.number().min(0).optional(),
  style: GeoShapeStyleSchema.optional(),
  /**
   * Pose le NOM de chaque contour sur la carte (`zoniris.name`, `cities.name`…). Libellés HTML et
   * non calque `symbol` MapLibre : sans clé MapTiler, le style de repli n'embarque aucun glyphe, un
   * calque de texte n'afficherait donc rien — et les libellés HTML suivent les jetons du thème.
   * Le nom est posé au point INTÉRIEUR le plus éloigné du bord, pas au centroïde, qui tombe dehors
   * sur les formes concaves (un cirque, une commune en croissant).
   * ⚠️ Un libellé = un nœud du DOM : au-delà de {@link GEO_SHAPE_MAX_LABELS} contours, seuls les
   * plus VASTES sont nommés — nommer 1 345 QPV serait illisible autant qu'inutile.
   */
  showNames: z.boolean().optional(),
};

/**
 * Code pays ISO, ou LISTE de codes.
 *
 * Le legacy ne connaît QUE le scalaire : `countryCode: "FR,RE"` renvoie 0 document (mesuré le
 * 2026-08-28 sur `/co2/zone/getshape`). Une liste est donc résolue côté client en autant d'appels,
 * fusionnés et dédoublonnés par `_id` — le même mécanisme que deux couches partageant un `id`,
 * mais sans dupliquer toute la déclaration.
 *
 * Le cas d'usage qui l'impose : les régions françaises. `level:"3"` + `FR` ne rend que les 13
 * régions MÉTROPOLITAINES ; l'outre-mer vit sous son propre code pays (`RE`, `MQ`, `GP`, `GF`,
 * `YT` — un document chacun). Sans liste, une carte « France entière » oublie l'outre-mer.
 */
export const CountryCodeSchema = z.union([
  z.string().min(1),
  z.array(z.string().min(1)).min(1),
]);
export type CountryCode = z.infer<typeof CountryCodeSchema>;

/** Normalise le scalaire et la liste en un TABLEAU, seule forme que manipule le résolveur. */
export function countryCodeList(value: CountryCode | undefined): string[] {
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : value;
}

/** Plafond de libellés par couche — au-delà, les plus vastes gagnent. */
export const GEO_SHAPE_MAX_LABELS = 60;

/**
 * `zoniris` — au moins UN filtre identifiant est exigé par le serveur parmi `cityId`, `insee`,
 * `countryCode`, `spec`, `shapeType`, `name` : la collection compte plus de 49 000 documents et
 * n'est jamais renvoyée en entier (sans filtre : `{result:false, msg:"missing parameters"}`).
 * `level` NE COMPTE PAS — il ne fait qu'affiner (`"6"` = IRIS, `"8"` = bassins de vie).
 *
 * ⚠️ Les filtres ne sélectionnent pas la même population : sur Saint-Paul, `cityId`/`spec`/
 * `shapeType` ramènent les 7 bassins de vie (tous avec contour) là où `insee: "97415"` ramène
 * 54 documents (IRIS inclus) dont 30 SANS `geoShape` — 966 Ko pour 24 contours utiles.
 * `name` est une recherche insensible à la casse ET aux accents (regex non ancrée).
 */
const ZonirisShapeSourceSchema = z.object({
  ...GeoShapeCommon,
  source: z.literal("zoniris"),
  filters: z
    .object({
      cityId: z.string(),
      insee: z.string(),
      countryCode: CountryCodeSchema,
      spec: z.string(),
      shapeType: z.string(),
      name: z.string(),
      level: z.string(),
    })
    .partial()
    .refine(
      (f) => Boolean(f.cityId || f.insee || f.countryCode || f.spec || f.shapeType || f.name),
      { message: "zoniris exige au moins un filtre identifiant (cityId, insee, countryCode, spec, shapeType ou name) — level ne suffit pas." }
    ),
});

/**
 * `zones` — niveaux administratifs (`"1"`…`"6"`) ou quartiers prioritaires (`"QPV"`).
 *
 * ⚠️ `QPV` renvoie 1 345 documents / 9,4 Mo dont 49 seulement portent un contour, et le filtre
 * `countryCode` y est ÉCRASÉ côté serveur par `{type:"QPV"}` : sans bornage par
 * `parentId` + `parentLevel`, c'est le dump NATIONAL qui arrive. D'où le refus ci-dessous.
 * ⚠️ `parentId` n'est pris en compte que si `parentLevel` est fourni et non vide au sens de PHP :
 * `parentLevel: "0"` désactive silencieusement le filtre parent.
 */
const ZoneShapeSourceSchema = z.object({
  ...GeoShapeCommon,
  source: z.literal("zones"),
  filters: z
    .object({
      countryCode: CountryCodeSchema,
      level: z.enum(["1", "2", "3", "4", "5", "6", "QPV"]),
      parentId: z.string().optional(),
      parentLevel: z.string().optional(),
      /** Projection légère du serveur (`_id`, `name`, `geoShape`, `level`, `type`, `insee`, `geo`,
       *  `geoPosition`). Le résolveur l'émet en `light: "1"`. Retire les métadonnées, PAS la
       *  géométrie : gain de 96 % sur les QPV, de 4 % seulement sur les EPCI. */
      light: z.boolean().optional(),
    })
    .refine((f) => f.level !== "QPV" || Boolean(f.parentId && f.parentLevel), {
      message: "level 'QPV' exige parentId ET parentLevel : countryCode est ignoré par le serveur, la requête non bornée renvoie 9,4 Mo (dump national).",
    })
    // Un `parentId` désigne UNE zone, donc UN pays : le poser en face de plusieurs codes le
    // rejouerait à l'identique sur chacun et ne ramènerait des contours que pour le sien.
    .refine((f) => countryCodeList(f.countryCode).length <= 1 || !f.parentId, {
      message: "countryCode multiple et parentId sont incompatibles : un parent appartient à un seul pays. Déclarer une couche par périmètre borné (elles fusionnent si elles partagent un `id`).",
    }),
});

/**
 * `cities` — communes avec leur contour. Le résolveur pose `level: "cities"`.
 *
 * ⚠️ `parentId` ET `parentLevel` sont OBLIGATOIRES : sans eux l'action renvoie `[]` SANS RIEN
 * LIRE (BUG-L-213) — ce qui fait croire que la donnée n'existe pas. Bornée, elle est légère :
 * `countryCode:"RE"` + parent `58be4af494ef47df1d0ddbcc` (zone Réunion, niveau 4) = 24 communes,
 * toutes avec contour, 57 Ko.
 */
const CitiesShapeSourceSchema = z.object({
  ...GeoShapeCommon,
  source: z.literal("cities"),
  filters: z.object({
    /** SCALAIRE ici, contrairement à `zones` : `parentId` est OBLIGATOIRE sur cette branche et
     *  désigne une zone d'un seul pays — une liste n'aurait aucun sens. Pour plusieurs pays,
     *  déclarer une couche par pays en leur donnant le même `id` : elles fusionnent. */
    countryCode: z.string().min(1),
    parentId: z.string().min(1),
    parentLevel: z.string().min(1),
    light: z.boolean().optional(),
  }),
});

export const GeoShapeSourceSchema = z.discriminatedUnion("source", [
  ZonirisShapeSourceSchema,
  ZoneShapeSourceSchema,
  CitiesShapeSourceSchema,
]);
export type GeoShapeSource = z.infer<typeof GeoShapeSourceSchema>;
