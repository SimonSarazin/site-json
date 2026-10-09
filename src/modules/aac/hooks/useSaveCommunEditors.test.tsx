// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import Cocolight from "@communecter/cocolight-api-client";

/**
 * Ce que la mutation ÉCRIT réellement : `links.canEdit` puis la question déclarée, chacune
 * seulement si elle change, et calculées sur la réponse RELUE — pas sur l'instantané de la fiche.
 *
 * ⚠️ UNE VRAIE ENTITÉ `Answer` (relecture `api.answer` → `get()`, règles d'`updateField`) : seul
 * le transport est intercepté (`client.callEndpoint`). La lecture y passe par la VRAIE
 * normalisation du SDK (`_transformData`), qui rend les vignettes absolues — c'est elle qui avait
 * fait écrire des URL absolues en base (29/09), et qu'un objet nu à la place de l'entité masquait.
 */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useT", () => ({ useT: () => (key: string) => key }));

const { useSaveCommunEditors } = await import("./useSaveCommunEditors");

const A = "5dfa41886908648d3b8b46f6";
const B = "57618d6640bb4ece776308aa";
const C = "64785065919b8815ad72cf94";
const ANSWER_ID = "6a3e8d99d571dc339040e6bf";
const FIELD = "finderaapStep1m0w402djpsq3i44017";
const QUESTION = { stepKey: "aapStep1", label: "Référent du commun", fieldName: FIELD, path: `answers.aapStep1.${FIELD}` };

/** Les appels partis vers le serveur, dans l'ordre. */
let envois: Array<{ constant: string; data: Record<string, unknown> }> = [];

function makeApi(etatServeur: Record<string, unknown>) {
  const client = new Cocolight.ApiClient({ baseURL: "http://localhost" } as never);
  // `updateField` exige une session (`callIsConnected`) : le SDK n'en vérifie que le jeton.
  client.setToken("jeton-de-test");
  const normaliser = (client as unknown as { _transformData: (d: unknown) => unknown })._transformData.bind(client);
  client.callEndpoint = (async (constant: string, data: Record<string, unknown>) => {
    envois.push({ constant, data });
    if (constant === "COFORM_ANSWERS_BY_ID") {
      return {
        result: true,
        data: { data: normaliser({ id: ANSWER_ID, collection: "answers", form: "f".repeat(24), answers: {}, ...etatServeur }) },
      };
    }
    return { result: true, data: {} };
  }) as never;
  return new Cocolight.Api(null, client);
}

/** Les écritures `updatePathValue` émises : `[chemin, valeur]`. */
const ecritures = () =>
  envois.filter((e) => e.constant === "UPDATE_PATH_VALUE").map((e) => [e.data.path, e.data.value]);

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

async function enregistrer(
  etatServeur: Record<string, unknown>,
  editors: Record<string, unknown>,
  question: typeof QUESTION | null = QUESTION,
  formId: string | null = null
) {
  const api = makeApi(etatServeur);
  const { result } = renderHook(
    () => useSaveCommunEditors({ api, answerId: ANSWER_ID, question, formId }),
    { wrapper }
  );
  result.current.mutate({ editors: editors as never });
  await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
  expect(result.current.error).toBeNull();
  // La réponse est relue avant d'écrire.
  expect(envois[0]?.constant).toBe("COFORM_ANSWERS_BY_ID");
}

const moi = (id: string, name: string) => ({ id, name, type: "citoyens" });

beforeEach(() => {
  envois = [];
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});

describe("useSaveCommunEditors", () => {
  it("écrit la liste complète dans `links.canEdit` ET dans la question, entrées existantes conservées", async () => {
    await enregistrer(
      {
        links: { canEdit: { [A]: { name: "A", type: "citoyens", profilThumbImageUrl: "/a.png" } } },
        answers: { aapStep1: { [FIELD]: { [A]: moi(A, "A") } } },
      },
      { [A]: moi(A, "A"), [C]: moi(C, "C") }
    );
    expect(ecritures()).toEqual([
      [
        "links.canEdit",
        {
          // Vignette relue ABSOLUE (`http://localhost/a.png`) : elle repart telle qu'en base.
          [A]: { name: "A", type: "citoyens", profilThumbImageUrl: "/a.png" },
          [C]: { name: "C", type: "citoyens" },
        },
      ],
      [QUESTION.path, { [A]: moi(A, "A"), [C]: moi(C, "C") }],
    ]);
  });

  it("n'écrit que le côté qui change", async () => {
    await enregistrer(
      {
        links: { canEdit: { [A]: { name: "A", type: "citoyens" }, [B]: { name: "B", type: "citoyens" } } },
        answers: { aapStep1: { [FIELD]: { [A]: moi(A, "A") } } },
      },
      { [A]: moi(A, "A"), [B]: moi(B, "B") }
    );
    expect(ecritures().map(([chemin]) => chemin)).toEqual([QUESTION.path]);
  });

  it("une liste vidée s'écrit `null` des deux côtés — un `$unset`", async () => {
    await enregistrer(
      { links: { canEdit: { [A]: { name: "A", type: "citoyens" } } }, answers: { aapStep1: { [FIELD]: { [A]: moi(A, "A") } } } },
      {}
    );
    expect(ecritures()).toEqual([
      ["links.canEdit", null],
      [QUESTION.path, null],
    ]);
  });

  it("sans question déclarée, seul `links.canEdit` est écrit", async () => {
    await enregistrer({ links: {}, answers: {} }, { [A]: moi(A, "A") }, null);
    expect(ecritures()).toEqual([["links.canEdit", { [A]: { name: "A", type: "citoyens" } }]]);
  });

  /** La même réponse lue par le coform (page de réponse, aperçu) : sa clé exige le formulaire. */
  it("invalide la réponse de la fiche ET celle du coform", async () => {
    const FORM = "f".repeat(24); // appel courant = formulaire de dépôt (cas nominal)
    const invalider = vi.spyOn(queryClient, "invalidateQueries");
    await enregistrer({ links: {}, answers: {} }, { [A]: moi(A, "A") }, null, FORM);
    await waitFor(() => expect(invalider).toHaveBeenCalledTimes(2));
    const cles = invalider.mock.calls.map(([filtre]) => JSON.stringify((filtre as { queryKey: unknown }).queryKey));
    expect(cles).toContain(JSON.stringify(["coform", "answer", FORM, ANSWER_ID]));
  });

  /** Commun déposé sur un AUTRE appel : ses lectures coform se rangent sous le formulaire de dépôt. */
  it("invalide aussi la réponse sous son formulaire de DÉPÔT quand il diffère de l'appel", async () => {
    const APPEL = "a".repeat(24);
    const DEPOT = "d".repeat(24);
    const invalider = vi.spyOn(queryClient, "invalidateQueries");
    await enregistrer({ form: DEPOT, links: {}, answers: {} }, { [A]: moi(A, "A") }, null, APPEL);
    await waitFor(() => expect(invalider).toHaveBeenCalledTimes(3));
    const cles = invalider.mock.calls.map(([filtre]) => JSON.stringify((filtre as { queryKey: unknown }).queryKey));
    expect(cles).toContain(JSON.stringify(["coform", "answer", APPEL, ANSWER_ID]));
    expect(cles).toContain(JSON.stringify(["coform", "answer", DEPOT, ANSWER_ID]));
  });
});
