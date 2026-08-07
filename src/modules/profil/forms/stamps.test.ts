import { describe, it, expect, vi, afterEach } from "vitest";

import {
  formatNow,
  estVide,
  resolveEagerStamps,
  stampsPourMode,
  applyPayloadStamps,
  preparePathValueStamps,
} from "./stamps";
import type { SpecStamp } from "./entityModalSpec";

afterEach(() => vi.restoreAllMocks());

describe("formatNow — byte-parité avec le stamp legacy (ibDateSign, SANS zéro de tête)", () => {
  it("j/M/aaaa : 6 août 2026 → « 6/8/2026 » (jamais 06/08)", () => {
    expect(formatNow("j/M/aaaa", new Date(2026, 7, 6))).toBe("6/8/2026");
  });
  it("j/M/aaaa : 15 novembre 2026 → « 15/11/2026 »", () => {
    expect(formatNow("j/M/aaaa", new Date(2026, 10, 15))).toBe("15/11/2026");
  });
  it("jj/MM/aaaa : padding explicite quand demandé", () => {
    expect(formatNow("jj/MM/aaaa", new Date(2026, 7, 6))).toBe("06/08/2026");
  });
  it("aaaa-MM-jj : ordre et séparateurs littéraux", () => {
    expect(formatNow("aaaa-MM-jj", new Date(2026, 0, 3))).toBe("2026-01-03");
  });
});

describe("estVide (sémantique fillIfEmpty)", () => {
  it("undefined/null/\"\"/[] sont vides ; 0, false, [0] ne le sont pas", () => {
    expect(estVide(undefined)).toBe(true);
    expect(estVide(null)).toBe(true);
    expect(estVide("")).toBe(true);
    expect(estVide([])).toBe(true);
    expect(estVide(0)).toBe(false);
    expect(estVide(false)).toBe(false);
    expect(estVide([0])).toBe(false);
  });
});

describe("resolveEagerStamps (résolution EAGER, jumeau de resolveExtraFields)", () => {
  it("remplace $scope et $costum par leurs valeurs ; clé absente → undefined (stamp inerte ensuite)", () => {
    const stamps: SpecStamp[] = [
      { field: "type", value: { $scope: "poiType" } },
      { field: "tags", value: { $costum: "mainTag" }, op: "append" },
      { field: "x", value: { $scope: "absente" } },
      { field: "y", value: { $costum: "absente" } },
      { field: "tag", value: "litteral" },
    ];
    const out = resolveEagerStamps(stamps, { scope: { poiType: "recoveryCenter" }, costum: { mainTag: "TiersLieux" } })!;
    expect(out[0].value).toBe("recoveryCenter");
    expect(out[1].value).toBe("TiersLieux");
    expect(out[2].value).toBeUndefined();
    expect(out[3].value).toBeUndefined();
    expect(out[4].value).toBe("litteral");
  });
  it("sans stamps : ressort tel quel (même référence)", () => {
    expect(resolveEagerStamps(undefined, {})).toBeUndefined();
  });
});

describe("stampsPourMode (défaut on:\"add\")", () => {
  const stamps: SpecStamp[] = [
    { field: "a", value: 1 },
    { field: "b", value: 2, on: "edit" },
    { field: "c", value: 3, on: "both" },
  ];
  it("add : défaut + both", () => {
    expect(stampsPourMode(stamps, "add").map((s) => s.field)).toEqual(["a", "c"]);
  });
  it("edit : edit + both", () => {
    expect(stampsPourMode(stamps, "edit").map((s) => s.field)).toEqual(["b", "c"]);
  });
});

describe("applyPayloadStamps", () => {
  const now = new Date(2026, 7, 6);

  it("set écrase ; fillIfEmpty respecte l'existant ; $from lit le payload (stamps ordonnés)", () => {
    const out = applyPayloadStamps(
      { name: "Asso", shortDescription: "", type: "ancien" },
      [
        { field: "type", value: "LocalBusiness" },
        { field: "shortDescription", value: { $from: "name" }, op: "fillIfEmpty" },
        { field: "resume", value: { $from: "shortDescription" } }, // voit le stamp précédent
      ],
      { mode: "add", now },
    );
    expect(out.type).toBe("LocalBusiness");
    expect(out.shortDescription).toBe("Asso");
    expect(out.resume).toBe("Asso");
  });

  it("fillIfEmpty NE remplace PAS une valeur présente", () => {
    const out = applyPayloadStamps(
      { shortDescription: "déjà là", name: "X" },
      [{ field: "shortDescription", value: { $from: "name" }, op: "fillIfEmpty" }],
      { mode: "add", now },
    );
    expect(out.shortDescription).toBe("déjà là");
  });

  it("append : union dédupliquée, edit fusionne la valeur SERVEUR (sémantique merge tags tiers-lieux)", () => {
    const out = applyPayloadStamps(
      { tags: ["saisi"] },
      [{ field: "tags", value: "TiersLieux", op: "append", on: "both" }],
      { mode: "edit", targetServerData: { tags: ["existant", "TiersLieux"] }, now },
    );
    expect(out.tags).toEqual(["existant", "TiersLieux", "saisi"]);
  });

  it("append en add : payload ∪ valeur, sans serveur", () => {
    const out = applyPayloadStamps(
      {},
      [{ field: "tags", value: ["A", "B"], op: "append" }],
      { mode: "add", now },
    );
    expect(out.tags).toEqual(["A", "B"]);
  });

  it("$now est évalué à l'application, format legacy", () => {
    const out = applyPayloadStamps({}, [{ field: "dateSign", value: { $now: "j/M/aaaa" } }], { mode: "add", now });
    expect(out.dateSign).toBe("6/8/2026");
  });

  it("valeur évaluée undefined → stamp ignoré ; canal pathValue exclu ; aucun stamp actif → même référence", () => {
    const payload = { a: 1 };
    expect(applyPayloadStamps(payload, [{ field: "x", value: undefined }], { mode: "add", now }).x).toBeUndefined();
    expect(applyPayloadStamps(payload, [{ field: "d", value: "v", channel: "pathValue" }], { mode: "add", now })).toBe(payload);
    expect(applyPayloadStamps(payload, [], { mode: "add", now })).toBe(payload);
  });
});

describe("preparePathValueStamps", () => {
  const now = new Date(2026, 7, 6);

  it("prépare chemin + valeur évaluée + drapeau fillIfEmpty (le cas dateSign)", () => {
    const writes = preparePathValueStamps(
      { name: "Asso" },
      [{ field: "dateSign", value: { $now: "j/M/aaaa" }, channel: "pathValue", op: "fillIfEmpty" }],
      { mode: "add", now },
    );
    expect(writes).toEqual([{ field: "dateSign", value: "6/8/2026", fillIfEmpty: true }]);
  });

  it("ne retient que le canal pathValue du mode ; append refusé avec warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const writes = preparePathValueStamps(
      {},
      [
        { field: "payloadOnly", value: "x" },
        { field: "editOnly", value: "y", channel: "pathValue", on: "edit" },
        { field: "tags", value: "z", channel: "pathValue", op: "append" },
      ],
      { mode: "add", now },
    );
    expect(writes).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("append"));
  });
});
