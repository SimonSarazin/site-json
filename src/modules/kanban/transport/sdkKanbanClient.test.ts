import Cocolight from "@communecter/cocolight-api-client";
import { describe, expect, test } from "vitest";
import { FakeSdk, ok, refusal, sdkError } from "@/modules/kanban/__fixtures__/fakeSdk";
import { isAccessLostFailure, kanbanErrorReason, KanbanAuthError, KanbanApiError } from "@/modules/kanban/lib/kanbanErrors";
import { createSdkKanbanClient, kanbanErrorFromSdk, parseKanbanData } from "./sdkKanbanClient";

const isAny = (_value: unknown): _value is unknown => true;
const isBoardId = (value: unknown): value is { boardId: string } =>
  typeof value === "object" && value !== null && typeof (value as { boardId?: unknown }).boardId === "string";

describe("traduction des erreurs du SDK", () => {
  test("refus du module : code, raison fine et statut conservés", () => {
    const error = kanbanErrorFromSdk(sdkError(403, { result: false, msg: "notMember", detail: { boardId: "b1" } }), "KANBAN_BOARD_GET_URL");
    expect(error).toBeInstanceOf(KanbanApiError);
    expect(error).toMatchObject({ status: 403, code: "notMember", kind: "denied", url: "/costum/kanban-board/get" });
    expect(isAccessLostFailure(error)).toBe(true);

    const conflict = kanbanErrorFromSdk(sdkError(409, { result: false, msg: "conflict", detail: { reason: "concurrentUpdate" } }), "KANBAN_CARD_UPDATE_URL");
    expect(kanbanErrorReason(conflict)).toBe("concurrentUpdate");
    expect(conflict).toMatchObject({ kind: "rejected" });
  });

  test("401 : erreur de session, enveloppe ou pas (jeton absent, jeton refusé)", () => {
    expect(kanbanErrorFromSdk(sdkError(401, { result: false, msg: "unauthorized", detail: { reason: "invalidToken" } }), "KANBAN_BOARD_GET_URL")).toBeInstanceOf(KanbanAuthError);
    expect(kanbanErrorFromSdk(sdkError(401, undefined, "Token requis pour l'endpoint sécurisé"), "KANBAN_BOARD_GET_URL")).toBeInstanceOf(KanbanAuthError);
  });

  test("`Api` du site non connectée : la façade lève AVANT l'appel, c'est une erreur de session", () => {
    const error = kanbanErrorFromSdk(new Cocolight.error.ApiAuthenticationError("Vous devez être connecté pour faire cette action.", 401), "KANBAN_BOARD_GET_URL");
    expect(error).toBeInstanceOf(KanbanAuthError);
    expect(error).toMatchObject({ status: 401, kind: "denied", url: "/costum/kanban-board/get" });
  });

  test("`{result:false}` servi en HTTP 200 : la façade lève `ApiResponseError`, traduite comme un refus", () => {
    const body = { result: false, msg: "notMember", detail: { boardId: "b1" } };
    const error = kanbanErrorFromSdk(new Cocolight.error.ApiResponseError("notMember", 200, body), "KANBAN_BOARD_GET_URL");
    expect(error).toBeInstanceOf(KanbanApiError);
    expect(error).not.toBeInstanceOf(KanbanAuthError);
    expect(error).toMatchObject({ status: 200, code: "notMember", kind: "denied", detail: { boardId: "b1" } });
  });

  test("réponse hors schéma `responses.200` du registre : réponse hors contrat", () => {
    const error = kanbanErrorFromSdk(new Cocolight.error.ApiValidationError("Response validation failed.", 200, ["data/board must be object"], { errors: [] }), "KANBAN_BOARD_GET_URL");
    expect(error).toMatchObject({ status: 200, code: "invalidResponse", kind: "invalidResponse" });
    expect((error as KanbanApiError).message).toContain("data/board must be object");
  });

  test("rafraîchissement du jeton raté : la forme RÉELLE du SDK (500, corps nul, message de l'intercepteur) est une erreur de session", () => {
    // L'intercepteur 401 lève `ApiClientError("Erreur lors du rafraîchissement du token.", 401)` DANS
    // `callEndpoint`, dont le `catch` la ré-emballe sans `response` : statut 500, corps `null`.
    const refreshFailed = kanbanErrorFromSdk(sdkError(500, null, "Erreur lors de l'appel de l'API : Erreur lors du rafraîchissement du token."), "KANBAN_BOARD_GET_URL");
    expect(refreshFailed).toBeInstanceOf(KanbanAuthError);
    expect(refreshFailed).toMatchObject({ status: 401, kind: "denied" });
  });

  test("sans réponse : réseau ou délai, jamais « erreur serveur »", () => {
    expect(kanbanErrorFromSdk(sdkError(500, null, "Erreur lors de l'appel de l'API : Network Error"), "KANBAN_BOARD_SYNC_URL")).toMatchObject({ status: 0, code: "network", kind: "network" });
    expect(kanbanErrorFromSdk(sdkError(500, null, "Erreur lors de l'appel de l'API : timeout of 30000ms exceeded"), "KANBAN_BOARD_SYNC_URL")).toMatchObject({ code: "timeout", kind: "timeout" });
  });

  test("page HTML : le statut décide — panne serveur en 500, réponse hors contrat en 404", () => {
    expect(kanbanErrorFromSdk(sdkError(500, "<html>Erreur</html>"), "KANBAN_BOARD_GET_URL")).toMatchObject({ code: "invalidResponse", kind: "serverError" });
    expect(kanbanErrorFromSdk(sdkError(500, ""), "KANBAN_BOARD_GET_URL")).toMatchObject({ kind: "serverError" });
    const unknownRoute = kanbanErrorFromSdk(sdkError(404, "<html>Not found</html>"), "KANBAN_BOARD_GET_URL");
    expect(unknownRoute).toMatchObject({ code: "invalidResponse", kind: "invalidResponse" });
    // Route absente du serveur (PHP kanban non déployé) : le polling doit s'arrêter, pas insister.
    expect(isAccessLostFailure(unknownRoute)).toBe(true);
  });

  test("constante inconnue du registre (SDK trop ancien) : le 404 sans corps du SDK est une route absente", () => {
    // `ApiClient.callEndpoint` lève `ApiClientError("Endpoint introuvable : …", 404)` SANS corps : c'est
    // ce que verrait un site dont le SDK installé n'a pas encore les routes kanban.
    const error = kanbanErrorFromSdk(new Cocolight.error.ApiClientError("Endpoint introuvable : KANBAN_BOARD_GET_URL", 404), "KANBAN_BOARD_GET_URL");
    expect(error).toMatchObject({ status: 0, code: "network", kind: "network" });
  });

  test("disjoncteur ouvert : panne serveur ; erreur locale ou déjà traduite : intacte", () => {
    expect(kanbanErrorFromSdk(new Cocolight.error.CircuitBreakerError("ouvert"), "KANBAN_BOARD_GET_URL")).toMatchObject({ status: 503, kind: "serverError" });
    const local = new TypeError("bug");
    expect(kanbanErrorFromSdk(local, "KANBAN_BOARD_GET_URL")).toBe(local);
    const translated = new KanbanApiError("x", { status: 409, code: "conflict" });
    expect(kanbanErrorFromSdk(translated, "KANBAN_BOARD_GET_URL")).toBe(translated);
  });
});

