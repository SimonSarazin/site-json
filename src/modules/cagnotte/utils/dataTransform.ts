/**
 * Helpers de transformation et d'extraction de données utilisés à travers le module cagnotte
 * (hooks, lib, components). Centralise les utilitaires qui étaient dupliqués entre :
 *  - `hooks/useFundingEnvelope.ts`
 *  - `lib/milestoneSyncContext.ts`
 *  - `hooks/useSaveCagnotteContribution.ts`
 *  - `components/PaymentConfigPage.tsx`
 *
 * Toutes les fonctions sont pures (aucun side-effect) — adaptées à `utils/` plutôt qu'à `lib/`.
 */
import type { CagnotteFundableItem, CagnotteResource } from "../types";

export type UnknownRecord = Record<string, unknown>;

/**
 * Étape par défaut des données d'un commun AAC.
 *
 * ⚠️ Le module AAC suppose partout que le commun vit sur `aapStep1`. Ce n'est PAS une
 * levée de l'hypothèse module-wide : c'est le repli des appelants qui ne résolvent pas
 * leur étape. Qui la connaît (la fiche, via `config.roles.depenseStepKey`) DOIT la
 * passer explicitement — cf. `doc/34` §4, « jamais de `aapStepN` en dur ».
 *
 * Déclarée ici, dans la couche la plus basse, pour que `utils/` n'ait pas à dépendre
 * de `lib/` ; `lib/actionMilestonePathUpdates` la ré-exporte pour ses appelants
 * historiques.
 */
export const DEFAULT_AAC_STEP = "aapStep1";

/**
 * Coerce une valeur en `Record<string, unknown>`. Retourne `{}` pour `null`, `undefined`,
 * les primitives ou les valeurs non-objet. À utiliser comme garde-fou avant un accès dynamique.
 */
export function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

/**
 * Retourne le record s'il est non-vide, sinon `null`. Pratique pour les fallbacks
 * « prendre la première source non-vide » (cf. `getServerData`, `extractPaymentMethods`).
 */
export function getNonEmptyRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as UnknownRecord;
  return Object.keys(record).length > 0 ? record : null;
}

/**
 * Coerce en tableau : tableaux pass-through, objets → `Object.values`, sinon `[]`.
 * Utile pour les structures backend qui sont parfois sérialisées en `{ "0": ..., "1": ... }`.
 */
export function toArrayOrValues<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return Object.values(value as Record<string, T>);
  return [];
}

/**
 * Coerce en tableau en wrappant les valeurs scalaires : `null/undefined → []`,
 * tableau pass-through, autre valeur → `[value]`.
 */
export function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value == null) return [];
  return [value as T];
}

export function normalizeTags(value: unknown): string[] {
  const tags = toArray<unknown>(value).filter(
    (tag): tag is string => typeof tag === "string" && tag.length > 0,
  );
  return Array.from(new Set(tags));
}

/**
 * Coerce en `number` finite. Retourne `0` pour `null`, `undefined`, `NaN`, `Infinity`.
 */
export function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Coerce en `string`. Retourne `''` pour toute valeur non-string (y compris numbers,
 * pour éviter les `"[object Object]"`).
 */
export function toString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Normalise une valeur en `string | null` : trim, retourne `null` si la chaîne devient vide
 * ou si la valeur n'est pas une string. Utile pour traiter des IDs / slugs optionnels où
 * `""` doit être traité comme « pas de valeur ».
 */
export function normalizeIdOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Coerce sûre vers un entier (tronque les décimales). Gère :
 *  - `number` finis → `Math.trunc(value)`
 *  - `string` (FR ou EN) : `"1 234,5"` → `1234`, `"42"` → `42`, `""` ou invalide → `0`
 *  - Tout autre type → `0`
 *
 * Utile pour les montants côté backend qui peuvent arriver indifféremment en number
 * (calculé local) ou en string (sérialisé EJSON).
 */
