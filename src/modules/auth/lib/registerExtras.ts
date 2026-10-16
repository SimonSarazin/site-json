/**
 * Inscription avec CHAMPS SUPPLÉMENTAIRES et MODE d'activation (cocolight-backend/docs/33, étape 5).
 *
 * Deux fonctions pures, testées sans React :
 *  - `visibleRegisterFields` : les champs de `auth.register.fields` à rendre/valider dans l'état courant
 *    (`showIf` tranché contre les valeurs saisies) ;
 *  - `collectRegisterFields` : les valeurs NON VIDES des champs VISIBLES — ce qui part au serveur. Un
 *    champ masqué par `showIf` n'est jamais envoyé, même s'il a été rempli avant d'être masqué (ex.
 *    `othersTypepro` saisi puis `typepro` changé) : sinon le citoyen porterait une précision orpheline.
 *
 * Et l'appel `registerWithExtras`, qui pose `mode` et `fields` sur `userApi.register` (SDK ≥ 1.0.198,
 * docs/33 étape 4) : les types viennent du SDK, seul l'allègement du payload est fait ici.
 */
import type { UserApi } from "@communecter/cocolight-api-client";
import type { RegisterFieldConfig } from "../schema";

/** Paramètres de `userApi.register`, tels que le SDK les type (`fields` posés À PLAT dans le POST). */
export type RegisterParamsWithExtras = Parameters<UserApi["register"]>[0];
export type RegisterMode = NonNullable<RegisterParamsWithExtras["mode"]>;

/** Réponse brute de `person/register` (le legacy fait foi : `result` + `msg`) — le SDK la rend en `any`. */
export interface RegisterResponse {
  result: boolean;
  msg?: string;
  [k: string]: unknown;
}

/** Un champ est visible si sans `showIf`, ou si le champ désigné porte exactement la valeur attendue. */
export function isRegisterFieldVisible(field: RegisterFieldConfig, values: Record<string, string>): boolean {
  if (!field.showIf) return true;
  return (values[field.showIf.field] ?? "") === field.showIf.equals;
}

export function visibleRegisterFields(
  fields: readonly RegisterFieldConfig[] | undefined,
  values: Record<string, string>,
): RegisterFieldConfig[] {
  return (fields ?? []).filter((f) => isRegisterFieldVisible(f, values));
}

/** Premier champ VISIBLE et `required` laissé vide (espaces exclus), ou `undefined` si tout est rempli. */
export function firstMissingRequiredField(
  fields: readonly RegisterFieldConfig[] | undefined,
  values: Record<string, string>,
): RegisterFieldConfig | undefined {
  return visibleRegisterFields(fields, values).find((f) => f.required && !(values[f.name] ?? "").trim());
}

/** Valeurs non vides des champs visibles, dans l'ordre de la config. `{}` si rien à envoyer. */
export function collectRegisterFields(
  fields: readonly RegisterFieldConfig[] | undefined,
  values: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of visibleRegisterFields(fields, values)) {
    const v = (values[f.name] ?? "").trim();
    if (v) out[f.name] = v;
  }
  return out;
}

/**
 * `userApi.register` avec `mode`/`fields`. `mode` absent et `fields` vide ne sont PAS posés : l'appel
 * reste alors byte-identique à l'inscription d'avant (le backend applique son défaut `normal`).
 */
export function registerWithExtras(userApi: UserApi, params: RegisterParamsWithExtras): Promise<RegisterResponse> {
  const { fields, mode, ...rest } = params;
  const payload: RegisterParamsWithExtras = {
    ...rest,
    ...(mode ? { mode } : {}),
    ...(fields && Object.keys(fields).length > 0 ? { fields } : {}),
  };
  return userApi.register(payload) as Promise<RegisterResponse>;
}
