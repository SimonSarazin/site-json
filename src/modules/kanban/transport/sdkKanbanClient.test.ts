import Cocolight from "@communecter/cocolight-api-client";
import { describe, expect, test } from "vitest";
import { FakeSdk, ok, refusal, sdkError } from "@/modules/kanban/__fixtures__/fakeSdk";
import { isAccessLostFailure, kanbanErrorReason, KanbanAuthError, KanbanApiError } from "@/modules/kanban/lib/kanbanErrors";
import { createSdkKanbanClient, kanbanErrorFromSdk, unwrapKanbanEnvelope } from "./sdkKanbanClient";

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

describe("enveloppe", () => {
  test("`data` déplié et validé par la garde", () => {
    expect(unwrapKanbanEnvelope({ result: true, data: { boardId: "b1" } }, isBoardId, "KANBAN_BOARD_CREATE_URL")).toEqual({ boardId: "b1" });
  });

  test("`{result:false}` en HTTP 200 lève comme un refus", () => {
    expect(() => unwrapKanbanEnvelope({ result: false, msg: "notMember", detail: {} }, isAny, "KANBAN_BOARD_GET_URL")).toThrow(
      expect.objectContaining({ code: "notMember", kind: "denied" }),
    );
  });

  test("hors contrat : enveloppe absente, sans `data`, ou `data` refusée par la garde", () => {
    for (const payload of [null, "texte", { data: {} }, { result: true }, { result: true, data: { autre: 1 } }]) {
      expect(() => unwrapKanbanEnvelope(payload, isBoardId, "KANBAN_BOARD_GET_URL")).toThrow(expect.objectContaining({ code: "invalidResponse" }));
    }
  });
});

describe("transport sur le client principal", () => {
  test("appelle la constante avec le corps, sans transformation ni validation legacy", async () => {
    const sdk = new FakeSdk({ "board/get": () => ok({ boardId: "b1" }) });
    const client = createSdkKanbanClient(() => sdk);
    const body = { boardId: "b1", dueDate: null };

    await expect(client.post("KANBAN_BOARD_GET_URL", body, isBoardId)).resolves.toEqual({ boardId: "b1" });
    expect(sdk.calls).toEqual([{ route: "board/get", body: { boardId: "b1", dueDate: null }, transform: false, validate: false }]);
    expect(body).toEqual({ boardId: "b1", dueDate: null });
  });

  test("un refus remonte en erreur kanban, avec sa raison", async () => {
    const sdk = new FakeSdk({ "card/update": () => refusal(422, "validation", { field: "title", reason: "contributorsLimit" }) });
    const failure = createSdkKanbanClient(() => sdk).post("KANBAN_CARD_UPDATE_URL", { boardId: "b1", cardId: "c1" }, isAny);
    await expect(failure).rejects.toMatchObject({ code: "validation", status: 422, detail: { field: "title" } });
  });

  test("client du site absent : erreur de session, aucun appel", async () => {
    const sdk = new FakeSdk();
    await expect(createSdkKanbanClient(() => null).post("KANBAN_BOARD_GET_URL", {}, isAny)).rejects.toBeInstanceOf(KanbanAuthError);
    expect(sdk.calls).toHaveLength(0);
  });

  test("le client est relu à chaque appel : né après le transport, il sert quand même", async () => {
    let current: FakeSdk | null = null;
    const client = createSdkKanbanClient(() => current);
    await expect(client.post("KANBAN_BOARD_GET_URL", { boardId: "b1" }, isBoardId)).rejects.toBeInstanceOf(KanbanAuthError);
    current = new FakeSdk({ "board/get": () => ok({ boardId: "b1" }) });
    await expect(client.post("KANBAN_BOARD_GET_URL", { boardId: "b1" }, isBoardId)).resolves.toEqual({ boardId: "b1" });
  });

  test("annulation : avant l'appel, rien ne part ; à l'arrivée, la réponse est abandonnée", async () => {
    const sdk = new FakeSdk({ "board/get": () => ok({ boardId: "b1" }) });
    const client = createSdkKanbanClient(() => sdk);
    const before = new AbortController();
    before.abort(new Error("démonté"));
    await expect(client.post("KANBAN_BOARD_GET_URL", {}, isBoardId, { signal: before.signal })).rejects.toThrow("démonté");
    expect(sdk.calls).toHaveLength(0);

    const during = new AbortController();
    sdk.on("board/get", () => {
      during.abort(new Error("navigation"));
      return ok({ boardId: "b1" });
    });
    await expect(client.post("KANBAN_BOARD_GET_URL", {}, isBoardId, { signal: during.signal })).rejects.toThrow("navigation");
  });
});
