// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";

vi.mock("./useDiscussionUnread", () => ({
  useDiscussionUnread: () => ({ unread: 7, isLoading: false, isReady: true }),
}));

const { useDiscussionLauncher } = await import("./useDiscussionLauncher");

const ORG = "65a1000000000000000000a1";

function monter(url = "/") {
  return renderHook(() => useDiscussionLauncher(), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
  });
}

describe("useDiscussionLauncher", () => {
  it("ouvre AU PREMIER RENDU quand l'URL désigne déjà une discussion", () => {
    // Le point du lot : `open` est dérivé au rendu. Posé dans un effet, la modale se serait
    // ouverte au second rendu — un clignotement visible sur un lien partagé.
    const { result } = monter(`/?discussion=%40organizations%3A${ORG}`);
    expect(result.current.open).toBe(true);
  });

  it("reste fermé quand l'URL ne dit rien", () => {
    expect(monter().result.current.open).toBe(false);
  });

  it("s'ouvre sans sélection — le cas du bouton qui montre simplement le rail", () => {
    const { result } = monter();
    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);
  });

  it("efface le paramètre en se fermant, pour ne pas rouvrir au rechargement", () => {
    const { result } = monter(`/?discussion=%40organizations%3A${ORG}`);
    act(() => result.current.setOpen(false));
    expect(result.current.open).toBe(false);
  });

  it("ouvre SUR une sélection", () => {
    const { result } = monter();
    act(() => result.current.openAt({ kind: "holder", type: "organizations", id: ORG }));
    expect(result.current.open).toBe(true);
  });

  it("remonte les non-lus sans requête supplémentaire", () => {
    expect(monter().result.current.unread).toBe(7);
  });
});
