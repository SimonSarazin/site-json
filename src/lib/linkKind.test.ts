import { describe, it, expect } from "vitest";

import { classifyHref, isProtocolHref } from "./linkKind";

describe("classifyHref — contrat 4 voies des liens de config", () => {
  it("vide, null, undefined et « # » sont inertes", () => {
    for (const v of ["", "#", null, undefined]) expect(classifyHref(v)).toBe("inert");
  });

  it("mailto/tel/sms sont remis à l'OS, quelle que soit la casse", () => {
    // La régression corrigée : ces trois-là partaient en navigate() → page d'accueil en 200.
    expect(classifyHref("tel:+262693514224")).toBe("protocol");
    expect(classifyHref("mailto:contact@ekilib.re")).toBe("protocol");
    expect(classifyHref("sms:+262693514224")).toBe("protocol");
    expect(classifyHref("MAILTO:Contact@Ekilib.re")).toBe("protocol");
  });

  it("une ancre non vide vise la page courante", () => {
    expect(classifyHref("#creneaux-list")).toBe("anchor");
  });

  it("http, https et le protocole-relatif sont externes", () => {
    expect(classifyHref("https://ssbe.re/maison-sport-sante-mss/")).toBe("external");
    expect(classifyHref("http://exemple.re")).toBe("external");
    expect(classifyHref("//cdn.exemple.re/x")).toBe("external");
  });

  it("tout le reste est une route interne", () => {
    expect(classifyHref("/creneaux")).toBe("internal");
    expect(classifyHref("/blog?categorie=autre")).toBe("internal");
    expect(classifyHref("creneaux")).toBe("internal");
  });

  it("« httpsomething » n'est pas un lien externe (le préfixe seul ne suffit pas)", () => {
    // L'ancien test `href.startsWith('http')` classait `/https-et-sante` comme externe.
    expect(classifyHref("/https-et-sante")).toBe("internal");
    expect(classifyHref("httpsommeil")).toBe("internal");
  });

  it("isProtocolHref ne répond vrai que pour les 3 protocoles OS", () => {
    expect(isProtocolHref("tel:0692")).toBe(true);
    expect(isProtocolHref("/contact")).toBe(false);
    expect(isProtocolHref("#")).toBe(false);
  });
});
