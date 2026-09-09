import getValueByPath from "@/helpers/getValueByPath";
import type { Answer, FormId } from "@communecter/cocolight-api-client";
import {
  buildServicePricingServices,
  buildServicePricingStats,
  extractServicePricingAnswers,
  type ServicePricingAggregate,
  type ServicePricingPathsOverride,
  type ServicePricingPriceUnit,
  type ServicePricingService,
  type ServicePricingStat,
} from "../helpers/servicePricingAnswers";

/**
 * Helpers PURS de la section `coform-resource-directory` — annuaire à plat des
 * RESSOURCES d'un tiers-lieu (coworking / salle de réunion / hébergement), une
 * carte par `answer` CoForm.
 *
 * Portage de `Navigator::getRessourceTL` (costum `franceTierslieux`) : cet
 * endpoint n'est qu'un `SearchNew::globalAutoComplete` (= variant SDK `default`)
 * suivi d'un post-traitement — résolution du tiers-lieu porteur depuis l'input
 * « finder » de la réponse, remontée de son adresse/géo, filtre région. On
 * reproduit ce post-traitement ICI, côté client, sans nouvel endpoint ni
 * évolution SDK.
 *
 * Le rendu de carte suit `tlCardRessourcePanelHtml` (JS costum
 * `franceTierslieux/dataviz/getElement.js`) : NOM de la ressource (champ dédié,
 * sinon repli « N Salles de réunion » / « Coworking » / « Hébergement »),
 * CAPACITÉ (postes / min-max pers. / chambres) et TARIF « Dès X ». Les chemins
 * d'input sont ceux de `getNavigatorElement.suplment`.
 *
 * Les 3 formulaires sont des COPIES l'un de l'autre : préfixe d'étape distinct
 * (`navigatorDesTierslieux25112025_209_0`…) mais suffixes d'input STABLES
 * (`finder…miem3epsztzcm9dgim`, nom `…mieg4k7yxrito5j9e6`, équipements
 * `…mieg8j24m89gm99t5mi`) — d'où la résolution par suffixe, comme
 * `parseCoformAnswer` / `DEFAULT_COFORM_FIELDS`.
 */

/** Catégorie service-pricing (cf. {@link extractServicePricingAnswers}). */
export type ResourceKind = "coworking" | "meeting" | "accommodation";

/** Un type de ressource déclaré en config (une option de la facette + un formulaire). */
export interface ResourceTypeConf {
  /** Slug stable — id de l'option de facette. */
  id: string;
  /** Catégorie service-pricing associée (capacités / tarifs). */
  kind: ResourceKind;
  /** `_id` du formulaire CoForm. */
  formId: string;
  /** Clé d'étape de la réponse, ex. `navigatorDesTierslieux25112025_209_0`. */
  stepPrefix: string;
  /** Suffixe de l'input URL de réservation (PROPRE au formulaire — `linkPath` de `suplment`). */
  linkSuffix?: string;
  /** Suffixe de l'input « À propos » (PROPRE au formulaire — `description` du preview legacy). */
  descriptionSuffix?: string;
  /** Suffixe de l'input « Services proposés » (`string[]`, PROPRE au formulaire — hébergement `miq86g5vaw1kavrapkb`). */
  servicesSuffix?: string;
}

/** Suffixes d'input PARTAGÉS par les formulaires copie. */
export interface ResourceDirectoryFieldSuffixes {
  /** Input « finder » (tiers-lieu porteur). Ex. `miem3epsztzcm9dgim`. */
  finder: string;
  /** Input du NOM de la ressource. Ex. `mieg4k7yxrito5j9e6` (`namePath` de `suplment`). */
  name?: string;
  /** Input liste d'équipements (`string[]`). Ex. `mieg8j24m89gm99t5mi` (`extraPath`). */
  equipments?: string;
  /** Input SURFACE (`areaPath` de `suplment`). Ex. `mieg4k7zslc8awrql2`. */
  area?: string;
  /** Input URL de réservation, si commun aux formulaires (sinon `ResourceTypeConf.linkSuffix`). */
  bookingUrl?: string;
}

/** Chemin complet de l'input « finder » d'un type de ressource. */
export function finderPath(rt: ResourceTypeConf, finderSuffix: string): string {
  return `answers.${rt.stepPrefix}.finder${rt.stepPrefix}${finderSuffix}`;
}

