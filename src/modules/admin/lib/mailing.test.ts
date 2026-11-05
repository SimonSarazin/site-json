import { describe, it, expect } from "vitest";
import { buildMailingHtml, plainTextOf, recipientFromEntity, uniqueRecipients } from "./mailing";

const ID = "66f2adcfba41c614b86c0af8";

describe("recipientFromEntity — qui part dans tplMail[]", () => {
  it("un citoyen part par son _id (l'e-mail est résolu serveur, jamais lu côté client)", () => {
    const r = recipientFromEntity("citoyens", { id: ID, serverData: { name: "Jean", email: "jean@exemple.re" } });
    expect(r).toEqual({ key: ID, label: "Jean", value: ID });
  });
  it("une fiche part par son e-mail de contact, en minuscules", () => {
    const r = recipientFromEntity("organizations", { id: ID, serverData: { name: "Asso", email: "Contact@Asso.re" } });
    expect(r).toEqual({ key: ID, label: "Asso", value: "contact@asso.re" });
  });
  it("sans entityType, la collection de la fiche décide (liste de membres mixte)", () => {
    expect(recipientFromEntity(undefined, { id: ID, serverData: { collection: "citoyens", name: "J" } })?.value).toBe(ID);
    expect(recipientFromEntity(undefined, { id: ID, serverData: { collection: "organizations", name: "A", email: "a@b.re" } })?.value).toBe("a@b.re");
  });
  it("fiche sans e-mail valide, citoyen sans id : null (ignoré, comme l'écran legacy)", () => {
    expect(recipientFromEntity("organizations", { id: ID, serverData: { name: "Asso" } })).toBeNull();
    expect(recipientFromEntity("organizations", { id: ID, serverData: { email: "pas une adresse" } })).toBeNull();
    expect(recipientFromEntity("citoyens", { serverData: { name: "X" } })).toBeNull();
    expect(recipientFromEntity("citoyens", null)).toBeNull();
  });
});

describe("uniqueRecipients", () => {
  it("dédoublonne sur la valeur envoyée", () => {
    const a = { key: "1", label: "A", value: "x@y.re" };
    const b = { key: "2", label: "B", value: "x@y.re" };
    const c = { key: "3", label: "C", value: ID };
    expect(uniqueRecipients([a, b, c])).toEqual([a, c]);
  });
});

describe("buildMailingHtml — forme legacy <h3>objet</h3><br>message<br>", () => {
  it("rend le markdown (gras, liste, lien) et garde le HTML brut en texte", () => {
    const html = buildMailingHtml("Réunion <b>de</b> rentrée", "Bonjour **à tous**\n\n- un\n- deux\n\nhttps://exemple.re <script>x</script>");
    expect(html.startsWith("<h3>Réunion &lt;b&gt;de&lt;/b&gt; rentrée</h3><br>")).toBe(true);
    expect(html).toContain("<strong>à tous</strong>");
    expect(html).toContain("<li>un</li>");
    expect(html).toContain('<a href="https://exemple.re">https://exemple.re</a>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html.endsWith("<br>")).toBe(true);
  });
});

describe("plainTextOf", () => {
  it("vide malgré la mise en forme → vide", () => {
    expect(plainTextOf("   \n\n")).toBe("");
    expect(plainTextOf("**x**")).toBe("x");
  });
});
