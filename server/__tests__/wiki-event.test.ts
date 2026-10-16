import { describe, it, expect, afterEach, vi } from "vitest";
// @ts-expect-error — module JS sans types, c'est le patron du dossier `server/`
import { titrePage, wikitexte, fusionner, wikiEventCreateHandler } from "../api/wiki-event.js";

const evt = {
  name: "Chantier participatif",
  type: "others",
  startDate: "2026-11-20T23:00:00+0000",
  endDate: "2026-11-21T22:59:00+0000",
  timeZone: "Europe/Paris",
  description: "Texte | piège {{x}}\n\nDocumentation de la rencontre : U",
  organizer: { a: { name: "La Plume à Loup" } },
  slug: "s",
};

describe("page wiki d'un événement", () => {
  it("titre : nom et jour en heure locale", () => {
    expect(titrePage(evt)).toBe("Chantier participatif (2026-11-21)");
  });

  it("wikitexte : échappe les paramètres et retire le lien du wiki de la description", () => {
    const texte = wikitexte(evt, { url: "U", fiche: "F" });
    expect(texte).toContain("|description=Texte &#124; piège &#123;&#123;x&#125;&#125;\n");
    expect(texte).not.toContain("Documentation de la rencontre");
    expect(texte).toContain("== Description ==\n\nTexte &#124; piège &#123;&#123;x&#125;&#125;");
    expect(texte).toContain("|from=La Plume à Loup");
  });
});

describe("mise à jour", () => {
  it("régénère le modèle et la description, garde le compte-rendu écrit sur le wiki", () => {
    const ancien = wikitexte(evt, { url: "U", fiche: "F", image: "" }).replace("== Compte-rendu ==\n", "== Compte-rendu ==\nNotes des participants\n");
    const modifie = { ...evt, name: "Nouveau nom", description: "Nouvelle description\n\nDocumentation de la rencontre : U" };
    const texte = fusionner(ancien, wikitexte(modifie, { url: "U", fiche: "F", image: "Evenement_x.jpg" }));
    expect(texte).toContain("|Main_Picture=Evenement_x.jpg");
    expect(texte).toContain("|name=Nouveau nom");
    expect(texte).toContain("== Description ==\n\nNouvelle description");
    expect(texte).toContain("Notes des participants");
    expect(texte.match(/== Description ==/g)).toHaveLength(1);
  });
});

describe("migration de l'ancien modèle", () => {
  it("remplace {{Evenement et CR}} par {{Evenement}}", () => {
    const neuf = wikitexte(evt, { url: "U", fiche: "F", image: "i.jpg" });
    const ancien = "{{Evenement et CR\n|name=Vieux\n}}\n\n== Compte-rendu ==\nNotes\n";
    const texte = fusionner(ancien, neuf);
    expect(texte.startsWith("{{Evenement\n")).toBe(true);
    expect(texte).not.toContain("Evenement et CR");
    expect(texte).toContain("Notes");
  });
});

describe("nom de modèle variable", () => {
  it("écrit l'appel avec le modèle choisi et le remplace en mise à jour", () => {
    const event = wikitexte(evt, { url: "U", fiche: "F", image: "", modele: "Event" });
    expect(event.startsWith("{{Event\n")).toBe(true);
    const texte = fusionner("{{Evenement\n|name=Vieux\n}}\n\n== Compte-rendu ==\nNotes\n", event);
    expect(texte.startsWith("{{Event\n")).toBe(true);
    expect(texte).toContain("Notes");
  });
});

describe("paramètres selon le modèle", () => {
  it("Event : Location, endDate et contact, sans from ni urlpad", () => {
    const t = wikitexte(evt, { url: "U", fiche: "F", image: "i.jpg", modele: "Event" });
    expect(t).toContain("|Lang=Français");
    expect(t).toContain("|endDate=2026-11-21");
    expect(t).toContain("|contact=La Plume à Loup");
    expect(t).toContain("|Location=");
    expect(t).not.toMatch(/\|(from|urlpad|complement)=/);
  });
});

describe("création : garde-fous", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  function reponse() {
    const res: any = { code: 200, body: null };
    res.status = (c: number) => ((res.code = c), res);
    res.json = (b: unknown) => ((res.body = b), res);
    return res;
  }

  it("refuse sans Authorization", async () => {
    const res = reponse();
    await wikiEventCreateHandler({ headers: {}, params: { id: "a".repeat(24) } }, res);
    expect(res.code).toBe(401);
  });

  it("refuse tant que la description ne contient pas le lien (droit d'édition non prouvé)", async () => {
    process.env.WIKI_API_URL = "https://wiki.example/api.php";
    process.env.VITE_BASE_URL_BACKEND = "https://backend.example";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ result: true, map: { ...evt, description: "sans lien" } }))));
    const res = reponse();
    await wikiEventCreateHandler({ headers: { authorization: "Bearer x" }, params: { id: "a".repeat(24) } }, res);
    expect(res.code).toBe(403);
  });
});
