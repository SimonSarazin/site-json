/**
 * Résolution des QUESTIONS que la carte d'annuaire doit lire — fonction PURE.
 *
 * Deux problèmes distincts, qu'il ne faut pas confondre :
 *
 *  - les clés d'ÉTAPE (`aapStep1`…) sont une convention structurelle variable
 *    (4 ou 5 étapes) ⇒ toujours DÉRIVÉES, via `AacStepRoles` ;
 *  - les ids de QUESTION (`aapStep1m2ucu54mopm33osqxpd`…) sont une DONNÉE propre
 *    à un formulaire ⇒ ils entrent par la config du site, jamais par le code.
 *
 * D'où la chaîne de résolution, du plus explicite au plus devinatoire :
 *   override de config > `form.mapping` > scan des types/libellés > défauts.
 *
 * ⚠️ L'override de config est un CHEMIN, lu par `parseFieldPath` :
 *
 *  - `answers.<étape>.<id>` pour une RÉPONSE — l'étape en fait partie, car un
 *    form a plusieurs étapes et la seule devinette disponible ici serait l'étape
 *    du RÔLE (`depenseStepKey`, ou `evalStepKey` pour `choose`) : juste dans le
 *    cas canonique, faux dès qu'une question sort de son étape attendue, et
 *    indisponible quand la dérivation échoue. C'est aussi la forme de
 *    `form.mapping` en base ;
 *  - un chemin RACINE de profondeur libre (`name`, `links.cae`…) pour ce qui
 *    n'est pas une réponse : champs pré-calculés par le backend, ou branches
 *    métier propres à la PLATEFORME (le vivier de membres d'un commun vit dans
 *    `links.cae` sur la fédé des CAE, `links.tls` sur les tiers-lieux).
 *
 * La distinction n'est pas cosmétique : un champ racine est calculé APRÈS la
 * requête, il n'est donc pas interrogeable côté serveur (cf. `aacQueryParams`).
 *
 * `source` expose lequel a répondu, sur le modèle de `criteriaSource` : c'est ce
 * qui permet de diagnostiquer une carte vide sans avoir à deviner.
 */
import type { AacFormMeta, AacOption, AacQuestionMeta } from "./formMeta";
import type { AacStepRoles } from "../types";

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
const toStr = (v: unknown): string => (typeof v === "string" ? v : "");

/** Les rôles de champ dont la carte et les filtres ont besoin. */
export type AacCardFieldRole =
  | "title"
  | "description"
  | "tags"
  | "maturity"
  | "image"
  | "depense"
  | "choose"
  | "users";

/** Un champ résolu, avec son chemin de lecture déjà construit. */
export interface AacCardFieldRef {
  /**
   * Étape porteuse, ou `null` quand le champ vit à la RACINE du document —
   * les champs pré-calculés par le backend (`name`, `descriptionStr`, `tags`,
   * `image`, `funds`…) ne sont pas des réponses et n'ont donc pas d'étape.
   */
  stepKey: string | null;
  id: string;
  /** Chemin complet dans le document : `answers.<stepKey>.<id>`, ou `<id>` à la racine. */
  path: string;
  label: string;
  options: AacOption[];
}

export type AacCardFields = Record<AacCardFieldRole, AacCardFieldRef | null>;

/** D'où vient chaque rôle résolu — pour le diagnostic. */
export type AacCardFieldSource = "config" | "mapping" | "scan" | "default" | "none";

export interface ResolvedAacCardFields {
  fields: AacCardFields;
  source: Record<AacCardFieldRole, AacCardFieldSource>;
}

export const AAC_CARD_FIELD_ROLES: AacCardFieldRole[] = [
  "title",
  "description",
  "tags",
  "maturity",
  "image",
  "depense",
  "choose",
  "users",
];

/**
 * Aucun rôle résolu — l'état AVANT que le formulaire ne soit chargé, ou quand il
 * est indisponible.
 *
 * Ce n'est pas un état d'erreur : `parseAacAnswer` retombe alors sur les champs
 * PRÉ-CALCULÉS par le backend (`name`, `descriptionStr`, `tags`, `image`,
 * `funds`…), qui suffisent à rendre une carte. La résolution des questions
 * affine ; elle ne conditionne pas l'affichage.
 */
