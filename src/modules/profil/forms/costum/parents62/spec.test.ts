/**
 * Garde du costumForm `parents62-parole` (document JSON de config.prod.parents62.json,
 * compilé par la voie unique `registerCostumForm`) : structure zod + clés de code
 * enregistrées (transforms parents62:*), scope `poi:scope` avec stamp `affiche`,
 * et round-trip READ (tags/medias → champs UI) → WRITE (fusion tags/medias).
 */
import { describe, it, expect } from "vitest";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { specToConfig } from "../../resolveModalSpec";
import { seedFromEntity, valuesToPayload } from "@/modules/formEngine/engine/fieldPipeline";
import type { EntityModalCtx } from "../../entityModalSpec";
import { loadCostumForm } from "../__fixtures__/configCostum";

// Compile le document depuis la VRAIE config — échoue si une clé read/write/scope
// référencée (parents62:*, poi:scope, address:read…) n'est pas enregistrée.
const { descriptor, spec } = loadCostumForm("parents62-parole");

const carrier = {
  id: "6a47b32c40487f80a207a975",
  serverData: { slug: "parents62", lists: {} },
} as unknown as EntityTypes;
const me = { id: "meId" } as unknown as EntityTypes;

describe("costumForm parents62-parole", () => {
  const config = specToConfig(spec);
  const scope = config.resolveScope!(carrier) as Record<string, unknown>;

  it("scope dérivé du carrier (poi:scope générique) + stamp type affiche au create", () => {
    expect(scope).toMatchObject({ sourceKey: "parents62", parentId: "6a47b32c40487f80a207a975", poiType: "affiche" });
    const ctx: EntityModalCtx = { mode: "add", parent: null, scope, me, carrier, entity: null };
    const mut = config.buildSpec(ctx);
    expect(mut).toMatchObject({ mode: "add", entityType: "poi", costumSlug: "parents62", imageField: "_imageFile" });
    expect(mut.inject?.extraFields).toEqual({ type: "affiche" });
  });

  it("READ édition : tags/medias serveur décomposés vers les champs UI", () => {
    const values = seedFromEntity(descriptor, {
      name: "Parole X",
      category: "difficile",
      description: "Transcription…",
      tags: ["territoire62:calaisis", "public:parents", "age:0-3", "santé"],
      medias: [{ type: "audio", url: "https://x/p.mp3" }],
    });
    expect(values).toMatchObject({
      name: "Parole X",
      category: "difficile",
      paroleTerritoire: "territoire62:calaisis",
      parolePublic: ["public:parents"],
      paroleAges: ["age:0-3"],
      paroleThemes: ["santé"],
      paroleAudioUrl: "https://x/p.mp3",
    });
  });

  it("WRITE : champs UI omis, tags fusionnés, medias construits depuis l'URL", () => {
    const payload = valuesToPayload(descriptor, {
      name: "Parole X",
      category: "complique",
      description: "Texte",
      paroleTerritoire: "territoire62:arrageois",
      parolePublic: ["public:parents"],
      paroleAges: [],
      paroleThemes: ["santé"],
      paroleAudioUrl: "https://x/p.mp3",
      paroleConsentement: true,
    });
    expect(payload.tags).toEqual(["santé", "territoire62:arrageois", "public:parents"]);
    expect(payload.medias).toEqual([{ type: "audio", url: "https://x/p.mp3" }]);
    expect(payload.paroleConsentement).toBe(true);
    for (const k of ["paroleTerritoire", "parolePublic", "paroleAges", "paroleThemes", "paroleAudioUrl"]) {
      expect(payload).not.toHaveProperty(k);
    }
  });
});
