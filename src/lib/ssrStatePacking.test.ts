import { createRequire } from "node:module";
import { describe, it, expect } from "vitest";
import { serializeSsrState, unpackSsrState } from "./ssrStatePacking";

/** La référence : ce que les serveurs appelaient avant (paquet JS sans types, chargé tel quel). */
const serialize = createRequire(import.meta.url)("serialize-javascript") as (value: unknown, options: { isJSON: true }) => string;

/**
 * Le transport seul change : `unpack(parse(serialize(état)))` doit rendre EXACTEMENT le JSON de
 * l'état — ce que le client recevait avant — tout en ne transportant chaque parent distinct qu'une
 * fois, et sans rien perdre de l'échappement que `serialize-javascript` assurait dans le `<script>`.
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

/** Ce que le navigateur évalue : le texte injecté, relu comme JSON. */
const transporte = (state: object) => JSON.parse(serializeSsrState(state)) as ReturnType<typeof etat> & { __ssrParents?: unknown[] };

/** Séparateurs de ligne Unicode : littéraux interdits dans un script avant ES2019 — `serialize` les échappe. */
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

describe("serializeSsrState / unpackSsrState", () => {
  it("aller-retour : le client retrouve exactement le JSON d'origine", () => {
    const origine = JSON.parse(JSON.stringify(etat()));
    expect(unpackSsrState(transporte(etat()))).toEqual(origine);
  });

  it("chaque parent distinct n'est transporté qu'une fois", () => {
    const texte = serializeSsrState(etat());
    expect(transporte(etat()).__ssrParents).toHaveLength(2);
    expect(texte.split('"Open Atlas"')).toHaveLength(2);
    expect(texte.length).toBeLessThan(JSON.stringify(etat()).length);
  });

  it("l'état emballé reste un DehydratedState lisible (queries, mutations)", () => {
    const emballe = transporte(etat());
    expect(emballe.queries).toHaveLength(2);
    expect(emballe.mutations).toEqual([]);
  });

  it("chaque entité restituée a SA copie du parent, pas une référence partagée", () => {
    const restitue = unpackSsrState(transporte(etat()));
    const [m1, m2] = (restitue.queries[1].state.data as { pages: { results: { parent: object }[] }[] }).pages[0].results;
    expect(m1.parent).toEqual(m2.parent);
    expect(m1.parent).not.toBe(m2.parent);
  });

  it("côté serveur, les entités sont des INSTANCES : le parent se lit dans leur `toJSON`, sérialisé une fois par instance", () => {
    let parentSerialise = 0;
    const parentDuSdk = { id: parentOpenAtlas.id };
    class Entite {
      readonly parent = parentDuSdk;
      constructor(private readonly id: string) {}
      toJSON() {
        // Comme `BaseEntity.toJSON` : une méta NEUVE à chaque appel — seule l'instance `parent` est
        // partagée. Son propre `toJSON` compte les passages.
        return entite(this.id, { toJSON: () => (parentSerialise++, parentOpenAtlas) });
      }
    }
    const instances = { mutations: [], queries: [{ queryKey: ["m"], state: { data: [new Entite("a"), new Entite("b"), new Entite("c")] } }] };
    const emballe = transporte(instances);
    expect(emballe.__ssrParents).toHaveLength(1);
    expect(parentSerialise).toBe(1);
    expect(unpackSsrState(emballe)).toEqual(JSON.parse(JSON.stringify(instances)));
  });

  it("deux instances de parent au contenu identique ne font qu'une entrée", () => {
    class Entite {
      readonly parent = { id: parentOpenAtlas.id }; // une instance par entité
      constructor(private readonly id: string) {}
      toJSON() {
        return entite(this.id, { ...parentOpenAtlas });
      }
    }
    const instances = { mutations: [], queries: [{ queryKey: ["m"], state: { data: [new Entite("a"), new Entite("b")] } }] };
    expect(transporte(instances).__ssrParents).toHaveLength(1);
  });

  it("échappe le texte pour un <script> exactement comme serialize-javascript (isJSON)", () => {
    const piege = { mutations: [], queries: [{ queryKey: ["x"], state: { data: { titre: "</script><script>alert(1)</script>", ligne: `a${LS}b${PS}c` } } }] };
    expect(serializeSsrState(piege)).toBe(serialize(piege, { isJSON: true }));

    // Le chemin propre à l'emballage : la table des parents, concaténée au texte, doit l'être aussi.
    const parentPiege = { ...parentOpenAtlas, serverData: { ...parentOpenAtlas.serverData, name: `</script><script>alert(2)</script>${LS}` } };
    const emballe = {
      ...etat(),
      queries: [...etat().queries, ...piege.queries, { queryKey: ["p"], state: { data: [entite("x", parentPiege)] } }],
    };
    const texte = serializeSsrState(emballe);
    expect((JSON.parse(texte) as { __ssrParents: unknown[] }).__ssrParents).toContainEqual(parentPiege);
    for (const interdit of ["<", ">", LS, PS]) expect(texte).not.toContain(interdit);
    expect(unpackSsrState(JSON.parse(texte))).toEqual(JSON.parse(JSON.stringify(emballe)));
  });

  it("un état sans parent à factoriser, ou non emballé, passe tel quel", () => {
    const sansParent = { mutations: [], queries: [{ queryKey: ["x"], state: { data: { a: 1 } } }] };
    expect(serializeSsrState(sansParent)).toBe(serialize(sansParent, { isJSON: true }));
    expect(unpackSsrState(sansParent)).toBe(sansParent);
    expect(unpackSsrState(null)).toBeNull();
  });

  it("un état qui n'est pas un objet n'est jamais emballé — la table n'aurait pas où se ranger", () => {
    const liste = [entite("a", parentOpenAtlas), entite("b", parentOpenAtlas)];
    expect(JSON.parse(serializeSsrState(liste))).toEqual(JSON.parse(JSON.stringify(liste)));
    // Même quand c'est le `toJSON` de l'état qui rend un tableau.
    const deguise = { toJSON: () => liste };
    expect(JSON.parse(serializeSsrState(deguise))).toEqual(JSON.parse(JSON.stringify(liste)));
  });

  it("un nœud déjà sérialisé n'emprunte jamais la méta d'une instance : il est reconnu par son texte", () => {
    const parentDuSdk = { id: "p1", serverData: { id: "p1", name: "Brut" } };
    class Entite {
      readonly parent = parentDuSdk;
      toJSON() {
        return entite("a", parentOpenAtlas);
      }
    }
    // Le 2ᵉ nœud porte l'objet parent LUI-MÊME (pas de `toJSON`) : son contenu diffère de la méta du 1er.
    const melange = { mutations: [], queries: [{ queryKey: ["m"], state: { data: [new Entite(), entite("b", parentDuSdk)] } }] };
    expect(unpackSsrState(transporte(melange))).toEqual(JSON.parse(JSON.stringify(melange)));
  });

  it("restitue aussi les entités logées sous un `parent` qui n'est pas une référence", () => {
    const sousTableau = { mutations: [], queries: [{ queryKey: ["m"], state: { data: { ...entite("a", null), parent: [entite("b", parentOpenAtlas)] } } }] };
    expect(unpackSsrState(transporte(sousTableau))).toEqual(JSON.parse(JSON.stringify(sousTableau)));
  });
});