export const EMPTY_AAC_CARD_FIELDS: AacCardFields = Object.freeze(
  Object.fromEntries(AAC_CARD_FIELD_ROLES.map((r) => [r, null]))
) as AacCardFields;

/** Noms canoniques du legacy AAP, dernier recours quand rien n'a répondu. */
const DEFAULT_IDS: Record<AacCardFieldRole, string | null> = {
  title: "titre",
  description: "description",
  tags: "tags",
  maturity: null, // aucun nom canonique : la maturité est propre à chaque AAC
  image: "image",
  depense: "depense",
  choose: "choose",
  // Aucun défaut : le vivier de membres est propre à la PLATEFORME, pas au
  // formulaire (`links.cae`, `links.tls`…). Non résolu ⇒ `parseAacAnswer`
  // retombe sur le `user_count` du backend.
  users: null,
};

/** Rôles portés par l'étape d'évaluation plutôt que par l'étape de dépôt. */
const EVAL_ROLES = new Set<AacCardFieldRole>(["choose"]);

/** Le chemin de lecture d'un champ : `answers.<étape>.<id>`, ou `<id>` à la racine. */
function fieldPath(stepKey: string | null, id: string): string {
  return stepKey ? `answers.${stepKey}.${id}` : id;
}

function toRef(meta: AacQuestionMeta): AacCardFieldRef {
  return {
    stepKey: meta.stepKey,
    id: meta.id,
    path: fieldPath(meta.stepKey, meta.id),
    label: meta.label,
    options: meta.options,
  };
}

/** Référence « nue » : le rôle est connu par son id, mais aucune question du form
 *  ne le décrit — champ racine, défaut canonique, ou `mapping` périmé. */
function bareRef(stepKey: string | null, id: string): AacCardFieldRef {
  return { stepKey, id, path: fieldPath(stepKey, id), label: id, options: [] };
}

/** Un chemin de champ, une fois relu. `stepKey: null` ⇒ racine du document. */
export interface AacFieldPath {
  stepKey: string | null;
  /** Clé de question dans l'étape, ou chemin POINTÉ à la racine (`links.cae`). */
  id: string;
}

/**
 * Lit un chemin de champ — l'inverse exact de `fieldPath`. Deux mondes :
 *
 *  - `answers.<étape>.<id>` — une RÉPONSE. L'étape en fait partie : un form AAP
 *    en compte 4 ou 5, et l'id seul obligerait à la deviner. Profondeur IMPOSÉE
 *    à trois segments : c'est la forme du stockage (`answers[étape][id]`) ;
 *  - tout le reste — un chemin à la RACINE du document, de profondeur libre :
 *    un champ pré-calculé par le backend (`name`, `descriptionStr`, `tags`,
 *    `image`, `funds`…) ou une branche métier (`links.cae`, `links.tls`,
 *    `allVoteCount.love`). Ces données n'appartiennent à aucune étape, et leur
 *    arborescence n'est pas la nôtre — d'où l'absence de contrainte.
 *
 * `null` sur une valeur vide, non-chaîne, à segment vide, ou sur un chemin
 * `answers.*` d'une autre profondeur — celui-là est une FAUTE, pas une lecture
 * racine : `answers.q_x` ne désigne rien, `answers` étant indexé par étape. La
 * config n'étant JAMAIS parsée par Zod au runtime, l'appelant retombe alors sur
 * la suite de la chaîne plutôt que de viser un chemin fabriqué.
 */
export function parseFieldPath(raw: unknown): AacFieldPath | null {
  const value = toStr(raw).trim();
  if (!value) return null;

  const parts = value.split(".");
  if (parts.some((p) => !p)) return null;

  if (parts[0] === "answers") {
    return parts.length === 3 ? { stepKey: parts[1], id: parts[2] } : null;
  }
  return { stepKey: null, id: value };
}

/** Lit `form.mapping`, qui associe des rôles à des chemins `answers.<step>.<id>`. */
function fromMapping(mapping: unknown, role: AacCardFieldRole): AacFieldPath | null {
  const m = rec(mapping);
  const raw = m[role];
  return parseFieldPath(typeof raw === "object" ? rec(raw).path : raw);
}

/**
 * Heuristique de dernier recours, bornée à l'étape concernée.
 * Volontairement conservatrice : mieux vaut `null` — et un filtre masqué — qu'un
 * champ deviné qui afficherait la mauvaise donnée.
 */
