import { describe, it, expect } from "vitest";
import { readAgendaUrl, writeAgendaUrl, type AgendaFilterDefaults } from "./agendaUrlParams";

const defaults: AgendaFilterDefaults = {
  mode: "list",
  tab: "upcoming",
  tabs: ["upcoming", "ongoing", "past"],
};

describe("readAgendaUrl", () => {
  it("retombe sur les défauts quand l'URL est vide", () => {
    expect(readAgendaUrl(new URLSearchParams(""), defaults)).toEqual({
      mode: "list",
      tab: "upcoming",
      text: "",
      type: "",
      tags: [],
    });
  });

  it("lit chaque filtre depuis l'URL", () => {
    const sp = new URLSearchParams("vue=calendar&tab=past&q=marché&type=fair&tags=Art,Culture");
    expect(readAgendaUrl(sp, defaults)).toEqual({
      mode: "calendar",
      tab: "past",
      text: "marché",
      type: "fair",
      tags: ["Art", "Culture"],
    });
  });

  it("ignore un mode/onglet invalide", () => {
    const sp = new URLSearchParams("vue=grid&tab=bogus");
    const r = readAgendaUrl(sp, defaults);
    expect(r.mode).toBe("list");
    expect(r.tab).toBe("upcoming");
  });
});

describe("writeAgendaUrl", () => {
  it("n'écrit pas les valeurs égales aux défauts ni les filtres vides", () => {
    const out = writeAgendaUrl(
      new URLSearchParams(""),
      { mode: "list", tab: "upcoming", text: "", type: "", tags: [] },
      defaults,
    );
    expect(out.toString()).toBe("");
  });

  it("écrit les filtres non-défaut et préserve les autres paramètres", () => {
    const out = writeAgendaUrl(
      new URLSearchParams("keep=1"),
      { mode: "calendar", tab: "past", text: " concert ", type: "concert", tags: ["A", "B"] },
      defaults,
    );
    expect(out.get("keep")).toBe("1");
    expect(out.get("vue")).toBe("calendar");
    expect(out.get("tab")).toBe("past");
    expect(out.get("q")).toBe("concert");
    expect(out.get("type")).toBe("concert");
    expect(out.get("tags")).toBe("A,B");
  });

  it("roundtrip read∘write = identité fonctionnelle", () => {
    const state = { mode: "calendar" as const, tab: "ongoing" as const, text: "x", type: "workshop", tags: ["T1", "T2"] };
    const written = writeAgendaUrl(new URLSearchParams(""), state, defaults);
    expect(readAgendaUrl(written, defaults)).toEqual(state);
  });
});
