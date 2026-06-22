import { describe, it, expect } from "vitest";
import type { Api } from "@communecter/cocolight-api-client";
import { fetchElementSummary } from "./useElementSummary";

/** Fabrique un faux `Api` dont `organization()` renvoie une entité au serverData donné. */
function fakeApi(serverData: Record<string, unknown>): Api {
  return {
    organization: async () => ({ serverData }),
  } as unknown as Api;
}

describe("fetchElementSummary", () => {
  it("extrait le nom et priorise l'image medium > pleine > thumb", async () => {
    const api = fakeApi({
      name: "Org A",
      profilThumbImageUrl: "/t.jpg",
      profilMediumImageUrl: "/m.jpg",
      profilImageUrl: "/i.jpg",
    });
    expect(await fetchElementSummary(api, "1", "organizations")).toEqual({
      name: "Org A",
      img: "/m.jpg",
    });
  });

  it("retombe sur pleine puis thumb si medium absent", async () => {
    expect(
      await fetchElementSummary(
        fakeApi({ name: "Org A", profilImageUrl: "/i.jpg", profilThumbImageUrl: "/t.jpg" }),
        "1",
        "organizations",
      ),
    ).toEqual({ name: "Org A", img: "/i.jpg" });

    expect(
      await fetchElementSummary(fakeApi({ name: "Org A", profilThumbImageUrl: "/t.jpg" }), "1", "organizations"),
    ).toEqual({ name: "Org A", img: "/t.jpg" });
  });

  it("name/img = undefined si absents ou chaînes vides", async () => {
    expect(
      await fetchElementSummary(fakeApi({ name: "   ", profilImageUrl: "" }), "1", "organizations"),
    ).toEqual({});
  });

  it("retourne {} pour un type non résoluble (pas de factory entity)", async () => {
    const api = fakeApi({ name: "X" });
    expect(await fetchElementSummary(api, "1", "things")).toEqual({});
  });
});
