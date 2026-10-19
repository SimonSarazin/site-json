/**
 * `social:readFlat` (codec commun des formulaires costum) doit rester IDENTIQUE au `pf:socialRead` du profil
 * générique : c'est le même aller-retour (objet `socialNetwork` → 9 clés plates du bloc UPDATE_BLOCK_SOCIAL),
 * exposé au chemin costum qui ne charge pas editProfilePayload. Une dérive (clé ajoutée d'un côté) casserait
 * l'édition des réseaux sociaux d'un citoyen sur les sites à formulaire costum citoyen.
 */
import { describe, it, expect } from "vitest";
import { applyTransform } from "@/modules/formEngine/engine/transforms";
import { SOCIAL_FLAT_KEYS } from "./sharedCodecs"; // + side-effect : enregistre social:readFlat
import "../editProfilePayload";                     // side-effect : enregistre pf:socialRead (référence)

describe("social:readFlat ≡ pf:socialRead", () => {
  const cas: unknown[] = [
    undefined, null, {}, [],
    { facebook: "https://facebook.com/x", mastodon: "https://mastodon.social/@x" },
    { github: "gh", gitlab: "gl", facebook: "fb", twitter: "tw", instagram: "ig", diaspora: "dp", mastodon: "md", telegram: "tg", signal: "sg", linkedin: "hors bloc" },
  ];
  it.each(cas.map((c) => [JSON.stringify(c) ?? "undefined", c]))("même sortie pour %s", (_l, v) => {
    expect(applyTransform("social:readFlat", v, {})).toEqual(applyTransform("pf:socialRead", v, {}));
  });
  it("les 9 clés sont exactement celles du bloc UPDATE_BLOCK_SOCIAL", () => {
    expect([...SOCIAL_FLAT_KEYS].sort()).toEqual(["diaspora", "facebook", "github", "gitlab", "instagram", "mastodon", "signal", "telegram", "twitter"]);
  });
});
