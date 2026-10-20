import type { CoFormInputField } from "../types";

/**
 * Résolution de l'indirection `multiDecide`.
 *
 * `tpls.forms.ocecoform.multiDecide` n'est PAS un champ de saisie : c'est un
 * placeholder que l'admin du formulaire pointe vers un type de décision réel,
 * via `forms.inputConfig.multiDecide`. Le legacy (`step_v2.php:387-393`) fait
 * la substitution au rendu — il remplace le type ET RÉINDEXE l'input sous une
 * nouvelle clé, le dernier segment du type cible.
 *
 * Mesuré en base (`pixelhumain1`) : 266 inputs `multiDecide` sur 206 formulaires,
 * et **aucune réponse ne porte la clé d'origine** (`decide` : 0 occurrence). Les
 * clés réellement stockées sont celles d'après substitution — `selection` (654
 * réponses), `evaluation` (36), `pourContre` (11). Résoudre la clé n'est donc
 * pas un détail cosmétique : sans cela on lit et on écrit au mauvais endroit.
 *
 * Quand aucune config n'est posée (130 formulaires), le legacy rend le template
 * `multiDecide.php`, qui n'affiche qu'un `<select>` réservé à l'admin du
 * formulaire (`if ($canEditForm)`) — donc RIEN pour un répondant. D'où le `null`
 * renvoyé ici, et non un champ « type inconnu ».
 */

const SEGMENT_MULTI_DECIDE = "multiDecide";

/** Détection par segment, comme `in_array(..., explode(".", $type))` côté legacy. */
export function isMultiDecideType(type: string | undefined | null): boolean {
  if (!type) return false;
  return type.split(".").indexOf(SEGMENT_MULTI_DECIDE) !== -1;
}

/**
 * Clé sous laquelle l'input substitué est réindexé : le dernier segment du type
 * cible (`tpls.forms.aap.selection` → `selection`).
 */
export function multiDecideTargetKey(targetType: string): string {
  const segments = targetType.split(".");
  return segments[segments.length - 1];
}

export interface MultiDecideResolution {
  /** Clé effective de l'input après substitution. */
  key: string;
  /** Input effectif : même définition, mais porteur du type cible. */
  field: CoFormInputField;
}

/**
 * Renvoie l'input effectif, ou `null` si l'input ne doit pas être rendu.
 *
 * - input ordinaire → renvoyé tel quel ;
 * - `multiDecide` + config posée → substitué (type + clé) ;
 * - `multiDecide` sans config → `null` (parité legacy : invisible au répondant).
 */
export function resolveMultiDecide(
  fieldKey: string,
  fieldData: CoFormInputField,
  inputConfig: { multiDecide?: string } | null | undefined
): MultiDecideResolution | null {
  if (!isMultiDecideType(fieldData.type)) {
    return { key: fieldKey, field: fieldData };
  }

  const target = inputConfig?.multiDecide;
  if (!target || typeof target !== "string" || target.trim() === "") return null;

  return {
    key: multiDecideTargetKey(target),
    // La définition d'origine est conservée (label, info, isRequired…) : le
    // legacy réaffecte `$input` lui-même, seul son `type` change.
    field: { ...fieldData, type: target },
  };
}
