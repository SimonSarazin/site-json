import { describe, it, expect } from "vitest";
import { exclusiveRowId, itemsToUnset, runExclusiveFlag, type ExclusiveWritable } from "./exclusiveFlag";

const row = (id: string, featured: boolean | undefined) => ({
  id,
  serverData: { id, featured },
});

describe("exclusiveRowId", () => {
  it("lit `id` en priorité", () => {
    expect(exclusiveRowId({ id: "a1", serverData: { id: "other" } })).toBe("a1");
  });

  it("replie sur `serverData.id` si `id` est absent", () => {
    expect(exclusiveRowId({ serverData: { id: "a2" } })).toBe("a2");
  });

  it("renvoie `null` sans id exploitable", () => {
    expect(exclusiveRowId({})).toBeNull();
  });
});

describe("itemsToUnset", () => {
  it("sélectionne les lignes à `true` autres que la cible", () => {
    const rows = [row("a", true), row("b", false), row("c", true), row("target", false)];
    const result = itemsToUnset(rows, "featured", "target");
    expect(result.map((r) => exclusiveRowId(r))).toEqual(["a", "c"]);
  });

  it("exclut la cible même si elle porte déjà le flag (pas de self-unset)", () => {
    const rows = [row("target", true), row("b", true)];
    const result = itemsToUnset(rows, "featured", "target");
    expect(result.map((r) => exclusiveRowId(r))).toEqual(["b"]);
  });

  it("renvoie un tableau vide si aucune autre ligne n'est à `true`", () => {
    const rows = [row("a", false), row("b", undefined)];
    expect(itemsToUnset(rows, "featured", "target")).toEqual([]);
  });

  it("`targetId` null (id introuvable) n'exclut aucune ligne par id — seule la valeur du flag filtre", () => {
    const rows = [row("a", true), row("b", false)];
    expect(itemsToUnset(rows, "featured", null).map((r) => exclusiveRowId(r))).toEqual(["a"]);
  });

  it("lit le flag via un chemin pointé (cohérence avec `getPath`/colonnes admin)", () => {
    const rows = [
      { id: "a", serverData: { nested: { flag: true } } },
      { id: "target", serverData: { nested: { flag: false } } },
    ];
    expect(itemsToUnset(rows, "nested.flag", "target").map((r) => exclusiveRowId(r))).toEqual(["a"]);
  });
});

describe("runExclusiveFlag (orchestration — review MR 44)", () => {
  const writable = (id: string, flagged: boolean, journal: string[], fail = false): ExclusiveWritable => ({
    id,
    serverData: { id, featured: flagged },
    updateField: async (path, value) => {
      if (fail) { journal.push(`${id}:ÉCHEC`); throw new Error("401"); }
      journal.push(`${id}:${path}=${String(value)}`);
      return true;
    },
  });

  it("la CIBLE d'abord, puis l'unset du périmètre SERVEUR (pas des lignes chargées)", async () => {
    const journal: string[] = [];
    const cible = writable("nouvelle", false, journal);
    // l'ex-une vit HORS de toute fenêtre chargée : seule la recherche serveur la voit
    const horsFenetre = writable("ex-une-ancienne", true, journal);
    const res = await runExclusiveFlag({
      field: "featured", value: true, target: cible,
      fetchFlagged: async () => [horsFenetre, cible],
    });
    expect(journal).toEqual(["nouvelle:featured=true", "ex-une-ancienne:featured=false"]);
    expect(res.unsetFailures).toBe(0);
  });

  it("un unset qui échoue (ex. 401) est COMPTÉ, pas propagé — l'intention de l'admin reste posée", async () => {
    const journal: string[] = [];
    const res = await runExclusiveFlag({
      field: "featured", value: true, target: writable("nouvelle", false, journal),
      fetchFlagged: async () => [writable("récalcitrante", true, journal, true), writable("docile", true, journal)],
    });
    expect(res.unsetFailures).toBe(1);
    expect(journal).toEqual(["nouvelle:featured=true", "récalcitrante:ÉCHEC", "docile:featured=false"]);
  });

  it("retirer la une (value:false) ne touche que la cible — aucune recherche", async () => {
    const journal: string[] = [];
    let cherche = false;
    await runExclusiveFlag({
      field: "featured", value: false, target: writable("actuelle", true, journal),
      fetchFlagged: async () => { cherche = true; return []; },
    });
    expect(journal).toEqual(["actuelle:featured=false"]);
    expect(cherche).toBe(false);
  });

  it("un échec du SET cible propage (l'admin doit le savoir) — et rien d'autre n'a été écrit", async () => {
    const journal: string[] = [];
    await expect(runExclusiveFlag({
      field: "featured", value: true, target: writable("nouvelle", false, journal, true),
      fetchFlagged: async () => [writable("ex-une", true, journal)],
    })).rejects.toThrow();
    expect(journal).toEqual(["nouvelle:ÉCHEC"]);
  });
});
