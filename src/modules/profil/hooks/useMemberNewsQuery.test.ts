import { describe, it, expect } from "vitest";
import type { News, Organization } from "@communecter/cocolight-api-client";

import { fusionnerEtTrierActus, type ActuDeLieu } from "./useMemberNewsQuery";

const lieu = (slug: string) => ({ id: `id-${slug}`, slug }) as unknown as Organization;
const actuDe = (id: string, lieuOrigine: Organization, updated?: number): ActuDeLieu => ({
  news: { id, serverData: { updated } } as unknown as News,
  lieu: lieuOrigine,
});

describe("fusionnerEtTrierActus — portage de News::sortNews($allNews, ['updated' => SORT_DESC]), lieu conservé", () => {
  it("trie les actus de plusieurs lieux par date décroissante, mélangées", () => {
    const lieuA = lieu("la-plume-a-loup");
    const lieuB = lieu("kiltir-lab");
    const actus = [actuDe("a1", lieuA, 100), actuDe("a2", lieuA, 300), actuDe("b1", lieuB, 200)];
    expect(fusionnerEtTrierActus(actus).map((a) => a.news.id)).toEqual(["a2", "b1", "a1"]);
  });

  it("chaque actu GARDE son lieu d'origine après le tri — le point que la 1re version perdait", () => {
    const lieuA = lieu("la-plume-a-loup");
    const lieuB = lieu("kiltir-lab");
    const tries = fusionnerEtTrierActus([actuDe("a1", lieuA, 100), actuDe("b1", lieuB, 200)]);
    expect(tries.find((a) => a.news.id === "a1")?.lieu.slug).toBe("la-plume-a-loup");
    expect(tries.find((a) => a.news.id === "b1")?.lieu.slug).toBe("kiltir-lab");
  });

  it("une actu sans `updated` passe en dernier, sans faire échouer le tri", () => {
    const l = lieu("x");
    const sansDate = actuDe("x", l, undefined);
    expect(fusionnerEtTrierActus([actuDe("récente", l, 500), sansDate]).map((a) => a.news.id)).toEqual(["récente", "x"]);
  });

  it("liste vide → liste vide", () => {
    expect(fusionnerEtTrierActus([])).toEqual([]);
  });

  it("ne mute pas le tableau d'entrée", () => {
    const l = lieu("x");
    const source = [actuDe("a", l, 1), actuDe("b", l, 2)];
    const copie = [...source];
    fusionnerEtTrierActus(source);
    expect(source).toEqual(copie);
  });
});
