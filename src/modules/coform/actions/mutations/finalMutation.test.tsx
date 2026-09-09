// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import Cocolight from "@communecter/cocolight-api-client";

/**
 * Le formulaire SOUS LEQUEL on enregistre doit être celui qu'on a rendu.
 *
 * `Form.answer({id})` ne pré-remplit pas `form` sur une réponse existante :
 * `Answer._resolveFormId` retombe alors sur `serverData.form`, le formulaire de
 * DÉPÔT. Invisible tant que les deux coïncident ; faux dès qu'un appel à
 * communs édite un commun déposé ailleurs.
 *
 * ⚠️ CES TESTS MONTENT UNE VRAIE ENTITÉ `Answer`, pas un objet nu.
 *
 * La première version de ce fichier remplaçait l'entité par
 * `{ data: {}, save, processUploads }`. Elle passait au vert alors que le code
 * de production **levait systématiquement** : `answer.data` est un Proxy qui
 * n'accepte que les champs du schéma `SAVE_COFORM_ANSWER` et rejette `form`.
 * Le mock avait effacé la seule pièce dont le comportement était en question.
 * D'où la règle : ce qui décide du succès ne se mocke pas.
 */

const FORM_DE_DEPOT = "c".repeat(24);
const FORM_DE_L_APPEL = "a".repeat(24);
const ANSWER_ID = "b".repeat(24);

let dernierPayload: Record<string, unknown> | null = null;

/**
 * Une `Answer` RÉELLE, avec son DraftProxy, dont seuls les I/O réseau sont
 * neutralisés — au niveau du transport (`client.callEndpoint`), pas de l'entité.
 *
 * ⚠️ Forme de réponse attendue : `EndpointApi.call` rend `response.data`, et
 * `Form.get()` lit ensuite `form.data.id` — d'où le double `data` imbriqué.
 */
async function makeAnswer() {
  const client = new Cocolight.ApiClient({ baseURL: "http://localhost" } as never);
  client.callEndpoint = (async (constant: string) => {
    if (constant === "COFORM_ANSWERS_BY_ID") {
      return {
        result: true,
        data: { data: { id: ANSWER_ID, collection: "answers", form: FORM_DE_DEPOT, answers: {} } },
      };
    }
    return {
      result: true,
      data: {
        data: { id: FORM_DE_L_APPEL, collection: "forms", name: "Appel courant", inputs: {}, params: {}, subForms: [] },
      },
    };
  }) as never;

  const api = new Cocolight.Api(null, client);
  const form = await api.form({ id: FORM_DE_L_APPEL });
  const answer = await form.answer({ id: ANSWER_ID });

  // On ne neutralise QUE les effets de bord. Le DraftProxy reste en place :
  // c'est justement lui qu'on veut exercer.
  answer.processUploads = (async (d: unknown) => d) as never;
  answer.deleteFiles = (async () => {}) as never;
  answer.save = (async () => {
    dernierPayload = { ...answer.draftData };
    return answer.serverData;
  }) as never;
  return { api, answer };
}

let apiCourante: unknown = null;
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => ({ api: apiCourante }),
}));

const { useCoFormFinalMutation } = await import("./file");

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  dernierPayload = null;
});

describe("useCoFormFinalMutation — formulaire d'enregistrement", () => {
  it("n'est PAS refusé par le DraftProxy — la régression qui cassait tout submit", async () => {
    const { api, answer } = await makeAnswer();
    apiCourante = api;
    vi.spyOn(api, "form").mockResolvedValue({ answer: async () => answer } as never);

    const { result } = renderHook(
      () => useCoFormFinalMutation({ formId: FORM_DE_L_APPEL, answerId: ANSWER_ID }),
      { wrapper }
    );

    result.current.mutate({ allData: { aapStep1: { titre: "Un commun" } } });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    // Écrire sur `answer.data.form` levait `[DraftProxy] Le champ "form" n'est
    // pas autorisé.` AVANT `save()` : rien n'était enregistré, sur les trois
    // modules et les deux branches (création et édition).
    expect(result.current.error).toBeNull();
    expect(dernierPayload).not.toBeNull();
  });

  it("épingle le formulaire RENDU, pas celui de dépôt", async () => {
    const { api, answer } = await makeAnswer();
    apiCourante = api;
    vi.spyOn(api, "form").mockResolvedValue({ answer: async () => answer } as never);
    expect(answer.serverData.form).toBe(FORM_DE_DEPOT);

    const { result } = renderHook(
      () => useCoFormFinalMutation({ formId: FORM_DE_L_APPEL, answerId: ANSWER_ID }),
      { wrapper }
    );
    result.current.mutate({ allData: { aapStep1: { titre: "Un commun" } } });
    await waitFor(() => expect(dernierPayload).not.toBeNull());

    // C'est cette clé que `_resolveFormId` lit AVANT `serverData.form`, et donc
    // elle qui décide du `formId` envoyé à `saveanswer`.
    expect(dernierPayload?.form).toBe(FORM_DE_L_APPEL);
  });

  it("le champ `form` reste refusé sur `data` — on documente la contrainte du SDK", async () => {
    const { answer } = await makeAnswer();
    expect(() => {
      (answer.data as Record<string, unknown>).form = FORM_DE_L_APPEL;
    }).toThrow(/n'est pas autorisé/);
    // Alors que le draft brut l'accepte : c'est toute la raison du correctif.
    expect(() => {
      answer.draftData.form = FORM_DE_L_APPEL;
    }).not.toThrow();
  });
});
