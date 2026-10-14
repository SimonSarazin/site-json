// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Cocolight from "@communecter/cocolight-api-client";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { useCoFormAnswerQuery } from "./useCoFormQuery";

/**
 * Lire une réponse : présente, vide, absente, ou serveur en panne.
 *
 * Une réponse ABSENTE : `findanswered` rend alors des données sans identifiant (mesuré au serveur de
 * dev le 14/10), et c'est `Answer.get` qui en fait un `ApiError` 404. Elle ne reviendra pas — la
 * réessayer tenait la page plusieurs secondes sur « Chargement » avant « Réponse introuvable ». Toute
 * autre erreur garde ses trois nouvelles tentatives.
 *
 * ⚠️ La frontière est le TRANSPORT (`client.callEndpoint`), pas l'entité : `Form.get` et `Answer.get`
 * tournent pour de vrai. C'est `Answer.get` qui décide qu'une réponse est absente ; doubler l'entité
 * ferait décider le test à sa place (patron : `actions/mutations/finalMutation.test.tsx`).
 */

const FORM_ID = "f".repeat(24);
const ANSWER_ID = "a".repeat(24);
const FORMULAIRE = { result: true, data: { data: { id: FORM_ID, collection: "forms", name: "F", inputs: {}, params: {}, subForms: [] } } };

function monter(lecture: () => unknown) {
  const client = new Cocolight.ApiClient({ baseURL: "http://localhost" } as never);
  const lectures: string[] = [];
  client.callEndpoint = (async (constant: string) => {
    if (constant !== "COFORM_ANSWERS_BY_ID") return FORMULAIRE;
    lectures.push(constant);
    return lecture();
  }) as never;
  const cocolight = { api: new Cocolight.Api(null, client), loading: false, me: null } as unknown as CocolightContextType;
  // Aucun délai entre deux tentatives : la règle se juge au NOMBRE de lectures, pas à l'horloge.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <CocolightContext.Provider value={cocolight}>{children}</CocolightContext.Provider>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => useCoFormAnswerQuery({ formId: FORM_ID, answerId: ANSWER_ID }), { wrapper });
  return { lectures, result };
}

describe("useCoFormAnswerQuery", () => {
  it("une réponse absente (données sans identifiant) : un `ApiError` 404, lu UNE fois", async () => {
    const { lectures, result } = monter(() => ({ result: true, data: { data: {} } }));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toMatchObject({ name: "ApiError", status: 404 });
    expect(lectures).toHaveLength(1);
    expect(result.current.answer).toBeNull();
  });

  it("une panne du serveur est réessayée trois fois", async () => {
    const { lectures, result } = monter(() => {
      throw new Cocolight.error.ApiClientError("Erreur lors de l'appel de l'API", 500);
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(lectures).toHaveLength(4);
  });

  it("une réponse qui existe SANS contenu : la réponse est là, ses données nulles, aucune erreur", async () => {
    const { result } = monter(() => ({ result: true, data: { data: { id: ANSWER_ID, collection: "answers", form: FORM_ID } } }));
    await waitFor(() => expect(result.current.answer).not.toBeNull());
    expect(result.current.answerData).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("une réponse remplie : ses données", async () => {
    const reponses = { aapStep1: { titre: "Un titre" } };
    const { result } = monter(() => ({ result: true, data: { data: { id: ANSWER_ID, collection: "answers", form: FORM_ID, answers: reponses } } }));
    await waitFor(() => expect(result.current.answerData).not.toBeNull());
    expect(result.current.answerData).toEqual(reponses);
  });
});
