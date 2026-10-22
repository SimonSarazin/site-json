import { describe, expect, it } from "vitest";
import {
  classifyImageSource,
  writtenImageAddress,
  isInsideLink,
  newMarkNonce,
  placeRemoteImages,
  remoteImageMark,
  stripRemoteMarks,
  type RemoteImage,
} from "./inlineImages";

const SERVEUR = "https://plateforme.example";

describe("classifyImageSource — d'où vient une image", () => {
  it("un chemin relatif se lit contre le serveur : c'est un fichier téléversé, affiché d'office", () => {
    expect(classifyImageSource("/upload/communecter/comments/abc/photo.png", SERVEUR)).toEqual({
      kind: "platform",
      url: "https://plateforme.example/upload/communecter/comments/abc/photo.png",
    });
  });

  it("une adresse complète du serveur aussi, quel qu'en soit le chemin", () => {
    expect(classifyImageSource("https://plateforme.example/upload/x.png", SERVEUR)).toEqual({ kind: "platform", url: "https://plateforme.example/upload/x.png" });
    expect(classifyImageSource("https://plateforme.example/assets/logo.png", SERVEUR).kind).toBe("platform");
  });

  it("un autre site est tiers — même sous-domaine voisin, même port différent", () => {
    expect(classifyImageSource("https://images.example.org/chat.jpg", SERVEUR)).toEqual({
      kind: "remote",
      url: "https://images.example.org/chat.jpg",
      host: "images.example.org",
    });
    expect(classifyImageSource("https://www.plateforme.example/x.png", SERVEUR).kind).toBe("remote");
    expect(classifyImageSource("https://plateforme.example:8443/x.png", SERVEUR).kind).toBe("remote");
    expect(classifyImageSource("http://ailleurs.example/x.png", SERVEUR)).toMatchObject({ kind: "remote", host: "ailleurs.example" });
  });

  it("une adresse sans protocole (`//…`) mène ailleurs : tierce", () => {
    expect(classifyImageSource("//espion.example/pixel.gif", SERVEUR)).toEqual({
      kind: "remote",
      url: "https://espion.example/pixel.gif",
      host: "espion.example",
    });
  });

  it("le nom du site sort normalisé, en minuscules", () => {
    expect(classifyImageSource("HTTPS://Images.Example.ORG/a.png", SERVEUR)).toMatchObject({ kind: "remote", host: "images.example.org" });
  });

  it("refusées : `data:`, `javascript:`, une adresse vide ou blanche, un serveur illisible", () => {
    expect(classifyImageSource("data:image/png;base64,iVBORw0KGgo=", SERVEUR)).toEqual({ kind: "refused" });
    expect(classifyImageSource("javascript:alert(1)", SERVEUR)).toEqual({ kind: "refused" });
    expect(classifyImageSource("", SERVEUR)).toEqual({ kind: "refused" });
    expect(classifyImageSource("   ", SERVEUR)).toEqual({ kind: "refused" });
    expect(classifyImageSource("/upload/x.png", "pas une adresse")).toEqual({ kind: "refused" });
  });

  it("les espaces de bord ne comptent pas", () => {
    expect(classifyImageSource("  /upload/x.png ", SERVEUR)).toEqual({ kind: "platform", url: "https://plateforme.example/upload/x.png" });
  });
});

describe("writtenImageAddress — ce qui s'écrit dans le texte", () => {
  it("un fichier du serveur, rendu absolu par le SDK, s'écrit par son chemin seul", () => {
    expect(writtenImageAddress("https://plateforme.example/upload/communecter/comments/a/chat.png?v=2#x", SERVEUR)).toBe("/upload/communecter/comments/a/chat.png?v=2#x");
  });

  it("un chemin déjà relatif reste tel quel", () => {
    expect(writtenImageAddress("/upload/a.png", SERVEUR)).toBe("/upload/a.png");
  });

  it("une adresse d'ailleurs, ou refusée, reste entière", () => {
    expect(writtenImageAddress("https://images.example.org/chat.jpg", SERVEUR)).toBe("https://images.example.org/chat.jpg");
    expect(writtenImageAddress("data:image/png;base64,AAAA", SERVEUR)).toBe("data:image/png;base64,AAAA");
  });
});

/** Le jeton d'un rendu, fixé pour les tests. */
const JETON = "0123456789abcdef01234567";

const CHAT: RemoteImage = { url: "https://images.example.org/chat.jpg", host: "images.example.org", alt: "Un chat", inLink: false };
const etiquette = (image: RemoteImage) => `Afficher l'image de ${image.host}`;

