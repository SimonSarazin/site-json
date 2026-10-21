/**
 * Périmètre des réponses d'un ampli — SOURCE UNIQUE des filtres.
 *
 * Deux écrans comptent les mêmes propositions : la page ampli (« Idées
 * soumises », via `AmpliSectionRenderer`) et la liste des amplis (« N
 * propositions », via `useAmpliAnswerCounts`). Recopiés de part et d'autre, les
 * filtres divergeraient au premier changement et les deux chiffres cesseraient
 * de correspondre, sans que rien ne le signale.
 */

import type { AmpliPath } from "../schema";

/** Filtres backend : le formulaire, et seulement les réponses qui ont un nom. */
export function ampliAnswerFilters(coform: string, path: AmpliPath): Record<string, unknown> {
  return {
    form: coform,
    finderPath: path.finder || "",
    ...(path.name !== "" ? { [`answers.${path.name}`]: { $exists: true } } : {}),
  };
}

/** Champs projetés : ceux du mapping, plus l'auteur et les réactions. */
export function ampliAnswerFields(path: AmpliPath): string[] {
  return [
    // Filtré : un rôle optionnel non renseigné projetterait `answers.undefined`.
    ...Object.values(path)
      .filter((value): value is string => typeof value === "string" && value !== "")
      .map((value) => `answers.${value}`),
    "user",
    "vote",
    "voteCount",
  ];
}