/** Chemin complet d'un input `<step><suffixe>` sous `answers.<step>.`. */
function inputPath(rt: ResourceTypeConf, suffix: string): string {
  return `answers.${rt.stepPrefix}.${rt.stepPrefix}${suffix}`;
}

/**
 * Filtre Mongo FIXE de la requête `answers` : les N formulaires + la garde
 * « réponse géolocalisée » (`finder` présent) en `$or`, un terme par formulaire.
 * Reproduit `filters[form][$in]` + `filters[$or][…finder…][$exists]` de la
 * charge utile legacy.
 *
 * ⚠️ `$or` est émis en **forme MAP** (`{ chemin: opérateur, … }`) et NON en
 * tableau : `SearchNew::searchFilters` lit `$or` comme une map `champ→op`, et la
 * forme tableau Mongo standard fait un **HTTP 500** sur le backend legacy
 * (cf. `lib/mongoFilters.ts`). C'est aussi la forme de la charge utile d'origine
 * (`filters[$or][answers.…finder…][$exists]=true`).
 */
export function buildResourceDirectoryFilters(
  resourceTypes: ResourceTypeConf[],
  finderSuffix: string,
): Record<string, unknown> {
  const formIds = resourceTypes.map((r) => r.formId);
  const orMap: Record<string, unknown> = {};
  for (const r of resourceTypes) orMap[finderPath(r, finderSuffix)] = { $exists: true };
  return {
    ...(formIds.length ? { form: { $in: formIds } } : {}),
    ...(Object.keys(orMap).length ? { $or: orMap } : {}),
  };
}

/**
 * Surcharge `card.servicePricing` dérivée des `resourceTypes` de config —
 * suffixes de `getNavigatorElement.suplment` (`getElement.js`).
 */
export function buildServicePricingOverride(
  resourceTypes: ResourceTypeConf[],
): ServicePricingPathsOverride {
  const override: ServicePricingPathsOverride = {};
  for (const rt of resourceTypes) {
    const base = `answers.${rt.stepPrefix}.${rt.stepPrefix}`;
    if (rt.kind === "meeting") {
      override.meeting = { id: rt.formId, room: `${base}miokvr9ezvu0064fk` }; // roomPath
    } else if (rt.kind === "coworking") {
      override.coworking = {
        id: rt.formId,
        place: `${base}mieg4k7z9gv729cs53`, // placePath
        price: {
          hourly: `${base}minag948nw1ltatx78o`,
          halfDay: `${base}minagtkflgfepmrq32l`,
          fullDay: `${base}minah6jdpwjpzymuxm`,
        },
      };
    } else {
      override.accommodation = {
        id: rt.formId,
        place: `${base}mieg4k7z9gv729cs53`, // placePath
        price: {
          bed: `${base}minaceqtibwcyy3khtm`, // bedPricePath
          room: `${base}miq84do7c678u3c8xuq`, // roomPricePath
        },
      };
    }
  }
  return override;
}

/** Le type de ressource d'une réponse : par son champ `form`, sinon par l'étape présente. */
export function resolveAnswerType(
  serverData: Record<string, unknown> | undefined,
  resourceTypes: ResourceTypeConf[],
): ResourceTypeConf | undefined {
  if (!serverData) return undefined;
  const form = typeof serverData.form === "string" ? serverData.form : undefined;
  if (form) {
    const byForm = resourceTypes.find((r) => r.formId === form);
    if (byForm) return byForm;
  }
  const answers = serverData.answers as Record<string, unknown> | undefined;
  if (answers && typeof answers === "object") {
    return resourceTypes.find((r) => answers[r.stepPrefix] != null);
  }
  return undefined;
}

/** Référence du tiers-lieu porteur d'une ressource. */
export interface ResourceParentRef {
  id: string;
  name?: string;
  type: string;
}

/**
 * Tiers-lieu porteur : lu d'abord dans l'input « finder » de la réponse (map
 * `{ orgId: { id, name, type } }`), avec repli sur `links.organizations` — les
 * deux voies de `Navigator::getRessourceTL`.
 */
