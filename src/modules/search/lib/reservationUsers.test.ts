import { describe, it, expect } from "vitest";
import { keepInPerimeter, reservationUserIds, reservedResourceIds, scopeFiltersToIds } from "./reservationUsers";

// Forme réelle (base locale, 16/10/2026) : une réservation pointe un équipement et, depuis la
// reprise, l'organisation usagère par identifiant ; 2 réponses scolaires n'ont que le texte.
const resa = (resourceIds: string[], userId?: string) => ({ resourceIds, userId });

describe("reservedResourceIds", () => {
  it("rassemble les équipements de toutes les réservations, triés et sans doublon", () => {
    expect(reservedResourceIds([resa(["b", "a"]), resa(["a"]), resa([])])).toEqual(["a", "b"]);
  });
});

describe("reservationUserIds — usagers d'au moins un équipement du périmètre", () => {
  const scolaires = new Set(["gymnase-lycee", "salle-danse-lycee"]);

  it("garde l'organisation dès qu'une de ses réservations touche le périmètre", () => {
    const ids = reservationUserIds(
      [
        resa(["salle-municipale"], "club-a"),
        resa(["gymnase-lycee"], "club-b"),
        resa(["salle-municipale", "salle-danse-lycee"], "club-c"),
      ],
      scolaires,
    );
    expect(ids).toEqual(["club-b", "club-c"]);
  });

  it("une organisation n'apparaît qu'une fois, triée", () => {
    expect(reservationUserIds([resa(["gymnase-lycee"], "z"), resa(["salle-danse-lycee"], "z"), resa(["gymnase-lycee"], "a")], scolaires))
      .toEqual(["a", "z"]);
  });

  it("une réservation sans identifiant d'organisation (texte historique seul) ne compte pas", () => {
    expect(reservationUserIds([resa(["gymnase-lycee"])], scolaires)).toEqual([]);
  });

  it("aucun équipement du périmètre réservé → aucune organisation", () => {
    expect(reservationUserIds([resa(["salle-municipale"], "club-a")], scolaires)).toEqual([]);
  });
});

describe("scopeFiltersToIds — périmètre d'identifiants de la liste", () => {
  it("sans périmètre : les filtres ressortent par la MÊME référence (queryKey inchangée)", () => {
    const filters = { tags: { $in: ["x"] } };
    const r = scopeFiltersToIds(filters, null);
    expect(r.filters).toBe(filters);
    expect(r.none).toBe(false);
  });

  it("pose `_id.$in` sans toucher aux autres filtres", () => {
    expect(scopeFiltersToIds({ tags: { $in: ["x"] } }, ["o1", "o2"])).toEqual({
      filters: { tags: { $in: ["x"] }, _id: { $in: ["o1", "o2"] } },
      none: false,
    });
  });

  it("intersecte un `_id.$in` déjà posé (facette par réponses) au lieu de l'écraser", () => {
    expect(scopeFiltersToIds({ _id: { $in: ["o2", "o9"] } }, ["o1", "o2"]).filters).toEqual({ _id: { $in: ["o2"] } });
  });

  it("garde une exclusion `_id.$nin` à côté du `$in`", () => {
    expect(scopeFiltersToIds({ _id: { $nin: ["o3"] } }, ["o1"]).filters).toEqual({ _id: { $nin: ["o3"], $in: ["o1"] } });
  });

  it("périmètre vide ou intersection vide → `none`, et AUCUN `$in` vide (le backend l'ignorerait)", () => {
    expect(scopeFiltersToIds({}, []).none).toBe(true);
    const disjoint = scopeFiltersToIds({ _id: { $in: ["o9"] } }, ["o1"]);
    expect(disjoint.none).toBe(true);
    expect(disjoint.filters).toEqual({ _id: { $in: ["o9"] } });
  });
});

describe("keepInPerimeter — équipements réservés restreints au site", () => {
  const groups = [{ resourceId: "gymnase-lycee" }, { resourceId: "salle-municipale" }];

  it("ne garde que les équipements du périmètre", () => {
    expect(keepInPerimeter(groups, ["gymnase-lycee"])).toEqual([{ resourceId: "gymnase-lycee" }]);
  });

  it("sans périmètre, tout reste (comportement historique)", () => {
    expect(keepInPerimeter(groups, null)).toEqual(groups);
  });

  it("périmètre vide → aucun équipement", () => {
    expect(keepInPerimeter(groups, [])).toEqual([]);
  });
});
