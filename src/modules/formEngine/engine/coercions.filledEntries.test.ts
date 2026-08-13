import { describe, it, expect } from "vitest";
import { coerceFilledEntries } from "@/modules/formEngine/engine/coercions";

/**
 * Un `fieldArray` peut proposer des lignes d'avance (les 4 réseaux sociaux de l'Institut Bleu). Leur
 * intitulé vit en PLACEHOLDER, pas en valeur : sans quoi la simple ouverture du formulaire écrit ces
 * libellés en base. Mesuré avant correction : 142 des 246 entrées stockées n'avaient aucun lien, et
 * 21 organisations sur 73 n'en avaient pas une seule de renseignée.
 */
describe("coerce:filledEntries", () => {
  it("retire les lignes proposées que l'utilisateur n'a pas touchées", () => {
    expect(coerceFilledEntries([
      { type: "", link: "" },
      { type: "", link: "https://facebook.com/x" },
      { type: "", link: "   " },
      { type: "", link: "" },
    ])).toEqual([{ type: "", link: "https://facebook.com/x" }]);
  });

  it("garde une ligne dès qu'UN champ est renseigné — on ne présume pas lequel fait foi", () => {
    expect(coerceFilledEntries([{ type: "Mastodon", link: "" }])).toHaveLength(1);
    expect(coerceFilledEntries([{ type: "", link: "https://x.fr" }])).toHaveLength(1);
  });

  it("formulaire ouvert puis fermé sans rien saisir → tableau VIDE, pas 4 lignes de bruit", () => {
    expect(coerceFilledEntries([
      { type: "", link: "" }, { type: "", link: "" },
      { type: "", link: "" }, { type: "", link: "" },
    ])).toEqual([]);
  });

  it("valeur non tableau → tableau vide, jamais de crash", () => {
    expect(coerceFilledEntries(undefined)).toEqual([]);
    expect(coerceFilledEntries("")).toEqual([]);
  });
});
