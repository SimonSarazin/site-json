import { describe, it, expect, vi } from "vitest";
// Side-effect : enregistre la source "profil:entities" dans le registre.
import "./register";
import { getCommandSources } from "@/modules/commandPalette/registry/registry";
import type { Command, CommandReadContext } from "@/modules/commandPalette";

const source = getCommandSources().find((s) => s.namespace === "profil:entities")!;

function ctx(over: Partial<CommandReadContext> = {}): CommandReadContext {
  return {
    query: "asso",
    me: null,
    locale: "fr",
    pathname: "/",
    theme: "light",
    entity: null,
    config: {} as CommandReadContext["config"],
    ...over,
  };
}

function mockEntity(results: unknown[]) {
  return { searchCostum: vi.fn().mockResolvedValue({ results }) };
}

const run = (cmds: Command[] | Promise<Command[]>) => cmds as Promise<Command[]>;

describe("source de commandes profil (entités)", () => {
  it("est déclarée comme source async", () => {
    expect(source).toBeDefined();
    expect(source.async).toBe(true);
  });

  it("renvoie [] sans entité ou si la requête est trop courte", async () => {
    expect(await run(source.getCommands(ctx({ entity: null })))).toEqual([]);
    expect(
      await run(source.getCommands(ctx({ query: "a", entity: mockEntity([]) as never })))
    ).toEqual([]);
  });

  it("construit des commandes depuis les résultats backend", async () => {
    const entity = mockEntity([
      {
        id: "1",
        slug: "mon-asso",
        serverData: { name: "Mon Asso" },
        getEntityType: () => "organizations",
      },
    ]);
    const cmds = await run(source.getCommands(ctx({ entity: entity as never })));
    expect(cmds).toHaveLength(1);
    expect(cmds[0].label).toBe("Mon Asso");
    expect(cmds[0].group).toBe("profil:entities");
  });

  it("respecte la config entitySearch (searchType, limit, params)", async () => {
    const entity = mockEntity([]);
    await run(
      source.getCommands(
        ctx({
          entity: entity as never,
          config: {
            commandPalette: {
              entitySearch: { searchType: ["organizations"], limit: 3, params: { notSourceKey: true } },
            },
          } as never,
        })
      )
    );
    expect(entity.searchCostum).toHaveBeenCalledWith(
      expect.objectContaining({
        searchType: ["organizations"],
        indexStep: 3,
        name: "asso",
        notSourceKey: true,
      })
    );
  });

  it("est désactivable via entitySearch.enabled = false", async () => {
    const entity = mockEntity([{ id: "1", slug: "x", serverData: { name: "X" } }]);
    const cmds = await run(
      source.getCommands(
        ctx({
          entity: entity as never,
          config: { commandPalette: { entitySearch: { enabled: false } } } as never,
        })
      )
    );
    expect(cmds).toEqual([]);
    expect(entity.searchCostum).not.toHaveBeenCalled();
  });

  it("sans itemAction : le clic navigue vers /profil/:slug (défaut)", async () => {
    const entity = mockEntity([
      { id: "1", slug: "mon-asso", serverData: { name: "Mon Asso" }, getEntityType: () => "organizations" },
    ]);
    const cmds = await run(source.getCommands(ctx({ entity: entity as never })));
    const runCtx = { navigate: vi.fn(), close: vi.fn(), openEntityPreview: vi.fn() };
    cmds[0].perform(runCtx as never);
    expect(runCtx.navigate).toHaveBeenCalledWith("/profil/mon-asso");
    expect(runCtx.openEntityPreview).not.toHaveBeenCalled();
    expect(runCtx.close).toHaveBeenCalled();
  });

  it("itemAction preview : le clic ouvre le détail (SwitchDetailsMode) au lieu de naviguer", async () => {
    const item = { id: "1", slug: "stade", serverData: { name: "Stade" }, getEntityType: () => "poi" };
    const entity = mockEntity([item]);
    const cmds = await run(
      source.getCommands(
        ctx({
          entity: entity as never,
          config: {
            commandPalette: {
              entitySearch: {
                itemAction: { kind: "preview", detailsMode: "dialog", preview: { type: "poi-amenities" } },
              },
            },
          } as never,
        })
      )
    );
    const runCtx = { navigate: vi.fn(), close: vi.fn(), openEntityPreview: vi.fn() };
    cmds[0].perform(runCtx as never);
    expect(runCtx.openEntityPreview).toHaveBeenCalledWith(item, {
      detailsMode: "dialog",
      preview: { type: "poi-amenities" },
    });
    expect(runCtx.navigate).not.toHaveBeenCalled();
    expect(runCtx.close).toHaveBeenCalled();
  });

  it("itemActionByType prime sur itemAction (par type d'entité)", async () => {
    const entity = mockEntity([
      { id: "1", slug: "stade", serverData: { name: "Stade" }, getEntityType: () => "poi" },
      { id: "2", slug: "asso", serverData: { name: "Asso" }, getEntityType: () => "organizations" },
    ]);
    const cmds = await run(
      source.getCommands(
        ctx({
          entity: entity as never,
          config: {
            commandPalette: {
              entitySearch: {
                itemAction: { kind: "profil" },
                itemActionByType: { poi: { kind: "preview", preview: { type: "poi-amenities" } } },
              },
            },
          } as never,
        })
      )
    );
    const poiRun = { navigate: vi.fn(), close: vi.fn(), openEntityPreview: vi.fn() };
    cmds[0].perform(poiRun as never);
    expect(poiRun.openEntityPreview).toHaveBeenCalled();
    expect(poiRun.navigate).not.toHaveBeenCalled();

    const orgRun = { navigate: vi.fn(), close: vi.fn(), openEntityPreview: vi.fn() };
    cmds[1].perform(orgRun as never);
    expect(orgRun.navigate).toHaveBeenCalledWith("/profil/asso");
    expect(orgRun.openEntityPreview).not.toHaveBeenCalled();
  });

  it("itemAction preview sans hôte (openEntityPreview absent) : retombe sur la navigation", async () => {
    const entity = mockEntity([
      { id: "1", slug: "stade", serverData: { name: "Stade" }, getEntityType: () => "poi" },
    ]);
    const cmds = await run(
      source.getCommands(
        ctx({
          entity: entity as never,
          config: {
            commandPalette: { entitySearch: { itemAction: { kind: "preview" } } },
          } as never,
        })
      )
    );
    const runCtx = { navigate: vi.fn(), close: vi.fn() };
    cmds[0].perform(runCtx as never);
    expect(runCtx.navigate).toHaveBeenCalledWith("/profil/stade");
    expect(runCtx.close).toHaveBeenCalled();
  });
});