describe("placeRemoteImages — ce que le lecteur voit à la place d'une image tierce", () => {
  it("fermée : un bouton qui nomme le site, l'adresse entière en infobulle", () => {
    const html = placeRemoteImages(`<p>Voici ${remoteImageMark(0, JETON)}</p>`, [CHAT], new Set(), etiquette, JETON);
    expect(html).toBe(
      `<p>Voici <button type="button" data-remote-image="0" title="https://images.example.org/chat.jpg">Afficher l'image de images.example.org</button></p>`
        .replace("l'image", "l&#39;image"),
    );
  });

  it("ouverte : l'image, sans Referer, focalisable par le code", () => {
    const html = placeRemoteImages(remoteImageMark(0, JETON), [CHAT], new Set([0]), etiquette, JETON);
    expect(html).toBe(
      `<img src="https://images.example.org/chat.jpg" alt="Un chat" loading="lazy" referrerpolicy="no-referrer" tabindex="-1" data-remote-image-shown="0">`,
    );
  });

  it("dans un lien : sa description, sans bouton ni image — même « ouverte »", () => {
    const html = placeRemoteImages(`<a href="/x">${remoteImageMark(0, JETON)}</a>`, [{ ...CHAT, inLink: true }], new Set([0]), etiquette, JETON);
    expect(html).toBe(`<a href="/x">Un chat</a>`);
  });

  it("dans un lien et sans description : le nom du site", () => {
    const html = placeRemoteImages(remoteImageMark(0, JETON), [{ ...CHAT, alt: "  ", inLink: true }], new Set(), etiquette, JETON);
    expect(html).toBe("images.example.org");
  });

  it("chaque marque prend SON image, dans l'ordre du texte", () => {
    const deux: RemoteImage[] = [CHAT, { url: "https://b.example/2.png", host: "b.example", alt: "deux", inLink: false }];
    const html = placeRemoteImages(`${remoteImageMark(1, JETON)} puis ${remoteImageMark(0, JETON)}`, deux, new Set([1]), etiquette, JETON);
    expect(html.startsWith(`<img src="https://b.example/2.png" alt="deux"`)).toBe(true);
    expect(html).toContain(`data-remote-image-shown="1"`);
    expect(html).toContain(`data-remote-image="0"`);
  });

  it("une marque sans image ne laisse rien", () => {
    expect(placeRemoteImages(`a${remoteImageMark(3, JETON)}b`, [CHAT], new Set(), etiquette, JETON)).toBe("ab");
  });

  it("tout ce qui vient du texte entre échappé — adresse, description, nom affiché", () => {
    const piege: RemoteImage = {
      url: `https://x.example/a"b<c>.png`,
      host: "x.example",
      alt: `"><script>alert(1)</script>`,
      inLink: false,
    };
    const fermee = placeRemoteImages(remoteImageMark(0, JETON), [piege], new Set(), () => `<b>&"'`, JETON);
    expect(fermee).toBe(`<button type="button" data-remote-image="0" title="https://x.example/a&quot;b&lt;c&gt;.png">&lt;b&gt;&amp;&quot;&#39;</button>`);
    const ouverte = placeRemoteImages(remoteImageMark(0, JETON), [piege], new Set([0]), etiquette, JETON);
    expect(ouverte).toContain(`src="https://x.example/a&quot;b&lt;c&gt;.png"`);
    expect(ouverte).toContain(`alt="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"`);
    expect(ouverte).not.toContain("<script>");
  });

  it("une marque d'un AUTRE jeton — fabriquée par l'auteur — ne reçoit rien, et ses signes partent", () => {
    const forgee = remoteImageMark(0, "ffffffffffffffffffffffff");
    expect(placeRemoteImages(`<a title="A${forgee}B">l</a> ${remoteImageMark(0, JETON)}`, [CHAT], new Set(), etiquette, JETON))
      .toBe(`<a title="Affffffffffffffffffffffff:0B">l</a> <button type="button" data-remote-image="0" title="https://images.example.org/chat.jpg">Afficher l&#39;image de images.example.org</button>`);
  });

  it("sans marque, le HTML passe intact", () => {
    expect(placeRemoteImages("<p>rien</p>", [CHAT], new Set([0]), etiquette, JETON)).toBe("<p>rien</p>");
  });
});

describe("newMarkNonce — le jeton d'un rendu", () => {
  it("vingt-quatre chiffres hexadécimaux, tirés au hasard", () => {
    const [a, b] = [newMarkNonce(), newMarkNonce()];
    expect(a).toMatch(/^[0-9a-f]{24}$/);
    expect(a).not.toBe(b);
  });
});

describe("stripRemoteMarks — personne ne peut écrire une marque", () => {
  it("retire les deux signes, et eux seuls", () => {
    expect(stripRemoteMarks(`a\uE0000\uE001b é ✓`)).toBe("a0b é ✓");
  });
});

describe("isInsideLink", () => {
  const jetons = (...types: string[]) => types.map(type => ({ type }));

  it("vrai entre l'ouverture et la fermeture d'un lien", () => {
    expect(isInsideLink(jetons("link_open", "image", "link_close"), 1)).toBe(true);
  });

  it("faux hors de tout lien, et après un lien fermé", () => {
    expect(isInsideLink(jetons("text", "image"), 1)).toBe(false);
    expect(isInsideLink(jetons("link_open", "text", "link_close", "image"), 3)).toBe(false);
  });
});
