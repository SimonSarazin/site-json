import { describe, it, expect } from "vitest";
import {
  extractAudioUrl,
  extractByPrefix,
  extractTerritoire,
  extractThemes,
  mergeParoleTags,
  paroleMedias,
} from "./fns";

describe("parents62 — transforms du costumForm parole", () => {
  describe("READ (pré-remplissage édition depuis tags/medias)", () => {
    const tags = ["territoire62:arrageois", "public:parents", "age:0-3", "santé", "coup-de-coeur"];

    it("extractTerritoire : premier tag territoire (select mono-valeur)", () => {
      expect(extractTerritoire(tags)).toBe("territoire62:arrageois");
      expect(extractTerritoire(["santé"])).toBe("");
    });

    it("extractByPrefix : tags d'un namespace (public/âges)", () => {
      expect(extractByPrefix(tags, "public:")).toEqual(["public:parents"]);
      expect(extractByPrefix(tags, "age:")).toEqual(["age:0-3"]);
    });

    it("extractThemes : tags libres hors namespaces gérés", () => {
      expect(extractThemes(tags)).toEqual(["santé", "coup-de-coeur"]);
    });

    it("extractAudioUrl : url du premier média audio", () => {
      expect(
        extractAudioUrl([{ type: "audio", url: "https://x/p.mp3" }, { type: "video", url: "y" }]),
      ).toBe("https://x/p.mp3");
      expect(extractAudioUrl([])).toBe("");
      expect(extractAudioUrl(undefined)).toBe("");
    });
  });

  describe("WRITE (fusion des sélections)", () => {
    it("mergeParoleTags : thèmes + territoire + public + âges, dédupliqué", () => {
      expect(
        mergeParoleTags({
          paroleTerritoire: "territoire62:arrageois",
          parolePublic: ["public:parents"],
          paroleAges: ["age:0-3", "age:4-6"],
          paroleThemes: ["santé", "santé"],
        }),
      ).toEqual(["santé", "territoire62:arrageois", "public:parents", "age:0-3", "age:4-6"]);
    });

    it("retirer une coche retire le tag (la sélection courante fait foi)", () => {
      expect(
        mergeParoleTags({
          paroleTerritoire: "territoire62:calaisis",
          parolePublic: [],
          paroleAges: [],
          paroleThemes: ["coup-de-coeur"],
        }),
      ).toEqual(["coup-de-coeur", "territoire62:calaisis"]);
    });

    it("sans territoire choisi et référentiel communes vide → pas de dérivation (no-op T0.5)", () => {
      expect(mergeParoleTags({ paroleTerritoire: "", postalCode: "62000" })).toEqual([]);
    });

    it("paroleMedias : URL saisie → [{type:audio,url}] ; vidée → [] (clear en édition)", () => {
      expect(paroleMedias({ paroleAudioUrl: " https://x/p.mp3 " })).toEqual([
        { type: "audio", url: "https://x/p.mp3" },
      ]);
      expect(paroleMedias({ paroleAudioUrl: "" })).toEqual([]);
      expect(paroleMedias({})).toEqual([]);
    });
  });
});
