// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, useEffect, useImperativeHandle } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import type { EditorSurfaceProps } from "./editor/EditorSurface";
import type { EditorSurfaceHandle, EditorSurfaceState, FormatKind } from "./editor/editorTypes";
import "../i18n";

/**
 * La COQUILLE du composer, sans l'éditeur.
 *
 * Deux choses se jugent ici, que la suite principale ne peut pas voir puisqu'elle charge le vrai :
 *   - ce que la coquille montre et retient tant que le code de l'éditeur n'est pas là, et quand il
 *     n'arrive pas ;
 *   - le CONTRAT entre les deux — ce qu'elle lui passe, ce qu'elle fait de ce qu'il lui dit. L'éditeur
 *     est remplacé par un témoin qui enregistre ses props et tient une poignée factice.
 */

const magasin = vi.hoisted(() => ({
  courant: { surface: null as unknown, failed: false },
  charger: vi.fn(async () => undefined),
}));
vi.mock("./editor/editorStore", () => ({
  loadEditorSurface: magasin.charger,
  useEditorSurface: () => magasin.courant,
}));

const { CommentComposer } = await import("./CommentComposer");

const AUCUNE = Object.fromEntries(
  ["bold", "italic", "strike", "code", "link", "quote", "list", "ordered", "codeBlock"].map(kind => [kind, false]),
) as Record<FormatKind, boolean>;

/** Ce que le témoin a reçu, et la poignée qu'il a posée. */
const recu: { props: EditorSurfaceProps | null } = { props: null };
const poignee = {
  focus: vi.fn(), toggle: vi.fn(), setHeading: vi.fn(), setLink: vi.fn(), insertText: vi.fn(), insertImage: vi.fn(), clear: vi.fn(),
  currentLink: vi.fn<() => string | null>(() => null),
  read: vi.fn(() => ({ text: "lu dans l'éditeur", mentions: [{ id: "a".repeat(24), name: "Camille", slug: "camille" }] })),
} satisfies EditorSurfaceHandle;

function Temoin(props: EditorSurfaceProps) {
  useEffect(() => { recu.props = props; });
  // Par le même crochet que le vrai : la poignée n'existe qu'une fois l'éditeur monté.
  useImperativeHandle(props.handleRef, () => poignee, []);
  return createElement("div", { "data-temoin": "" });
}
/** Ce que l'éditeur dit de lui. Par défaut : pas de titre au curseur, et le bloc peut en devenir un. */
const dire = (etat: Pick<EditorSurfaceState, "empty" | "active"> & Partial<EditorSurfaceState>) =>
  act(() => { recu.props!.onStateChange({ heading: null, canHeading: true, ...etat }); });

type Props = Partial<Parameters<typeof CommentComposer>[0]>;
function mount(props: Props = {}) {
  const onSubmit = vi.fn();
  const view = render(createElement(LocalizationProvider, null, createElement(CommentComposer, { onSubmit, ...props })));
  const update = (next: Props) => view.rerender(createElement(LocalizationProvider, null, createElement(CommentComposer, { onSubmit, ...next })));
  return { onSubmit, update, container: view.container };
}
const bouton = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;
const image = { localId: "img-1", name: "photo.png", previewUrl: null, status: "ready" as const, docId: "a".repeat(24) };

beforeEach(() => {
  vi.clearAllMocks();
  magasin.courant = { surface: null, failed: false };
  recu.props = null;
  poignee.read.mockReturnValue({ text: "lu dans l'éditeur", mentions: [{ id: "a".repeat(24), name: "Camille", slug: "camille" }] });
  poignee.currentLink.mockReturnValue(null);
});

