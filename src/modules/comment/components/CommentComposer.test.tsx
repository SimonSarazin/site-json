// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import i18n from "@/i18n";
import { CommentComposer } from "./CommentComposer";
import "../i18n";

/**
 * Le composer est jugé sur son clavier.
 *
 * Ce qui est vérifié ici, ce sont les décisions d'ergonomie qu'un refactor casse sans bruit :
 * Entrée envoie mais pas pendant une composition d'accent, Maj+Entrée passe à la ligne, et
 * les marques de mise en forme ne volent pas le focus du champ.
 */

function mount(props: Partial<Parameters<typeof CommentComposer>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const cocolight = { me: null, api: null, entity: null, helper: {} } as unknown as CocolightContextType;
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        CocolightContext.Provider,
        { value: cocolight },
        createElement(LocalizationProvider, null, children),
      ),
    );

  const onSubmit = vi.fn();
  const view = render(createElement(CommentComposer, { onSubmit, ...props }), { wrapper });
  // `textbox`, le rôle IMPLICITE du textarea : « ARIA in HTML » n'autorise aucun rôle de
  // remplacement sur `<textarea>`, un `role="combobox"` y serait hors spécification et le champ
  // cesserait d'être annoncé comme zone multiligne.
  const field = screen.getByRole("textbox") as HTMLTextAreaElement;
  /** Nouvelles props sur le MÊME composer : ce que fait l'hôte quand la liste d'images change. */
  const update = (next: Partial<Parameters<typeof CommentComposer>[0]>) =>
    view.rerender(createElement(CommentComposer, { onSubmit, ...next }));
  return { onSubmit, field, update };
}

function type(field: HTMLTextAreaElement, value: string) {
  fireEvent.change(field, { target: { value } });
}

describe("CommentComposer — accessibilité", () => {
  it("n'annonce aucune liste tant qu'il n'y a pas de suggestion", () => {
    const { field } = mount();
    // Liste fermée : AUCUN `aria-activedescendant` ni `aria-controls` — pointer un identifiant
    // inexistant rend le champ muet chez certains lecteurs d'écran, ce qui est pire que de ne
    // rien annoncer. Les deux attributs permanents, eux, disent que le champ peut en ouvrir une.
    expect(field.getAttribute("aria-activedescendant")).toBeNull();
    expect(field.getAttribute("aria-controls")).toBeNull();
    expect(field.getAttribute("aria-autocomplete")).toBe("list");
    expect(field.getAttribute("aria-haspopup")).toBe("listbox");
    // Le rôle de remplacement ne doit PAS revenir : c'est la régression à verrouiller.
    expect(field.getAttribute("role")).toBeNull();
  });

  it("décrit la mise en forme sans l'afficher", () => {
    mount();
    // La phrase est lue par un lecteur d'écran, jamais vue : les six marques sont des
    // icônes, et leur `aria-label` seul ne dit pas qu'on peut aussi les taper.
    // Toutes les mentions hors écran, pas la première : il y en a désormais deux, et se fier
    // à leur ORDRE ferait d'un ajout anodin un échec de test.
    const horsEcran = [...document.querySelectorAll(".sr-only")].map(e => e.textContent ?? "");
    expect(horsEcran.some(texte => texte.includes("**"))).toBe(true);
  });
});

