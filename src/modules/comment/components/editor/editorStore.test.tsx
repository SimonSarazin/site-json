// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";

/**
 * Le magasin qui charge l'éditeur. Chaque test repart d'un module NEUF (`vi.resetModules`) : son
 * état est celui de l'onglet, il ne se remet pas à zéro tout seul. Le fichier de l'éditeur est
 * remplacé par une doublure dont on tient l'arrivée — et la panne.
 */

const Faux = () => createElement("div", { "data-faux-editeur": "" });
let demandes = 0;
let enPanne = false;
let arrivee: Promise<void> = Promise.resolve();

beforeEach(() => {
  vi.resetModules();
  demandes = 0;
  enPanne = false;
  arrivee = Promise.resolve();
  vi.doMock("./EditorSurface", async () => {
    demandes += 1;
    await arrivee;
    if (enPanne) throw new Error("réseau");
    return { EditorSurface: Faux };
  });
});

async function magasin() {
  const { loadEditorSurface, useEditorSurface } = await import("./editorStore");
  const vus: Array<{ surface: boolean; failed: boolean }> = [];
  const Temoin = () => {
    const { surface: Surface, failed } = useEditorSurface();
    vus.push({ surface: Surface !== null, failed });
    return Surface ? createElement(Surface, {} as never) : createElement("p", null, failed ? "échec" : "attente");
  };
  return { loadEditorSurface, Temoin, vus };
}

describe("editorStore", () => {
  it("tant que rien n'est demandé, l'éditeur n'est pas là — et son fichier n'est pas chargé", async () => {
    const { Temoin } = await magasin();
    const { container } = render(createElement(Temoin));
    expect(container.textContent).toBe("attente");
    expect(demandes).toBe(0);
  });

  it("demandé, il arrive à ceux qui l'attendaient, sans qu'ils aient à se remonter", async () => {
    let lacher: () => void = () => undefined;
    arrivee = new Promise(resolve => { lacher = resolve; });
    const { loadEditorSurface, Temoin } = await magasin();
    const { container } = render(createElement(Temoin));

    let fini: Promise<void> = Promise.resolve();
    act(() => { fini = loadEditorSurface(); });
    expect(container.textContent).toBe("attente");
    await act(async () => { lacher(); await fini; });
    expect(container.querySelector("[data-faux-editeur]")).toBeTruthy();
  });

  it("deux demandes de suite n'en font qu'une — et une fois là, plus aucune", async () => {
    const { loadEditorSurface } = await magasin();
    const premiere = loadEditorSurface();
    const seconde = loadEditorSurface();
    expect(seconde).toBe(premiere);
    await premiere;
    await loadEditorSurface();
    expect(demandes).toBe(1);
  });

  it("un composer monté APRÈS le trouve tout de suite : pas d'écran d'attente de plus", async () => {
    const { loadEditorSurface, Temoin, vus } = await magasin();
    await loadEditorSurface();
    const { container } = render(createElement(Temoin));
    expect(container.querySelector("[data-faux-editeur]")).toBeTruthy();
    expect(vus.every(vu => vu.surface)).toBe(true);
  });

  // Le serveur et le premier rendu du client doivent écrire le MÊME balisage : au serveur l'éditeur
  // n'est jamais là, même si le module l'a déjà sous la main.
  it("au rendu serveur, il n'est jamais là", async () => {
    const { loadEditorSurface, Temoin } = await magasin();
    await loadEditorSurface();
    expect(renderToString(createElement(Temoin))).toContain("attente");
  });

  it("une panne se dit, et la demande suivante retente", async () => {
    enPanne = true;
    const { loadEditorSurface, Temoin } = await magasin();
    const { container } = render(createElement(Temoin));
    await act(async () => { await loadEditorSurface(); });
    expect(container.textContent).toBe("échec");

    enPanne = false;
    await act(async () => { await loadEditorSurface(); });
    expect(demandes).toBe(2);
    expect(container.querySelector("[data-faux-editeur]")).toBeTruthy();
  });

  it("retenter efface la panne le temps de la demande : on ne lit pas « échec » pendant qu'on recharge", async () => {
    enPanne = true;
    const { loadEditorSurface, Temoin } = await magasin();
    const { container } = render(createElement(Temoin));
    await act(async () => { await loadEditorSurface(); });

    let lacher: () => void = () => undefined;
    arrivee = new Promise(resolve => { lacher = resolve; });
    enPanne = false;
    let fini: Promise<void> = Promise.resolve();
    act(() => { fini = loadEditorSurface(); });
    expect(container.textContent).toBe("attente");
    await act(async () => { lacher(); await fini; });
    expect(container.querySelector("[data-faux-editeur]")).toBeTruthy();
  });
});
