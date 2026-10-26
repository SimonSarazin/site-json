// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createElement, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import { CommentImages } from "./CommentImages";
import type { CommentImage } from "../types";
import "../i18n";

/**
 * Les images d'un message.
 *
 * Deux décisions sont verrouillées ici, parce qu'elles sont invisibles à la relecture du code :
 * la source est toujours l'image d'origine, que `OptimizedImage` demande à la largeur utile
 * (480 px seule, 192 px en vignette) — la miniature carrée du backend ne sert qu'en repli, quand
 * l'original manque ou ne se charge pas —, et un document disparu se dit au lieu de laisser un
 * cadre vide.
 */

function monte(images: readonly CommentImage[]) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(LocalizationProvider, null, children);
  return render(createElement(CommentImages, { images }), { wrapper });
}

const image = (over: Partial<CommentImage> = {}): CommentImage => ({
  id: "a".repeat(24),
  url: "/upload/grande.jpg",
  thumbUrl: "/upload/thumb/grande.jpg",
  name: "capture.png",
  ...over,
});

describe("CommentImages", () => {
  it("ne rend rien sans image — pas même un conteneur vide", () => {
    const { container } = monte([]);
    expect(container.querySelector("[data-comment-images]")).toBeNull();
  });

  /** La largeur DEMANDÉE à l'optimiseur — pas l'attribut `width`, qui ne réduit rien. */
  const demandee = (img: HTMLImageElement) => new URL(img.src).searchParams.get("w");

  it("sert l'image d'origine pour une image seule, demandée à 480 px", () => {
    monte([image()]);
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("grande.jpg");
    expect(img.src).not.toContain("thumb");
    expect(demandee(img)).toBe("480");
  });

  // À plusieurs aussi : la miniature du backend est un carré de 200 px, déformé et bordé de noir
  // pour une image en paysage. La réduction, c'est `OptimizedImage` qui la demande.
  it("sert l'image d'origine à plusieurs aussi, demandée à la largeur d'une vignette", () => {
    monte([image(), image({ id: "b".repeat(24), name: "seconde.png" })]);
    const imgs = screen.getAllByRole("img") as HTMLImageElement[];
    expect(imgs).toHaveLength(2);
    expect(imgs.every(img => img.src.includes("grande.jpg") && !img.src.includes("thumb"))).toBe(true);
    expect(imgs.map(demandee)).toEqual(["192", "192"]);
  });

  it("se rabat sur la miniature quand l'image d'origine manque", () => {
    monte([image({ url: null }), image({ id: "b".repeat(24), url: null })]);
    const sources = screen.getAllByRole("img").map(i => (i as HTMLImageElement).src);
    expect(sources.every(src => src.includes("thumb"))).toBe(true);
  });

  // Le repli doit jouer aussi quand l'original EXISTE mais ne se charge pas (optimiseur en 502
  // sur un fichier trop lourd ou trop lent) : sans cela une vignette cassée remplace une
  // miniature valide — et celle-là seulement, pas ses voisines.
  it("se rabat sur la miniature quand l'image d'origine ne se charge pas", () => {
    monte([image(), image({ id: "b".repeat(24), name: "seconde.png" })]);
    const [premiere, seconde] = screen.getAllByRole("img") as HTMLImageElement[];
    fireEvent.error(premiere);
    expect((screen.getAllByRole("img")[0] as HTMLImageElement).src).toContain("thumb");
    expect(seconde.src).not.toContain("thumb");
  });

  // Un aperçu local porte la même adresse des deux côtés : il n'y a rien vers quoi se replier,
  // la source doit rester la même — sinon le même chargement repartirait en boucle.
  it("garde sa source quand la miniature est la même adresse", () => {
    monte([image({ url: "blob:local-1", thumbUrl: "blob:local-1" })]);
    const img = screen.getByRole("img") as HTMLImageElement;
    fireEvent.error(img);
    expect((screen.getByRole("img") as HTMLImageElement).src).toBe("blob:local-1");
  });

  // Le backend décrémente `countImages` quand un document a disparu, mais rien ne garantit que
  // l'entrée ne survive pas : mieux vaut le dire que peindre un cadre vide.
  it("signale un document disparu au lieu d'un cadre vide", () => {
    const { container } = monte([image({ url: null, thumbUrl: null })]);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("[data-comment-images] svg")).not.toBeNull();
  });

  // Rien à agrandir : la visionneuse s'ouvrirait sur sa seule croix.
  it("n'ouvre pas la visionneuse sur un document disparu", () => {
    monte([image({ url: null, thumbUrl: null })]);
    const tuile = screen.getByRole("button", { name: /capture\.png/i }) as HTMLButtonElement;
    expect(tuile.disabled).toBe(true);
    fireEvent.click(tuile);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("nomme chaque image, même sans nom de fichier", () => {
    monte([image({ name: "" }), image({ id: "b".repeat(24), name: "" })]);
    expect(screen.getByRole("button", { name: /image 1 sur 2/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /image 2 sur 2/i })).toBeTruthy();
  });

  it("ouvre la visionneuse au clic", () => {
    monte([image()]);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /capture\.png/i }));
    // Le dialogue est PORTALISÉ : il ne se trouve pas sous `container`, seulement dans l'écran.
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("CommentImages — visionneuse", () => {
  // TROIS images, pas deux : à deux, « suivante » et « précédente » mènent au même endroit, et un
  // sens inversé passerait inaperçu.
  const trois = ["une", "deux", "trois"].map((nom, i) => image({
    id: String(i + 1).repeat(24), url: `/upload/${nom}.jpg`, thumbUrl: `/upload/thumb/${nom}.jpg`, name: `${nom}.jpg`,
  }));
  const agrandie = () => (screen.getByRole("dialog").querySelector("img") as HTMLImageElement).src;

  // Mesuré au navigateur le 07/10 : l'image « agrandie » plafonnait à 512 px sur grand écran. Le
  // dialogue de base porte `sm:max-w-lg`, qu'une largeur maximale SANS variante `sm:` n'écrase
  // pas — tailwind-merge ne fusionne que des classes de même variante. On teste la cause : la
  // classe de base ne doit plus figurer dans le résultat de la fusion.
  it("lève le plafond de 32 rem du dialogue de base", () => {
    monte([image()]);
    fireEvent.click(screen.getByRole("button", { name: /capture\.png/i }));
    expect(screen.getByRole("dialog").className).not.toMatch(/(^|\s)sm:max-w-lg(\s|$)/);
  });

  // Second plafond, mesuré juste après le premier : une boîte à la largeur de son contenu, posée
  // à `left: 50%`, ne dispose que de la moitié de l'écran (720 px sur 1440). Même méthode — le
  // centrage du dialogue de base ne doit plus figurer dans la fusion.
  it("ne se borne pas à la moitié de l'écran", () => {
    monte([image()]);
    fireEvent.click(screen.getByRole("button", { name: /capture\.png/i }));
    const classes = screen.getByRole("dialog").className;
    expect(classes).not.toMatch(/left-\[50%\]/);
    expect(classes).not.toMatch(/translate-x-\[-50%\]/);
  });

  // Retirer une classe de base ne suffit pas : ce qui la REMPLACE fait la mise en page. Une
  // relecture l'a montré par la mesure — sans `mx-auto` ou `right-0` la boîte se colle au bord
  // gauche, un `sm:max-w-md` la ramène sous les 512 px d'origine, et sans `min-w-0` la flèche
  // « suivante » sort de l'écran. jsdom ne mesure rien : on tient les classes, une à une.
  it("porte chaque réglage qui remplace ceux du dialogue de base", () => {
    monte(trois);
    fireEvent.click(screen.getByRole("button", { name: /une\.jpg/i }));
    const dialogue = screen.getByRole("dialog");
    const classes = dialogue.className.split(/\s+/);
    for (const attendue of ["left-0", "right-0", "mx-auto", "translate-x-0", "w-fit", "sm:max-w-[min(72rem,95vw)]"]) {
      expect(classes, attendue).toContain(attendue);
    }
    // Une seule largeur maximale par variante : celle-là, et pas une autre plus étroite.
    expect(classes.filter(c => c.startsWith("sm:max-w-"))).toEqual(["sm:max-w-[min(72rem,95vw)]"]);
    expect((dialogue.querySelector("img") as HTMLImageElement).className.split(/\s+/)).toContain("min-w-0");
  });

  // La croix tient le coin, les flèches le milieu : sous 124 px de haut elles se recouvraient,
  // et toucher « suivante » fermait la visionneuse (panoramique sur téléphone, image en attente).
  it("garde une hauteur où la croix ne recouvre pas « suivante »", () => {
    monte(trois);
    fireEvent.click(screen.getByRole("button", { name: /une\.jpg/i }));
    expect(screen.getByRole("dialog").className.split(/\s+/)).toContain("min-h-36");
  });

  it("montre la miniature si l'image agrandie ne se charge pas", () => {
    monte(trois);
    fireEvent.click(screen.getByRole("button", { name: /deux\.jpg/i }));
    fireEvent.error(screen.getByRole("dialog").querySelector("img") as HTMLImageElement);
    // L'adresse est encodée dans le paramètre `url` de l'optimiseur : on lit le paramètre.
    expect(new URL(agrandie()).searchParams.get("url")).toBe("/upload/thumb/deux.jpg");
  });

  it("ouvre sur l'image cliquée, en pleine résolution", () => {
    monte(trois);
    fireEvent.click(screen.getByRole("button", { name: /deux\.jpg/i }));
    expect(agrandie()).toContain("deux.jpg");
    expect(agrandie()).not.toContain("thumb");
  });

  it("avance avec « suivante », recule avec « précédente »", () => {
    monte(trois);
    fireEvent.click(screen.getByRole("button", { name: /une\.jpg/i }));
    fireEvent.click(screen.getByRole("button", { name: /image suivante/i }));
    expect(agrandie()).toContain("deux.jpg");
    fireEvent.click(screen.getByRole("button", { name: /image précédente/i }));
    expect(agrandie()).toContain("une.jpg");
  });

  it("boucle aux deux bouts", () => {
    monte(trois);
    fireEvent.click(screen.getByRole("button", { name: /une\.jpg/i }));
    fireEvent.click(screen.getByRole("button", { name: /image précédente/i }));
    expect(agrandie()).toContain("trois.jpg");
    fireEvent.click(screen.getByRole("button", { name: /image suivante/i }));
    expect(agrandie()).toContain("une.jpg");
  });

  it("se parcourt aux flèches du clavier, dans le même sens que les boutons", () => {
    monte(trois);
    fireEvent.click(screen.getByRole("button", { name: /une\.jpg/i }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(agrandie()).toContain("deux.jpg");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(agrandie()).toContain("trois.jpg");
  });

  // La croix du dialogue de base se nommait « Close » et se perdait, sombre sur le voile sombre.
  it("se ferme par sa propre croix, nommée dans la langue du site", () => {
    monte([image()]);
    fireEvent.click(screen.getByRole("button", { name: /capture\.png/i }));
    expect(screen.queryByRole("button", { name: /^close$/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /fermer l'image/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("n'offre aucune flèche pour une image seule", () => {
    monte([image()]);
    fireEvent.click(screen.getByRole("button", { name: /capture\.png/i }));
    expect(screen.queryByRole("button", { name: /image suivante/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /image précédente/i })).toBeNull();
  });
});
