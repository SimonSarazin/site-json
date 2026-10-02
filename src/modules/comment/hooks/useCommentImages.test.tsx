// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { useCommentImages } from "./useCommentImages";
import { MAX_IMAGES } from "../lib/commentImages";

/**
 * Le téléversement des images d'un message.
 *
 * Ce qui est réellement en question ici n'est pas le SDK — c'est le **contrat d'appel** que le
 * backend impose : un document devient un document de commentaire par son `folder`, et il est
 * téléversé AVANT que le message n'existe. Se tromper là-dessus produit un document rangé sous
 * l'entité porteuse, que `Comment::insert` ne déplacera jamais.
 */

const ME_ID = "a".repeat(24);

function fichier(name = "photo.png", type = "image/png", size = 1024): File {
  return { name, type, size } as unknown as File;
}

function setup(uploadDocument: ReturnType<typeof vi.fn> | null) {
  const me = uploadDocument ? { id: ME_ID, uploadDocument } : null;
  const cocolight = { me, api: null, entity: null, helper: {} } as unknown as CocolightContextType;
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(CocolightContext.Provider, { value: cocolight }, children);
  return renderHook(() => useCommentImages(), { wrapper });
}

beforeEach(() => {
  // jsdom n'implémente pas les URL d'objet : sans ces bouchons, on ne testerait que la garde.
  vi.stubGlobal("URL", Object.assign(Object.create(URL), {
    createObjectURL: vi.fn((f: File) => `blob:${f.name}`),
    revokeObjectURL: vi.fn(),
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe("useCommentImages", () => {
  it("téléverse dans le dossier `comments` — c'est lui qui fait un document de commentaire", async () => {
    const upload = vi.fn().mockResolvedValue({ docId: "d".repeat(24), docPath: "/u/p.png" });
    const { result } = setup(upload);

    act(() => result.current.add([fichier()]));

    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][1]).toMatchObject({
      folder: "comments",
      contentKey: "slider",
      docType: "image",
      // Point de chute provisoire : `Document::moveDoc` le réécrira avec l'identifiant du message.
      ownerId: ME_ID,
    });

    await waitFor(() => expect(result.current.docIds).toEqual(["d".repeat(24)]));
    expect(result.current.busy).toBe(false);
  });

  it("montre l'image pendant son envoi, avant tout identifiant", () => {
    const upload = vi.fn(() => new Promise<never>(() => {}));
    const { result } = setup(upload);

    act(() => result.current.add([fichier()]));

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].status).toBe("uploading");
    expect(result.current.items[0].previewUrl).toBe("blob:photo.png");
    // Rien à joindre tant que le serveur n'a pas répondu — et l'envoi doit attendre.
    expect(result.current.docIds).toEqual([]);
    expect(result.current.busy).toBe(true);
  });

  it("marque l'échec sans emporter le message", async () => {
    const upload = vi.fn().mockRejectedValue(new Error("413"));
    const { result } = setup(upload);

    act(() => result.current.add([fichier()]));

    await waitFor(() => expect(result.current.items[0].status).toBe("error"));
    // Une image en échec reste visible — pour qu'on puisse la retirer — mais ne part jamais.
    expect(result.current.docIds).toEqual([]);
    expect(result.current.busy).toBe(false);
  });

  it("retire une image et révoque son aperçu sur-le-champ", async () => {
    const upload = vi.fn().mockResolvedValue({ docId: "e".repeat(24), docPath: "" });
    const { result } = setup(upload);

    act(() => result.current.add([fichier()]));
    await waitFor(() => expect(result.current.docIds).toHaveLength(1));

    act(() => result.current.remove(result.current.items[0].localId));

    expect(result.current.items).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo.png");
  });

  /**
   * Contre-épreuve du piège : `reset` suit immédiatement l'envoi, et le message optimiste
   * affiche ces mêmes URL. Les révoquer ici ferait disparaître les images à l'instant précis
   * où le message apparaît.
   */
  it("vide la liste après l'envoi SANS révoquer les aperçus encore affichés", async () => {
    const upload = vi.fn().mockResolvedValue({ docId: "f".repeat(24), docPath: "" });
    const { result } = setup(upload);

    act(() => result.current.add([fichier()]));
    await waitFor(() => expect(result.current.docIds).toHaveLength(1));

    const previews = result.current.optimisticImages;
    expect(previews[0]).toMatchObject({ id: "f".repeat(24), url: "blob:photo.png" });

    act(() => result.current.reset());

    expect(result.current.items).toEqual([]);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("libère les aperçus au démontage", async () => {
    const upload = vi.fn().mockResolvedValue({ docId: "g".repeat(24), docPath: "" });
    const { result, unmount } = setup(upload);

    act(() => result.current.add([fichier()]));
    await waitFor(() => expect(result.current.docIds).toHaveLength(1));

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:photo.png");
  });

  it("s'arrête au plafond et le dit", () => {
    const upload = vi.fn(() => new Promise<never>(() => {}));
    const { result } = setup(upload);

    act(() => result.current.add(Array.from({ length: 7 }, (_, i) => fichier(`p${i}.png`))));

    expect(result.current.items).toHaveLength(MAX_IMAGES);
    expect(result.current.full).toBe(true);
    expect(result.current.rejected).toEqual(["count"]);
    // Le plafond n'est pas décoratif : au-delà de cinq, `convertParamsForComments` n'hydrate rien.
    expect(upload).toHaveBeenCalledTimes(MAX_IMAGES);
  });

  it("ne propose rien à un visiteur qui ne peut pas téléverser", () => {
    const { result } = setup(null);
    expect(result.current.supported).toBe(false);
    act(() => result.current.add([fichier()]));
    expect(result.current.items).toEqual([]);
  });
});