function scan(
  role: AacCardFieldRole,
  candidates: AacQuestionMeta[]
): AacQuestionMeta | null {
  const byType = (...types: string[]) =>
    candidates.find((c) => types.includes(c.componentType)) ?? null;

  switch (role) {
    case "title":
      return byType("text");
    case "description":
      return byType("textarea");
    case "image":
      return byType("uploader");
    case "tags":
      // La question la plus « riche en options » parmi les multi-valeurs.
      return (
        candidates
          .filter(
            (c) =>
              c.options.length > 0 &&
              ["checkbox", "multiCheckboxPlus", "select", "unknown"].includes(
                c.componentType
              )
          )
          .sort((a, b) => b.options.length - a.options.length)[0] ?? null
      );
    case "maturity":
      // Par le LIBELLÉ, jamais par l'id (qui est généré).
      return (
        candidates.find(
          (c) =>
            /matur|avancement|stade/i.test(c.label) &&
            ["radio", "select", "multiRadio"].includes(c.componentType)
        ) ?? null
      );
    default:
      return null;
  }
}

/**
 * @param overrides `config.aac.directory.fields` — un chemin par rôle :
 *   `answers.<étape>.<id>` (réponse) ou `<id>` (champ racine du document).
 *   Toute autre forme est ignorée.
 */
export function resolveAacCardFields(
  meta: AacFormMeta,
  roles: AacStepRoles,
  overrides?: Partial<Record<AacCardFieldRole, string>>
): ResolvedAacCardFields {
  const mainStep = roles.depenseStepKey ?? Object.keys(meta.byStep)[0] ?? null;
  const evalStep = roles.evalStepKey ?? null;

  const fields = {} as AacCardFields;
  const source = {} as Record<AacCardFieldRole, AacCardFieldSource>;

  for (const role of AAC_CARD_FIELD_ROLES) {
    // 1. Override de config — l'échappatoire déterministe.
    //
    // Traité AVANT toute dérivation : le chemin porte SA propre étape, donc il
    // reste exploitable là où l'étape du rôle est introuvable (form atypique) ou
    // simplement différente (question déplacée hors de son étape attendue).
    const override = parseFieldPath(overrides?.[role]);
    if (override) {
      // `known.stepKey` est toujours une chaîne : un chemin racine ne peut donc
      // pas emprunter les métadonnées d'une question homonyme (`tags` existe
      // dans les deux mondes).
      const known = meta.byId[override.id];
      fields[role] =
        known && known.stepKey === override.stepKey
          ? toRef(known)
          : bareRef(override.stepKey, override.id);
      source[role] = "config";
      continue;
    }

    // Sans chemin explicite, on retombe sur l'étape du RÔLE — une déduction.
    const stepKey = EVAL_ROLES.has(role) ? evalStep : mainStep;
    if (!stepKey) {
      fields[role] = null;
      source[role] = "none";
      continue;
    }

    // Les questions candidates au scan : celles de l'étape du rôle.
    const candidates = (meta.byStep[stepKey] ?? [])
      .map((id) => meta.byId[id])
      .filter(Boolean);

    // 2. `form.mapping` — ⚠️ potentiellement PÉRIMÉ en base, d'où sa 2e place.
    //    Retenu seulement si le chemin décrit le form TEL QU'IL EST : question
    //    connue ET sur l'étape annoncée. Sinon le scan dira mieux.
    const mapped = fromMapping(meta.mapping, role);
    const mappedMeta = mapped ? meta.byId[mapped.id] : undefined;
    if (mapped && mappedMeta && mappedMeta.stepKey === mapped.stepKey) {
      fields[role] = toRef(mappedMeta);
      source[role] = "mapping";
      continue;
    }

    // 3. Scan des types / libellés.
    const scanned = scan(role, candidates);
    if (scanned) {
      fields[role] = toRef(scanned);
      source[role] = "scan";
      continue;
    }

    // 4. Défaut canonique du legacy.
    const fallbackId = DEFAULT_IDS[role];
    if (fallbackId) {
      const known = meta.byId[fallbackId];
      fields[role] =
        known && known.stepKey === stepKey ? toRef(known) : bareRef(stepKey, fallbackId);
      source[role] = "default";
      continue;
    }

    fields[role] = null;
    source[role] = "none";
  }

  return { fields, source };
}
