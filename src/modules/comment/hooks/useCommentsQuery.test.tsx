// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { useCommentsQuery } from "./useCommentsQuery";
import type { CommentTarget } from "../types";

/**
 * La LECTURE d'un fil : ce que le hook demande à l'entité commentée, et ce qu'il garde de sa
 * réponse.
 *
 * L'entité est la frontière : c'est elle qui parle au serveur, et sa propre règle (un `path` →
 * GET_COMMENTS_BY_PATH) se juge contre le vrai backend, par la sonde du lot R. Ici, on juge le
 * HOOK : le `path` qu'il transmet, et le tri qu'il fait de ce qu'on lui rend.
 */

const ORG = "65a1000000000000000000a1";
const FORM = "65b2000000000000000000b3";
const ME = "a".repeat(24);

/** Un message tel que le SDK le rend : une instance dont les données vivent dans `serverData`. */
function message(id: string, path?: string) {
  return {
    id,
    serverData: {
      id, text: `message ${id}`, created: 1_700_000_000,
      author: { id: "b".repeat(24), name: "Camille", slug: "camille" },
      ...(path ? { path } : {}),
    },
  };
}

/** Ce que l'entité commentée rendra à `getComments`, et ce qu'on lui a demandé. */
const lecture = vi.hoisted(() => ({ rendus: [] as unknown[], getComments: vi.fn() }));

function monter(target: CommentTarget) {
  const entite = { id: target.id, serverData: { _id: target.id }, getComments: lecture.getComments };
  const api = { organization: vi.fn(async () => entite), form: vi.fn(async () => entite) };
  const cocolight = { api, me: { id: ME, isConnected: true }, helper: {}, entity: null } as unknown as CocolightContextType;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client },
      createElement(CocolightContext.Provider, { value: cocolight }, children));
  return renderHook(() => useCommentsQuery({ target }), { wrapper });
}

beforeEach(() => {
  lecture.getComments.mockReset();
  lecture.getComments.mockImplementation(async () => lecture.rendus);
});

describe("useCommentsQuery — le `path` du fil", () => {
  it("demande le fil d'une question PAR SON `path` — sans lui, tous les fils du formulaire arrivaient mêlés", async () => {
    lecture.rendus = [message("c".repeat(24), "aapStep1.q1")];
    const { result } = monter({ type: "forms", id: FORM, path: "aapStep1.q1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lecture.getComments).toHaveBeenCalledExactlyOnceWith({ path: "aapStep1.q1" });
    expect(result.current.nodes.map(n => n.id)).toEqual(["c".repeat(24)]);
  });

  it("un fil RACINE ne demande pas de `path`, et ne garde que les messages qui n'en ont pas", async () => {
    const racine1 = "c".repeat(24);
    const racine2 = "d".repeat(24);
    lecture.rendus = [message(racine1), message("e".repeat(24), "aapStep1.q1"), message(racine2)];
    const { result } = monter({ type: "organizations", id: ORG, path: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lecture.getComments).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(result.current.nodes.map(n => n.id).sort()).toEqual([racine1, racine2]);
  });
});
