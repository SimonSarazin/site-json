import { describe, it, expect, vi } from "vitest";
import {
  applyAdmissibility,
  buildNotePath,
  buildAdmissibilityPath,
  buildAdmissibilityTimePath,
  VOTE_STATUS,
  type AdmissibilityTarget,
} from "./selection";

/**
 * L'avis d'admissibilité fait passer la candidature au statut de vote : c'est la
 * seule écriture de ce lot qui touche à son cycle de vie. On vérifie donc la
 * séquence écriture par écriture, y compris ce qui ne doit PAS être écrit.
 */

function cible(status?: unknown): AdmissibilityTarget & { appels: [string, unknown, unknown?][] } {
  const appels: [string, unknown, unknown?][] = [];
  return {
    appels,
    serverData: status === undefined ? null : { status },
    updateField: vi.fn(async (path: string, value: unknown, opts?: Record<string, unknown>) => {
      appels.push([path, value, opts]);
      return undefined;
    }),
  };
}

const LE_18_MARS = new Date("2026-03-18T09:30:00.000Z");

describe("chemins d'écriture", () => {
  it("cibles scopées par étape ET par évaluateur", () => {
    // Le scope par utilisateur est ce qui évite d'écraser les notes des autres.
    expect(buildNotePath("aapStep2", "u1", "depense")).toBe(
      "answers.aapStep2.selection.u1.depense"
    );
    expect(buildAdmissibilityPath("aapStep2", "u1")).toBe("answers.aapStep2.admissibility.u1");
    expect(buildAdmissibilityTimePath("aapStep2", "u1")).toBe(
      "answers.aapStep2.admissibilityTime.u1"
    );
  });
});

describe("applyAdmissibility", () => {
  const params = { subFormId: "aapStep2", userId: "u1", value: "admissible" };

  it("écrit l'avis puis son horodatage SERVEUR", () => {
    const a = cible([]);
    return applyAdmissibility(a, params, LE_18_MARS).then(() => {
      expect(a.appels[0]).toEqual(["answers.aapStep2.admissibility.u1", "admissible", undefined]);
      // `"updatedTime"` est une valeur magique : c'est le backend qui pose son
      // propre `time()`. L'heure ne vient jamais du client.
      expect(a.appels[1]).toEqual([
        "answers.aapStep2.admissibilityTime.u1",
        "updatedTime",
        undefined,
      ]);
    });
  });

  it("pousse le jeton de vote et trace `statusInfo.vote`", async () => {
    const a = cible([]);
    await applyAdmissibility(a, params, LE_18_MARS);
    expect(a.appels[2]).toEqual(["status", VOTE_STATUS, { arrayForm: true }]);
    expect(a.appels[3]).toEqual([
      "statusInfo.vote",
      { user: "", action: "add", updated: LE_18_MARS },
      undefined,
    ]);
  });

  it("NE pousse PAS un jeton déjà présent — le legacy, lui, le duplique", async () => {
    // Relevé en base : 5 candidatures sur 126 portent `"vote"` 2 à 4 fois, parce
    // que le legacy fait un `$push` inconditionnel à chaque évaluateur.
    const a = cible(["projectstate", VOTE_STATUS]);
    await applyAdmissibility(a, params, LE_18_MARS);
    expect(a.appels.map((x) => x[0])).not.toContain("status");
    // La trace, elle, reste écrite : un nouvel avis est bien un nouvel événement.
    expect(a.appels.map((x) => x[0])).toContain("statusInfo.vote");
  });

  it("un avis NÉGATIF ne touche pas au statut de la candidature", async () => {
    const a = cible([]);
    await applyAdmissibility(a, { ...params, value: "inadmissible" }, LE_18_MARS);
    const chemins = a.appels.map((x) => x[0]);
    expect(chemins).toEqual([
      "answers.aapStep2.admissibility.u1",
      "answers.aapStep2.admissibilityTime.u1",
    ]);
    expect(chemins).not.toContain("status");
    expect(chemins).not.toContain("statusInfo.vote");
  });

  it("tolère une réponse sans `status` (candidature jamais qualifiée)", async () => {
    const a = cible(undefined);
    await applyAdmissibility(a, params, LE_18_MARS);
    expect(a.appels.map((x) => x[0])).toContain("status");
  });

  it("tolère un `status` qui n'est pas un tableau", async () => {
    // 7 réponses en base portent un `status` objet, pollué par un autre écran.
    const a = cible({ nimporte: "quoi" });
    await applyAdmissibility(a, params, LE_18_MARS);
    expect(a.appels.map((x) => x[0])).toContain("status");
  });
});
