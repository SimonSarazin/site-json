import { describe, it, expect } from "vitest";
import {
  collapseSectionUnions,
  dumpJsonSchema,
  pruneUnreachableDefs,
  resolveBlockSchema,
  type JsonSchemaNode,
} from "./config-blocks";

/**
 * `reused: "ref"` factorise en `$defs` tout sous-schéma partagé ; quand ses
 * points d'usage disparaissent (union `Section` repliée en résumé), la
 * définition doit disparaître avec eux — sinon chaque contrat partagé entre
 * sections gonfle `page`/`tabs`/`gridLayout` d'un poids que personne ne lit.
 */
describe("pruneUnreachableDefs", () => {
  const ref = (name: string): JsonSchemaNode => ({ $ref: `#/$defs/${name}` });

  it("ne garde que les définitions atteignables depuis la racine, transitivement", () => {
    const root: JsonSchemaNode = {
      type: "object",
      properties: { a: ref("a") },
      $defs: {
        a: { type: "object", properties: { b: ref("b") } },
        b: { type: "string" },
        orphan: { type: "object", properties: { c: ref("c") } },
        c: { type: "number" },
      },
    };
    pruneUnreachableDefs(root);
    expect(Object.keys(root.$defs ?? {}).sort()).toEqual(["a", "b"]);
  });

  it("suit les $ref sous items, additionalProperties et anyOf/oneOf/allOf", () => {
    const root: JsonSchemaNode = {
      type: "object",
      properties: {
        list: { type: "array", items: ref("i") },
        map: { type: "object", additionalProperties: ref("m") },
        u: { anyOf: [ref("x"), { oneOf: [ref("y")] }, { allOf: [ref("z")] }] },
      },
      $defs: {
        i: { type: "string" },
        m: { type: "string" },
        x: { type: "string" },
        y: { type: "string" },
        z: { type: "string" },
        dead: { type: "string" },
      },
    };
    pruneUnreachableDefs(root);
    expect(Object.keys(root.$defs ?? {}).sort()).toEqual(["i", "m", "x", "y", "z"]);
  });

  it("tolère les schémas récursifs ($ref: \"#\" et cycles entre définitions)", () => {
    const root: JsonSchemaNode = {
      type: "object",
      properties: { self: { $ref: "#" }, n: ref("node") },
      $defs: {
        node: { type: "object", properties: { children: { type: "array", items: ref("node") } } },
        unused: { type: "string" },
      },
    };
    expect(() => pruneUnreachableDefs(root)).not.toThrow();
    expect(Object.keys(root.$defs ?? {})).toEqual(["node"]);
  });

  it("retire le dictionnaire quand il ne reste rien", () => {
    const root: JsonSchemaNode = { type: "string", $defs: { a: { type: "string" } } };
    pruneUnreachableDefs(root);
    expect(root.$defs).toBeUndefined();
  });
});

describe("collapseSectionUnions ⇄ $defs (dump réel)", () => {
  const dump = (selector: string) => {
    const schema = resolveBlockSchema(selector);
    expect(schema, selector).toBeDefined();
    return collapseSectionUnions(dumpJsonSchema(schema!));
  };

  it("le repli de l'union Section ne laisse aucune définition orpheline derrière lui", () => {
    for (const selector of ["page", "section:tabs", "section:gridLayout"]) {
      const json = dump(selector);
      const before = Object.keys(json.$defs ?? {}).length;
      pruneUnreachableDefs(json);
      const after = Object.keys(json.$defs ?? {}).length;
      expect(after, `${selector} : ${before - after} orphelin(s) survivent au repli`).toBe(before);
    }
  });

  it("l'enveloppe `page` reste un dump court (le poids était dans les orphelins)", () => {
    // Avant la purge : 68 Ko dont 52 Ko de `$defs` sans lecteur. L'enveloppe
    // utile pèse ~16 Ko ; 30 Ko laisse de la marge sans redevenir illisible.
    const size = JSON.stringify(dump("page"), null, 2).length;
    expect(size).toBeLessThan(30_000);
  });
});
