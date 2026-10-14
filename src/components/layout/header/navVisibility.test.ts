import { describe, it, expect } from "vitest";

import { conditionsDeVisibiliteNav, filtrerNavParVisibilite, type NavNodeAvecVisibilite } from "./navVisibility";

interface Item extends NavNodeAvecVisibilite {
  label: string;
  children?: Item[];
}

const nav: Item[] = [
  { label: "Accueil" },
  {
    label: "Les lieux",
    visibility: undefined,
    children: [
      { label: "Voir tous les lieux" },
      { label: "Mes lieux", visibility: { auth: "required" } },
    ],
  },
  { label: "Se gouverner", visibility: { auth: "required" } },
];

describe("conditionsDeVisibiliteNav — aplatit item PUIS ses enfants, dans l'ordre", () => {
  it("une condition par item, une par enfant, profondeur d'abord", () => {
    const conditions = conditionsDeVisibiliteNav(nav);
    expect(conditions).toEqual([
      undefined, // Accueil
      undefined, // Les lieux
      undefined, // Voir tous les lieux
      { auth: "required" }, // Mes lieux
      { auth: "required" }, // Se gouverner
    ]);
  });

  it("un item sans enfant ne consomme qu'un seul créneau", () => {
    const seul: Item[] = [{ label: "Seul" }];
    expect(conditionsDeVisibiliteNav(seul)).toEqual([undefined]);
  });
});

describe("filtrerNavParVisibilite — reconstruit l'arbre à partir des booléens rendus", () => {
  it("tout visible : nav inchangée (structure et ordre)", () => {
    const visibles = [true, true, true, true, true];
    expect(filtrerNavParVisibilite(nav, visibles)).toEqual(nav);
  });

  it("« Mes lieux » masqué (anonyme) : « Les lieux » reste, avec un seul enfant", () => {
    // Accueil visible, Les lieux visible, Voir tous les lieux visible, Mes lieux MASQUÉ, Se gouverner masqué.
    const visibles = [true, true, true, false, false];
    const resultat = filtrerNavParVisibilite(nav, visibles);
    expect(resultat.map((i) => i.label)).toEqual(["Accueil", "Les lieux"]);
    expect(resultat[1].children?.map((c) => c.label)).toEqual(["Voir tous les lieux"]);
  });

  it("item masqué par sa PROPRE condition : disparaît entièrement, enfants compris", () => {
    const visibles = [true, false, true, true, false]; // "Les lieux" masqué malgré ses enfants visibles
    const resultat = filtrerNavParVisibilite(nav, visibles);
    expect(resultat.map((i) => i.label)).toEqual(["Accueil"]);
  });

  it("tous les enfants masqués : le parent reste (il porte son propre `path`)", () => {
    const visibles = [true, true, false, false, true];
    const resultat = filtrerNavParVisibilite(nav, visibles);
    const lesLieux = resultat.find((i) => i.label === "Les lieux");
    expect(lesLieux).toBeDefined();
    expect(lesLieux!.children).toEqual([]);
  });

  it("aucune `visibility` nulle part : `nav` traverse identique", () => {
    const sansCondition: Item[] = [{ label: "A" }, { label: "B", children: [{ label: "B1" }] }];
    const visibles = conditionsDeVisibiliteNav(sansCondition).map(() => true);
    expect(filtrerNavParVisibilite(sansCondition, visibles)).toEqual(sansCondition);
  });
});
