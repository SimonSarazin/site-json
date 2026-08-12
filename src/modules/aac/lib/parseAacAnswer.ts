/**
 * Normalise une entrée de `results` de `directoryproposal` en carte d'annuaire.
 * Fonction PURE — c'est la frontière : au-delà, l'UI ne voit plus jamais la
 * forme du backend, ce qui rend la bascule d'endpoint invisible pour elle.
 *
 * Le backend pré-calcule `name` / `descriptionStr` / `tags` / `image` / `funds` /
 * `user_count` / `interrest_count` (`Aap::parsePropositionData`).
 *
 * ⚠️ Ces champs sont un CHEMIN RAPIDE, pas un contrat : ils sont calculés APRÈS
 * la projection `fields` et depuis `answers.aapStep1` **en dur**. Sur une capture
 * à projection étroite, ou sur un AAC dont l'étape de dépôt n'est pas la
 * première, ils reviennent vides — sans la moindre erreur. D'où le repli
 * systématique sur `answers.<étape résolue>.<question résolue>`.
 *
 * Ce que le backend fournit et qu'on ne recalcule PAS : `interrest_count`, et
 * `user_count` tant que `fields.users` n'est pas configuré.
 *
 * ⚠️ `user_count` n'est PAS le nombre de membres du commun : le backend y met la
 * taille de `links.contributors`. Le vivier de membres, lui, dépend de la
 * PLATEFORME (`links.cae` sur la fédé des CAE, `links.tls` sur les tiers-lieux),
 * et un même commun peut être porté par deux AAC avec des chiffres différents.
 * D'où le rôle `users`, dont le chemin est libre — cf. `readField`.
 */
import type { AacCardFieldRef, AacCardFields } from "./resolveAacCardFields";
import { readUsageAnswer, type AacUsageAnswer } from "./aacUsage";

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
const toStr = (v: unknown): string => (typeof v === "string" ? v : "");

/** Entier tolérant, calqué sur `intval()` : préfixe numérique, 0 sinon. */
const toInt = (v: unknown): number => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Secondes Unix, depuis les TROIS formes que ce champ prend selon la source :
 *
 *  - `Date` — ce que rend le SDK. `ApiClient._transformData` normalise chaque
 *    entrée de `results`, et `created`/`updated` sont dans ses `_dateFields` ;
 *  - `number` — la forme de fil, et celle des fixtures ;
 *  - `{sec, usec}` — la forme Mongo héritée, que porte encore `modified`.
 *
 * ⚠️ Ne PAS remplacer par `toInt` : sur une `Date`, `parseInt(String(v))` rend
 * `NaN` — donc `0`. Les tris par date deviendraient inertes, sans erreur.
 */
const toEpochSeconds = (v: unknown): number => {
  if (v instanceof Date) {
    const ms = v.getTime();
    return Number.isFinite(ms) ? Math.trunc(ms / 1000) : 0;
  }
  if (v && typeof v === "object") return toInt((v as Rec).sec);
  return toInt(v);
};

/** Flottant tolérant, calqué sur `floatval()`. */
const toFloat = (v: unknown): number => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Mongo rend indifféremment `{}` ou `[]` pour une collection vide, et une map
 * à clés numériques là où un tableau est attendu. On accepte les trois.
 */
function toArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.values(v as Rec);
  return [];
}

/** Liste de chaînes tolérante : tableau, map, ou chaîne unique. */
function toStringList(v: unknown): string[] {
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  return toArray(v)
    .map((x) => toStr(x).trim())
    .filter(Boolean);
}

/** Jumeau de `resolveFileUrl` de `coform/components/ReadOnlyUploaderGallery`. */
function absoluteUrl(baseUrl: string, src: string): string {
  if (!src) return src;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:")) return src;
  return src.startsWith("/") ? `${baseUrl}${src}` : `${baseUrl}/${src}`;
}

/**
 * Lit un champ résolu sur le document brut, dans le monde que sa référence
 * désigne : `answers.<stepKey>.<id>` pour une réponse, `<id>` à la RACINE quand
 * la référence n'a pas d'étape (champ pré-calculé par le backend).
 */
function readField(doc: Rec, ref: AacCardFieldRef | null): unknown {
  if (!ref) return undefined;
  if (ref.stepKey !== null) return rec(rec(doc.answers)[ref.stepKey])[ref.id];
  // Racine : profondeur libre (`links.cae`), donc on descend segment par segment.
  return ref.id
    .split(".")
    .reduce<unknown>(
      (node, key) => (Array.isArray(node) ? node[Number(key)] : rec(node)[key]),
      doc
    );
}

/** Une dépense telle que le backend la réduit : montant cible + montants financés. */
export interface AacFund {
  price: number;
  financers: number[];
}

/** Ce que consomme la carte. Aucune forme du backend ne transparaît ici. */
export interface AacCommunCard {
  id: string;
  title: string;
  /** `false` quand le backend n'a pas trouvé de titre → l'UI met son libellé. */
  hasTitle: boolean;
  description: string;
  tags: string[];
  maturity: string | null;
  /** URL absolue, ou `null` ⇒ l'UI met SON placeholder. */
  imageUrl: string | null;
  funds: AacFund[];
  totalRequested: number;
  totalFunded: number;
  /** Non borné : le financé PEUT dépasser le demandé (dépense revue à la baisse). */
  progressPercent: number;
  hasFundingRequest: boolean;
  /** Membres du chemin configuré (`fields.users`), sinon `user_count` backend. */
  usersCount: number;
  interestCount: number;
  /** `null` quand l'étape d'évaluation n'est pas dans la réponse ⇒ pas de badge. */
  isSelected: boolean | null;
  /** Usage catégorisé — alimente le filtre « Filtrer par besoins ». */
  usage: AacUsageAnswer;
  /** Horodatages Unix en SECONDES, `0` si absents. Servent au tri. */
  createdAt: number;
  updatedAt: number;
}

