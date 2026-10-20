// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import Cocolight from "@communecter/cocolight-api-client";
import type { FinderElement } from "../../types";

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
 * `save()` tourne pour de vrai : `dernierPayload` est la requête
 * `SAVE_COFORM_ANSWER` réellement émise (sérialisation de `_buildSavePayload`
 * comprise), pas le brouillon.
 *
 * ⚠️ Forme de réponse attendue : `EndpointApi.call` rend `response.data`, et
 * `Form.get()` lit ensuite `form.data.id` — d'où le double `data` imbriqué.
 *
 * ⚠️ Remplacer `callEndpoint` court-circuite aussi la NORMALISATION de lecture
 * du SDK (`_transformData`, qui rend notamment les vignettes absolues). L'état
 * serveur y passe donc explicitement : c'est la forme que la mutation relit en
 * vrai, et celle qui a fait partir des vignettes absolues en base (29/09).
 */
async function makeAnswer(etatServeur: Record<string, unknown> = {}) {
  const client = new Cocolight.ApiClient({ baseURL: "http://localhost" } as never);
  // `save()` exige une session : le SDK n'en vérifie que le jeton.
  client.setToken("jeton-de-test");
  const normaliser = (client as unknown as { _transformData: (d: unknown) => unknown })._transformData.bind(client);
  client.callEndpoint = (async (constant: string, data: Record<string, unknown>) => {
    if (constant === "SAVE_COFORM_ANSWER") {
      dernierPayload = data;
      return { result: true, data: { result: true } };
    }
    if (constant === "COFORM_ANSWERS_BY_ID") {
      return {
        result: true,
        data: { data: normaliser({ id: ANSWER_ID, collection: "answers", form: FORM_DE_DEPOT, answers: {}, ...etatServeur }) },
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

  // On ne neutralise QUE les effets de bord (téléversements, suppressions de
  // fichiers). Le DraftProxy et `save()` restent en place : c'est justement
  // eux qu'on veut exercer.
  answer.processUploads = (async (d: unknown) => d) as never;
  answer.deleteFiles = (async () => {}) as never;
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

    // `draftData.form` est ce que `_resolveFormId` lit AVANT `serverData.form` :
    // c'est lui qui décide du `formId` envoyé à `saveanswer`.
    expect(dernierPayload?.formId).toBe(FORM_DE_L_APPEL);
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

/**
 * `addToLinks` : la question « Référent du commun » alimente `links.canEdit`, par DIFFÉRENCE avec
 * l'état serveur relu par la mutation. Même entité réelle que plus haut : c'est aussi la preuve
 * que le DraftProxy accepte l'écriture de `links`.
 */
describe("useCoFormFinalMutation — addToLinks", () => {
  const REF = "finderaapStep1m0w402djpsq3i44017";
  const A = "5dfa41886908648d3b8b46f6";
  const B = "57618d6640bb4ece776308aa";
  const C = "64785065919b8815ad72cf94";
  const personne = (id: string): FinderElement => ({ id, name: `nom-${id.slice(-4)}`, type: "citoyens" });

  async function soumettre(opts: { params: Record<string, unknown>; referents: Record<string, FinderElement> | null }) {
    const { api, answer } = await makeAnswer({
      answers: { aapStep1: { [REF]: { [A]: personne(A) } } },
      links: {
        answered: [A],
        canEdit: { [A]: { name: "A", type: "citoyens" }, [B]: { name: "B", type: "citoyens", profilThumbImageUrl: "/b.png" } },
      },
    });
    // La relecture SDK a bien rendu la vignette absolue : sans cela, le test ne prouverait rien.
    const relu = answer.serverData as unknown as { links: { canEdit: Record<string, { profilThumbImageUrl?: string }> } };
    expect(relu.links.canEdit[B].profilThumbImageUrl).toBe("http://localhost/b.png");
    apiCourante = api;
    vi.spyOn(api, "form").mockResolvedValue({ serverData: { params: opts.params }, answer: async () => answer } as never);

    const { result } = renderHook(
      () => useCoFormFinalMutation({ formId: FORM_DE_L_APPEL, answerId: ANSWER_ID }),
      { wrapper }
    );
    result.current.mutate({ allData: { aapStep1: { titre: "Un commun", [REF]: opts.referents } } });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.error).toBeNull();
    // Le fil : `links` part sérialisé en JSON — et seulement s'il porte quelque chose.
    const envoye = dernierPayload?.links;
    return typeof envoye === "string"
      ? (JSON.parse(envoye) as Record<string, Record<string, unknown>>)
      : undefined;
  }

  it("un référent remplacé : A sort, C entre, B (ajouté depuis la fiche) reste tel qu'en base", async () => {
    const links = await soumettre({
      params: { [REF]: { type: "citoyens", addToLinks: { value: true, links: "canEdit" } } },
      referents: { [C]: personne(C) },
    });
    // Seul le lien écrit part : `answered` relu n'écrase pas l'ajout que le backend y fait.
    expect(Object.keys(links ?? {})).toEqual(["canEdit"]);
    expect(Object.keys(links?.canEdit ?? {}).sort()).toEqual([B, C].sort());
    // Vignette RELATIVE, comme en base — pas l'URL absolue de la relecture.
    expect(links?.canEdit?.[B]).toEqual({ name: "B", type: "citoyens", profilThumbImageUrl: "/b.png" });
  });

  /**
   * Le brouillon d'une `Answer` relue reprend les `links` du serveur, NORMALISÉS par le SDK, et
   * `save()` les renverrait tous : vignettes absolues en base, et `links.answered` remplacé par sa
   * copie relue — le modifieur n'y entrait jamais (constaté le 29/09). Rien à écrire → rien ne part,
   * et `SaveAnswerAction` garde les liens en base tels quels.
   */
  it("sans `addToLinks` sur la question, aucun lien relu n'est renvoyé", async () => {
    const links = await soumettre({
      params: { [REF]: { type: "citoyens" } },
      referents: { [C]: personne(C) },
    });
    // Aucun champ `links` dans la requête : `SaveAnswerAction` garde ceux de la base.
    expect(links).toBeUndefined();
    expect(dernierPayload).not.toBeNull();
    expect(dernierPayload).not.toHaveProperty("links");
  });
});
