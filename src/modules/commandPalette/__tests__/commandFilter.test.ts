import { describe, it, expect, beforeEach } from "vitest";
import { filterCommands, groupCommands } from "../lib/commandFilter";
import { registerCommandSource, _resetForTesting } from "../registry/registry";
import type { Command, LocalizedText } from "../registry/types";

const cmd = (
  id: string,
  label: LocalizedText,
  group: string,
  keywords?: string[]
): Command => ({ id, label, group, keywords, perform: () => {} });

describe("filterCommands", () => {
  const list = [
    cmd("a", "Accueil", "nav"),
    cmd("b", "À propos", "nav"),
    cmd("c", { fr: "Contact", en: "Contact us" }, "nav", ["mail", "email"]),
  ];

  it("retourne tout pour une requête vide", () => {
    expect(filterCommands(list, "", "fr")).toHaveLength(3);
  });

  it("filtre par label résolu", () => {
    expect(filterCommands(list, "accueil", "fr").map((c) => c.id)).toEqual(["a"]);
  });

  it("filtre par keyword", () => {
    expect(filterCommands(list, "email", "fr").map((c) => c.id)).toEqual(["c"]);
  });

  it("résout le label localisé pour la locale demandée", () => {
    expect(filterCommands(list, "contact us", "en").map((c) => c.id)).toEqual(["c"]);
  });
});

describe("groupCommands", () => {
  beforeEach(() => {
    _resetForTesting();
    registerCommandSource({
      namespace: "x",
      groups: [
        { id: "nav", heading: "Navigation", order: 10 },
        { id: "actions", heading: "Actions", order: 90 },
      ],
      getCommands: () => [],
    });
  });

  it("regroupe, trie par order et limite par groupe", () => {
    const list = [
      cmd("a1", "A1", "actions"),
      cmd("a2", "A2", "actions"),
      cmd("a3", "A3", "actions"),
      cmd("n1", "N1", "nav"),
      cmd("n2", "N2", "nav"),
    ];
    const res = groupCommands(list, 2);
    expect(res.map((g) => g.group.id)).toEqual(["nav", "actions"]);
    expect(res[0].commands.map((c) => c.id)).toEqual(["n1", "n2"]);
    expect(res[1].commands).toHaveLength(2); // tronqué de 3 → 2
  });

  it("utilise un heading fallback pour un groupe non déclaré", () => {
    const res = groupCommands([cmd("z", "Z", "mystery")], 10);
    expect(res[0].group.heading).toBe("mystery");
  });
});