describe("CommentComposer — envoi", () => {
  it("Entrée envoie le message", () => {
    const { onSubmit, field } = mount();
    type(field, "bonjour");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("bonjour", []);
  });

  it("Maj+Entrée n'envoie pas — c'est un passage à la ligne", () => {
    const { onSubmit, field } = mount();
    type(field, "bonjour");
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("n'envoie pas un message vide, ni fait que d'espaces", () => {
    const { onSubmit, field } = mount();
    type(field, "   ");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("coupe les espaces de bord avant d'envoyer", () => {
    const { onSubmit, field } = mount();
    type(field, "  bonjour  ");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("bonjour", []);
  });

  it("vide le champ après l'envoi", () => {
    const { field } = mount();
    type(field, "bonjour");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(field.value).toBe("");
  });

  it("le bouton d'envoi est désactivé tant que rien n'est écrit", () => {
    const { field } = mount();
    const send = screen.getByRole("button", { name: /envoyer/i });
    expect(send).toBeDisabled();
    type(field, "bonjour");
    expect(send).not.toBeDisabled();
  });
});

describe("CommentComposer — mise en forme", () => {
  it("une marque entoure la sélection sans faire perdre le focus au champ", () => {
    const { field } = mount();
    type(field, "dis bonjour");
    field.setSelectionRange(4, 11);

    const bold = screen.getByRole("button", { name: "Gras" });
    // À la souris : `mouseDown` garde le focus (et la sélection) dans le champ, `click` applique.
    fireEvent.mouseDown(bold);
    fireEvent.click(bold);

    expect(field.value).toBe("dis **bonjour**");
    expect(document.activeElement).toBe(field);
  });

  it("répond au CLAVIER — elle était morte : seul `mouseDown` appliquait (revue du 29/09)", async () => {
    const { field } = mount();
    type(field, "dis bonjour");
    field.setSelectionRange(4, 11);
    const user = userEvent.setup();
    screen.getByRole("button", { name: "Gras" }).focus();
    await user.keyboard("{Enter}");
    expect(field.value).toBe("dis **bonjour**");
    expect(document.activeElement).toBe(field);
  });

  it("insère un exemple sélectionné quand rien n'est choisi", () => {
    const { field } = mount();
    type(field, "");
    fireEvent.click(screen.getByRole("button", { name: "Citation" }));
    // L'exemple inséré est TRADUIT (il était écrit en dur, en français, dans la bibliothèque).
    expect(field.value).toBe("> citation");
  });

  /**
   * Le test français ne suffit pas : ses exemples sont IDENTIQUES aux anciens littéraux, si bien
   * qu'un retour en arrière passerait inaperçu. En anglais, plus aucun mot français.
   */
  it("insère l'exemple de la langue courante — en anglais, plus un mot de français", async () => {
    await i18n.changeLanguage("en");
    try {
      const { field } = mount();
      fireEvent.click(screen.getByRole("button", { name: "Quote" }));
      expect(field.value).toBe("> quote");
    } finally {
      await i18n.changeLanguage("fr");
    }
  });
});

describe("CommentComposer — réponse et édition", () => {
  it("affiche le bandeau « réponse à » et permet d'en sortir", () => {
    const onStopReplying = vi.fn();
    mount({ replyingTo: { id: "x", author: "Camille" }, onStopReplying });
    expect(screen.getByText(/Réponse à Camille/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /ne plus répondre/i }));
    expect(onStopReplying).toHaveBeenCalled();
  });

  it("en mode édition, rend à l'envoi les mentions du message — elles disparaissaient à la correction", () => {
    const camille = { id: "e".repeat(24), name: "Camille", slug: "camille" };
    const { onSubmit, field } = mount({ mode: "edit", initialValue: "merci @camille", initialMentions: [camille] });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("merci @camille", [camille]);
  });

  it("en mode édition : libellé « Enregistrer », valeur initiale, et Échap annule", () => {
    const onCancel = vi.fn();
    const { field } = mount({ mode: "edit", initialValue: "texte existant", onCancel });
    expect(field.value).toBe("texte existant");
    expect(screen.getByRole("button", { name: /enregistrer/i })).toBeTruthy();
    fireEvent.keyDown(field, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("CommentComposer — images (B1 levé)", () => {
  it("colle une image : elle est JOINTE, plus refusée", () => {
    const onAddImages = vi.fn();
    const { field } = mount({ onAddImages });
    const file = new File(["x"], "photo.png", { type: "image/png" });
    fireEvent.paste(field, {
      clipboardData: { files: [file], items: [], getData: () => "" },
    });
    expect(onAddImages).toHaveBeenCalledWith([file]);
  });

  // Confisquer tout collage ferait perdre son texte à qui colle un paragraphe : la garde ne
  // doit se déclencher que sur une vraie image.
  it("ne confisque pas un collage de texte", () => {
    const onAddImages = vi.fn();
    const { field } = mount({ onAddImages });
    fireEvent.paste(field, { clipboardData: { files: [], items: [], getData: () => "du texte" } });
    expect(onAddImages).not.toHaveBeenCalled();
  });

  // Sans rappel d'ajout, le composer ne doit proposer aucun bouton qui ne mènerait nulle part —
  // c'est ce qui le garde utilisable en mode édition, où les images ne sont pas gérées.
  it("n'offre aucun bouton d'image quand l'hôte n'en reçoit pas", () => {
    mount();
    expect(screen.queryByRole("button", { name: /joindre une image/i })).toBeNull();
  });

  it("offre le bouton d'image dès que l'hôte sait en recevoir", () => {
    mount({ onAddImages: vi.fn() });
    expect(screen.getByRole("button", { name: /joindre une image/i })).toBeTruthy();
  });

  // `Comment::insert` accepte explicitement un message sans texte s'il porte des images : le
  // bouton d'envoi doit donc s'activer sur les seules pièces jointes.
  it("autorise l'envoi d'un message sans texte mais avec image", () => {
    const image = {
      localId: "img-1", name: "photo.png", previewUrl: null,
      status: "ready" as const, docId: "a".repeat(24),
    };
    mount({ onAddImages: vi.fn(), onRemoveImage: vi.fn(), images: [image] });
    const envoyer = screen.getByRole("button", { name: /envoyer/i }) as HTMLButtonElement;
    expect(envoyer.disabled).toBe(false);
  });

  // Envoyer pendant un téléversement perdrait l'image : son identifiant n'existe pas encore.
  it("retient l'envoi tant qu'une image téléverse", () => {
    const image = {
      localId: "img-2", name: "photo.png", previewUrl: null,
      status: "uploading" as const, docId: null,
    };
    mount({ onAddImages: vi.fn(), onRemoveImage: vi.fn(), images: [image], imagesBusy: true });
    const envoyer = screen.getByRole("button", { name: /envoyer/i }) as HTMLButtonElement;
    expect(envoyer.disabled).toBe(true);
  });

  it("explique un refus plutôt que d'ignorer le fichier", () => {
    mount({ onAddImages: vi.fn(), imageRejections: ["type"] });
    expect(screen.getByText(/JPEG et PNG/i)).toBeTruthy();
  });
});

/**
 * Ce que le composer fait d'une image qui ne partira pas.
 *
 * Vu au navigateur le 07/10 : le backend refusait le téléversement (500), l'aperçu passait au
 * rouge sans un mot, et le message partait quand même — sans son image, l'aperçu en échec
 * effacé par l'envoi. Rien ne disait à l'auteur que son image n'avait jamais été jointe.
 */
describe("CommentComposer — image qui ne partira pas", () => {
  const image = (status: "uploading" | "ready" | "error", n = 1) => ({
    localId: `img-${status}-${n}`, name: `photo-${n}.png`, previewUrl: null,
    status, docId: status === "ready" ? String(n).repeat(24) : null,
  });
  const hote = { onAddImages: vi.fn(), onRemoveImage: vi.fn() };
  const envoyer = () => screen.getByRole("button", { name: /envoyer/i }) as HTMLButtonElement;
  const annonces = (role: "alert" | "status") =>
    screen.queryAllByRole(role).map(e => e.textContent ?? "").filter(texte => texte.trim() !== "");

  // Le bouton n'était pas la seule voie : Entrée appelait l'envoi sans regarder le téléversement.
  it("Entrée n'envoie pas tant qu'une image téléverse, et le texte reste dans le champ", () => {
    const { onSubmit, field } = mount({ ...hote, images: [image("uploading")], imagesBusy: true });
    type(field, "avec ma photo");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.value).toBe("avec ma photo");
  });

  // La retenue se lit dans le STATUT des images : un hôte qui oublierait `imagesBusy` laissait
  // encore Entrée envoyer sans l'image.
  it("retient l'envoi sur le seul statut « en route », sans `imagesBusy`", () => {
    const { onSubmit, field } = mount({ ...hote, images: [image("uploading")] });
    type(field, "avec ma photo");
    expect(envoyer().disabled).toBe(true);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // Entrée retenue sans un mot paraîtrait morte — une image lourde sur une liaison lente, ce sont
  // de longues secondes. La phrase ne vient qu'APRÈS une tentative, et s'en va avec le téléversement.
  it("dit pourquoi rien ne part quand on tente d'envoyer pendant un téléversement", () => {
    const { field, update } = mount({ ...hote, images: [image("uploading")], imagesBusy: true });
    type(field, "avec ma photo");
    expect(annonces("status").some(texte => /encore en cours d'envoi/.test(texte))).toBe(false);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(annonces("status").some(texte => /^L'image est encore en cours d'envoi/.test(texte))).toBe(true);

    // L'image arrive : la phrase tombe d'elle-même.
    update({ ...hote, images: [{ ...image("uploading"), status: "ready" as const, docId: "a".repeat(24) }] });
    expect(annonces("status").some(texte => /encore en cours d'envoi/.test(texte))).toBe(false);
    // … et un NOUVEAU téléversement ne la ramène pas tant qu'on n'a pas retenté.
    update({ ...hote, images: [image("uploading", 2)], imagesBusy: true });
    expect(annonces("status").some(texte => /encore en cours d'envoi/.test(texte))).toBe(false);
  });

  it("compte les images attendues quand elles sont plusieurs", () => {
    const { field } = mount({ ...hote, images: [image("uploading", 1), image("uploading", 2)], imagesBusy: true });
    type(field, "avec mes photos");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(annonces("status").some(texte => /^2 images sont encore en cours d'envoi/.test(texte))).toBe(true);
  });

  it("retient l'envoi tant qu'une image a échoué, au bouton comme à Entrée", () => {
    const { onSubmit, field } = mount({ ...hote, images: [image("error")] });
    type(field, "avec ma photo");
    expect(envoyer().disabled).toBe(true);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.value).toBe("avec ma photo");
  });

  // Une image prête ne rachète pas celle qui a échoué : l'auteur en a joint deux.
  it("retient l'envoi même si une autre image, elle, est prête", () => {
    const { onSubmit, field } = mount({ ...hote, images: [image("ready", 1), image("error", 2)] });
    expect(envoyer().disabled).toBe(true);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("dit quelle image n'a pas pu être jointe, et quoi faire", () => {
    mount({ ...hote, images: [image("ready", 1), image("error", 2)] });
    const alerte = screen.getByRole("alert");
    expect(alerte.textContent).toContain("photo-2.png");
    expect(alerte.textContent).not.toContain("photo-1.png");
    expect(alerte.textContent).toMatch(/retirez-la/i);
  });

  it("les compte quand elles sont plusieurs", () => {
    mount({ ...hote, images: [image("error", 1), image("error", 2)] });
    expect(screen.getByRole("alert").textContent).toMatch(/2 images/);
  });

  // L'aperçu en échec portait déjà son propre `role="status"` : deux régions vivantes disaient le
  // même échec au même rendu, avec deux verbes. Une seule annonce, celle de l'alerte.
  it("annonce l'échec une seule fois", () => {
    mount({ ...hote, images: [image("error")] });
    expect(annonces("alert")).toHaveLength(1);
    expect(annonces("status").filter(texte => /n'a pas pu/.test(texte))).toEqual([]);
  });

  // Le composer est un conteneur `inline-size` : un nom de fichier long et sans point de coupure
  // ne l'élargit pas, il en sortait (mesuré par une relecture : 25 px au-delà du bord pour 52
  // caractères). jsdom ne mesure rien — on tient la règle de césure.
  it("laisse la phrase se couper sur un nom de fichier long", () => {
    mount({ ...hote, images: [image("error")] });
    expect(screen.getByRole("alert").className.split(/\s+/)).toContain("break-words");
  });

  it("ne dit rien tant qu'aucune image n'a échoué", () => {
    mount({ ...hote, images: [image("ready", 1), image("uploading", 2)], imagesBusy: true });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // La phrase demande de « retirer » l'image : le bouton doit exister et joindre l'hôte. Sans ce
  // câblage, l'image en échec ne partirait jamais et l'envoi resterait retenu pour de bon.
  it("offre le bouton de retrait que la phrase désigne, relié à l'hôte", () => {
    const onRemoveImage = vi.fn();
    mount({ onAddImages: vi.fn(), onRemoveImage, images: [image("ready", 1), image("error", 2)] });
    fireEvent.click(screen.getByRole("button", { name: "Retirer photo-2.png" }));
    expect(onRemoveImage).toHaveBeenCalledExactlyOnceWith("img-error-2");
  });

  // Les deux rappels vont ensemble. Si l'hôte n'offre pas le retrait, les aperçus ne sont pas
  // montrés : retenir l'envoi enfermerait l'auteur derrière une phrase qu'il ne peut pas suivre.
  it("ne retient pas l'envoi sur un échec que personne ne peut retirer", () => {
    const { onSubmit, field } = mount({ onAddImages: vi.fn(), images: [image("error")] });
    expect(screen.queryByRole("alert")).toBeNull();
    type(field, "tant pis pour la photo");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("tant pis pour la photo", []);
  });

  // Retirer l'image en échec est le geste demandé : il doit suffire, sans rien retaper.
  it("l'image en échec retirée, le message part avec son texte", () => {
    const { onSubmit, field, update } = mount({ ...hote, images: [image("error")] });
    type(field, "tant pis pour la photo");
    update({ ...hote, images: [] });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(envoyer().disabled).toBe(false);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("tant pis pour la photo", []);
  });

  // « Sans texte mais avec image » ne vaut que pour une image qui PART : une image en échec ou
  // encore en route n'est pas un contenu, et l'envoi produirait un message vide.
  it("une image retirée de la course n'autorise pas un message sans texte", () => {
    const { onSubmit, field, update } = mount({ ...hote, images: [image("error")] });
    expect(envoyer().disabled).toBe(true);
    fireEvent.keyDown(field, { key: "Enter" });
    update({ ...hote, images: [image("uploading")], imagesBusy: true });
    expect(envoyer().disabled).toBe(true);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