export function resolveAnswerParent(
  serverData: Record<string, unknown> | undefined,
  resourceTypes: ResourceTypeConf[],
  finderSuffix: string,
): ResourceParentRef | null {
  if (!serverData) return null;
  const rt = resolveAnswerType(serverData, resourceTypes);
  const candidates = rt ? [rt] : resourceTypes;
  for (const cand of candidates) {
    const finder = getValueByPath(serverData, finderPath(cand, finderSuffix));
    const ref = firstOrgRef(finder);
    if (ref) return ref;
  }
  return firstOrgRef((serverData.links as Record<string, unknown> | undefined)?.organizations);
}

function firstOrgRef(raw: unknown): ResourceParentRef | null {
  if (!raw || typeof raw !== "object") return null;
  const [firstId, firstVal] = Object.entries(raw as Record<string, unknown>)[0] ?? [];
  if (!firstId) return null;
  const v = (firstVal ?? {}) as Record<string, unknown>;
  return {
    id: typeof v.id === "string" && v.id ? v.id : firstId,
    name: typeof v.name === "string" ? v.name : undefined,
    type: typeof v.type === "string" && v.type ? v.type : "organizations",
  };
}

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

/** Lignes du tableau des salles (`roomPath` = commonTable) — ligne 0 = en-têtes. */
export function meetingRoomRows(
  serverData: Record<string, unknown> | undefined,
  rt: ResourceTypeConf | undefined,
): unknown[][] {
  if (!serverData || !rt || rt.kind !== "meeting") return [];
  const raw = getValueByPath(serverData, inputPath(rt, "miokvr9ezvu0064fk"));
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is unknown[] => Array.isArray(row));
}

/** Une salle de réunion : une ligne (hors en-têtes) du tableau `roomPath`. */
export interface MeetingRoom {
  name?: string;
  /** Surface (colonne 1 — libre : « 30 », « 30 m² »…). */
  area?: string;
  minPers?: number;
  maxPers?: number;
  hourly?: number;
  halfDay?: number;
  fullDay?: number;
  /** Colonne 7 « Tarif solidaire possible » (valeur libre : « Oui »…). */
  solidaire?: string;
  /** Colonne 8 : URLs d'images DÉJÀ absolues (`/upload/communecter/…`). */
  images: string[];
}

