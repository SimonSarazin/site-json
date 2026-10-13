// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Editor } from "@tiptap/core";
import { Slice } from "@tiptap/pm/model";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import i18n from "@/i18n";
import { COMMENT_PROSE } from "../lib/commentProse";
import { CommentComposer } from "./CommentComposer";
import { loadEditorSurface, useEditorSurface } from "./editor/editorStore";
import type { EditorSurfaceHandle, EditorSurfaceState } from "./editor/editorTypes";
import { stubSelectionGeometry } from "./editor/__tests__/jsdom";
import "../i18n";

/**
 * Le composer est jugé sur son clavier et sur ce qu'il ENVOIE.
 *
 * Ce qui est vérifié ici, ce sont les décisions d'ergonomie qu'un refactor casse sans bruit :
 * Entrée envoie — sauf dans une liste, un bloc de code, ou sur un écran tactile —, Maj+Entrée
 * passe à la ligne, les marques ne volent pas le focus du champ, et ce qui part est le markdown
 * que le fil rendra.
 *
 * Le champ est un éditeur (`editor/EditorSurface`) : jsdom ne sait pas taper dans un
 * `contenteditable`, on y écrit donc par son instance — le reste (touches, collage, boutons)
 * passe par les vrais événements.
 */

// Le code de l'éditeur est chargé une fois : chaque composer monté ensuite le trouve tout de suite.
// Son attente et son échec ont leur fichier (`CommentComposer.chargement.test.tsx`).
beforeAll(async () => {
  stubSelectionGeometry();
  await loadEditorSurface();
});

// Le sélecteur d'émojis est un paquet lourd, chargé à l'ouverture : ici, un bouton qui en choisit un.
vi.mock("emoji-picker-react", () => ({
  default: ({ onEmojiClick }: { onEmojiClick: (choisi: { emoji: string }) => void }) =>
    createElement("button", { type: "button", onClick: () => onEmojiClick({ emoji: "🎉" }) }, "choisir-un-émoji"),
}));

type Champ = HTMLElement & { editor: Editor };
type Props = Partial<Parameters<typeof CommentComposer>[0]>;

function mount(props: Props = {}) {
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
  // `textbox` : un `contenteditable` n'a pas de rôle implicite, l'éditeur le pose. Cherché dans CE
  // composer : un test peut en monter deux.
  const field = within(view.container).getByRole("textbox") as Champ;
  /** Nouvelles props sur le MÊME composer : ce que fait l'hôte quand la liste d'images change. */
  const update = (next: Props) => view.rerender(createElement(CommentComposer, { onSubmit, ...next }));
  return { onSubmit, field, editor: field.editor, update, container: view.container };
}

/** Écrit au curseur, comme la frappe : du TEXTE, signes compris — pas du markdown relu. */
function type(field: Champ, value: string) {
  if (value === "") return;
  act(() => { field.editor.commands.insertContent({ type: "text", text: value }); });
}
/**
 * Tape signe après signe, par où passe la vraie frappe (`handleTextInput`) : c'est là que se
 * déclenchent les raccourcis tapés — `- ` qui ouvre une liste, `**gras**` qui pose une marque.
 */
function frapper(field: Champ, texte: string) {
  const { editor } = field;
  for (const signe of texte) {
    act(() => {
      const { from, to } = editor.state.selection;
      const inserer = () => editor.state.tr.insertText(signe, from, to);
      const pris = editor.view.someProp("handleTextInput", gerer => gerer(editor.view, from, to, signe, inserer));
      if (!pris) editor.view.dispatch(inserer());
    });
  }
}
/** Sélectionne `mot` dans le premier bloc du champ (les positions de l'éditeur commencent à 1). */
function select(field: Champ, mot: string) {
  const debut = field.editor.getText().indexOf(mot) + 1;
  act(() => { field.editor.commands.setTextSelection({ from: debut, to: debut + mot.length }); });
}
const touche = (field: Champ, key: string, plus: KeyboardEventInit = {}) => act(() => { fireEvent.keyDown(field, { key, ...plus }); });
const bouton = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;
const clic = (element: HTMLElement) => act(() => { fireEvent.mouseDown(element); fireEvent.click(element); });
/** L'éditeur donne le focus à l'image suivante, pas dans l'instant : on l'attend avant d'en juger. */
const image = () => act(async () => { await new Promise(resolve => requestAnimationFrame(() => resolve(null))); });

