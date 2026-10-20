/**
 * La sélection (`choose`) déclarée par la config ⇄ celle que porte le formulaire.
 *
 * `config.aac.directory.fields.choose` n'est jamais déduit (cf. `resolveAacCardFields`) : c'est ce
 * qui empêche un AAP de voir toutes ses propositions « En attente ». La contrepartie est un oubli
 * SILENCIEUX — Zod, l'audit et le préflight restent verts — dans les deux sens :
 *  - un vrai AAC sans `choose` déclaré publie TOUTES ses propositions titrées, sans badge ni bouton ;
 *  - un `choose` qui ne désigne aucune question restreint l'annuaire public à des sélections qui
 *    n'existent pas : il sort vide.
 *
 * Le signal est la QUESTION `choose` du formulaire, pas `aapType` : le formulaire de la Fédération
 * des CAE, un AAC avec sélection, n'a pas d'`aapType` (mesuré en PROD le 14/10).
 *
 * Lu par `config:probe` (formulaire réel, backend) et, en développement, par l'annuaire.
 */
import type { AacFormMeta } from "./formMeta";
import { parseFieldPath } from "./resolveAacCardFields";

const CHOOSE_ID = "choose";

export type AacChooseFinding =
  /** Le formulaire a une étape de sélection que la config ne déclare pas. */
  | { kind: "non-declaree"; formPath: string; message: string }
  /** Le chemin déclaré n'est pas une réponse `answers.<étape>.<id>` : il est ignoré. */
  | { kind: "mal-formee"; declared: string; message: string }
  /** Le chemin déclaré ne désigne aucune question du formulaire. */
  | { kind: "introuvable"; declared: string; formPath: string | null; message: string };

/** Les chemins `answers.<étape>.choose` que porte le formulaire, dans l'ordre des étapes. */
function formChoosePaths(meta: Pick<AacFormMeta, "byStep">): string[] {
  return Object.entries(meta.byStep)
    .filter(([, ids]) => ids.includes(CHOOSE_ID))
    .map(([stepKey]) => `answers.${stepKey}.${CHOOSE_ID}`);
}

export function diagnoseAacChoose(
  meta: Pick<AacFormMeta, "byStep">,
  declaredRaw: unknown,
): AacChooseFinding | null {
  const formPath = formChoosePaths(meta)[0] ?? null;
  const declared = typeof declaredRaw === "string" ? declaredRaw.trim() : "";

  if (!declared) {
    if (!formPath) return null;
    return {
      kind: "non-declaree",
      formPath,
      message:
        `le formulaire porte une étape de sélection (${formPath}) que la config ne déclare pas ` +
        `(aac.directory.fields.choose) : l'annuaire publie TOUTES les propositions titrées, sans badge ` +
        `ni bouton « Ajouter à l'annuaire ». AAC : déclarer "${formPath}". AAP qui publie tout : voulu.`,
    };
  }

  const parsed = parseFieldPath(declared);
  if (!parsed || parsed.stepKey === null) {
    return {
      kind: "mal-formee",
      declared,
      message:
        `aac.directory.fields.choose = "${declared}" n'est pas une réponse answers.<étape>.<id> : ` +
        `il est IGNORÉ, l'annuaire publie tout` + (formPath ? ` (le formulaire porte ${formPath})` : "") + ".",
    };
  }

  if (!meta.byStep[parsed.stepKey]?.includes(parsed.id)) {
    return {
      kind: "introuvable",
      declared,
      formPath,
      message:
        `aac.directory.fields.choose = "${declared}" ne désigne aucune question du formulaire : ` +
        `l'annuaire public, restreint aux sélectionnées, sort VIDE` +
        (formPath ? ` — le formulaire porte ${formPath}.` : " — le formulaire n'a pas d'étape de sélection (AAP : retirer la clé)."),
    };
  }

  return null;
}