function toInt(v: unknown): number | undefined {
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Salles de réunion d'une réponse (colonnes du `roomPath` : `[name, area,
 * minPers, maxPers, hourly, halfDay, fullDay, solidaire, images[]]`) —
 * cf. `tlCardRessourcePanelHtml` / preview legacy. Ligne 0 = en-têtes.
 */
export function parseMeetingRooms(
  serverData: Record<string, unknown> | undefined,
  rt: ResourceTypeConf | undefined,
): MeetingRoom[] {
  return meetingRoomRows(serverData, rt)
    .slice(1)
    .map((row) => ({
      name: str(row[0]),
      area: str(row[1]),
      minPers: toInt(row[2]),
      maxPers: toInt(row[3]),
      hourly: toInt(row[4]),
      halfDay: toInt(row[5]),
      fullDay: toInt(row[6]),
      solidaire: str(row[7]),
      images: Array.isArray(row[8])
        ? (row[8] as unknown[]).filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        : [],
    }));
}

/** Texte « À propos » de la ressource (`descriptionSuffix` du formulaire). */
export function resolveAnswerDescription(
  serverData: Record<string, unknown> | undefined,
  rt: ResourceTypeConf | undefined,
): string | undefined {
  if (!serverData || !rt?.descriptionSuffix) return undefined;
  return str(getValueByPath(serverData, inputPath(rt, rt.descriptionSuffix)));
}

/** Surface de la ressource (`areaPath` — libre : « 30 », « 30 m² »…). */
export function resolveAnswerArea(
  serverData: Record<string, unknown> | undefined,
  rt: ResourceTypeConf | undefined,
  areaSuffix: string | undefined,
): string | undefined {
  if (!serverData || !rt || !areaSuffix) return undefined;
  return str(getValueByPath(serverData, inputPath(rt, areaSuffix)));
}

/** « Services proposés » de la ressource (`servicesSuffix` du formulaire — hébergement). */
export function resolveAnswerServices(
  serverData: Record<string, unknown> | undefined,
  rt: ResourceTypeConf | undefined,
): string[] {
  if (!serverData || !rt?.servicesSuffix) return [];
  const raw = getValueByPath(serverData, inputPath(rt, rt.servicesSuffix));
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  const single = str(raw);
  return single ? [single] : [];
}

/** TOUS les tarifs non nuls d'une catégorie (pas seulement le premier). */
export function allServicePricingPrices(
  agg: ServicePricingAggregate,
  kind: ResourceKind,
): Array<{ unit: ServicePricingPriceUnit; price: number }> {
  if (kind === "accommodation") {
    const p = agg.accommodation.price;
    return [
      ...(p.bed > 0 ? [{ unit: "bed" as const, price: p.bed }] : []),
      ...(p.room > 0 ? [{ unit: "room" as const, price: p.room }] : []),
    ];
  }
  const p = kind === "meeting" ? agg.meeting.price : agg.coworking.price;
  return [
    ...(p.hourly > 0 ? [{ unit: "hour" as const, price: p.hourly }] : []),
    ...(p.halfDay > 0 ? [{ unit: "halfDay" as const, price: p.halfDay }] : []),
    ...(p.fullDay > 0 ? [{ unit: "fullDay" as const, price: p.fullDay }] : []),
  ];
}

/**
 * Facettes « Prix » — CALQUÉES SUR COMMUNECTER : trois groupes indépendants, un
 * par unité de tarif, chacun avec SES tranches. Les bornes sont des chaînes
 * `"min-max"` du contrat backend `Navigator::priceRangeBounds` (côté vide = borne
 * absente, intervalle semi-ouvert `[min, max[`). Filtre appliqué CÔTÉ SERVEUR
 * (`filters.<field>`) — une réponse sans tarif dans l'unité concernée sort ; deux
 * unités cochées se combinent en ET (le backend teste chaque champ).
 */
export interface PriceFilterGroup {
  /** = `field` backend = id de groupe de filtre. */
  field: "priceHourly" | "priceHalfDay" | "priceFullDay";
  label: { fr: string; en: string };
  ranges: ReadonlyArray<{ id: string; label: { fr: string; en: string } }>;
}

export const PRICE_FILTER_GROUPS: readonly PriceFilterGroup[] = [
  {
    field: "priceHourly",
    label: { fr: "Tarif à l'heure", en: "Hourly rate" },
    ranges: [
      { id: "0-20", label: { fr: "moins de 20 €", en: "under €20" } },
      { id: "20-50", label: { fr: "20 € à 50 €", en: "€20 to €50" } },
      { id: "50-100", label: { fr: "50 € à 100 €", en: "€50 to €100" } },
      { id: "100-", label: { fr: "plus de 100 €", en: "over €100" } },
    ],
  },
  {
    field: "priceHalfDay",
    label: { fr: "Tarif à la demi-journée", en: "Half-day rate" },
    ranges: [
      { id: "0-50", label: { fr: "moins de 50 €", en: "under €50" } },
      { id: "50-100", label: { fr: "50 € à 100 €", en: "€50 to €100" } },
      { id: "100-200", label: { fr: "100 € à 200 €", en: "€100 to €200" } },
      { id: "200-", label: { fr: "plus de 200 €", en: "over €200" } },
    ],
  },
  {
    field: "priceFullDay",
    label: { fr: "Tarif à la journée", en: "Day rate" },
    ranges: [
      { id: "0-100", label: { fr: "moins de 100 €", en: "under €100" } },
      { id: "100-200", label: { fr: "100 € à 200 €", en: "€100 to €200" } },
      { id: "200-400", label: { fr: "200 € à 400 €", en: "€200 to €400" } },
      { id: "400-", label: { fr: "plus de 400 €", en: "over €400" } },
    ],
  },
] as const;

/** Nom de la ressource depuis son input dédié (`namePath`), ou `undefined`. */
export function resolveAnswerName(
  serverData: Record<string, unknown> | undefined,
  rt: ResourceTypeConf | undefined,
  nameSuffix: string | undefined,
): string | undefined {
  if (!serverData || !rt || !nameSuffix) return undefined;
  return str(getValueByPath(serverData, inputPath(rt, nameSuffix)));
}

/** Liste d'équipements d'une réponse (`string[]`, vide si absent). */
export function resolveAnswerEquipments(
  serverData: Record<string, unknown> | undefined,
  rt: ResourceTypeConf | undefined,
  equipmentsSuffix: string | undefined,
): string[] {
  if (!serverData || !rt || !equipmentsSuffix) return [];
  const raw = getValueByPath(serverData, inputPath(rt, equipmentsSuffix));
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  const single = str(raw);
  return single ? [single] : [];
}

/** URL de réservation d'une réponse (`ResourceTypeConf.linkSuffix` en priorité). */
export function resolveAnswerBookingUrl(
  serverData: Record<string, unknown> | undefined,
  rt: ResourceTypeConf | undefined,
  fallbackSuffix: string | undefined,
): string | undefined {
  if (!serverData || !rt) return undefined;
  const suffix = rt.linkSuffix ?? fallbackSuffix;
  if (!suffix) return undefined;
  return str(getValueByPath(serverData, inputPath(rt, suffix)));
}

/**
 * E-mail du tiers-lieu porteur, tel que remonté par `Navigator::getRessourceTL`
 * (`serverData.email` de premier niveau, à défaut la 1re valeur de `parentEmails`).
 * Destinataire de la demande de réservation quand la ressource n'a pas de lien.
 */
export function resolveAnswerParentEmail(
  serverData: Record<string, unknown> | undefined,
): string | undefined {
  const direct = str(serverData?.email);
  if (direct) return direct;
  const map = serverData?.parentEmails;
  if (map && typeof map === "object") {
    for (const v of Object.values(map as Record<string, unknown>)) {
      const email = str(v);
      if (email) return email;
    }
  }
  return undefined;
}

/**
 * Photos rattachées à la réponse (`serverData.documents`, objet OU tableau).
 * URL construite `/upload/communecter/<folder>/<name>` — même schéma que le
 * legacy (`ph/upload/communecter/answers/<id>/…`).
 */
export function resolveAnswerPhotos(serverData: Record<string, unknown> | undefined): string[] {
  const docs = serverData?.documents;
  const list = Array.isArray(docs)
    ? docs
    : docs && typeof docs === "object"
      ? Object.values(docs as Record<string, unknown>)
      : [];
  return list
    .map((d) => {
      const doc = (d ?? {}) as Record<string, unknown>;
      if (typeof doc.docPath === "string" && doc.docPath) return doc.docPath;
      const folder = typeof doc.folder === "string" ? doc.folder : "";
      const name = typeof doc.name === "string" ? doc.name : "";
      if (doc.doctype === "image" || /\.(jpe?g|png|webp|gif|avif)$/i.test(name)) {
        return folder && name ? `/upload/communecter/${folder}/${name}` : "";
      }
      return "";
    })
    .filter((u) => u.length > 0);
}

/** Repli i18n du nom quand l'input dédié est vide (cf. `tlCardRessourcePanelHtml`). */
export interface ResourceNameFallback {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * Nom d'affichage — `getRessourceTL` éclate désormais 1 salle = 1 réponse
 * (cf. `Navigator::getRessourceTL`) :
 *  - meeting : `serverData.roomName` (posé par l'éclatement), sinon le nom de la
 *    salle (colonne 0 du tableau), sinon « Salle de réunion » ;
 *  - coworking / accommodation : leur champ « nom » dédié, sinon
 *    « Espace de coworking » / « Hébergement ».
 */
export function resolveResourceName(
  serverData: Record<string, unknown> | undefined,
  rt: ResourceTypeConf | undefined,
  nameSuffix: string | undefined,
): { name?: string; nameFallback?: ResourceNameFallback } {
  if (!rt) return {};
  if (rt.kind === "meeting") {
    const roomName = str(serverData?.roomName) ?? str(meetingRoomRows(serverData, rt)[1]?.[0]);
    return roomName ? { name: roomName } : { nameFallback: { key: "resourceDirectory.nameMeeting" } };
  }
  const explicit = resolveAnswerName(serverData, rt, nameSuffix);
  if (explicit) return { name: explicit };
  return {
    nameFallback: {
      key:
        rt.kind === "coworking"
          ? "resourceDirectory.nameCoworking"
          : "resourceDirectory.nameAccommodation",
    },
  };
}

/** Modèle d'affichage d'une carte de ressource. */
export interface ResourceCardModel {
  type?: ResourceTypeConf;
  /** Nom explicite (champ dédié / nom de salle unique). */
  name?: string;
  /** Repli i18n si `name` absent (à passer à `t(key, params)`). */
  nameFallback?: ResourceNameFallback;
  /** Texte « À propos » (détail uniquement). */
  description?: string;
  /** Surface libre (détail uniquement). */
  area?: string;
  parent: ResourceParentRef | null;
  equipments: string[];
  /** « Services proposés » (hébergement — détail uniquement). */
  extraServices: string[];
  /** Images « ressource » : celles de la salle (`getRessourceTL` éclate 1 salle = 1 réponse) sinon les documents. */
  photos: string[];
  bookingUrl?: string;
  /** E-mail du tiers-lieu porteur (remonté par le backend) — cible d'une demande de réservation. */
  parentEmail?: string;
  /** Salle(s) de réunion — après éclatement serveur : 0 ou 1 élément. */
  rooms: MeetingRoom[];
  /** Index de la salle dans le tableau d'origine (éclatement `getRessourceTL`), si applicable. */
  roomIndex?: number;
  /** Capacité (pastille) — 0 ou 1 élément (une réponse = un type). */
  stats: ServicePricingStat[];
  /** Tarif « à partir de » — 0 ou 1 élément (carte). */
  services: ServicePricingService[];
  /** TOUS les tarifs non nuls (détail). */
  prices: Array<{ unit: ServicePricingPriceUnit; price: number }>;
}

export interface ParseResourceDirectoryItemOptions {
  resourceTypes: ResourceTypeConf[];
  finderSuffix: string;
  fieldSuffixes?: ResourceDirectoryFieldSuffixes;
  /** Surcharge des chemins service-pricing (déf. dérivée des `resourceTypes`). */
  servicePricing?: ServicePricingPathsOverride;
}

/** Normalise une réponse `serverData` en {@link ResourceCardModel}. Fonction pure. */
export function parseResourceDirectoryItem(
  serverData: Record<string, unknown> | undefined,
  opts: ParseResourceDirectoryItemOptions,
): ResourceCardModel {
  const { resourceTypes, finderSuffix, fieldSuffixes, servicePricing } = opts;
  const type = resolveAnswerType(serverData, resourceTypes);
  const parent = resolveAnswerParent(serverData, resourceTypes, finderSuffix);
  const { name, nameFallback } = resolveResourceName(serverData, type, fieldSuffixes?.name);
  const description = resolveAnswerDescription(serverData, type);
  const area = resolveAnswerArea(serverData, type, fieldSuffixes?.area);
  const equipments = resolveAnswerEquipments(serverData, type, fieldSuffixes?.equipments);
  const extraServices = resolveAnswerServices(serverData, type);
  const bookingUrl = resolveAnswerBookingUrl(serverData, type, fieldSuffixes?.bookingUrl);
  const parentEmail = resolveAnswerParentEmail(serverData);
  const documentPhotos = resolveAnswerPhotos(serverData);
  const rooms = type?.kind === "meeting" ? parseMeetingRooms(serverData, type) : [];
  // Salle de réunion : les photos de la SALLE (colonne 8) priment sur les documents.
  const photos = rooms[0]?.images.length ? rooms[0].images : documentPhotos;
  const roomIndex = typeof serverData?.roomIndex === "number" ? serverData.roomIndex : undefined;

  let stats: ServicePricingStat[] = [];
  let services: ServicePricingService[] = [];
  let prices: Array<{ unit: ServicePricingPriceUnit; price: number }> = [];
  if (type && serverData) {
    // `extractServicePricingAnswers` attend `Record<FormId, Answer[]>` (les
    // réponses d'un LIEU groupées par formulaire) : ici une seule réponse, on
    // l'enveloppe sous son `formId` — seule sa catégorie agrège, d'où au plus
    // une pastille + un tarif par carte.
    const byForm = { [type.formId]: [{ serverData } as unknown as Answer] } as Record<FormId, Answer[]>;
    const override = servicePricing ?? buildServicePricingOverride(resourceTypes);
    const agg = extractServicePricingAnswers(byForm, override);
    stats = buildServicePricingStats(agg, { requirePrice: false });
    services = buildServicePricingServices(agg);
    prices = allServicePricingPrices(agg, type.kind);
  }

  return {
    type,
    name,
    nameFallback,
    description,
    area,
    parent,
    equipments,
    extraServices,
    photos,
    bookingUrl,
    parentEmail,
    rooms,
    roomIndex,
    stats,
    services,
    prices,
  };
}