describe("CommentComposer — rendu serveur", () => {
  // Le serveur et le premier rendu du client doivent écrire le MÊME balisage. Ici le code de
  // l'éditeur est déjà chargé — comme dans un onglet où l'on a déjà écrit — et le serveur n'en
  // rend rien quand même.
  it("au serveur, pas d'éditeur : le champ d'attente, et rien de ProseMirror", () => {
    const queryClient = new QueryClient();
    const cocolight = { me: null, api: null, entity: null, helper: {} } as unknown as CocolightContextType;
    const html = renderToString(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(CocolightContext.Provider, { value: cocolight },
          createElement(LocalizationProvider, null, createElement(CommentComposer, { onSubmit: vi.fn(), initialValue: "du **gras**" })))),
    );
    expect(html).toContain("data-comment-field-loading");
    expect(html).not.toContain("ProseMirror");
    expect(html).not.toContain('role="textbox"');
    // Le texte de départ n'est pas écrit en clair à la place du champ : il attend l'éditeur.
    expect(html).not.toContain("du **gras**");
  });
});

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
  });

  it("est une zone de texte multiligne, atteignable au clavier, nommée d'après ce qu'on y fait", () => {
    const { field } = mount();
    expect(field.getAttribute("role")).toBe("textbox");
    expect(field.getAttribute("aria-multiline")).toBe("true");
    expect(field.getAttribute("tabindex")).toBe("0");
    expect(field.getAttribute("contenteditable")).toBe("true");
    expect(field.getAttribute("aria-label")).toBe("Écrire un message…");
  });

  it("se nomme autrement quand on répond, et quand on corrige", () => {
    expect(mount({ replyingTo: { id: "x", author: "Camille" } }).field.getAttribute("aria-label")).toBe("Répondre à Camille…");
    expect(mount({ mode: "edit" }).field.getAttribute("aria-label")).toBe("Modifier le message…");
  });

  it("décrit la mise en forme sans l'afficher, et le champ y renvoie", () => {
    const { field } = mount();
    // La phrase est lue par un lecteur d'écran, jamais vue : les marques sont des icônes, et leur
    // nom seul ne dit ni qu'on peut les taper, ni ce que fait Entrée.
    const aide = document.getElementById(field.getAttribute("aria-describedby") ?? "");
    expect(aide?.className).toContain("sr-only");
    expect(aide?.textContent).toContain("**");
    expect(aide?.textContent).toContain("Maj+Entrée");
  });

  it("le texte d'attente est une décoration : il ne fait pas partie du message", () => {
    const { field, onSubmit } = mount({ placeholder: "Votre avis…" });
    expect(field.querySelector("[data-placeholder]")?.getAttribute("data-placeholder")).toBe("Votre avis…");
    expect(field.editor.getText()).toBe("");
    touche(field, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // Ce qu'on voit en tapant est ce que le fil montrera : mêmes classes de mise en forme des deux côtés.
  it("porte la mise en forme du fil", () => {
    const { field } = mount();
    for (const classe of COMMENT_PROSE.split(" ")) expect(field.classList.contains(classe)).toBe(true);
    expect(field.classList.contains("comment-editor-field")).toBe(true);
  });

  it("le texte d'attente suit ses props sans recréer l'éditeur", () => {
    const { field, update } = mount();
    const editeur = field.editor;
    update({ replyingTo: { id: "x", author: "Camille" } });
    expect(field.querySelector("[data-placeholder]")?.getAttribute("data-placeholder")).toBe("Répondre à Camille…");
    expect(field.getAttribute("aria-label")).toBe("Répondre à Camille…");
    expect((screen.getByRole("textbox") as Champ).editor).toBe(editeur);
  });

  it("`disabled` : on n'y écrit plus, et c'est dit", () => {
    const { field, update } = mount({ disabled: true });
    expect(field.getAttribute("contenteditable")).toBe("false");
    expect(field.getAttribute("aria-disabled")).toBe("true");
    // Le texte d'attente reste : un champ fermé ET vide ne dirait plus ce qu'il est.
    expect(field.querySelector("[data-placeholder]")).toBeTruthy();
    expect(bouton("Gras").disabled).toBe(true);
    update({ disabled: false });
    expect(field.getAttribute("contenteditable")).toBe("true");
    expect(field.getAttribute("aria-disabled")).toBeNull();
  });
});

describe("CommentComposer — envoi", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("Entrée envoie le message", () => {
    const { onSubmit, field } = mount();
    type(field, "bonjour");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("bonjour", []);
  });

  it("Maj+Entrée n'envoie pas — c'est un passage à la ligne, et il part avec le message", () => {
    const { onSubmit, field } = mount();
    type(field, "bonjour");
    touche(field, "Enter", { shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.querySelectorAll("p")).toHaveLength(1);
    type(field, "la suite");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("bonjour\nla suite", []);
  });

  it("n'envoie pas un message vide, ni fait que d'espaces ou de sauts de ligne", () => {
    const { onSubmit, field } = mount();
    touche(field, "Enter");
    type(field, "   ");
    touche(field, "Enter");
    touche(field, "Enter", { shiftKey: true });
    touche(field, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(bouton(/envoyer/i).disabled).toBe(true);
  });

  it("coupe les espaces de bord avant d'envoyer", () => {
    const { onSubmit, field } = mount();
    type(field, "  bonjour  ");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("bonjour", []);
  });

  it("vide le champ après l'envoi, et le bouton se referme", () => {
    const { field } = mount();
    type(field, "bonjour");
    touche(field, "Enter");
    expect(field.editor.getText()).toBe("");
    expect(bouton(/envoyer/i).disabled).toBe(true);
  });

  it("le bouton d'envoi est désactivé tant que rien n'est écrit, et envoie comme Entrée", () => {
    const { field, onSubmit } = mount();
    const send = bouton(/envoyer/i);
    expect(send).toBeDisabled();
    type(field, "bonjour");
    expect(send).not.toBeDisabled();
    act(() => { fireEvent.click(send); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("bonjour", []);
  });

  it("ce qu'on tape part tel qu'on l'a tapé : un signe du markdown reste un signe", () => {
    const { onSubmit, field } = mount();
    type(field, "[urgent] 2 * 3 * 4 = 24, ~10h, voir nom_de_fichier et C:\\dossier");
    touche(field, "Enter");
    // Tel quel, sans une barre oblique inverse : ce texte se lit aussi là où le markdown n'est pas rendu.
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("[urgent] 2 * 3 * 4 = 24, ~10h, voir nom_de_fichier et C:\\dossier", []);
  });

  it("… sauf ce qui, relu, deviendrait autre chose : cela seul est neutralisé", () => {
    const { onSubmit, field } = mount();
    type(field, "a *x* b");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("a \\*x\\* b", []);
  });

  it("dans une liste, Entrée ouvre l'élément suivant — elle n'envoie pas", () => {
    const { onSubmit, field } = mount();
    clic(bouton("Liste à puces"));
    type(field, "un");
    touche(field, "Enter");
    type(field, "deux");
    expect(onSubmit).not.toHaveBeenCalled();
    expect([...field.querySelectorAll("li")].map(li => li.textContent)).toEqual(["un", "deux"]);
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("- un\n- deux", []);
  });

  it("dans un bloc de code, Entrée passe à la ligne — elle n'envoie pas", () => {
    const { onSubmit, field } = mount();
    clic(bouton("Bloc de code"));
    type(field, "const a = 1;");
    touche(field, "Enter");
    type(field, "const b = 2;");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.querySelector("pre")?.textContent).toBe("const a = 1;\nconst b = 2;");
  });

  // Il n'y a pas de Maj+Entrée sous le pouce : sur un écran tactile, Entrée doit pouvoir passer à
  // la ligne, et le message part par son bouton.
  it("sur un écran tactile, Entrée passe à la ligne : le message part par son bouton", () => {
    vi.stubGlobal("matchMedia", (requete: string) => ({ matches: requete === "(pointer: coarse)" }));
    const { onSubmit, field } = mount();
    type(field, "première ligne");
    touche(field, "Enter");
    type(field, "seconde");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.querySelectorAll("p")).toHaveLength(2);
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("première ligne\n\nseconde", []);
  });

  it("avec une souris, la même Entrée envoie", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const { onSubmit, field } = mount();
    type(field, "bonjour");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("bonjour", []);
  });

  it("`disabled` retient l'envoi de ce qui est déjà écrit, à Entrée comme au bouton — et le rend en se levant", () => {
    const { onSubmit, field, update } = mount();
    type(field, "bonjour");
    update({ disabled: true });
    expect(bouton(/envoyer/i).disabled).toBe(true);
    touche(field, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.editor.getText()).toBe("bonjour");
    update({ disabled: false });
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("bonjour", []);
  });

  it("`submitting` retient l'envoi, à Entrée comme au bouton", () => {
    const { onSubmit, field, update } = mount({ submitting: true });
    type(field, "bonjour");
    expect(bouton(/envoyer/i).disabled).toBe(true);
    touche(field, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.editor.getText()).toBe("bonjour");
    update({ submitting: false });
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("bonjour", []);
  });
});

describe("CommentComposer — mise en forme", () => {
  it("une marque s'applique à la sélection sans faire perdre le focus au champ", async () => {
    const { field, onSubmit } = mount();
    type(field, "dis bonjour");
    select(field, "bonjour");

    // À la souris : `mouseDown` garde le focus (et la sélection) dans le champ, `click` applique.
    clic(bouton("Gras"));
    await image();

    expect(field.querySelector("strong")?.textContent).toBe("bonjour");
    expect(document.activeElement).toBe(field);
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("dis **bonjour**", []);
  });

  it("le clic sur une marque ne prend pas le focus : son `mouseDown` est neutralisé", () => {
    mount();
    for (const nom of ["Gras", "Italique", "Barré", "Code", "Lien", "Citation", "Liste à puces", "Liste numérotée", "Bloc de code"]) {
      expect(fireEvent.mouseDown(bouton(nom))).toBe(false);
    }
  });

  it("répond au CLAVIER — elle était morte : seul `mouseDown` appliquait (revue du 29/09)", async () => {
    const { field } = mount();
    type(field, "dis bonjour");
    select(field, "bonjour");
    const user = userEvent.setup();
    bouton("Gras").focus();
    await user.keyboard("{Enter}");
    await image();
    expect(field.querySelector("strong")?.textContent).toBe("bonjour");
    expect(document.activeElement).toBe(field);
  });

  it.each([
    ["Gras", "strong", "**mot**"],
    ["Italique", "em", "*mot*"],
    ["Barré", "s", "~~mot~~"],
    ["Code", "code", "`mot`"],
  ])("« %s » pose sa marque, et elle part en markdown", (nom, balise, attendu) => {
    const { field, onSubmit } = mount();
    type(field, "mot");
    select(field, "mot");
    clic(bouton(nom));
    expect(field.querySelector(balise)?.textContent).toBe("mot");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(attendu, []);
  });

  it.each([
    ["Citation", "blockquote", "> mot"],
    ["Liste à puces", "ul", "- mot"],
    ["Liste numérotée", "ol", "1. mot"],
    ["Bloc de code", "pre", "```\nmot\n```"],
  ])("« %s » change le bloc, et il part en markdown", (nom, balise, attendu) => {
    const { field, onSubmit } = mount();
    type(field, "mot");
    clic(bouton(nom));
    expect(field.querySelector(balise)?.textContent).toBe("mot");
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(attendu, []);
  });

  it("une marque se retire comme elle se pose : le bouton bascule", () => {
    const { field } = mount();
    type(field, "mot");
    select(field, "mot");
    clic(bouton("Gras"));
    clic(bouton("Gras"));
    expect(field.querySelector("strong")).toBeNull();
  });

  it("chaque bouton DIT son état : `aria-pressed` suit le curseur, pas le dernier clic", () => {
    const { field } = mount();
    type(field, "du gras puis rien");
    select(field, "gras");
    expect(bouton("Gras").getAttribute("aria-pressed")).toBe("false");
    clic(bouton("Gras"));
    expect(bouton("Gras").getAttribute("aria-pressed")).toBe("true");
    expect(bouton("Italique").getAttribute("aria-pressed")).toBe("false");
    // Le curseur sort du gras : le bouton se relâche sans qu'on y touche.
    select(field, "rien");
    expect(bouton("Gras").getAttribute("aria-pressed")).toBe("false");
  });

  it("nomme ses boutons dans la langue courante — en anglais, plus un mot de français", async () => {
    await i18n.changeLanguage("en");
    try {
      mount();
      for (const nom of ["Bold", "Italic", "Strikethrough", "Code", "Link", "Quote", "Bulleted list", "Numbered list", "Code block"]) {
        expect(bouton(nom).getAttribute("title")).toBe(nom);
      }
    } finally {
      await i18n.changeLanguage("fr");
    }
  });

  it.each([
    ["- un", "ul li"], ["1. un", "ol li"], ["> cité", "blockquote"], ["``` ", "pre"],
  ])("les raccourcis de bloc qu'on tape marchent encore : « %s »", (saisie, balise) => {
    const { field } = mount();
    frapper(field, saisie);
    expect(field.querySelector(balise)).toBeTruthy();
  });

  it.each([
    ["**gras** ", "strong", "gras"], ["__gras__ ", "strong", "gras"], ["*italique* ", "em", "italique"],
    ["_italique_ ", "em", "italique"], ["~~barré~~ ", "s", "barré"], ["`code` ", "code", "code"],
  ])("une marque tapée « à la markdown » se pose : « %s»", (saisie, balise, texte) => {
    const { field } = mount();
    frapper(field, saisie);
    expect(field.querySelector(balise)?.textContent).toBe(texte);
    expect(field.textContent).not.toMatch(/[*_~`]/);
  });

  // Le kit mettait le « 3 » en italique. Le fil, lui, n'a jamais lu « * 3 * » comme une marque : ce
  // qu'on voit en tapant doit être ce qu'il affichera.
  it("« 2 * 3 * 4 » tapé reste un calcul : une marque ne commence ni ne finit par une espace", () => {
    const { field, onSubmit } = mount();
    frapper(field, "2 * 3 * 4 et a _ b _ c et x ~~ y ~~ z");
    expect(field.querySelector("em, strong, s")).toBeNull();
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("2 * 3 * 4 et a _ b _ c et x ~~ y ~~ z", []);
  });

  it("une étoile au milieu d'un mot n'ouvre rien", () => {
    const { field } = mount();
    frapper(field, "a*b*c ");
    expect(field.querySelector("em")).toBeNull();
  });
});

describe("CommentComposer — lien", () => {
  const adresse = () => screen.getByLabelText("Adresse du lien") as HTMLInputElement;
  const saisir = (valeur: string) => act(() => { fireEvent.change(adresse(), { target: { value: valeur } }); });

  it("« Lien » ouvre un champ d'adresse ; Entrée pose le lien sur la sélection et rend le focus au texte", async () => {
    const { field, onSubmit } = mount();
    type(field, "voir la page");
    select(field, "la page");
    clic(bouton("Lien"));
    expect(adresse().value).toBe("");
    saisir("exemple.org/page");
    act(() => { fireEvent.keyDown(adresse(), { key: "Enter" }); });
    await image();

    expect(screen.queryByLabelText("Adresse du lien")).toBeNull();
    const lien = field.querySelector("a");
    expect(lien?.textContent).toBe("la page");
    // Le protocole qu'on n'écrit jamais est complété.
    expect(lien?.getAttribute("href")).toBe("https://exemple.org/page");
    expect(document.activeElement).toBe(field);
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("voir [la page](https://exemple.org/page)", []);
  });

  it("le bouton « Appliquer » fait de même", () => {
    const { field } = mount();
    type(field, "ici");
    select(field, "ici");
    clic(bouton("Lien"));
    saisir("https://exemple.org");
    act(() => { fireEvent.click(bouton("Appliquer")); });
    expect(field.querySelector("a")?.getAttribute("href")).toBe("https://exemple.org");
  });

  it("sans sélection, l'adresse devient son propre texte", () => {
    const { field, onSubmit } = mount();
    type(field, "voir ");
    clic(bouton("Lien"));
    saisir("https://exemple.org/a_b");
    act(() => { fireEvent.click(bouton("Appliquer")); });
    expect(field.querySelector("a")?.textContent).toBe("https://exemple.org/a_b");
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("voir https://exemple.org/a_b", []);
  });

  it("une adresse qui ne mène nulle part n'est pas posée : « Appliquer » reste inactif, Entrée ne fait rien", () => {
    const { field } = mount();
    type(field, "ici");
    select(field, "ici");
    clic(bouton("Lien"));
    for (const mauvaise of ["", "javascript:alert(1)", "deux mots"]) {
      saisir(mauvaise);
      expect(bouton("Appliquer").disabled).toBe(true);
      act(() => { fireEvent.keyDown(adresse(), { key: "Enter" }); });
      expect(field.querySelector("a")).toBeNull();
    }
    // Le champ est resté ouvert : on corrige, on ne recommence pas.
    expect(adresse()).toBeTruthy();
  });

  it("dans un lien, le champ reprend son adresse et offre de le retirer", () => {
    const { field } = mount({ initialValue: "voir [la page](https://exemple.org/page) ici" });
    select(field, "page");
    expect(bouton("Lien").getAttribute("aria-pressed")).toBe("true");
    clic(bouton("Lien"));
    expect(adresse().value).toBe("https://exemple.org/page");
    act(() => { fireEvent.click(bouton("Retirer le lien")); });
    expect(field.querySelector("a")).toBeNull();
    expect(field.textContent).toBe("voir la page ici");
  });

  it("hors d'un lien, rien à retirer : le bouton n'est pas offert", () => {
    const { field } = mount();
    type(field, "ici");
    select(field, "ici");
    clic(bouton("Lien"));
    expect(screen.queryByRole("button", { name: "Retirer le lien" })).toBeNull();
  });

  it("corriger l'adresse d'un lien le garde entier, texte compris", () => {
    const { field } = mount({ initialValue: "[la page](https://exemple.org/page)" });
    // Le curseur posé DANS le lien, sans rien sélectionner : c'est tout le lien qu'on corrige.
    act(() => { field.editor.commands.setTextSelection(4); });
    clic(bouton("Lien"));
    saisir("https://exemple.org/autre");
    act(() => { fireEvent.click(bouton("Appliquer")); });
    const liens = field.querySelectorAll("a");
    expect(liens).toHaveLength(1);
    expect(liens[0].textContent).toBe("la page");
    expect(liens[0].getAttribute("href")).toBe("https://exemple.org/autre");
  });
});

describe("CommentComposer — mentions", () => {
  const personne = (id: string, name: string, slug: string) => ({ id, serverData: { name, slug } });
  const CAMILLE = personne("a".repeat(24), "Camille Martin", "camille-martin");
  const CARLOS = personne("b".repeat(24), "Carlos Diaz", "carlos");
  const SANS_SLUG = personne("c".repeat(24), "Sans Slug", "");

  function avecPersonnes(personnes: readonly unknown[], props: Props = {}) {
    const searchMembers = vi.fn().mockResolvedValue(personnes);
    const entity = { id: "e".repeat(24), searchMembers } as unknown as EntityTypes;
    return { ...mount({ entity, ...props }), searchMembers };
  }
  /** Tape `@ca` et attend la liste : la suggestion de l'éditeur et la recherche sont asynchrones. */
  async function ouvrirLaListe(field: Champ, saisie = "@ca") {
    type(field, saisie);
    return screen.findByRole("listbox");
  }
  const options = () => screen.getAllByRole("option");

  it("taper « @ » et deux lettres ouvre la liste des personnes, reliée au champ et annoncée", async () => {
    const { field, searchMembers } = avecPersonnes([CAMILLE, CARLOS]);
    const liste = await ouvrirLaListe(field);

    expect(searchMembers).toHaveBeenCalledWith({ search: "ca", searchMode: "personOnly" });
    expect(options().map(o => o.textContent)).toEqual(["Camille Martin@camille-martin", "Carlos Diaz@carlos"]);
    expect(field.getAttribute("aria-controls")).toBe(liste.id);
    expect(field.getAttribute("aria-activedescendant")).toBe(options()[0].id);
    expect(options()[0].getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByRole("status").some(s => s.textContent === "2 personnes proposées")).toBe(true);
  });

  it("les flèches déplacent la surbrillance, en boucle — le focus reste dans le champ", async () => {
    const { field } = avecPersonnes([CAMILLE, CARLOS]);
    await ouvrirLaListe(field);
    touche(field, "ArrowDown");
    expect(field.getAttribute("aria-activedescendant")).toBe(options()[1].id);
    expect(options()[1].getAttribute("aria-selected")).toBe("true");
    touche(field, "ArrowDown");
    expect(field.getAttribute("aria-activedescendant")).toBe(options()[0].id);
    touche(field, "ArrowUp");
    expect(field.getAttribute("aria-activedescendant")).toBe(options()[1].id);
  });

  it.each(["Enter", "Tab"])("%s choisit la personne surlignée — et n'envoie pas", async key => {
    const { field, onSubmit } = avecPersonnes([CAMILLE, CARLOS]);
    await ouvrirLaListe(field);
    touche(field, "ArrowDown");
    touche(field, key);

    expect(onSubmit).not.toHaveBeenCalled();
    const mention = field.querySelector("[data-type='mention']");
    // Le champ montre le NOM, comme le fil le montrera ; le slug voyage avec le nœud.
    expect(mention?.textContent).toBe("@Carlos Diaz");
    expect(mention?.getAttribute("data-slug")).toBe("carlos");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(field.getAttribute("aria-controls")).toBeNull();
  });

  it("la mention choisie part en `@slug`, avec la personne", async () => {
    const { field, onSubmit } = avecPersonnes([CAMILLE, CARLOS]);
    type(field, "merci ");
    await ouvrirLaListe(field);
    touche(field, "Enter");
    type(field, "pour tout");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(
      "merci @camille-martin pour tout",
      [{ id: "a".repeat(24), name: "Camille Martin", slug: "camille-martin" }],
    );
  });

  it("se choisit aussi à la souris, sans que le champ perde le focus", async () => {
    const { field } = avecPersonnes([CAMILLE, CARLOS]);
    await ouvrirLaListe(field);
    // `mouseDown` neutralisé : un clic ferait perdre le focus au champ avant que la mention ne soit posée.
    let laisse = true;
    act(() => { laisse = fireEvent.mouseDown(options()[1]); });
    await image();
    expect(laisse).toBe(false);
    expect(field.querySelector("[data-type='mention']")?.getAttribute("data-slug")).toBe("carlos");
    expect(document.activeElement).toBe(field);
  });

  it("le survol déplace la surbrillance", async () => {
    const { field } = avecPersonnes([CAMILLE, CARLOS]);
    await ouvrirLaListe(field);
    act(() => { fireEvent.mouseEnter(options()[1]); });
    expect(field.getAttribute("aria-activedescendant")).toBe(options()[1].id);
  });

  it("une personne sans slug n'est pas choisissable : Entrée n'est pas confisquée, le message part", async () => {
    const { field, onSubmit } = avecPersonnes([SANS_SLUG]);
    await ouvrirLaListe(field);
    touche(field, "Enter");
    expect(field.querySelector("[data-type='mention']")).toBeNull();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("@ca", []);
  });

  it("… ni à la souris : cliquer dessus ne pose rien", async () => {
    const { field } = avecPersonnes([SANS_SLUG]);
    await ouvrirLaListe(field);
    act(() => { fireEvent.mouseDown(options()[0]); });
    expect(field.querySelector("[data-type='mention']")).toBeNull();
    expect(field.editor.getText()).toBe("@ca");
  });

  it("la liste ouverte, le composer revendique Échap — même sans édition à annuler", async () => {
    const { field } = avecPersonnes([CAMILLE]);
    expect(field.closest("[data-comment-escape]")).toBeNull();
    await ouvrirLaListe(field);
    expect(field.closest("[data-comment-escape]")).toBeTruthy();
  });

  it("personne ne correspond : pas de liste, et Entrée envoie le texte tel quel — une fois la recherche revenue", async () => {
    const { field, onSubmit, searchMembers } = avecPersonnes([]);
    type(field, "@zz");
    await vi.waitFor(() => expect(searchMembers).toHaveBeenCalled());
    await image();
    expect(screen.queryByRole("listbox")).toBeNull();
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("@zz", []);
  });

  // Qui tape « @ca » puis Entrée veut la première personne proposée, pas envoyer « @ca » : un
  // message parti ne se reprend pas.
  it("tant que la recherche est en route, Entrée n'envoie pas : elle attend la liste", async () => {
    let rendre: (personnes: unknown[]) => void = () => undefined;
    const searchMembers = vi.fn(() => new Promise<unknown[]>(resolve => { rendre = resolve; }));
    const entity = { id: "e".repeat(24), searchMembers } as unknown as EntityTypes;
    const { field, onSubmit } = mount({ entity });
    type(field, "salut @ca");
    await vi.waitFor(() => expect(searchMembers).toHaveBeenCalled());
    touche(field, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.editor.getText()).toBe("salut @ca");

    // La liste arrive : Entrée choisit la personne — elle n'envoie toujours pas.
    await act(async () => { rendre([CAMILLE]); });
    await screen.findByRole("listbox");
    touche(field, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.querySelector("[data-type='mention']")?.getAttribute("data-slug")).toBe("camille-martin");
  });

  it("une mention de moins de deux lettres ne cherche rien : Entrée envoie", () => {
    const { field, onSubmit, searchMembers } = avecPersonnes([CAMILLE]);
    type(field, "voir @c");
    touche(field, "Enter");
    expect(searchMembers).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("voir @c", []);
  });

  it("un « @ » au milieu d'un mot n'ouvre rien : une adresse de courriel n'est pas une mention", async () => {
    const { field, searchMembers } = avecPersonnes([CAMILLE]);
    type(field, "contact@ca");
    await act(async () => { await Promise.resolve(); });
    expect(searchMembers).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("Échap referme la liste sans annuler l'édition ; la suivante l'annule", async () => {
    const onCancel = vi.fn();
    const { field } = avecPersonnes([CAMILLE], { mode: "edit", onCancel });
    await ouvrirLaListe(field);
    touche(field, "Escape");
    await vi.waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(onCancel).not.toHaveBeenCalled();
    touche(field, "Escape");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("en mode édition, rend à l'envoi les mentions du message — elles disparaissaient à la correction", () => {
    const camille = { id: "e".repeat(24), name: "Camille", slug: "camille" };
    const { onSubmit, field } = mount({ mode: "edit", initialValue: "merci @camille", initialMentions: [camille] });
    expect(field.querySelector("[data-type='mention']")?.textContent).toBe("@Camille");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("merci @camille", [camille]);
  });

  it("garde le type d'une mention venue du legacy : une organisation ne devient pas un citoyen", () => {
    const orga = { id: "f".repeat(24), name: "Une orga", slug: "une_orga", type: "organizations" };
    const { onSubmit, field } = mount({ mode: "edit", initialValue: "avec @une_orga", initialMentions: [orga] });
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("avec @une_orga", [orga]);
  });

  it("une mention retirée du texte n'est plus renvoyée : on ne notifie pas qui n'est plus cité", () => {
    const camille = { id: "e".repeat(24), name: "Camille", slug: "camille" };
    const { onSubmit, field } = mount({ mode: "edit", initialValue: "merci @camille", initialMentions: [camille] });
    act(() => { field.editor.commands.setContent("<p>merci à tous</p>"); });
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("merci à tous", []);
  });

  it("un `@slug` tapé à la main, sans passer par la liste, n'est pas une mention", () => {
    const { onSubmit, field } = mount();
    type(field, "merci @camille");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("merci @camille", []);
  });
});

describe("CommentComposer — réponse et édition", () => {
  it("affiche le bandeau « réponse à » et permet d'en sortir", () => {
    const onStopReplying = vi.fn();
    mount({ replyingTo: { id: "x", author: "Camille" }, onStopReplying });
    expect(screen.getByText(/Réponse à Camille/i)).toBeTruthy();
    fireEvent.click(bouton(/ne plus répondre/i));
    expect(onStopReplying).toHaveBeenCalled();
  });

  // Choisir « Répondre » ne déplaçait ni le focus ni la lecture d'écran : la cible du champ, tout
  // en bas de la page, changeait en silence.
  it("choisir « Répondre » donne le focus au champ", async () => {
    const { field, update } = mount();
    await image();
    expect(document.activeElement).not.toBe(field);
    update({ replyingTo: { id: "x", author: "Camille" } });
    await image();
    expect(document.activeElement).toBe(field);
  });

  it("`autoFocus` donne le focus au champ dès qu'il est là ; sans lui, non", async () => {
    const sans = mount().field;
    await image();
    expect(document.activeElement).not.toBe(sans);
    const { field } = mount({ autoFocus: true, initialValue: "brouillon" });
    await image();
    expect(document.activeElement).toBe(field);
  });

  it("en mode édition : libellé « Enregistrer », le message relu tel que le fil le rend, et Échap annule", () => {
    const onCancel = vi.fn();
    const { field } = mount({ mode: "edit", initialValue: "du **gras** et\nune ligne", onCancel });
    expect(field.querySelector("strong")?.textContent).toBe("gras");
    expect(field.querySelector("br")).toBeTruthy();
    expect(bouton(/enregistrer/i)).toBeTruthy();
    touche(field, "Escape");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("« Annuler » n'existe qu'en édition, et rend la main à l'hôte", () => {
    const onCancel = vi.fn();
    mount({ mode: "edit", onCancel });
    fireEvent.click(bouton("Annuler"));
    expect(onCancel).toHaveBeenCalledOnce();
    // En création, pas de bouton « Annuler » : Échap suffit, et il n'y a rien à défaire.
    expect(within(mount({ onCancel }).container).queryByRole("button", { name: "Annuler" })).toBeNull();
  });

  it("un message relu puis renvoyé sans y toucher part tel qu'il était", () => {
    const texte = "Bonjour **tous**,\n\n- un\n- deux\n\n> cité\n\nvoir https://exemple.org/a_b";
    const { onSubmit } = mount({ mode: "edit", initialValue: texte });
    act(() => { fireEvent.click(bouton(/enregistrer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith(texte, []);
  });

  /**
   * « Échap m'appartient » — mais seulement quand il a quelque chose à faire. La modale des
   * discussions lit cet attribut sur un ANCÊTRE de la cible pour ne pas se fermer sur la même frappe.
   */
  it("revendique Échap quand il y a une édition à annuler, pas autrement", () => {
    expect(mount().field.closest("[data-comment-escape]")).toBeNull();
    expect(mount({ mode: "edit", onCancel: vi.fn() }).field.closest("[data-comment-escape]")).toBeTruthy();
  });

  it("sans édition à annuler, Échap n'est pas confisquée : la modale qui l'entoure la reçoit", () => {
    const { field } = mount();
    type(field, "bonjour");
    expect(fireEvent.keyDown(field, { key: "Escape" })).toBe(true);
  });

  it("consommée, Échap ne va pas plus loin : ce qui entoure le composer ne la revoit pas", () => {
    const dehors = vi.fn();
    const { field, container } = mount({ mode: "edit", onCancel: vi.fn() });
    container.addEventListener("keydown", dehors);
    expect(fireEvent.keyDown(field, { key: "Escape" })).toBe(false);
    expect(dehors).not.toHaveBeenCalled();
  });

  /**
   * Dans la modale des discussions, Échap arrive DÉJÀ neutralisée : pour ne pas se fermer, Radix
   * — qui écoute sur `document`, en capture — appelle `preventDefault`. Or l'éditeur ignore une
   * touche neutralisée. Vu au navigateur le 13/10 : l'édition ne s'annulait plus, la liste de
   * mentions ne se refermait plus. On rejoue ici la modale par ce qu'elle fait à la touche.
   */
  describe("dans une modale, qui neutralise la touche avant nous", () => {
    const neutraliser = (event: KeyboardEvent) => { if (event.key === "Escape") event.preventDefault(); };
    beforeAll(() => { document.addEventListener("keydown", neutraliser, true); });
    afterAll(() => { document.removeEventListener("keydown", neutraliser, true); });

    it("Échap annule quand même l'édition", () => {
      const onCancel = vi.fn();
      const { field } = mount({ mode: "edit", initialValue: "à corriger", onCancel });
      touche(field, "Escape");
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("Échap referme quand même la liste de mentions — sans annuler l'édition", async () => {
      const onCancel = vi.fn();
      const searchMembers = vi.fn().mockResolvedValue([{ id: "a".repeat(24), serverData: { name: "Camille Martin", slug: "camille-martin" } }]);
      const entity = { id: "e".repeat(24), searchMembers } as unknown as EntityTypes;
      const { field } = mount({ mode: "edit", onCancel, entity });
      type(field, "@ca");
      await screen.findByRole("listbox");
      touche(field, "Escape");
      await vi.waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
      expect(onCancel).not.toHaveBeenCalled();
      expect(field.closest("[data-comment-escape]")).toBeTruthy();
    });
  });
});

describe("CommentComposer — images (B1 levé)", () => {
  const presse = (donnees: { files?: File[]; texte?: string }) => ({
    clipboardData: {
      files: donnees.files ?? [], items: [],
      getData: (type: string) => (type === "text/plain" ? donnees.texte ?? "" : ""),
    },
  });

  it("colle une image : elle est JOINTE, plus refusée", () => {
    const onAddImages = vi.fn();
    const { field } = mount({ onAddImages });
    const file = new File(["x"], "photo.png", { type: "image/png" });
    act(() => { fireEvent.paste(field, presse({ files: [file] })); });
    expect(onAddImages).toHaveBeenCalledWith([file]);
    expect(field.editor.getText()).toBe("");
  });

  // Confisquer tout collage ferait perdre son texte à qui colle un paragraphe : la garde ne
  // doit se déclencher que sur une vraie image.
  it("ne confisque pas un collage de texte : il arrive dans le champ", () => {
    const onAddImages = vi.fn();
    const { field } = mount({ onAddImages });
    act(() => { fireEvent.paste(field, presse({ texte: "du texte" })); });
    expect(onAddImages).not.toHaveBeenCalled();
    expect(field.editor.getText()).toBe("du texte");
  });

  it("sans hôte pour les recevoir, une image collée n'est pas confisquée", () => {
    const { field } = mount();
    const file = new File(["x"], "photo.png", { type: "image/png" });
    expect(() => act(() => { fireEvent.paste(field, presse({ files: [file], texte: "légende" })); })).not.toThrow();
    expect(field.editor.getText()).toBe("légende");
  });

  // Les règles de collage du kit repassaient derrière le markdown, avec leur lecture à elles.
  it("coller « 2 * 3 * 4 » ne met rien en italique : le texte collé se lit comme le fil le lira", () => {
    const { field, onSubmit } = mount();
    act(() => { fireEvent.paste(field, presse({ texte: "2 * 3 * 4 = 24" })); });
    expect(field.querySelector("em")).toBeNull();
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("2 * 3 * 4 = 24", []);
  });

  it("coller du texte, c'est le relire comme le fil le lira : une liste collée reste une liste", () => {
    const { field, onSubmit } = mount();
    act(() => { fireEvent.paste(field, presse({ texte: "- un\n- deux" })); });
    expect([...field.querySelectorAll("ul li")].map(li => li.textContent)).toEqual(["un", "deux"]);
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("- un\n- deux", []);
  });

  // jsdom ne sait pas dire OÙ l'on dépose (`elementFromPoint`), et l'éditeur s'arrête avant
  // d'appeler son gestionnaire : on l'appelle comme lui, avec le même événement.
  const deposer = (field: Champ, fichiers: File[], deplace = false) => {
    const event = { dataTransfer: { files: fichiers, items: [], getData: () => "" }, preventDefault: vi.fn() } as unknown as DragEvent;
    const pris = field.editor.view.someProp("handleDrop", gerer => gerer(field.editor.view, event, Slice.empty, deplace));
    return { pris: pris === true, event };
  };

  it("dépose une image : elle est jointe elle aussi", () => {
    const onAddImages = vi.fn();
    const { field } = mount({ onAddImages });
    const file = new File(["x"], "photo.png", { type: "image/png" });
    const { pris, event } = deposer(field, [file]);
    expect(pris).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onAddImages).toHaveBeenCalledWith([file]);
  });

  it("un dépôt qui n'apporte pas d'image, ou qui déplace du texte du champ, n'est pas confisqué", () => {
    const onAddImages = vi.fn();
    const { field } = mount({ onAddImages });
    expect(deposer(field, []).pris).toBe(false);
    expect(deposer(field, [new File(["x"], "photo.png", { type: "image/png" })], true).pris).toBe(false);
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
    expect(bouton(/joindre une image/i)).toBeTruthy();
  });

  // `Comment::insert` accepte explicitement un message sans texte s'il porte des images : le
  // bouton d'envoi doit donc s'activer sur les seules pièces jointes.
  it("autorise l'envoi d'un message sans texte mais avec image", () => {
    const image = {
      localId: "img-1", name: "photo.png", previewUrl: null,
      status: "ready" as const, docId: "a".repeat(24),
    };
    const { onSubmit } = mount({ onAddImages: vi.fn(), onRemoveImage: vi.fn(), images: [image] });
    expect(bouton(/envoyer/i).disabled).toBe(false);
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("", []);
  });

  // Envoyer pendant un téléversement perdrait l'image : son identifiant n'existe pas encore.
  it("retient l'envoi tant qu'une image téléverse", () => {
    const image = {
      localId: "img-2", name: "photo.png", previewUrl: null,
      status: "uploading" as const, docId: null,
    };
    mount({ onAddImages: vi.fn(), onRemoveImage: vi.fn(), images: [image], imagesBusy: true });
    expect(bouton(/envoyer/i).disabled).toBe(true);
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
  const envoyer = () => bouton(/envoyer/i);
  // Les régions d'état qui PARLENT : celle de la liste de mentions existe toujours, vide.
  const annonces = (role: "alert" | "status") =>
    screen.queryAllByRole(role).map(e => e.textContent ?? "").filter(texte => texte.trim() !== "");

  // Le bouton n'était pas la seule voie : Entrée appelait l'envoi sans regarder le téléversement.
  it("Entrée n'envoie pas tant qu'une image téléverse, et le texte reste dans le champ", () => {
    const { onSubmit, field } = mount({ ...hote, images: [image("uploading")], imagesBusy: true });
    type(field, "avec ma photo");
    touche(field, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.editor.getText()).toBe("avec ma photo");
  });

  // La retenue se lit dans le STATUT des images : un hôte qui oublierait `imagesBusy` laissait
  // encore Entrée envoyer sans l'image.
  it("retient l'envoi sur le seul statut « en route », sans `imagesBusy`", () => {
    const { onSubmit, field } = mount({ ...hote, images: [image("uploading")] });
    type(field, "avec ma photo");
    expect(envoyer().disabled).toBe(true);
    touche(field, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // Entrée retenue sans un mot paraîtrait morte — une image lourde sur une liaison lente, ce sont
  // de longues secondes. La phrase ne vient qu'APRÈS une tentative, et s'en va avec le téléversement.
  it("dit pourquoi rien ne part quand on tente d'envoyer pendant un téléversement", () => {
    const { field, update } = mount({ ...hote, images: [image("uploading")], imagesBusy: true });
    type(field, "avec ma photo");
    expect(annonces("status").some(texte => /encore en cours d'envoi/.test(texte))).toBe(false);
    touche(field, "Enter");
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
    touche(field, "Enter");
    expect(annonces("status").some(texte => /^2 images sont encore en cours d'envoi/.test(texte))).toBe(true);
  });

  it("retient l'envoi tant qu'une image a échoué, au bouton comme à Entrée", () => {
    const { onSubmit, field } = mount({ ...hote, images: [image("error")] });
    type(field, "avec ma photo");
    expect(envoyer().disabled).toBe(true);
    touche(field, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.editor.getText()).toBe("avec ma photo");
  });

  // Une image prête ne rachète pas celle qui a échoué : l'auteur en a joint deux.
  it("retient l'envoi même si une autre image, elle, est prête", () => {
    const { onSubmit, field } = mount({ ...hote, images: [image("ready", 1), image("error", 2)] });
    expect(envoyer().disabled).toBe(true);
    touche(field, "Enter");
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
    fireEvent.click(bouton("Retirer photo-2.png"));
    expect(onRemoveImage).toHaveBeenCalledExactlyOnceWith("img-error-2");
  });

  // Les deux rappels vont ensemble. Si l'hôte n'offre pas le retrait, les aperçus ne sont pas
  // montrés : retenir l'envoi enfermerait l'auteur derrière une phrase qu'il ne peut pas suivre.
  it("ne retient pas l'envoi sur un échec que personne ne peut retirer", () => {
    const { onSubmit, field } = mount({ onAddImages: vi.fn(), images: [image("error")] });
    expect(screen.queryByRole("alert")).toBeNull();
    type(field, "tant pis pour la photo");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("tant pis pour la photo", []);
  });

  // Retirer l'image en échec est le geste demandé : il doit suffire, sans rien retaper.
  it("l'image en échec retirée, le message part avec son texte", () => {
    const { onSubmit, field, update } = mount({ ...hote, images: [image("error")] });
    type(field, "tant pis pour la photo");
    update({ ...hote, images: [] });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(envoyer().disabled).toBe(false);
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("tant pis pour la photo", []);
  });

  // « Sans texte mais avec image » ne vaut que pour une image qui PART : une image en échec ou
  // encore en route n'est pas un contenu, et l'envoi produirait un message vide.
  it("une image retirée de la course n'autorise pas un message sans texte", () => {
    const { onSubmit, field, update } = mount({ ...hote, images: [image("error")] });
    expect(envoyer().disabled).toBe(true);
    touche(field, "Enter");
    update({ ...hote, images: [image("uploading")], imagesBusy: true });
    expect(envoyer().disabled).toBe(true);
    touche(field, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

/**
 * Relecture du 13/10. Les marques tapées ne prenaient qu'en début de message ou derrière une
 * espace : ni en tête d'une seconde ligne (Maj+Entrée), ni derrière une apostrophe ou une
 * parenthèse — là où le fil, lui, les lit.
 */
describe("CommentComposer — marques tapées, partout où le fil les lirait", () => {
  it("en tête d'une ligne, après Maj+Entrée", () => {
    const { field, onSubmit } = mount();
    frapper(field, "bonjour");
    touche(field, "Enter", { shiftKey: true });
    frapper(field, "**gras** et *penché* et ~~barré~~");
    expect(field.querySelector("strong")?.textContent).toBe("gras");
    expect(field.querySelector("em")?.textContent).toBe("penché");
    expect(field.querySelector("s")?.textContent).toBe("barré");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("bonjour\n**gras** et *penché* et ~~barré~~", []);
  });

  it("derrière une apostrophe, une parenthèse, un guillemet", () => {
    const { field } = mount();
    frapper(field, "l'*été* et (**fort**) et «__très__»");
    expect([...field.querySelectorAll("em")].map(e => e.textContent)).toEqual(["été"]);
    expect([...field.querySelectorAll("strong")].map(e => e.textContent)).toEqual(["fort", "très"]);
  });

  it("le soulignement fait pareil : `_penché_` et `__gras__`", () => {
    const { field } = mount();
    frapper(field, "_penché_ puis __gras__");
    expect(field.querySelector("em")?.textContent).toBe("penché");
    expect(field.querySelector("strong")?.textContent).toBe("gras");
  });

  it("un gras en cours de frappe n'est pas un italique : `**gras*` attend sa seconde étoile", () => {
    const { field } = mount();
    frapper(field, "**gras*");
    expect(field.querySelector("em, strong")).toBeNull();
    frapper(field, "*");
    expect(field.querySelector("strong")?.textContent).toBe("gras");
    expect(field.querySelector("em")).toBeNull();
  });

  // Vu au navigateur le 13/10 : derrière une barre oblique, « _notes_ » prenait — et l'adresse partait
  // amputée de ses soulignés.
  it("dans une adresse en cours de frappe, rien ne prend : ses soulignés et ses étoiles lui appartiennent", () => {
    const { field, onSubmit } = mount();
    frapper(field, "voir https://exemple.org/~jean/_notes_/(*x*)/__y__ et www.exemple.org/_z_ merci");
    expect(field.querySelector("em, strong")).toBeNull();
    // À l'écran, pas un signe ne manque.
    expect(field.editor.getText()).toBe("voir https://exemple.org/~jean/_notes_/(*x*)/__y__ et www.exemple.org/_z_ merci");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledOnce();
    // L'adresse à protocole part signe pour signe.
    expect((onSubmit.mock.calls[0] as [string, unknown])[0].startsWith("voir https://exemple.org/~jean/_notes_/(*x*)/__y__ et ")).toBe(true);
  });

  it("ni derrière une ponctuation qui n'ouvre rien : une barre oblique, un point, un tiret", () => {
    const { field } = mount();
    frapper(field, "a/_b_ et c._d_ et e-*f* et g:**h**");
    expect(field.querySelector("em, strong")).toBeNull();
  });

  it("collée à une lettre, une étoile reste une étoile ; un souligné aussi", () => {
    const { field } = mount();
    frapper(field, "a*b*c et nom_de_variable_ et x**y**");
    expect(field.querySelector("em, strong")).toBeNull();
  });

  it("le code tapé prend lui aussi après un saut de ligne", () => {
    const { field } = mount();
    frapper(field, "voici");
    touche(field, "Enter", { shiftKey: true });
    frapper(field, "`npm i` ");
    expect(field.querySelector("code")?.textContent).toBe("npm i");
  });
});

/**
 * Relecture du 13/10. L'éditeur lie de lui-même une adresse tapée ou collée, puis laisse corriger
 * son texte sans toucher à sa cible : le message partait avec une adresse affichée et une autre
 * derrière. Le texte fait foi — sauf pour un lien ÉCRIT par le bouton.
 */
describe("CommentComposer — un lien dont le texte est une adresse", () => {
  const adresse = () => screen.getByLabelText("Adresse du lien") as HTMLInputElement;
  const lier = (field: Champ, texte: string, href: string) =>
    act(() => { field.editor.commands.insertContent({ type: "text", text: texte, marks: [{ type: "link", attrs: { href } }] }); });

  it("l'éditeur lie une adresse qu'on tape, dès l'espace qui la suit", () => {
    const { field } = mount();
    frapper(field, "voir https://exemple.org/page ");
    expect(field.querySelector("a")?.getAttribute("href")).toBe("https://exemple.org/page");
  });

  it("complétée après coup, elle mène où on la LIT", () => {
    const { field, onSubmit } = mount();
    type(field, "voir ");
    lier(field, "https://exemple.org/pag", "https://exemple.org/pag");
    frapper(field, "e");
    // Le lien de l'éditeur court toujours, sa cible n'a pas bougé : c'est le texte qui part.
    expect(field.querySelector("a")?.textContent).toBe("https://exemple.org/page");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("voir https://exemple.org/page", []);
  });

  // Ce que fait un vrai navigateur (mesuré le 13/10) : la lettre tapée en fin de lien reste DEHORS.
  it("… même quand la lettre ajoutée est restée hors du lien de l'éditeur", () => {
    const { field, onSubmit } = mount();
    type(field, "voir ");
    lier(field, "https://exemple.org/pag", "https://exemple.org/pag");
    act(() => { field.editor.commands.insertContent({ type: "text", text: "e" }); field.editor.commands.unsetMark("link"); });
    act(() => { field.editor.chain().setTextSelection({ from: field.editor.state.doc.content.size - 2, to: field.editor.state.doc.content.size - 1 }).unsetLink().run(); });
    expect(field.querySelector("a")?.textContent).toBe("https://exemple.org/pag");
    expect(field.editor.getText()).toBe("voir https://exemple.org/page");
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("voir https://exemple.org/page", []);
  });

  it("corrigée en son milieu aussi", () => {
    const { field, onSubmit } = mount({ initialValue: "voir https://exemple.org/ancienne-page merci" });
    select(field, "ancienne");
    frapper(field, "nouvelle");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("voir https://exemple.org/nouvelle-page merci", []);
  });

  it("une adresse collée par-dessus une adresse la REMPLACE — texte et cible", () => {
    const { field, onSubmit } = mount({ initialValue: "voir https://exemple.org/ancienne merci" });
    select(field, "https://exemple.org/ancienne");
    act(() => { fireEvent.paste(field, presseBrute({ texte: "https://exemple.org/nouvelle" })); });
    expect(field.editor.getText()).toBe("voir https://exemple.org/nouvelle merci");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("voir https://exemple.org/nouvelle merci", []);
  });

  it("collée par-dessus un MOT, elle en fait un lien : le mot reste, la cible est celle qu'on colle", () => {
    const { field, onSubmit } = mount({ initialValue: "voir ici" });
    select(field, "ici");
    act(() => { fireEvent.paste(field, presseBrute({ texte: "https://exemple.org/x" })); });
    expect(field.querySelector("a")?.textContent).toBe("ici");
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("voir [ici](https://exemple.org/x)", []);
  });

  it("le champ du bouton Lien reprend l'adresse qu'on lit, pas une cible périmée", () => {
    const { field } = mount();
    lier(field, "https://exemple.org/pag", "https://exemple.org/pag");
    frapper(field, "e");
    clic(bouton("Lien"));
    expect(adresse().value).toBe("https://exemple.org/page");
  });

  it("un lien ÉCRIT par le bouton garde sa cible, même sous un texte en forme d'adresse", () => {
    const { field, onSubmit } = mount();
    type(field, "exemple.org");
    select(field, "exemple.org");
    clic(bouton("Lien"));
    act(() => { fireEvent.change(adresse(), { target: { value: "https://exemple.org/fr/accueil" } }); });
    act(() => { fireEvent.click(bouton("Appliquer")); });
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("[exemple.org](https://exemple.org/fr/accueil)", []);
  });

  it("… et le champ du bouton reprend alors SA cible", () => {
    const { field } = mount({ initialValue: "[exemple.org](https://exemple.org/fr/accueil)" });
    act(() => { field.editor.commands.setTextSelection(3); });
    clic(bouton("Lien"));
    expect(adresse().value).toBe("https://exemple.org/fr/accueil");
  });
});

/** Un presse-papiers avec son texte ET son HTML — ce que dépose un tableur, ou une page web. */
function presseBrute(donnees: { texte?: string; html?: string }) {
  return {
    clipboardData: {
      files: [], items: [],
      getData: (type: string) => (type === "text/plain" ? donnees.texte ?? "" : type === "text/html" ? donnees.html ?? "" : ""),
    },
  };
}

describe("CommentComposer — collage", () => {
  it("des cellules de tableur gardent leurs séparations : c'est le texte du presse-papiers qui est collé", () => {
    const { field, onSubmit } = mount();
    const html = "<table><tr><td>Poste</td><td>Montant</td></tr><tr><td>Loyer</td><td>1200</td></tr></table>";
    act(() => { fireEvent.paste(field, presseBrute({ texte: "Poste\tMontant\nLoyer\t1200", html })); });
    expect(field.editor.getText()).not.toBe("PosteMontantLoyer1200");
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Poste\tMontant\nLoyer\t1200", []);
  });

  it("dans un bloc de code, un tableau collé reste du texte brut — comme tout ce qu'on y colle", () => {
    const { field } = mount();
    clic(bouton("Bloc de code"));
    const html = "<table><tr><td>Poste</td><td>Montant</td></tr><tr><td>Loyer</td><td>1200</td></tr></table>";
    act(() => { fireEvent.paste(field, presseBrute({ texte: "Poste\tMontant\nLoyer\t1200", html })); });
    expect(field.querySelectorAll("pre")).toHaveLength(1);
    expect(field.querySelector("pre")?.textContent).toBe("Poste\tMontant\nLoyer\t1200");
    // Aucun paragraphe n'en est sorti : le seul qui reste est celui, vide, que l'éditeur tient après un bloc.
    expect([...field.querySelectorAll("p")].map(paragraphe => paragraphe.textContent)).toEqual([""]);
  });

  it("sans tableau, le HTML collé reste du HTML : son gras est gardé", () => {
    const { field } = mount();
    act(() => { fireEvent.paste(field, presseBrute({ texte: "du gras", html: "<p>du <strong>gras</strong></p>" })); });
    expect(field.querySelector("strong")?.textContent).toBe("gras");
  });

  it("un lien collé ne garde que sa cible : ni la classe, ni le `target`, ni le `rel` du presse-papiers", () => {
    const { field, onSubmit } = mount();
    const html = '<p>voir <a href="https://exemple.org/doc" class="fixed inset-0 bg-black" target="_top" rel="opener" title="x">ici</a></p>';
    act(() => { fireEvent.paste(field, presseBrute({ texte: "voir ici", html })); });
    const lien = field.querySelector("a")!;
    expect(lien.getAttribute("href")).toBe("https://exemple.org/doc");
    expect(lien.className).not.toContain("fixed");
    expect(lien.getAttribute("target")).toBeNull();
    expect(lien.getAttribute("rel")).toBe("noopener noreferrer nofollow ugc");
    expect(lien.hasAttribute("title")).toBe(false);
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("voir [ici](https://exemple.org/doc)", []);
  });

  it("un lien collé dont le texte affiche une AUTRE adresse mène à celle qu'on lit", () => {
    const { field, onSubmit } = mount();
    act(() => { fireEvent.paste(field, presseBrute({ texte: "https://exemple.org", html: '<a href="https://tout-autre.example/piege">https://exemple.org</a>' })); });
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("https://exemple.org", []);
  });

  it("une mention copiée puis collée reste la même personne, son type compris", () => {
    const { field, onSubmit } = mount();
    const html = '<p>merci <span data-type="mention" data-id="65a1000000000000000000a3" data-label="Une orga" data-slug="une_orga" data-kind="organizations">@Une orga</span></p>';
    act(() => { fireEvent.paste(field, presseBrute({ texte: "merci @Une orga", html })); });
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("merci @une_orga", [{ id: "65a1000000000000000000a3", name: "Une orga", slug: "une_orga", type: "organizations" }]);
  });
});

describe("CommentComposer — l'aide du champ et sa barre d'outils", () => {
  const aideDe = (field: Champ) => document.getElementById(field.getAttribute("aria-describedby") ?? "")?.textContent ?? "";
  afterEach(() => { vi.unstubAllGlobals(); });

  it("à la souris : Entrée envoie — et l'aide dit où elle n'envoie pas", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const aide = aideDe(mount().field);
    expect(aide).toContain("Entrée envoie le message ; dans une liste ou un bloc de code, elle passe à la ligne.");
    expect(aide).toContain("Maj+Entrée passe à la ligne.");
  });

  it("au doigt : l'aide ne promet pas une Entrée qui envoie — le message part par son bouton", () => {
    vi.stubGlobal("matchMedia", (requete: string) => ({ matches: requete === "(pointer: coarse)" }));
    const aide = aideDe(mount().field);
    expect(aide).toContain("Entrée passe à la ligne ; le message part par son bouton.");
    expect(aide).not.toContain("Entrée envoie");
    // Les raccourcis de mise en forme, eux, valent partout.
    expect(aide).toContain("**gras**");
  });

  it("la barre d'outils est un groupe nommé", () => {
    const { container } = mount();
    const groupe = within(container).getByRole("group", { name: "Mise en forme et pièces jointes" });
    expect(within(groupe).getByRole("button", { name: "Gras" })).toBeTruthy();
    expect(within(groupe).getByRole("button", { name: "Insérer un émoji" })).toBeTruthy();
  });

  it("dans un bloc de code, rien ne se met en forme : les marques et le lien sont inertes, les blocs non", () => {
    const { field } = mount();
    type(field, "du texte");
    for (const nom of ["Gras", "Italique", "Barré", "Code", "Lien"]) expect(bouton(nom).disabled).toBe(false);
    clic(bouton("Bloc de code"));
    for (const nom of ["Gras", "Italique", "Barré", "Code", "Lien"]) expect(bouton(nom).disabled).toBe(true);
    for (const nom of ["Citation", "Liste à puces", "Liste numérotée", "Bloc de code"]) expect(bouton(nom).disabled).toBe(false);
    clic(bouton("Bloc de code"));
    for (const nom of ["Gras", "Lien"]) expect(bouton(nom).disabled).toBe(false);
  });
});

describe("CommentComposer — un bloc vide n'est pas un message", () => {
  it.each(["Liste à puces", "Liste numérotée", "Citation", "Bloc de code"])("« %s » sans rien dedans : le bouton d'envoi reste inactif, et rien ne part", nom => {
    const { field, onSubmit } = mount();
    clic(bouton(nom));
    expect(bouton(/envoyer/i).disabled).toBe(true);
    touche(field, "Enter");
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("dès qu'on y écrit, c'en est un", () => {
    const { field, onSubmit } = mount();
    clic(bouton("Citation"));
    type(field, "cité");
    expect(bouton(/envoyer/i).disabled).toBe(false);
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("> cité", []);
  });

  it("des espaces et des sauts de ligne non plus", () => {
    const { field, onSubmit } = mount();
    type(field, "   ");
    touche(field, "Enter", { shiftKey: true });
    expect(bouton(/envoyer/i).disabled).toBe(true);
    touche(field, "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

/**
 * Relecture du 13/10. L'éditeur peut être DÉTRUIT sous le composant : la bibliothèque le crée au
 * rendu et le défait une milliseconde plus tard si le montage tarde. Une commande passée à un
 * éditeur mort levait — et démontait tout l'arbre.
 */
describe("CommentComposer — un éditeur détruit", () => {
  it("la barre d'outils et l'envoi ne lèvent pas sur un éditeur mort, et rien ne part", () => {
    const { field, onSubmit } = mount({ initialValue: "un message" });
    // Une erreur levée dans un gestionnaire d'événement ne remonte pas à qui a cliqué : React la
    // SIGNALE à la fenêtre. C'est là qu'on l'attend.
    const signalees: unknown[] = [];
    const noter = (event: ErrorEvent) => { signalees.push(event.error ?? event.message); event.preventDefault(); };
    window.addEventListener("error", noter);
    act(() => { field.editor.destroy(); });
    // Sans nouveau rendu : la poignée de la coquille tient encore l'éditeur détruit.
    for (const nom of ["Gras", "Citation", "Bloc de code"]) clic(bouton(nom));
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    act(() => { fireEvent.keyDown(field, { key: "Escape" }); });
    window.removeEventListener("error", noter);
    expect(signalees).toEqual([]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("au rendu suivant, les effets passent sur l'éditeur mort sans lever — et le composer en retrouve un vivant", () => {
    const { field, onSubmit, update, container } = mount({ initialValue: "un message" });
    const mort = field.editor;
    act(() => { mort.destroy(); });
    // Ce rendu-ci tient encore l'éditeur détruit quand ses effets tournent : le focus de l'éditeur
    // (`autoFocus`), et celui que la coquille lui demande par sa poignée (« Répondre »). Demander
    // ses commandes à un éditeur mort lève — et une levée dans un effet démonte l'arbre.
    expect(() => update({ initialValue: "un message", autoFocus: true, replyingTo: { id: "x", author: "Camille" } })).not.toThrow();
    expect(() => update({ initialValue: "un message", autoFocus: true, disabled: true })).not.toThrow();
    update({ initialValue: "un message", autoFocus: true });
    // La bibliothèque en a refait un : on peut de nouveau écrire, et envoyer.
    const vivant = (within(container).getByRole("textbox") as Champ).editor;
    expect(vivant).not.toBe(mort);
    expect(vivant.isDestroyed).toBe(false);
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("un message", []);
  });
});

describe("CommentComposer — clavier, aux bords", () => {
  const CAMILLE_M = { id: "a".repeat(24), serverData: { name: "Camille Martin", slug: "camille-martin" } };
  const avecCamille = (props: Props = {}) => {
    const searchMembers = vi.fn().mockResolvedValue([CAMILLE_M]);
    return { ...mount({ entity: { id: "e".repeat(24), searchMembers } as unknown as EntityTypes, ...props }), searchMembers };
  };

  it("pendant une composition (accent mort, saisie asiatique), Échap appartient à la saisie : l'édition n'est pas annulée", () => {
    const onCancel = vi.fn();
    const { field } = mount({ mode: "edit", initialValue: "à corriger", onCancel });
    act(() => { fireEvent.keyDown(field, { key: "Escape", isComposing: true }); });
    expect(onCancel).not.toHaveBeenCalled();
    touche(field, "Escape");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  // Entre « @ » et l'arrivée des personnes, aucune liste n'est à l'écran — mais une mention est en
  // cours. Échap y renonce ; ne pas la revendiquer fermerait la modale, et le message avec elle.
  it("« @ » seul : Échap renonce à la mention, sans rien fermer d'autre — le suivant n'est plus à nous", async () => {
    const { field } = avecCamille();
    type(field, "@");
    await vi.waitFor(() => expect(field.closest("[data-comment-escape]")).toBeTruthy());
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(fireEvent.keyDown(field, { key: "Escape" })).toBe(false);
    await vi.waitFor(() => expect(field.closest("[data-comment-escape]")).toBeNull());
    expect(field.editor.getText()).toBe("@");
    expect(fireEvent.keyDown(field, { key: "Escape" })).toBe(true);
  });

  it("la surbrillance repart du haut quand la liste change", async () => {
    const CARLOS_D = { id: "b".repeat(24), serverData: { name: "Carlos Diaz", slug: "carlos" } };
    const searchMembers = vi.fn(async ({ search }: { search: string }) => (search === "ca" ? [CAMILLE_M, CARLOS_D] : [CARLOS_D, CAMILLE_M]));
    const { field } = mount({ entity: { id: "e".repeat(24), searchMembers } as unknown as EntityTypes });
    type(field, "@ca");
    await screen.findByRole("listbox");
    touche(field, "ArrowDown");
    expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true");
    type(field, "r");
    await vi.waitFor(() => expect(searchMembers).toHaveBeenCalledWith({ search: "car", searchMode: "personOnly" }));
    await vi.waitFor(() => expect(screen.getAllByRole("option")[0].textContent).toContain("Carlos"));
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
    expect(field.getAttribute("aria-activedescendant")).toBe(screen.getAllByRole("option")[0].id);
  });

  it("passer en bloc de code un paragraphe qui porte une mention : elle y reste, en texte — personne n'est effacé sans un mot", async () => {
    const { field, onSubmit } = avecCamille();
    type(field, "merci @ca");
    await screen.findByRole("listbox");
    touche(field, "Enter");
    type(field, "pour tout");
    expect(field.querySelector("[data-type='mention']")).toBeTruthy();
    clic(bouton("Bloc de code"));
    expect(field.querySelector("pre")?.textContent).toBe("merci @camille-martin pour tout");
    act(() => { fireEvent.click(bouton(/envoyer/i)); });
    // Dans du code, « @camille-martin » est du texte : il n'est plus renvoyé comme une mention.
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("```\nmerci @camille-martin pour tout\n```", []);
  });

  it("le champ ne fait pas parler le journal du fil : ce qu'on y tape n'est pas une annonce", () => {
    const { field } = mount();
    expect(field.closest("[data-comment-editor]")?.getAttribute("aria-live")).toBe("off");
  });
});

describe("CommentComposer — émoji", () => {
  it("l'émoji choisi s'insère au curseur, et le sélecteur se referme", async () => {
    const { field, onSubmit } = mount();
    type(field, "bravo  !");
    act(() => { field.editor.commands.setTextSelection(7); });
    act(() => { fireEvent.click(bouton("Insérer un émoji")); });
    const choisir = await screen.findByRole("button", { name: "choisir-un-émoji" });
    act(() => { fireEvent.click(choisir); });
    expect(field.editor.getText()).toBe("bravo 🎉 !");
    expect(screen.queryByRole("button", { name: "choisir-un-émoji" })).toBeNull();
    touche(field, "Enter");
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("bravo 🎉 !", []);
  });
});

/** La surface seule, pour compter ce qu'elle DIT à la coquille. */
describe("EditorSurface — ce qu'elle rapporte", () => {
  function Hote({ onStateChange }: { onStateChange: (etat: EditorSurfaceState) => void }) {
    const { surface: Surface } = useEditorSurface();
    const poignee = { current: null as EditorSurfaceHandle | null };
    if (!Surface) return null;
    return createElement(Surface, {
      initialValue: "", initialMentions: [], placeholder: "Écrire", label: "Écrire", disabled: false, autoFocus: false,
      entity: null, onSubmit: () => undefined, onStateChange, handleRef: poignee,
    });
  }

  it("une fois par CHANGEMENT d'état — pas une fois par frappe", () => {
    const onStateChange = vi.fn();
    const queryClient = new QueryClient();
    const cocolight = { me: null, api: null, entity: null, helper: {} } as unknown as CocolightContextType;
    const { container } = render(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(CocolightContext.Provider, { value: cocolight },
          createElement(LocalizationProvider, null, createElement(Hote, { onStateChange })))),
    );
    const field = within(container).getByRole("textbox") as Champ;
    const vides = () => onStateChange.mock.calls.map(([etat]) => (etat as EditorSurfaceState).empty);
    expect(vides()).toEqual([true]);
    type(field, "a");
    expect(vides()).toEqual([true, false]);
    type(field, "b");
    type(field, "c");
    expect(vides()).toEqual([true, false]);
    act(() => { field.editor.commands.toggleBold(); });
    expect(onStateChange).toHaveBeenCalledTimes(3);
    expect((onStateChange.mock.calls[2][0] as EditorSurfaceState).active.bold).toBe(true);
  });
});