describe("CommentComposer — tant que l'éditeur n'est pas là", () => {
  it("demande son code au montage, une fois", () => {
    const { update } = mount();
    update({ disabled: true });
    expect(magasin.charger).toHaveBeenCalledOnce();
  });

  it("montre un champ inerte de même allure : le texte d'attente, et « occupé »", () => {
    const { container } = mount({ placeholder: "Votre avis…" });
    const attente = container.querySelector("[data-comment-field-loading]")!;
    expect(attente.textContent).toBe("Votre avis…");
    expect(attente.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("à défaut de texte d'attente donné, celui de la situation : écrire, répondre, corriger", () => {
    const texte = (props: Props) => mount(props).container.querySelector("[data-comment-field-loading]")!.textContent;
    expect(texte({})).toBe("Écrire un message…");
    expect(texte({ replyingTo: { id: "x", author: "Camille" } })).toBe("Répondre à Camille…");
    expect(texte({ mode: "edit" })).toBe("Modifier le message…");
  });

  it("la barre d'outils et l'envoi attendent — une image prête ne suffit pas à envoyer", () => {
    mount({ onAddImages: vi.fn(), onRemoveImage: vi.fn(), images: [image] });
    for (const nom of ["Gras", "Italique", "Barré", "Code", "Lien", "Citation", "Liste à puces", "Liste numérotée", "Bloc de code", "Insérer un émoji"]) {
      expect(bouton(nom).disabled).toBe(true);
    }
    expect(bouton(/envoyer/i).disabled).toBe(true);
    // Joindre une image, lui, ne dépend pas de l'éditeur.
    expect(bouton(/joindre une image/i).disabled).toBe(false);
  });

  it("le code n'arrive pas : c'est dit, et « Réessayer » le redemande", () => {
    magasin.courant = { surface: null, failed: true };
    const { container } = mount();
    const alerte = screen.getByRole("alert");
    expect(alerte.textContent).toContain("L'éditeur n'a pas pu être chargé.");
    expect(container.querySelector("[data-comment-field-loading]")).toBeNull();
    expect(magasin.charger).toHaveBeenCalledOnce();
    fireEvent.click(bouton("Réessayer"));
    expect(magasin.charger).toHaveBeenCalledTimes(2);
    expect(bouton(/envoyer/i).disabled).toBe(true);
  });
});

describe("CommentComposer — ce que la coquille passe à l'éditeur", () => {
  beforeEach(() => { magasin.courant = { surface: Temoin, failed: false }; });

  it("le texte de départ et ses mentions, le périmètre des mentions, l'état, le focus", () => {
    const camille = { id: "e".repeat(24), name: "Camille", slug: "camille" };
    const entity = { id: "o".repeat(24) } as never;
    mount({ mode: "edit", initialValue: "merci @camille", initialMentions: [camille], entity, disabled: true, autoFocus: true });
    expect(recu.props).toMatchObject({
      initialValue: "merci @camille", initialMentions: [camille], entity, disabled: true, autoFocus: true,
      placeholder: "Modifier le message…", label: "Modifier le message…",
    });
  });

  it("par défaut : rien à relire, personne de mentionné, ni focus ni périmètre", () => {
    mount();
    expect(recu.props).toMatchObject({ initialValue: "", initialMentions: [], entity: null, disabled: false, autoFocus: false });
    expect(recu.props!.onCancel).toBeUndefined();
    expect(recu.props!.onAddImages).toBeUndefined();
  });

  it("un texte d'attente donné s'affiche, mais le champ garde le NOM de ce qu'on y fait", () => {
    mount({ placeholder: "Votre avis…", replyingTo: { id: "x", author: "Camille" } });
    expect(recu.props).toMatchObject({ placeholder: "Votre avis…", label: "Répondre à Camille…" });
  });

  it("la phrase qui décrit la mise en forme, par son identifiant", () => {
    mount();
    const aide = document.getElementById(recu.props!.describedBy ?? "");
    expect(aide?.className).toContain("sr-only");
    expect(aide?.textContent).toContain("Maj+Entrée");
  });

  it("ses rappels : annuler, et recevoir une image collée", () => {
    const onCancel = vi.fn();
    const onAddImages = vi.fn();
    mount({ onCancel, onAddImages });
    expect(recu.props!.onCancel).toBe(onCancel);
    expect(recu.props!.onAddImages).toBe(onAddImages);
  });
});

describe("CommentComposer — ce que la coquille fait de ce que l'éditeur lui dit", () => {
  beforeEach(() => { magasin.courant = { surface: Temoin, failed: false }; });

  it("tant qu'il n'a rien dit, elle ne sait pas s'il est vide : tout attend", () => {
    mount();
    expect(bouton(/envoyer/i).disabled).toBe(true);
    expect(bouton("Gras").disabled).toBe(true);
  });

  it("vide : la barre s'ouvre, l'envoi reste fermé ; plein : il s'ouvre", () => {
    mount();
    dire({ empty: true, active: AUCUNE });
    expect(bouton("Gras").disabled).toBe(false);
    expect(bouton(/envoyer/i).disabled).toBe(true);
    dire({ empty: false, active: AUCUNE });
    expect(bouton(/envoyer/i).disabled).toBe(false);
  });

  it("vide mais avec une image prête : l'envoi s'ouvre", () => {
    mount({ onAddImages: vi.fn(), onRemoveImage: vi.fn(), images: [image] });
    dire({ empty: true, active: AUCUNE });
    expect(bouton(/envoyer/i).disabled).toBe(false);
  });

  it("les marques actives se lisent sur leurs boutons, une par une", () => {
    mount();
    dire({ empty: false, active: { ...AUCUNE, italic: true, list: true } });
    const presses = ["Gras", "Italique", "Barré", "Code", "Lien", "Citation", "Liste à puces", "Liste numérotée", "Bloc de code"]
      .filter(nom => bouton(nom).getAttribute("aria-pressed") === "true");
    expect(presses).toEqual(["Italique", "Liste à puces"]);
    expect(bouton("Italique").className).toContain("bg-accent");
    expect(bouton("Gras").className).not.toContain("bg-accent");
  });

  it.each([
    ["Gras", "bold"], ["Italique", "italic"], ["Barré", "strike"], ["Code", "code"],
    ["Citation", "quote"], ["Liste à puces", "list"], ["Liste numérotée", "ordered"], ["Bloc de code", "codeBlock"],
  ])("« %s » commande sa bascule à l'éditeur", (nom, kind) => {
    mount();
    dire({ empty: true, active: AUCUNE });
    fireEvent.click(bouton(nom));
    expect(poignee.toggle).toHaveBeenCalledExactlyOnceWith(kind);
  });

  it("« Lien » ne bascule rien : il demande une adresse, puis la pose", () => {
    mount();
    dire({ empty: false, active: AUCUNE });
    fireEvent.click(bouton("Lien"));
    expect(poignee.toggle).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Adresse du lien"), { target: { value: "exemple.org" } });
    fireEvent.click(bouton("Appliquer"));
    expect(poignee.setLink).toHaveBeenCalledExactlyOnceWith("https://exemple.org");
    expect(screen.queryByLabelText("Adresse du lien")).toBeNull();
  });

  it("dans un lien : son adresse est proposée, et « Retirer le lien » le retire", () => {
    poignee.currentLink.mockReturnValue("https://exemple.org/page");
    mount();
    dire({ empty: false, active: { ...AUCUNE, link: true } });
    fireEvent.click(bouton("Lien"));
    expect((screen.getByLabelText("Adresse du lien") as HTMLInputElement).value).toBe("https://exemple.org/page");
    fireEvent.click(bouton("Retirer le lien"));
    expect(poignee.setLink).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("refermé sans rien poser, le champ d'adresse rend le focus au texte — pas à son bouton", async () => {
    mount();
    dire({ empty: false, active: AUCUNE });
    fireEvent.click(bouton("Lien"));
    fireEvent.keyDown(screen.getByLabelText("Adresse du lien"), { key: "Escape" });
    expect(screen.queryByLabelText("Adresse du lien")).toBeNull();
    // Le focus est rendu un instant après la fermeture, pas dans le même geste.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(poignee.focus).toHaveBeenCalled();
    expect(document.activeElement).not.toBe(bouton("Lien"));
    expect(poignee.setLink).not.toHaveBeenCalled();
  });

  it("l'envoi lit l'éditeur, transmet son texte et SES mentions, puis le vide", () => {
    const { onSubmit } = mount();
    dire({ empty: false, active: AUCUNE });
    fireEvent.click(bouton(/envoyer/i));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("lu dans l'éditeur", [{ id: "a".repeat(24), name: "Camille", slug: "camille" }]);
    expect(poignee.clear).toHaveBeenCalledOnce();
  });

  it("Entrée dans l'éditeur passe par le même envoi, avec les mêmes retenues", () => {
    const { onSubmit, update } = mount({ submitting: true });
    dire({ empty: false, active: AUCUNE });
    act(() => { recu.props!.onSubmit(); });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(poignee.clear).not.toHaveBeenCalled();
    update({ submitting: false });
    act(() => { recu.props!.onSubmit(); });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("un éditeur qui ne rend que des espaces n'envoie rien, et n'est pas vidé", () => {
    poignee.read.mockReturnValue({ text: "", mentions: [] });
    const { onSubmit } = mount();
    dire({ empty: false, active: AUCUNE });
    act(() => { recu.props!.onSubmit(); });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(poignee.clear).not.toHaveBeenCalled();
  });

  it("`disabled` retient l'envoi venu du clavier aussi", () => {
    const { onSubmit } = mount({ disabled: true });
    dire({ empty: false, active: AUCUNE });
    act(() => { recu.props!.onSubmit(); });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("choisir « Répondre » donne le focus à l'éditeur ; arrêter de répondre, non", () => {
    const { update } = mount();
    expect(poignee.focus).not.toHaveBeenCalled();
    update({ replyingTo: { id: "x", author: "Camille" } });
    expect(poignee.focus).toHaveBeenCalledOnce();
    update({ replyingTo: null });
    expect(poignee.focus).toHaveBeenCalledOnce();
  });

  it("`disabled` ferme la barre même si l'éditeur a parlé", () => {
    mount({ disabled: true });
    dire({ empty: false, active: AUCUNE });
    expect(bouton("Gras").disabled).toBe(true);
    expect(bouton(/envoyer/i).disabled).toBe(true);
  });
});

/**
 * Le menu des titres : six niveaux, comme l'éditeur du legacy, et le texte normal. Placé où le legacy
 * le place — après le barré. La coquille ne fait que dire le niveau choisi à l'éditeur.
 */
describe("CommentComposer — le menu des titres", () => {
  beforeEach(() => { magasin.courant = { surface: Temoin, failed: false }; });
  // Le menu de Radix s'appuie sur des API de pointeur que jsdom n'a pas.
  const manquantes = ["hasPointerCapture", "releasePointerCapture", "scrollIntoView"] as const;
  beforeAll(() => {
    for (const nom of manquantes) (Element.prototype as unknown as Record<string, unknown>)[nom] ??= () => false;
  });
  afterAll(() => {
    for (const nom of manquantes) delete (Element.prototype as unknown as Record<string, unknown>)[nom];
  });

  it("se place après « Barré », comme dans le legacy", () => {
    mount();
    dire({ empty: true, active: AUCUNE });
    const noms = screen.getAllByRole("button").map(b => b.getAttribute("aria-label")).filter(Boolean);
    expect(noms.slice(0, 5)).toEqual(["Gras", "Italique", "Barré", "Titre", "Code"]);
  });

  it("ouvre le texte normal et six niveaux, et commande à l'éditeur celui qu'on choisit", async () => {
    mount();
    dire({ empty: true, active: AUCUNE });
    const user = userEvent.setup();
    await user.click(bouton("Titre"));
    const niveaux = await screen.findAllByRole("menuitemradio");
    expect(niveaux.map(n => n.textContent)).toEqual(["Texte normal", "Titre 1", "Titre 2", "Titre 3", "Titre 4", "Titre 5", "Titre 6"]);
    expect(niveaux[0]!.getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("menuitemradio", { name: "Titre 2" }));
    expect(poignee.setHeading).toHaveBeenCalledExactlyOnceWith(2);
    // Refermé, le menu rend la main au texte — et pas d'abord à son bouton, qu'un lecteur d'écran annoncerait.
    expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0);
    expect(poignee.focus).toHaveBeenCalled();
    expect(document.activeElement).not.toBe(bouton("Titre"));
  });

  it("n'est pas modal : ouvert, il laisse la page vivante — le composer vit souvent dans un dialogue", async () => {
    mount();
    dire({ empty: true, active: AUCUNE });
    const user = userEvent.setup();
    await user.click(bouton("Titre"));
    await screen.findAllByRole("menuitemradio");
    // Un menu modal coupe le pointeur à tout le reste de la page — et, sous un dialogue monté, l'y laisse coupé.
    expect(document.body.style.pointerEvents).not.toBe("none");
    await user.keyboard("{Escape}");
  });

  it("le niveau au curseur est coché, le bouton se dit actif — et « Texte normal » rend le paragraphe", async () => {
    mount();
    dire({ empty: false, active: AUCUNE, heading: 3 });
    expect(bouton("Titre").className).toContain("bg-accent");
    const user = userEvent.setup();
    await user.click(bouton("Titre"));
    expect((await screen.findByRole("menuitemradio", { name: "Titre 3" })).getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("menuitemradio", { name: "Texte normal" }));
    expect(poignee.setHeading).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("là où un titre ne peut pas aller — la première ligne d'un élément de liste —, le bouton est inactif", () => {
    mount();
    dire({ empty: false, active: { ...AUCUNE, list: true }, canHeading: false });
    expect(bouton("Titre").disabled).toBe(true);
    dire({ empty: false, active: AUCUNE });
    expect(bouton("Titre").disabled).toBe(false);
  });

  it("tant que l'éditeur n'a rien dit de lui, il est inactif comme le reste de la barre", () => {
    mount();
    expect(bouton("Titre").disabled).toBe(true);
  });
});
