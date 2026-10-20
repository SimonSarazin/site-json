/**
 * Ce que la fiche d'un commun donne au SEO — fonction PURE.
 *
 * Titre, description et image se lisent par leur RÉFÉRENCE RÉSOLUE
 * (`directory.fields`, cf. `resolveAacCardFields`), jamais par un identifiant de
 * question en dur (`doc/34-module-aac.md` §9). Les replis suivent ceux de la
 * fiche elle-même (`CommunHero` : `answers.<étape dépense>.titre` /
 * `.description`) puis les champs pré-calculés par le backend (`name`,
 * `descriptionStr`, `image`) — qui ne sont PAS un contrat (cf. `parseAacAnswer`).
 */
import type { AacCardFieldRef, AacCardFields } from "./resolveAacCardFields";
import { stripMarkdown } from "@/modules/blog/lib/markdown";

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
const toStr = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Le libellé que le backend pose quand le titre est absent — pas un titre. */
const BACKEND_NO_TITLE = "(No title)";

/** Longueur usuelle d'une meta description (même borne que `BlogArticleSeo`). */
const DESCRIPTION_MAX = 160;

/** Jumeau de `readField` (`parseAacAnswer`) : étape ⇒ `answers.<étape>.<id>`, sinon racine (chemin pointé). */
function readRef(doc: Rec, ref: AacCardFieldRef | null | undefined): unknown {
  if (!ref) return undefined;
  if (ref.stepKey !== null) return rec(rec(doc.answers)[ref.stepKey])[ref.id];
  return ref.id
    .split(".")
    .reduce<unknown>((node, key) => (Array.isArray(node) ? node[Number(key)] : rec(node)[key]), doc);
}

/** Jumeau de `absoluteUrl` (`parseAacAnswer`). */
function absoluteUrl(baseUrl: string, src: string): string {
  if (!src) return src;
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("data:")) return src;
  return src.startsWith("/") ? `${baseUrl}${src}` : `${baseUrl}/${src}`;
}

export interface CommunSeoData {
  /** `""` si rien ne peut faire titre — l'appelant met son repli. */
  title: string;
  /** Texte brut (markdown retiré), borné à 160 caractères ; `""` à défaut. */
  description: string;
  /** URL absolue, ou `null`. */
  image: string | null;
}

export interface ResolveCommunSeoOptions {
  fields: Partial<AacCardFields>;
  /** L'étape qui porte `titre`/`description` en repli — `config.roles.depenseStepKey`. */
  depenseStepKey?: string | null;
  /** Base des URLs d'upload (backend), pour absolutiser une image relative. */
  baseUrl?: string;
}

export function resolveCommunSeo(
  answerLike: unknown,
  { fields, depenseStepKey, baseUrl = "" }: ResolveCommunSeoOptions,
): CommunSeoData {
  const a = rec(answerLike);
  const stepAnswers = depenseStepKey ? rec(rec(a.answers)[depenseStepKey]) : {};

  const preTitle = toStr(a.name);
  const title =
    toStr(readRef(a, fields.title)) ||
    toStr(stepAnswers.titre) ||
    (preTitle !== BACKEND_NO_TITLE ? preTitle : "");

  const rawDescription =
    toStr(readRef(a, fields.description)) || toStr(stepAnswers.description) || toStr(a.descriptionStr);
  const plain = rawDescription ? stripMarkdown(rawDescription) : "";
  const description =
    plain.length > DESCRIPTION_MAX ? `${plain.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : plain;

  // Une image n'est retenue que sous forme de CHEMIN : un uploader peut porter
  // des documents structurés, que le SEO n'a pas à deviner.
  const imagePath = toStr(readRef(a, fields.image)) || toStr(a.image);
  const image = imagePath ? absoluteUrl(baseUrl, imagePath) : null;

  return { title, description, image };
}