export function toSafeInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(",", ".").trim();
    if (!normalized) return 0;
    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Extrait l'id d'une référence d'entité côté backend, qui peut être :
 *  - une string brute (`"abc123"`)
 *  - un objet `{ id: "abc123" }`
 *  - un objet Mongo `{ _id: { $id | _str } }`
 *  - un objet `{ $id: "abc123" }`
 *
 * Retourne `''` si aucun id trouvé. Couvre les deux variantes historiquement utilisées
 * (`getEntityId` dans useFundingEnvelope et `getEntityIdFromUnknown` dans milestoneSyncContext).
 */
export function getEntityId(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const record = value as UnknownRecord;
  const direct = record.id;
  if (typeof direct === "string" && direct) return direct;

  const mongoId = asRecord(record._id);
  const dollarId = mongoId.$id;
  if (typeof dollarId === "string" && dollarId) return dollarId;

  const mongoStr = mongoId._str;
  if (typeof mongoStr === "string" && mongoStr) return mongoStr;

  const str = record.$id;
  if (typeof str === "string" && str) return str;

  return "";
}

/**
 * Auteur d'une action, c'est-à-dire qui l'a créée.
 *
 * Le backend écrit les deux champs à la création (`ActionAction.php` : `'creator' => $user`
 * ET `'idUserAuthor' => $user`), mais des documents anciens n'en portent qu'un — on lit
 * donc les deux, `creator` d'abord.
 *
 * Le dernier repli, `authorId`, couvre les actions qui arrivent **déjà normalisées** :
 * `FundingAction` ne transporte plus `creator` (cf. la branche `selectorType: "project"`
 * de `useCagnotteAdapter`, où `depense.actions` est typé `FundingAction[]`). Sans lui,
 * repasser un tel objet par cette fonction effaçait son auteur, et personne ne pouvait
 * plus corriger sa propre action.
 *
 * Retourne `""` quand l'action ne dit pas qui l'a créée.
 */
export function resolveActionAuthorId(actionLike: unknown): string {
  const record = asRecord(actionLike);
  return (
    getEntityId(record.creator) ||
    getEntityId(record.idUserAuthor) ||
    getEntityId(record.authorId)
  );
}

/**
 * Retourne le sous-arbre `serverData` d'une Entity Cocolight (ou le record direct si
 * la valeur n'est pas une Entity). Les méthodes du SDK qui retournent des entités linkées
 * (cf. `BaseEntity.fundingEnvelope` → `_linkEntity`) rangent les données du document Mongo
 * sous `entity.serverData` (getter sur `_serverData`), pas à la racine de l'instance.
 *
 * Ce helper résout ce niveau d'indirection en cherchant `_serverData`, puis `serverData`,
 * puis fallback sur le record lui-même s'il est non-vide.
 */
export function getServerData(value: unknown): UnknownRecord {
  const record = asRecord(value);

  return (
    getNonEmptyRecord(record._serverData) ||
    getNonEmptyRecord(record.serverData) ||
    getNonEmptyRecord(record) ||
    {}
  );
}

/**
 * Lit le champ costum `preferences` d'une Entity Cocolight en tolérant les deux shapes :
 *  - `entity.data.preferences` (draft local, non-encore-sauvegardé)
 *  - `entity.serverData.preferences` (données serveur)
 *
 * Le champ `preferences` est costum-spécifique (non typé strict côté SDK), d'où le retour
 * en `UnknownRecord | undefined`. À utiliser quand on a besoin de distinguer draft vs server ;
 * sinon, `getServerData(entity).preferences` est plus court.
 */
export function readEntityPreferences(
  entity: unknown,
  source: "data" | "serverData",
): UnknownRecord | undefined {
  const root = asRecord(entity)[source];
  if (!root || typeof root !== "object") return undefined;
  const prefs = (root as UnknownRecord).preferences;
  return prefs && typeof prefs === "object" ? (prefs as UnknownRecord) : undefined;
}

