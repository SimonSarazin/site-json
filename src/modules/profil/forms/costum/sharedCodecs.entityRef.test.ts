/**
 * Garde du codec RÉFÉRENCE D'ENTITÉ (`entityRef:read` / `entityRef:write`, sharedCodecs) — la forme
 * d'un `parent`/`organizer` de `finder` costum.
 *
 * Ce qu'il doit tenir, et pourquoi chaque point compte :
 *  - la forme LUE est enrichie (`about` : `_id`/`slug`/`profilThumbImageUrl` ; SDK : `id`) ; la forme
 *    ENVOYÉE doit être `{<id>: {type, name}}` — le contrat d'envoi refuse toute autre clé
 *    (`additionalProperties:false`, 400 AJV sur saintpaul-event, e2e 02/10) ;
 *  - l'ORDRE des clés est `type` puis `name`, celui de `transformEntityRefs` (SDK) qui bâtit la base du
 *    diff : à ordre différent, le `JSON.stringify` du diff verrait une modification à chaque save ;
 *  - vide / tableau / non-objet → `undefined` : un `parent` relu `[]` et ré-émis effaçait le parent.
 */
import { describe, it, expect } from "vitest";
import "./sharedRegistrations"; // side-effect : enregistre entityRef:read / entityRef:write
import { applyTransform } from "@/modules/formEngine/engine/transforms";

const ID = "682b2ac5e05a1d45844340e7";

/** Entrée telle que l'édition la reçoit : `about` + normalisation SDK. */
const enrichie = () => ({
  [ID]: {
    type: "organizations",
    name: "Sport Santé bien-être",
    _id: { $id: ID },
    slug: "sportSanteBienetre",
    id: ID,
    profilThumbImageUrl: "https://example.org/thumb.png",
  },
});

describe.each(["entityRef:read", "entityRef:write"])("%s", (cle) => {
  it("ne garde que {type, name}, dans cet ordre", () => {
    const out = applyTransform(cle, enrichie(), {} as never) as Record<string, Record<string, unknown>>;
    expect(out).toEqual({ [ID]: { type: "organizations", name: "Sport Santé bien-être" } });
    expect(Object.keys(out[ID]!)).toEqual(["type", "name"]);
  });

  it("sérialise EXACTEMENT comme la projection {type, name} (base du diff du SDK)", () => {
    const out = applyTransform(cle, enrichie(), {} as never);
    const projection = { [ID]: { type: "organizations", name: "Sport Santé bien-être" } };
    expect(JSON.stringify(out)).toBe(JSON.stringify(projection));
  });

  it("plusieurs références : chacune projetée, ordre des entrées préservé", () => {
    const autre = "5534fd9da1aa14201b0041cb";
    const out = applyTransform(cle, { ...enrichie(), [autre]: { name: "Autre", type: "organizations", slug: "x" } }, {} as never);
    expect(JSON.stringify(out)).toBe(JSON.stringify({
      [ID]: { type: "organizations", name: "Sport Santé bien-être" },
      [autre]: { type: "organizations", name: "Autre" },
    }));
  });

  it("vide, tableau, null, chaîne → undefined", () => {
    for (const v of [{}, [], null, undefined, ""]) {
      expect(applyTransform(cle, v, {} as never), JSON.stringify(v)).toBeUndefined();
    }
  });
});
