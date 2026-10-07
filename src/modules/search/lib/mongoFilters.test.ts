import { describe, it, expect } from "vitest";
import { mergeMongoFilters, orClausesOf } from "./mongoFilters";

describe("orClausesOf", () => {
  it("MAP legacy → une clause OU (sémantique de SearchNew::searchFilters)", () => {
    expect(orClausesOf({ "source.key": "x", "reference.costum": "x" })).toEqual([
      { $or: [{ "source.key": "x" }, { "reference.costum": "x" }] },
    ]);
  });

  it("forme composée { $and: [...] } → ses membres, sans ré-emballage", () => {
    const membres = [{ $or: [{ a: 1 }] }, { $or: [{ b: 2 }] }];
    expect(orClausesOf({ $and: membres })).toEqual(membres);
  });

  it("tableau de clauses → une clause OU (toléré en lecture, jamais émis)", () => {
    expect(orClausesOf([{ a: 1 }, { b: 2 }])).toEqual([{ $or: [{ a: 1 }, { b: 2 }] }]);
  });

  it("vide / non objet → aucune clause", () => {
    expect(orClausesOf({})).toEqual([]);
    expect(orClausesOf([])).toEqual([]);
    expect(orClausesOf(null)).toEqual([]);
    expect(orClausesOf("x")).toEqual([]);
  });
});

describe("mergeMongoFilters", () => {
  it("clés distinctes : spread ordinaire", () => {
    expect(mergeMongoFilters({ form: "f1" }, { type: "poi" })).toEqual({ form: "f1", type: "poi" });
  });

  it("un seul côté porte $or → forme CONSERVÉE telle quelle (pas de régression du parc)", () => {
    const perimetre = { tags: { $in: ["TiersLieux"] } };
    expect(mergeMongoFilters({ $or: perimetre }, { _id: { $in: ["a"] } })).toEqual({
      $or: perimetre,
      _id: { $in: ["a"] },
    });
  });

  it("DEUX $or → composés en ET, aucun n'est perdu", () => {
    // Cas réel : config.prod.tiers-lieux.json pose `$or: {tags:{$in:["TiersLieux"]}}`
    // sur les pages qui portent justement des groupes « par réponses ».
    const perimetre = { tags: { $in: ["TiersLieux"] } };
    const facette = { $and: [{ $or: [{ "answers.x.Obésité": { $exists: true } }] }] };
    expect(mergeMongoFilters({ $or: perimetre }, { $or: facette })).toEqual({
      $or: {
        $and: [
          { $or: [{ tags: { $in: ["TiersLieux"] } }] },
          { $or: [{ "answers.x.Obésité": { $exists: true } }] },
        ],
      },
    });
  });

  it("un spread naïf aurait perdu le périmètre — contre-épreuve explicite", () => {
    const perimetre = { tags: { $in: ["TiersLieux"] } };
    const facette = { $and: [{ $or: [{ "answers.x.V": { $exists: true } }] }] };
    const naif = { ...{ $or: perimetre }, ...{ $or: facette } };
    const fusion = mergeMongoFilters({ $or: perimetre }, { $or: facette });
    expect(naif.$or).toEqual(facette); // le périmètre a disparu
    expect(JSON.stringify(fusion)).toContain("TiersLieux"); // il survit à la fusion
  });

  it("$or vide côté facette : le périmètre existant est préservé", () => {
    const perimetre = { tags: { $in: ["TiersLieux"] } };
    expect(mergeMongoFilters({ $or: perimetre }, { $or: {} })).toEqual({ $or: perimetre });
  });

  it("composition à trois : le ET s'allonge, il ne s'imbrique pas", () => {
    const a = mergeMongoFilters({ $or: { a: 1 } }, { $or: { b: 2 } });
    const b = mergeMongoFilters(a, { $or: { c: 3 } });
    expect((b.$or as { $and: unknown[] }).$and).toHaveLength(3);
  });

  it("même clé, deux objets d'opérateurs : la facette $in s'ajoute à l'exclusion $nin, elle ne l'écrase pas", () => {
    // Cas réel : /annuaire de RéseauSanté exclut les lieux (`tags.$nin`) et porte une facette
    // « Thématique » sur `tags` (`$in`). Le serveur applique les deux sur la même clé.
    const exclusion = { tags: { $nin: ["lieux-sante"] } };
    const facette = { tags: { $in: ["Nutrition"] } };
    expect(mergeMongoFilters(exclusion, facette)).toEqual({ tags: { $nin: ["lieux-sante"], $in: ["Nutrition"] } });
    // Même opérateur des deux côtés : la facette, plus spécifique, gagne.
    expect(mergeMongoFilters({ tags: { $in: ["A"] } }, facette)).toEqual({ tags: { $in: ["Nutrition"] } });
  });

  it("même clé mais l'un des deux n'est pas un objet $in/$nin : remplacement ordinaire", () => {
    expect(mergeMongoFilters({ type: { $in: ["NGO"] } }, { type: "Group" })).toEqual({ type: "Group" });
    expect(mergeMongoFilters({ address: { postalCode: "97400" } }, { address: { $exists: true } })).toEqual({ address: { $exists: true } });
  });

  it("autre famille d'opérateurs ($exists, $ne, $not…) : PAS de composition — le serveur n'en applique qu'une par champ", () => {
    // Composer `{ $exists }` + `{ $in }` enverrait un objet dont seul `$exists` serait lu : la facette
    // disparaîtrait en silence. On garde le comportement historique : la facette remplace le défaut.
    expect(mergeMongoFilters({ "preferences.x": { $exists: true } }, { "preferences.x": { $in: ["a"] } })).toEqual({ "preferences.x": { $in: ["a"] } });
    expect(mergeMongoFilters({ tags: { $ne: "x" } }, { tags: { $in: ["a"] } })).toEqual({ tags: { $in: ["a"] } });
    expect(mergeMongoFilters({ tags: { $nin: ["x"] } }, { tags: { $in: ["a"], $exists: true } })).toEqual({ tags: { $in: ["a"], $exists: true } });
  });
});
