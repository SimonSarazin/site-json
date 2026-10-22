import { describe, expect, it } from "vitest";
import { normalizeLinkAddress } from "./linkAddress";

describe("normalizeLinkAddress", () => {
  it.each([
    ["https://exemple.org/page?a=1#b", "https://exemple.org/page?a=1#b"],
    ["http://exemple.org", "http://exemple.org"],
    ["  https://exemple.org  ", "https://exemple.org"],
    ["mailto:contact@exemple.org", "mailto:contact@exemple.org"],
  ])("garde une adresse complète : %s", (saisie, attendu) => {
    expect(normalizeLinkAddress(saisie)).toBe(attendu);
  });

  it.each([
    ["exemple.org", "https://exemple.org"],
    ["www.exemple.org/page", "https://www.exemple.org/page"],
    ["exemple.org:8080/x", "https://exemple.org:8080/x"],
    ["localhost:5174", "https://localhost:5174"],
    ["contact@exemple.org", "mailto:contact@exemple.org"],
  ])("complète le protocole qu'on n'écrit jamais : %s", (saisie, attendu) => {
    expect(normalizeLinkAddress(saisie)).toBe(attendu);
  });

  it.each([
    "", "   ", "bonjour", "deux mots", "exemple.org/deux mots", "https://", "https://exemple", "mailto:personne",
    "javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,x", "file:///etc/passwd", "ftp://exemple.org", "vbscript:x",
  ])("refuse ce qui ne mène nulle part, ou ailleurs que sur le web : « %s »", saisie => {
    expect(normalizeLinkAddress(saisie)).toBeNull();
  });
});
