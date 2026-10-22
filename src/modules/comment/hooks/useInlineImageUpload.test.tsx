// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { getBaseUrl } from "@/lib/constant/common";
import { useInlineImageUpload } from "./useInlineImageUpload";

/**
 * Importer une image pour l'écrire DANS le texte.
 *
 * Ce qui est en question est le CONTRAT D'APPEL : le document est rangé sous son auteur, avec la clé
 * du legacy pour ces images (`mdImage`), et il n'est PAS joint au message — joint, le serveur le
 * déplacerait dans le dossier du message et l'adresse écrite dans le texte casserait. Que le SDK
 * accepte ce dossier se vérifie au navigateur, sur le vrai SDK (sonde du lot).
 */

const ME_ID = "a".repeat(24);
const PNG = new File([new Uint8Array(4)], "chat.png", { type: "image/png" });

function monter(me: unknown) {
  const cocolight = { me, api: null, entity: null, helper: {} } as unknown as CocolightContextType;
  const wrapper = ({ children }: { children: ReactNode }) => createElement(CocolightContext.Provider, { value: cocolight }, children);
  return renderHook(() => useInlineImageUpload(), { wrapper }).result;
}

describe("useInlineImageUpload", () => {
  it("téléverse sous l'auteur, clé `mdImage`, dossier `comments` — et rend le chemin RELATIF à écrire", async () => {
    const uploadDocument = vi.fn().mockResolvedValue({ docId: "d".repeat(24), docPath: "/upload/communecter/comments/a/chat.png" });
    const upload = monter({ id: ME_ID, uploadDocument }).current;
    await expect(upload!(PNG)).resolves.toBe("/upload/communecter/comments/a/chat.png");
    expect(uploadDocument).toHaveBeenCalledWith(PNG, { contentKey: "mdImage", docType: "image", folder: "comments", ownerId: ME_ID });
  });

  it("l'adresse ABSOLUE que rend le SDK s'écrit par son chemin seul — comme le legacy", async () => {
    // Mesuré au navigateur le 14/10 : la normalisation du SDK rend `docPath` absolu.
    const absolue = new URL("/upload/communecter/comments/a/chat.png", getBaseUrl()).href;
    const upload = monter({ id: ME_ID, uploadDocument: vi.fn().mockResolvedValue({ docId: "d".repeat(24), docPath: absolue }) }).current;
    await expect(upload!(PNG)).resolves.toBe("/upload/communecter/comments/a/chat.png");
  });

  it("un serveur qui ne rend pas d'adresse est un échec, pas une image vide", async () => {
    const upload = monter({ id: ME_ID, uploadDocument: vi.fn().mockResolvedValue({ docId: "", docPath: "" }) }).current;
    await expect(upload!(PNG)).rejects.toThrow();
  });

  it("le refus du SDK remonte tel quel", async () => {
    const refus = new Error("refusé");
    const upload = monter({ id: ME_ID, uploadDocument: vi.fn().mockRejectedValue(refus) }).current;
    await expect(upload!(PNG)).rejects.toBe(refus);
  });

  it("rien à proposer sans compte, ou sans la méthode du SDK", () => {
    expect(monter(null).current).toBeUndefined();
    expect(monter({ id: ME_ID }).current).toBeUndefined();
    expect(monter({ uploadDocument: vi.fn() }).current).toBeUndefined();
  });
});
