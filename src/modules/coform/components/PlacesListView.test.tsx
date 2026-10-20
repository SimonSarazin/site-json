// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Cocolight, { type Api, type User } from "@communecter/cocolight-api-client";
import type { CoFormData } from "../types";

/**
 * « Rejoindre un autre lieu » : la demande (membre ou admin) part AU NOM de l'utilisateur connecté.
 *
 * Bug remonté le 30/09 : le lieu choisi était chargé par `api.organization({id})`, une entité SANS
 * contexte utilisateur (le SDK ne le transmet que d'un parent `User`) — `isMe` y vaut faux, et
 * `requestToJoin` / `requestToJoinAdmin` refusaient AVANT tout appel : « Vous devez être connecté
 * pour envoyer une demande de participation. », à un utilisateur connecté.
 *
 * ⚠️ De VRAIES entités SDK (`me`, le lieu, leurs gardes `isMe` / `callIsMe`) : seul le transport est
 * intercepté (`client.callEndpoint`). Un objet nu à la place de l'entité effacerait précisément la
 * garde en cause.
 */

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));

const cocolight = vi.hoisted(() => ({ me: null as unknown, api: null as unknown }));
vi.mock("@/hooks/useCocolight", () => ({
  useCocolight: () => cocolight,
}));

// Les lieux déjà liés : réseau, hors sujet — l'utilisateur n'en a aucun.
vi.mock("@/modules/profil/hooks/useMembershipQuery", () => ({
  useUserEligiblePlaces: () => ({
    organizations: [],
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    lastItemRef: () => {},
  }),
}));

const ME_ID = "63771a2a2129551c8f4fd9c3";
const LIEU_ID = "687f9ccf3d82cf6bf133d3f0";

// La recherche elle-même est hors sujet : elle rend directement le lieu choisi.
vi.mock("./FinderSearchModal", () => ({
  FinderSearchModal: ({ onValidate }: { onValidate: (elements: unknown[]) => void }) => (
    <button type="button" onClick={() => onValidate([{ id: LIEU_ID, name: "Suite126", type: "organizations" }])}>
      choisir le lieu
    </button>
  ),
}));

const { PlacesListView } = await import("./PlacesListView");

/** Formulaire « par lieu » minimal : un finder partagé, sans quoi la vue est « non applicable ». */
const FORM_DATA = {
  _id: { _str: "form-besoins" },
  id: "form-besoins",
  name: "Besoins",
  created: 0,
  creator: "creator1",
  type: "form",
  sharedQuestionPath: ["s1.finderlieu"],
  params: { finderlieu: { type: "organizations", multiple: false } },
  inputs: {
    s1: {
      id: "s1",
      name: "Lieu",
      formParent: "form-besoins",
      inputs: { lieu: { label: "Lieu", type: "tpls.forms.cplx.finder" } },
    },
  },
} as unknown as CoFormData;

/** Les appels partis vers le serveur, dans l'ordre. */
let envois: Array<{ constant: string; data: Record<string, unknown> }> = [];

/** Un jeton que le SDK sait lire : il en déduit `userId` (la signature n'est pas vérifiée côté client). */
function jeton(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.signature`;
}

/** Le SDK sur un transport intercepté ; connecté = un jeton porte l'id de l'utilisateur. */
function sdk(connecte: boolean): Api {
  const client = new Cocolight.ApiClient({ baseURL: "http://localhost" } as never);
  if (connecte) client.setToken(jeton({ id: ME_ID }));
  // Remplacer `callEndpoint` court-circuite aussi la normalisation de lecture du SDK : on la rejoue.
  const normaliser = (client as unknown as { _transformData: (d: unknown) => unknown })._transformData.bind(client);
  client.callEndpoint = (async (constant: string, data: Record<string, unknown>) => {
    envois.push({ constant, data });
    if (constant === "GET_ELEMENTS_ABOUT") {
      const { type } = (data.pathParams ?? {}) as { type?: string };
      return {
        result: true,
        data: normaliser(
          type === "citoyens"
            ? { id: ME_ID, collection: "citoyens", name: "Moi", slug: "moi", links: {} }
            : { id: LIEU_ID, collection: "organizations", name: "Suite126", slug: "suite126", links: {} }
        ),
      };
    }
    return { result: true, msg: "ok" };
  }) as never;
  return new Cocolight.Api(null, client);
}

/** Ce que `useCocolight` rend à un utilisateur connecté : `api` et l'entité `me`. */
async function sdkConnecte(): Promise<{ api: Api; me: User }> {
  const api = sdk(true);
  return { api, me: await api.user({ id: ME_ID }) };
}

/** Les demandes de lien émises. */
const demandes = () => envois.filter((e) => e.constant === "CONNECT").map((e) => e.data);

/** La mutation a abouti, dans un sens ou dans l'autre : une demande est partie, ou un refus s'affiche. */
const issue = () =>
  waitFor(() => expect(demandes().length + toastMock.error.mock.calls.length).toBeGreaterThan(0));

async function ouvrirLaDemande() {
  const user = userEvent.setup();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PlacesListView formData={FORM_DATA} formId="form-besoins" hidePageChrome placeKind="cae" />
    </QueryClientProvider>
  );
  await user.click(screen.getByRole("button", { name: /coform\.placeView\.joinSection\.searchButton/ }));
  await user.click(screen.getByRole("button", { name: "choisir le lieu" }));
  await screen.findByRole("dialog");
  return user;
}

beforeEach(() => {
  envois = [];
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  toastMock.info.mockReset();
});

describe("PlacesListView — demander à rejoindre un lieu", () => {
  it("« Demander les droits admin » envoie la demande au nom de l'utilisateur connecté", async () => {
    Object.assign(cocolight, await sdkConnecte());
    const user = await ouvrirLaDemande();

    await user.click(screen.getByRole("button", { name: "coform.placeView.join.requestAdmin" }));

    await issue();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(demandes()).toEqual([
      expect.objectContaining({
        childId: ME_ID,
        childType: "citoyens",
        parentType: "organizations",
        parentId: LIEU_ID,
        connectType: "admin",
      }),
    ]);
    // UN toast de succès, celui de la modale (il dit la suite) — pas en plus le générique de la mutation.
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("coform.placeView.join.successToastAdmin"));
    expect(toastMock.success.mock.calls).toEqual([["coform.placeView.join.successToastAdmin"]]);
  });

  it("« Demander à devenir membre » aussi — même garde, même cause", async () => {
    Object.assign(cocolight, await sdkConnecte());
    const user = await ouvrirLaDemande();

    await user.click(screen.getByRole("button", { name: "coform.placeView.join.requestMember" }));

    await issue();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(demandes()).toEqual([
      expect.objectContaining({ childId: ME_ID, parentId: LIEU_ID, connectType: "member" }),
    ]);
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("coform.placeView.join.successToastMember"));
    expect(toastMock.success.mock.calls).toEqual([["coform.placeView.join.successToastMember"]]);
  });

  it("déconnecté, aucune demande ne part — et le refus dit alors vrai", async () => {
    Object.assign(cocolight, { api: sdk(false), me: null });
    const user = await ouvrirLaDemande();

    await user.click(screen.getByRole("button", { name: "coform.placeView.join.requestAdmin" }));

    await issue();
    expect(toastMock.error).toHaveBeenCalledWith("toast.relationship.orgAdminRequestError", {
      description: "Vous devez être connecté pour envoyer une demande de participation.",
    });
    expect(demandes()).toHaveLength(0);
  });
});