export interface ParseAacAnswerOptions {
  fields: AacCardFields;
  /** Id du contexte costum, pour lire `choose[contextId].value`. */
  contextId?: string | null;
  /** Base des URLs d'upload. */
  baseUrl?: string;
  /** Force la question d'usage, sinon repérée par sa forme `{list, sublist}`. */
  usageId?: string | null;
}

/** Le libellé que le backend pose quand `answers.aapStep1.titre` est absent. */
const BACKEND_NO_TITLE = "(No title)";

export function parseAacAnswer(
  raw: unknown,
  { fields, contextId, baseUrl = "", usageId }: ParseAacAnswerOptions
): AacCommunCard {
  const a = rec(raw);
  const answers = rec(a.answers);

  const id = toStr(rec(a._id).$id) || toStr(a._id) || toStr(a.id);

  // Titre : pré-calculé, sinon la question résolue.
  const preTitle = toStr(a.name).trim();
  const rawTitle =
    preTitle && preTitle !== BACKEND_NO_TITLE
      ? preTitle
      : toStr(readField(a, fields.title)).trim();

  // Description et tags : le legacy privilégie la question sur le pré-calculé,
  // parce que la carte affiche un champ précis, pas le premier venu.
  const fromQuestionDesc = toStr(readField(a, fields.description)).trim();
  const description = fromQuestionDesc || toStr(a.descriptionStr).trim();

  const fromQuestionTags = toStringList(readField(a, fields.tags));
  const tags = fromQuestionTags.length > 0 ? fromQuestionTags : toStringList(a.tags);

  const maturityRaw = readField(a, fields.maturity);
  const maturity = toStr(maturityRaw).trim() || null;

  // Budget. `funds` est déjà filtré `include` par le backend ; en repli on lit
  // `depense[]` brut, qui porte encore des objets `financer`.
  const funds: AacFund[] = (
    toArray(a.funds).length > 0
      ? toArray(a.funds)
      : toArray(readField(a, fields.depense))
  ).map((d) => {
    const dep = rec(d);
    return {
      price: toInt(dep.price ?? dep.targetAmount),
      financers: toArray(dep.financer).map((f) =>
        typeof f === "number" || typeof f === "string" ? toFloat(f) : toFloat(rec(f).amount)
      ),
    };
  });

  const totalRequested = funds.reduce((s, f) => s + f.price, 0);
  const totalFunded = funds.reduce(
    (s, f) => s + f.financers.reduce((t, x) => t + x, 0),
    0
  );

  // `max(total, 1)` reproduit la garde du legacy : une dépense à 0 ne divise
  // jamais par zéro. Le résultat n'est PAS plafonné — un sur-financement doit
  // rester visible (« 5 500 € sur 5 000 € »).
  const progressPercent = Math.trunc((totalFunded / Math.max(totalRequested, 1)) * 100);

  const imagePath = toStr(a.image).trim();
  const imageUrl = imagePath ? absoluteUrl(baseUrl, imagePath) : null;

  // Membres. Chemin configuré ⇒ on compte ses entrées, **sans repli** : « 0
  // membre sur CETTE plateforme » est une réponse juste, alors que retomber sur
  // `user_count` afficherait le compte de contributeurs — voire celui de l'autre
  // AAC porteur du même commun.
  const usersCount = fields.users
    ? toArray(readField(a, fields.users)).length
    : toInt(a.user_count);

  // Badge « En attente » : indécidable si l'étape d'évaluation n'a pas été
  // projetée. `null` ⇒ le composant n'affiche pas de badge, plutôt que d'en
  // afficher un faux.
  const chooseRef = fields.choose;
  let isSelected: boolean | null = null;
  if (chooseRef && contextId && (chooseRef.stepKey === null || chooseRef.stepKey in answers)) {
    const choose = rec(readField(a, chooseRef));
    isSelected = toStr(rec(choose[contextId]).value) === "selected";
  }

  return {
    id,
    title: rawTitle,
    hasTitle: rawTitle !== "",
    description,
    tags,
    maturity,
    imageUrl,
    funds,
    totalRequested,
    totalFunded,
    progressPercent,
    hasFundingRequest: totalFunded > 0,
    usersCount,
    interestCount: toInt(a.interrest_count),
    isSelected,
    // L'usage vit dans l'étape de DÉPÔT, celle que porte `fields.title` — jamais
    // une clé d'étape en dur.
    usage: readUsageAnswer(answers[fields.title?.stepKey ?? mainStepKey(answers)], usageId),
    createdAt: toEpochSeconds(a.created),
    updatedAt: toEpochSeconds(a.updated),
  };
}

/** Première étape présente — le repli quand aucun champ n'a été résolu. */
function mainStepKey(answers: Rec): string {
  return Object.keys(answers)[0] ?? "";
}
