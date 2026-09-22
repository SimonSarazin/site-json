/**
 * Résout les blocs de prose de la FICHE d'un commun, déclarés sous
 * `config.aac.detail.sections`.
 *
 * Le pendant de `resolveAacCardFields` pour la fiche, avec une différence
 * assumée : **aucune heuristique**. L'annuaire peut deviner quelle question porte
 * le titre ou les tags — ce sont des rôles universels. La fiche, elle, n'a aucun
 * moyen de dire quelles questions d'un appel méritent une section ni dans quel
 * ordre. Une liste absente rend donc zéro bloc, plutôt qu'une suite de blocs
 * vides.
 *
 * La grammaire de chemin est celle de l'annuaire, relue par `parseFieldPath` :
 * `answers.<étape>.<id>` ou un chemin racine. Une entrée au chemin illisible est
 * ÉCARTÉE — jamais rendue avec un chemin fabriqué.
 */
import type { AacFormMeta } from "./formMeta";
import { parseFieldPath, type AacCardFieldRef } from "./resolveAacCardFields";
import type { AacDetailSectionConfig } from "../schema";

/** Un bloc prêt à rendre : son ancre, son intitulé, et où lire son contenu. */
export interface AacDetailSection {
  /** Ancre DOM et cible du sommaire. */
  id: string;
  /** Intitulé résolu — celui de la config, sinon le libellé de la question. */
  title: string;
  kicker?: string;
  icon?: string;
  /** Où lire la valeur, avec l'étape déjà séparée de l'id. */
  field: AacCardFieldRef;
}

/**
 * @param declared les blocs tels que la config les déclare, dans l'ordre.
 * @param titleOf rend le titre d'une chaîne localisée. Injecté plutôt qu'importé :
 *   cette fonction reste pure et testable sans contexte i18n.
 */
export function resolveAacDetailSections(
  meta: AacFormMeta | null,
  declared: AacDetailSectionConfig[] | undefined,
  titleOf: (value: unknown) => string = (v) => (typeof v === "string" ? v : "")
): AacDetailSection[] {
  if (!meta || !declared?.length) return [];

  const vus = new Set<string>();
  const out: AacDetailSection[] = [];

  for (const entree of declared) {
    const id = String(entree?.id ?? "").trim();
    // Un id vide ne peut ni ancrer ni figurer au sommaire ; un doublon ferait
    // pointer deux entrées de sommaire sur la même ancre.
    if (!id || vus.has(id)) continue;

    const chemin = parseFieldPath(entree?.field);
    if (!chemin) continue;

    // `known.stepKey === chemin.stepKey` : même garde que `resolveAacCardFields`.
    // Un chemin racine ne doit pas emprunter les métadonnées d'une question
    // homonyme — `tags` existe dans les deux mondes.
    const known = meta.byId[chemin.id];
    const question = known && known.stepKey === chemin.stepKey ? known : null;

    const titreConfig = titleOf(entree?.title).trim();

    vus.add(id);
    out.push({
      id,
      // Sans titre en config, l'intitulé vient de LA QUESTION de l'appel — plus
      // juste qu'une traduction générique. Repli ultime sur l'id, pour qu'un bloc
      // reste identifiable au sommaire.
      title: titreConfig || question?.label || id,
      kicker: titleOf(entree?.kicker).trim() || undefined,
      icon: typeof entree?.icon === "string" && entree.icon ? entree.icon : undefined,
      field: question
        ? {
            stepKey: question.stepKey,
            id: question.id,
            path: chemin.stepKey ? `answers.${chemin.stepKey}.${chemin.id}` : chemin.id,
            label: question.label,
            options: question.options,
          }
        : {
            stepKey: chemin.stepKey,
            id: chemin.id,
            path: chemin.stepKey ? `answers.${chemin.stepKey}.${chemin.id}` : chemin.id,
            label: chemin.id,
            options: [],
          },
    });
  }

  return out;
}
