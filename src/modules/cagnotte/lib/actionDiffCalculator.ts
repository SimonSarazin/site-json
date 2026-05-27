/**
 * Calcule le delta entre l'état actuel d'une action et l'état édité,
 * pour ne mutater côté backend que les champs réellement modifiés.
 *
 * Pattern : on construit un objet `updates: Record<string, unknown>` qui ne contient
 * que les champs changés. Chaque champ utilise sa **clé de chemin backend** (notamment
 * `links.contributors` pour les contributeurs, conformément au mapping côté `useEditAction`
 * qui pose `action.data.links = { contributors: ... }` avant `action.save()`).
 *
 * Cas particuliers :
 *  - **Aucun changement** → retourne un objet vide ; l'appelant peut alors afficher un
 *    toast « aucune modification » et sauter la mutation.
 *  - **Dates** : on stocke `null` quand la date est vidée (back attendu pour clear).
 *  - **Contributeurs** : on reconstruit `links.contributors` à partir de `next.contributors`
 *    (déjà enrichis `{ id, type, name, username? }` par `<SelectMember>`), en fallback
 *    sur les noms initiaux de `previous.contributors`.
 */

import type { ActionStatus } from "@communecter/cocolight-api-client";

export type DiffActionPrevious = {
  name: string;
  credits: number;
  status: ActionStatus;
  tags: string[];
  contributors: Array<{ id: string; name?: string }>;
  /** Timestamp ms — converti via `timestampToFrenchDate` pour la comparaison. */
  date_start?: number;
  /** Timestamp ms — converti via `timestampToFrenchDate` pour la comparaison. */
  date_end?: number;
};

export type DiffContributor = {
  id: string;
  type?: string;
  name?: string;
  username?: string;
};

export type DiffActionNext = {
  name: string;
  credits: number;
  status: ActionStatus;
  tags: string[];
  contributors: DiffContributor[];
  /** Format FR `DD/MM/YYYY` ou `""`. */
  startDate: string;
  /** Format FR `DD/MM/YYYY` ou `""`. */
  endDate: string;
};

export interface CalculateActionDiffParams {
  previous: DiffActionPrevious;
  next: DiffActionNext;
  /** Helper de conversion timestamp → `DD/MM/YYYY` (injecté pour éviter le couplage à date-fns ici). */
  formatTimestampToFrenchDate: (ts?: number) => string;
}

/**
 * Shape des champs éditables d'une Action côté front. Sert de contrat entre
 * `calculateActionDiff` (producteur) et `useEditAction` (consommateur).
 *
 * Le champ `"links.contributors"` est dotté volontairement : il représente une
 * sous-clé de `links` (le SDK expose `links` à plat — la mutation encapsule).
 * Les dates sont au format français `DD/MM/YYYY` ou `null` (vidées) — la mutation
 * convertit en ISO 8601 avant de transmettre au SDK.
 */
export interface ActionUpdateFields {
  name?: string;
  credits?: number;
  status?: ActionStatus;
  tags?: string[];
  "links.contributors"?: Record<string, { type: string; isAdmin: boolean; name: string }>;
  startDate?: string | null;
  endDate?: string | null;
}

export function calculateActionDiff(params: CalculateActionDiffParams): ActionUpdateFields {
  const { previous, next, formatTimestampToFrenchDate } = params;
  const updates: ActionUpdateFields = {};

  if (next.name !== previous.name) updates.name = next.name;
  if (next.credits !== previous.credits) updates.credits = next.credits;
  if (next.status !== previous.status) updates.status = next.status;

  if (JSON.stringify(next.tags) !== JSON.stringify(previous.tags)) {
    updates.tags = next.tags;
  }

  const previousContributorIds = previous.contributors.map((c) => c.id).sort();
  const nextContributorById = new Map<string, DiffContributor>();
  next.contributors.forEach((c) => {
    const id = c.id?.trim();
    if (id) nextContributorById.set(id, c);
  });
  const nextContributorIds = [...nextContributorById.keys()].sort();

  if (JSON.stringify(nextContributorIds) !== JSON.stringify(previousContributorIds)) {
    const nameFallbackById = new Map<string, string>();
    previous.contributors.forEach((c) => {
      if (c.id && c.name) nameFallbackById.set(c.id, c.name);
    });
    updates["links.contributors"] = Object.fromEntries(
      nextContributorIds.map((contributorId) => {
        const contributor = nextContributorById.get(contributorId);
        return [
          contributorId,
          {
            type: contributor?.type || "citoyens",
            isAdmin: true,
            name:
              contributor?.name || nameFallbackById.get(contributorId) || contributorId,
          },
        ];
      }),
    );
  }

  const previousStartDate = formatTimestampToFrenchDate(previous.date_start);
  const previousEndDate = formatTimestampToFrenchDate(previous.date_end);
  const nextStartDate = next.startDate.trim();
  const nextEndDate = next.endDate.trim();
  if (nextStartDate !== previousStartDate) {
    updates.startDate = nextStartDate || null;
  }
  if (nextEndDate !== previousEndDate) {
    updates.endDate = nextEndDate || null;
  }

  return updates;
}
