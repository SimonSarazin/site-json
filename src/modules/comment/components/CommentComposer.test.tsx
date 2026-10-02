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
  render(createElement(CommentComposer, { onSubmit, ...props }), { wrapper });
  // `textbox`, le rôle IMPLICITE du textarea : « ARIA in HTML » n'autorise aucun rôle de
  // remplacement sur `<textarea>`, un `role="combobox"` y serait hors spécification et le champ
  // cesserait d'être annoncé comme zone multiligne.
  const field = screen.getByRole("textbox") as HTMLTextAreaElement;
  return { onSubmit, field };
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
