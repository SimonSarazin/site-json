import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  registerCommandSource,
  getCommandSources,
  getCommandGroup,
  _resetForTesting,
} from "../registry/registry";
import type { CommandSource } from "../registry/types";

const makeSource = (namespace: string, extra?: Partial<CommandSource>): CommandSource => ({
  namespace,
  getCommands: () => [],
  ...extra,
});

describe("commandPalette registry", () => {
  beforeEach(() => _resetForTesting());

  it("enregistre et retourne une source", () => {
    const s = makeSource("a");
    registerCommandSource(s);
    expect(getCommandSources()).toEqual([s]);
  });

  it("agrège plusieurs sources dans l'ordre d'enregistrement", () => {
    registerCommandSource(makeSource("a"));
    registerCommandSource(makeSource("b"));
    expect(getCommandSources().map((s) => s.namespace)).toEqual(["a", "b"]);
  });

  it("avertit et écrase un doublon de namespace", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    registerCommandSource(makeSource("a"));
    const replacement = makeSource("a", { async: true });
    registerCommandSource(replacement);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('source "a" already registered')
    );
    expect(getCommandSources()).toEqual([replacement]);
    warn.mockRestore();
  });

  it("agrège les groupes déclarés par les sources", () => {
    registerCommandSource(
      makeSource("a", { groups: [{ id: "g1", heading: "Groupe 1", order: 5 }] })
    );
    expect(getCommandGroup("g1")).toEqual({ id: "g1", heading: "Groupe 1", order: 5 });
    expect(getCommandGroup("inconnu")).toBeUndefined();
  });

  it("_resetForTesting vide sources et groupes", () => {
    registerCommandSource(makeSource("a", { groups: [{ id: "g1", heading: "G" }] }));
    _resetForTesting();
    expect(getCommandSources()).toEqual([]);
    expect(getCommandGroup("g1")).toBeUndefined();
  });
});
