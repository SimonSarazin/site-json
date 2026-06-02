import { describe, it, expect, vi } from "vitest";
import { navigationSource } from "../sources/navigationSource";
import { actionsSource } from "../sources/actionsSource";
import type { Command, CommandReadContext, CommandRunContext } from "../registry/types";

function readCtx(over: Partial<CommandReadContext> = {}): CommandReadContext {
  return {
    query: "",
    me: null,
    locale: "fr",
    pathname: "/",
    theme: "light",
    entity: null,
    config: {
      pages: [
        { path: "/", title: { fr: "Accueil" } },
        { path: "/about", title: { fr: "À propos" } },
      ],
      header: {
        nav: [
          { label: { fr: "Lieux" }, path: "/lieux" },
          { label: { fr: "Placeholder" }, path: "#" },
          { label: { fr: "Plus" }, path: "/plus", children: [{ label: { fr: "Contact" }, path: "/contact" }] },
        ],
      },
      meta: { languages: ["fr", "en"], defaultLang: "fr" },
    } as unknown as CommandReadContext["config"],
    ...over,
  };
}

const sync = (cmds: Command[] | Promise<Command[]>): Command[] => cmds as Command[];

describe("navigationSource", () => {
  it("crée une commande par page + items nav, exclut '#', déduplique et récurse", () => {
    const cmds = sync(navigationSource.getCommands(readCtx()));
    const ids = cmds.map((c) => c.id);
    expect(ids).toContain("nav:/");
    expect(ids).toContain("nav:/about");
    expect(ids).toContain("nav:/lieux");
    expect(ids).toContain("nav:/plus");
    expect(ids).toContain("nav:/contact"); // enfant récursif
    expect(ids).not.toContain("nav:#"); // path "#" exclu
    expect(ids.filter((id) => id === "nav:/").length).toBe(1); // dédupliqué
  });

  it("perform navigue vers le path puis ferme", () => {
    const cmds = sync(navigationSource.getCommands(readCtx()));
    const home = cmds.find((c) => c.id === "nav:/")!;
    const run = { navigate: vi.fn(), close: vi.fn() } as unknown as CommandRunContext;
    home.perform(run);
    expect(run.navigate).toHaveBeenCalledWith("/");
    expect(run.close).toHaveBeenCalled();
  });
});

describe("actionsSource", () => {
  it("inclut le toggle thème et l'accueil", () => {
    const ids = sync(actionsSource.getCommands(readCtx())).map((c) => c.id);
    expect(ids).toContain("action:toggle-theme");
    expect(ids).toContain("action:home");
  });

  it("propose les langues disponibles sauf la locale courante", () => {
    const ids = sync(actionsSource.getCommands(readCtx({ locale: "fr" }))).map((c) => c.id);
    expect(ids).toContain("action:lang:en");
    expect(ids).not.toContain("action:lang:fr");
  });

  it("n'affiche la déconnexion que si connecté", () => {
    const anon = sync(actionsSource.getCommands(readCtx({ me: null }))).map((c) => c.id);
    expect(anon).not.toContain("action:logout");
    const connected = sync(
      actionsSource.getCommands(readCtx({ me: {} as never }))
    ).map((c) => c.id);
    expect(connected).toContain("action:logout");
  });

  it("le toggle thème bascule dark → light", () => {
    const toggle = sync(actionsSource.getCommands(readCtx())).find(
      (c) => c.id === "action:toggle-theme"
    )!;
    const setTheme = vi.fn();
    toggle.perform({ theme: "dark", setTheme, close: vi.fn() } as unknown as CommandRunContext);
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("logout appelle api.logout puis navigue vers l'accueil", () => {
    const logout = sync(actionsSource.getCommands(readCtx({ me: {} as never }))).find(
      (c) => c.id === "action:logout"
    )!;
    const apiLogout = vi.fn();
    const run = {
      api: { logout: apiLogout },
      navigate: vi.fn(),
      close: vi.fn(),
    } as unknown as CommandRunContext;
    logout.perform(run);
    expect(apiLogout).toHaveBeenCalled();
    expect(run.navigate).toHaveBeenCalledWith("/");
  });
});
