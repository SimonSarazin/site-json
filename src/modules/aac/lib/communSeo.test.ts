import { describe, it, expect } from "vitest";
import { resolveCommunSeo } from "./communSeo";
import type { AacCardFieldRef } from "./resolveAacCardFields";

const ref = (stepKey: string | null, id: string): AacCardFieldRef => ({
  stepKey,
  id,
  path: stepKey ? `answers.${stepKey}.${id}` : id,
  label: id,
  options: [],
});

describe("resolveCommunSeo — M12", () => {
  it("lit titre, description et image par leur référence résolue", () => {
    const seo = resolveCommunSeo(
      {
        answers: { etapeA: { q_titre: "Une instance peertube", q_desc: "Partage **vidéo** [auto-hébergé](x)" } },
        image: "/upload/communecter/x.png",
      },
      {
        fields: { title: ref("etapeA", "q_titre"), description: ref("etapeA", "q_desc"), image: ref(null, "image") },
        depenseStepKey: "etapeA",
        baseUrl: "http://backend.test",
      },
    );

    expect(seo.title).toBe("Une instance peertube");
    expect(seo.description).toBe("Partage vidéo auto-hébergé");
    expect(seo.image).toBe("http://backend.test/upload/communecter/x.png");
  });

  it("sans référence, retombe sur `titre`/`description` de l'étape dépense — comme le héros", () => {
    const seo = resolveCommunSeo(
      { answers: { aapStep2: { titre: "Titre étape", description: "Desc étape" } } },
      { fields: {}, depenseStepKey: "aapStep2" },
    );
    expect(seo.title).toBe("Titre étape");
    expect(seo.description).toBe("Desc étape");
    expect(seo.image).toBeNull();
  });

  it("le « (No title) » du backend n'est pas un titre ; `descriptionStr` sert de dernier repli", () => {
    const seo = resolveCommunSeo({ name: "(No title)", descriptionStr: "Pré-calculée" }, { fields: {} });
    expect(seo.title).toBe("");
    expect(seo.description).toBe("Pré-calculée");
  });

  it("borne la description à 160 caractères", () => {
    const seo = resolveCommunSeo({ descriptionStr: "a".repeat(400) }, { fields: {} });
    expect(seo.description.length).toBeLessThanOrEqual(160);
    expect(seo.description.endsWith("…")).toBe(true);
  });

  it("n'invente pas d'image depuis un uploader structuré", () => {
    const seo = resolveCommunSeo(
      { answers: { s: { img: [{ name: "a.png" }] } } },
      { fields: { image: ref("s", "img") }, depenseStepKey: "s", baseUrl: "http://b" },
    );
    expect(seo.image).toBeNull();
  });
});