/**
 * Coerce une date brute (Date, timestamp, string ISO) en timestamp ms. Repli
 * sur `Date.now()` si la valeur est absente/illisible — seul l'ordre relatif
 * des transactions compte à l'affichage, pas leur précision temporelle exacte
 * dans ce chemin de repli.
 */
function toTimestampOrNow(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

/**
 * Reconstruit `currentFunding`/`allFunding` à partir des financeurs BRUTS
 * (`depense.financer`) — utilisé par `buildItemsFromRawDepenses` quand
 * aucune entrée `targetResource.items` ne peut enrichir la dépense.
 *
 * `financer` arrive en tableau depuis l'enveloppe, mais un document brut peut le
 * porter en objet keyé par id de financeur (forme Mongo). `toArrayOrValues` couvre
 * les deux ; `toArray` aurait emballé l'objet entier en UN financeur fantôme
 * (`amount` 0, `id` vide) et mis le financement à zéro.
 */
function buildFallbackFundingFromRawFinancers(rawFinancer: unknown): {
  currentFunding: number;
  allFunding: CagnotteFundableItem["allFunding"];
} {
  const financers = toArrayOrValues<unknown>(rawFinancer).map(asRecord);
  const allFunding = financers.map((f, index) => ({
    id: toString(f.id) || `financer-${index}`,
    financerName: toString(f.name) || toString(f.financerName) || "",
    financerId: toString(f.id) || toString(f.financerId) || undefined,
    financerType: toString(f.type) || toString(f.financerType) || undefined,
    amount: toNumber(f.amount),
    date: toTimestampOrNow(f.date),
    paymentStatus: "paid" as const,
    transactionId: toString(f.transactionId) || toString(f.id) || `TX-${index}`,
    fundingType: toString(f.fundingType) || undefined,
    fundingIndex: index,
  }));
  const currentFunding = financers.reduce((sum, f) => sum + toNumber(f.amount), 0);
  return { currentFunding, allFunding };
}

/**
 * Construit la ressource finançable D'UNE RÉPONSE, sans passer par l'enveloppe.
 *
 * L'enveloppe (`useFundingEnvelope`) est une lecture de MASSE, scopée au contexte de
 * l'entité interrogée : une réponse déposée sous un autre contexte n'y figure pas, et
 * la ressource sort alors `undefined` — plus de montants, plus de `projectId`, donc
 * plus de section actions ni de création de palier.
 *
 * Or la réponse porte déjà tout l'essentiel : son projet (`project.id`, écrit par
 * `generateProject` / `associateExistingProject`) et ses dépenses. C'est le pendant, au
 * niveau RESSOURCE, de ce que `buildItemsFromRawDepenses` fait au niveau ITEM : la
 * réponse est la source primaire, l'enveloppe n'est qu'un enrichissement.
 *
 * @param answerLike - `answer.serverData` (ou l'entité : `getServerData` est appliqué).
 * @param step - étape portant `depense[]`. Défaut `DEFAULT_AAC_STEP` ; les appelants
 *   qui résolvent leur étape doivent la passer.
 * @returns la ressource, ou `null` si la réponse n'a pas d'identifiant exploitable.
 */
export function buildResourceFromAnswer(
  answerLike: unknown,
  step: string = DEFAULT_AAC_STEP,
): CagnotteResource | null {
  const answer = getServerData(answerLike);
  const answerId = getEntityId(answer);
  if (!answerId) return null;

  const stepAnswers = asRecord(asRecord(answer.answers)[step]);

  // `depense[]` arrive parfois sérialisé en objet (pollution Mongo `{}` ↔ `[]`) :
  // `toArrayOrValues` couvre les deux formes, `toArray` viderait la liste en silence.
  const rawDepenses = toArrayOrValues<unknown>(stepAnswers.depense).map(asRecord);

  const items = buildItemsFromRawDepenses(rawDepenses, []);
  const openItems = items.filter((item) => item.status !== "close");

  const project = asRecord(answer.project);
  const projectId = getEntityId(project);

  return {
    fromType: "proposition",
    id: answerId,
    answerId,
    projectId: projectId || undefined,
    // Même champ que la ressource issue de l'enveloppe (`proposition.titre`), lu à
    // la source — sinon la modale afficherait « sans titre » sur ce chemin.
    name: toString(stepAnswers.titre) || toString(project.name),
    resourceTotalAmount: openItems.reduce((sum, item) => sum + toSafeInt(item.price), 0),
    resourceFinancedAmount: openItems.reduce((sum, item) => sum + toSafeInt(item.currentFunding), 0),
    items,
  };
}

/**
 * Projette `depense[]` en items finançables, en FUSIONNANT chaque ligne brute avec
 * l'item enrichi qui lui correspond (`targetResource.items`, produit par
 * `useCagnotteAdapter` depuis l'enveloppe).
 *
 * La ligne BRUTE est la source de vérité pour tout ce qu'un formulaire édite —
 * `name`, `price`, `status`, `description`. Dans `MilestoneListField`, `rawDepenses`
 * est la valeur react-hook-form, déjà modifiée par le geste (suppression, clôture,
 * montant), alors que `enrichedItems` est une photo serveur figée jusqu'à la
 * soumission. Retourner l'item enrichi tel quel ré-affichait la ligne supprimée,
 * laissait un palier clôturé en « open », gardait l'ancien montant — et, par
 * cascade, « Modifier » ouvrait la modale sur une AUTRE ligne (`depenseIndex`
 * serveur relu dans `list[editIndex]` local).
 *
 * De l'enrichi, on ne reprend que ce que la ligne brute ne porte pas : `actions`
 * et les agrégats de financement (`funding`, `currentFunding`, `unpaidFunding`,
 * `userPledge`, `allFunding`). Sans item enrichi, ces agrégats sont reconstruits
 * depuis `depense.financer`.
 *
 * L'appariement se fait par `milestoneId` SEUL : une position est instable dès
 * qu'une ligne est retirée localement (la survivante devient la ligne 0, l'item
 * serveur 0 est la ligne supprimée), l'identifiant de palier, lui, traverse le
 * geste. Une ligne sans `milestone` n'est donc jamais enrichie — c'est le prix de
 * la stabilité. `depenseIndex` est l'index LOCAL : c'est lui que les gestes du
 * champ relisent (`list[item.depenseIndex]`).
 *
 * Pour les appelants qui passent des dépenses SERVEUR (`CommunFinancingSection`,
 * `CommunFinancingCard`, `CommunCofinancersTable`), brut et enrichi décrivent la
 * même ligne du même document : la fusion y est sans effet.
 */
export function buildItemsFromRawDepenses(
  rawDepenses: UnknownRecord[],
  enrichedItems: CagnotteFundableItem[],
): CagnotteFundableItem[] {
  return rawDepenses.map((d, index) => {
    const milestoneId = toString(d.milestone);
    const enriched =
      milestoneId !== "" ? enrichedItems.find((it) => it.milestoneId === milestoneId) : undefined;

    const fromRaw = {
      fromType: "depense" as const,
      itemId: toString(d.id) || String(index),
      milestoneId,
      depenseIndex: index,
      name: toString(d.poste),
      description: toString(d.description),
      price: toSafeInt(d.priceInt ?? d.price),
      status: d.include !== false ? "open" : "close",
    };

    if (enriched) {
      return {
        ...fromRaw,
        actions: enriched.actions,
        funding: enriched.funding,
        currentFunding: enriched.currentFunding,
        unpaidFunding: enriched.unpaidFunding,
        userPledge: enriched.userPledge,
        allFunding: enriched.allFunding,
      };
    }

    const { currentFunding, allFunding } = buildFallbackFundingFromRawFinancers(d.financer);

    return {
      ...fromRaw,
      actions: [],
      funding: [],
      currentFunding,
      unpaidFunding: 0,
      userPledge: 0,
      allFunding,
    };
  });
}
