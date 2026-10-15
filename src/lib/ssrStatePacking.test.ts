import { describe, it, expect } from "vitest";
import { packSsrState, unpackSsrState } from "./ssrStatePacking";

/**
 * Le transport seul change : `unpack(pack(état))` doit rendre EXACTEMENT le JSON de l'état — ce que
 * le client recevait avant — tout en ne transportant chaque parent distinct qu'une fois.
 */
const parentOpenAtlas = {
  id: "555eba56c655675cdd65bf19",
  type: "organizations",
  serverData: { id: "555eba56c655675cdd65bf19", name: "Open Atlas", links: { members: { a: { type: "citoyens" } } } },
};
const autreParent = { id: "p2", type: "projects", serverData: { id: "p2", name: "Autre" } };

const entite = (id: string, parent: unknown) => ({
  __entityTag: "User",
  __isSerializedEntity: true,
  serverData: { id, name: `Membre ${id}` },
  parent,
});

const etat = () => ({
  mutations: [],
  queries: [
    { queryKey: ["cocolight-data"], state: { data: { entity: entite("costum", null) } } },
    {
      queryKey: ["search", "membres"],
      state: {
        data: {
          pages: [
            { results: [entite("m1", parentOpenAtlas), entite("m2", parentOpenAtlas), entite("m3", autreParent)] },
            { results: [entite("m4", parentOpenAtlas)] },
          ],
        },
      },
    },
  ],
});

describe("packSsrState / unpackSsrState", () => {
  it("aller-retour : le client retrouve exactement le JSON d'origine", () => {
    const origine = JSON.parse(JSON.stringify(etat()));
    expect(unpackSsrState(packSsrState(etat()))).toEqual(origine);
  });

  it("chaque parent distinct n'est transporté qu'une fois", () => {
    const emballe = packSsrState(etat()) as unknown as { __ssrParents: unknown[] };
    expect(emballe.__ssrParents).toHaveLength(2);
    const transporte = JSON.stringify(emballe);
    expect(transporte.split('"Open Atlas"')).toHaveLength(2);
    expect(transporte.length).toBeLessThan(JSON.stringify(etat()).length);
  });

  it("l'état emballé reste un DehydratedState lisible (queries, mutations)", () => {
    const emballe = packSsrState(etat());
    expect(emballe.queries).toHaveLength(2);
    expect(emballe.mutations).toEqual([]);
  });

  it("chaque entité restituée a SA copie du parent, pas une référence partagée", () => {
    const restitue = unpackSsrState(packSsrState(etat()));
    const [m1, m2] = (restitue.queries[1].state.data as { pages: { results: { parent: object }[] }[] }).pages[0].results;
    expect(m1.parent).toEqual(m2.parent);
    expect(m1.parent).not.toBe(m2.parent);
  });

  it("côté serveur, les entités sont des INSTANCES : le parent se lit dans leur `toJSON`", () => {
    class Entite {
      constructor(private readonly id: string) {}
      toJSON() {
        return entite(this.id, parentOpenAtlas);
      }
    }
    const instances = { mutations: [], queries: [{ queryKey: ["m"], state: { data: [new Entite("a"), new Entite("b")] } }] };
    const emballe = packSsrState(instances) as unknown as { __ssrParents: unknown[] };
    expect(emballe.__ssrParents).toHaveLength(1);
    expect(unpackSsrState(emballe)).toEqual(JSON.parse(JSON.stringify(instances)));
  });

  it("un état sans parent à factoriser, ou non emballé, passe tel quel", () => {
    const sansParent = { mutations: [], queries: [{ queryKey: ["x"], state: { data: { a: 1 } } }] };
    expect(packSsrState(sansParent)).toBe(sansParent);
    expect(unpackSsrState(sansParent)).toBe(sansParent);
    expect(unpackSsrState(null)).toBeNull();
  });
});