describe("garde sur `data`", () => {
  test("`data` validé par la garde, rendu tel quel", () => {
    expect(parseKanbanData({ boardId: "b1" }, isBoardId, "KANBAN_BOARD_CREATE_URL")).toEqual({ boardId: "b1" });
  });

  test("hors contrat : `data` absent (réponse qui n'était pas une enveloppe) ou refusé par la garde", () => {
    for (const data of [undefined, null, {}, { autre: 1 }, "texte"]) {
      expect(() => parseKanbanData(data, isBoardId, "KANBAN_BOARD_GET_URL")).toThrow(expect.objectContaining({ code: "invalidResponse", url: "/costum/kanban-board/get" }));
    }
  });
});

describe("transport sur la façade `api.kanban`", () => {
  test("appelle la méthode de la façade avec le corps tel quel, et rend `data` validé", async () => {
    const sdk = new FakeSdk({ "board/get": () => ok({ boardId: "b1" }) });
    const client = createSdkKanbanClient(() => sdk);
    const body = { boardId: "b1", dueDate: null };

    await expect(client.call("KANBAN_BOARD_GET_URL", (kanban) => kanban.board.get(body), isBoardId)).resolves.toEqual({ boardId: "b1" });
    expect(sdk.calls).toEqual([{ route: "board/get", body: { boardId: "b1", dueDate: null } }]);
    expect(body).toEqual({ boardId: "b1", dueDate: null });
  });

  test("un refus remonte en erreur kanban, avec sa raison et l'URL de la route", async () => {
    const sdk = new FakeSdk({ "card/update": () => refusal(422, "validation", { field: "title", reason: "contributorsLimit" }) });
    const failure = createSdkKanbanClient(() => sdk).call("KANBAN_CARD_UPDATE_URL", (kanban) => kanban.card.update({ boardId: "b1", cardId: "c1" }), isAny);
    await expect(failure).rejects.toMatchObject({ code: "validation", status: 422, detail: { field: "title" }, url: "/costum/kanban-card/update" });
  });

  test("`{result:false}` en HTTP 200 lève comme un refus", async () => {
    const sdk = new FakeSdk({ "board/get": () => refusal(200, "notMember", { boardId: "b1" }) });
    const failure = createSdkKanbanClient(() => sdk).call("KANBAN_BOARD_GET_URL", (kanban) => kanban.board.get({ boardId: "b1" }), isAny);
    await expect(failure).rejects.toMatchObject({ code: "notMember", kind: "denied", status: 200 });
  });

  test("réponse qui n'est pas une enveloppe (page HTML en 200) : réponse hors contrat", async () => {
    const sdk = new FakeSdk({ "board/get": () => ({ status: 200, body: "<html>Maintenance</html>" }) });
    const failure = createSdkKanbanClient(() => sdk).call("KANBAN_BOARD_GET_URL", (kanban) => kanban.board.get({ boardId: "b1" }), isAny);
    await expect(failure).rejects.toMatchObject({ code: "invalidResponse" });
  });

  test("`Api` du site absente : erreur de session, aucun appel", async () => {
    const sdk = new FakeSdk();
    await expect(createSdkKanbanClient(() => null).call("KANBAN_BOARD_GET_URL", (kanban) => kanban.board.get({ boardId: "b1" }), isAny)).rejects.toBeInstanceOf(KanbanAuthError);
    expect(sdk.calls).toHaveLength(0);
  });

  test("l'`Api` est relue à chaque appel : née après le transport, elle sert quand même", async () => {
    let current: FakeSdk | null = null;
    const client = createSdkKanbanClient(() => current);
    await expect(client.call("KANBAN_BOARD_GET_URL", (kanban) => kanban.board.get({ boardId: "b1" }), isBoardId)).rejects.toBeInstanceOf(KanbanAuthError);
    current = new FakeSdk({ "board/get": () => ok({ boardId: "b1" }) });
    await expect(client.call("KANBAN_BOARD_GET_URL", (kanban) => kanban.board.get({ boardId: "b1" }), isBoardId)).resolves.toEqual({ boardId: "b1" });
  });

  test("annulation : avant l'appel, rien ne part ; à l'arrivée, la réponse est abandonnée", async () => {
    const sdk = new FakeSdk({ "board/get": () => ok({ boardId: "b1" }) });
    const client = createSdkKanbanClient(() => sdk);
    const before = new AbortController();
    before.abort(new Error("démonté"));
    await expect(client.call("KANBAN_BOARD_GET_URL", (kanban) => kanban.board.get({ boardId: "b1" }), isBoardId, { signal: before.signal })).rejects.toThrow("démonté");
    expect(sdk.calls).toHaveLength(0);

    const during = new AbortController();
    sdk.on("board/get", () => {
      during.abort(new Error("navigation"));
      return ok({ boardId: "b1" });
    });
    await expect(client.call("KANBAN_BOARD_GET_URL", (kanban) => kanban.board.get({ boardId: "b1" }), isBoardId, { signal: during.signal })).rejects.toThrow("navigation");
  });
});
