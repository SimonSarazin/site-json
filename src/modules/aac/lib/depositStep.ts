/**
 * Quelle ÉTAPE du formulaire constitue le dépôt d'un commun — fonction PURE.
 *
 * Un form AAP compte 4 ou 5 étapes, dont une seule est le dépôt : les suivantes
 * sont l'évaluation, le financement et le suivi, réservées à des rôles
 * (`params.<step>.canEdit = "Financeur,Evaluateur"` sur l'AAC de référence).
 * Ouvrir le formulaire ENTIER exposerait donc à un déposant des étapes qu'il ne
 * peut ni comprendre ni remplir. Le legacy fait le même découpage, via l'option
 * `getFirstStepOnly` du bloc « Déposer un commun » (`/step/aapStep1`).
 *
 * ⚠️ Jamais de `aapStepN` en dur (règle du §4 de la doc module) : la clé est
 * RÉSOLUE, dans cet ordre.
 *
 *  1. **L'étape qui porte le titre.** « Nom du commun » est la question
 *     obligatoire du dépôt, et son rôle est déjà résolu pour la carte
 *     (`resolveAacCardFields`, qui honore l'override de config). L'étape qui la
 *     porte EST donc l'étape de dépôt — y compris sur un form dont la
 *     disposition s'écarte du canon. C'est aussi cohérent par construction avec
 *     le garde anti-brouillons de l'annuaire, posé sur ce même chemin.
 *  2. **La première étape déclarée.** `form.subForms` est un TABLEAU ordonné
 *     (cf. `resolveAacConfig`) : sans titre résolu, son premier élément reste le
 *     meilleur candidat.
 *  3. `null` — on n'impose alors aucune étape et le formulaire complet s'affiche.
 *     Une dégradation lisible vaut mieux qu'une clé devinée qui n'existe pas :
 *     un `stepKey` inconnu rendrait un formulaire VIDE.
 *
 * Le titre pointant un champ RACINE (`name` pré-calculé par le backend, donc
 * `stepKey: null`) ne désigne aucune étape : on retombe alors sur (2).
 */
import type { AacCardFields } from "./resolveAacCardFields";
import type { AacResolvedConfig } from "../types";

export function resolveAacDepositStepKey(
  fields: AacCardFields | null | undefined,
  config: AacResolvedConfig | null | undefined
): string | null {
  const fromTitle = fields?.title?.stepKey;
  if (fromTitle) return fromTitle;

  const firstStep = config?.steps?.[0]?.key;
  return firstStep || null;
}
