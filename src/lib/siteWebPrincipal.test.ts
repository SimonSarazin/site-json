import { describe, it, expect } from "vitest";
import { siteWebPrincipal } from "./siteWebPrincipal";

describe("siteWebPrincipal", () => {
  it("fiche ancienne : `url` seul → repli sur `url`", () => {
    expect(siteWebPrincipal({ url: "https://letampon.fr" })).toBe("https://letampon.fr");
  });

  it("fiche du formulaire actuel ou legacy : `link` seul", () => {
    expect(siteWebPrincipal({ link: "www.exemple.re" })).toBe("www.exemple.re");
  });

  it("les deux : `link` (plus récent) l'emporte sur `url`", () => {
    expect(siteWebPrincipal({ url: "https://letampon.fr", link: "www.letampon.fr" })).toBe("www.letampon.fr");
  });

  it("`link` vide → repli sur `url` ; valeur rognée, sans protocole ajouté", () => {
    expect(siteWebPrincipal({ link: "  ", url: " https://promotionsante.re/ " })).toBe("https://promotionsante.re/");
  });

  it("aucun site web ou type inattendu → undefined", () => {
    expect(siteWebPrincipal({})).toBeUndefined();
    expect(siteWebPrincipal(undefined)).toBeUndefined();
    expect(siteWebPrincipal({ url: 42, link: null })).toBeUndefined();
  });
});
