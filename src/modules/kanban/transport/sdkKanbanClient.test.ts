import Cocolight from "@communecter/cocolight-api-client";
import { describe, expect, test } from "vitest";
import { FakeBridge, FakeMainClient, ok, refusal, sdkError } from "@/modules/kanban/__fixtures__/fakeSdk";
import { isAccessLostFailure, kanbanErrorReason, KanbanAuthError, KanbanApiError } from "@/modules/kanban/lib/kanbanErrors";
import { KANBAN_ENDPOINTS } from "./kanbanEndpoints";
import { createSdkKanbanClient, kanbanErrorFromSdk, unwrapKanbanEnvelope } from "./sdkKanbanClient";

const isAny = (_value: unknown): _value is unknown => true;
const isBoardId = (value: unknown): value is { boardId: string } =>
  typeof value === "object" && value !== null && typeof (value as { boardId?: unknown }).boardId === "string";

describe("registre du pont", () => {
  test("20 routes, constantes uniques, nommées d'après leur chemin", () => {
    expect(KANBAN_ENDPOINTS).toHaveLength(20);
    expect(new Set(KANBAN_ENDPOINTS.map((entry) => entry.constant)).size).toBe(20);
    for (const entry of KANBAN_ENDPOINTS) {
      const match = /^\/costum\/kanban-([a-z]+)\/([a-z]+)$/.exec(entry.path);
      expect(match, entry.path).not.toBeNull();
      expect(entry.constant).toBe(`KANBAN_${match?.[1].toUpperCase()}_${match?.[2].toUpperCase()}_URL`);
      expect(entry).toMatchObject({ method: "POST", contentType: "application/json", auth: "bearer" });
    }
  });

  test("aucun schéma de requête : le SDK retirerait les `null` (effacer une échéance)", () => {
    for (const entry of KANBAN_ENDPOINTS) expect(entry).not.toHaveProperty("request");
  });
});

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

  test("401 : erreur de session, enveloppe ou pas (jeton absent, rafraîchissement raté)", () => {
    expect(kanbanErrorFromSdk(sdkError(401, { result: false, msg: "unauthorized", detail: { reason: "invalidToken" } }), "KANBAN_BOARD_GET_URL")).toBeInstanceOf(KanbanAuthError);
    expect(kanbanErrorFromSdk(sdkError(401, undefined, "Token requis pour l'endpoint sécurisé"), "KANBAN_BOARD_GET_URL")).toBeInstanceOf(KanbanAuthError);
    const refreshFailed = kanbanErrorFromSdk(sdkError(401, { code: 401, message: "expired" }, "Erreur lors du rafraîchissement du token."), "KANBAN_BOARD_GET_URL");
    expect(refreshFailed).toBeInstanceOf(KanbanAuthError);
    expect(isAccessLostFailure(refreshFailed)).toBe(false);
  });

  test("sans réponse : réseau ou délai, jamais « erreur serveur »", () => {
    expect(kanbanErrorFromSdk(sdkError(500, null, "Erreur lors de l'appel de l'API : Network Error"), "KANBAN_BOARD_SYNC_URL")).toMatchObject({ status: 0, code: "network", kind: "network" });
    expect(kanbanErrorFromSdk(sdkError(500, null, "Erreur lors de l'appel de l'API : timeout of 15000ms exceeded"), "KANBAN_BOARD_SYNC_URL")).toMatchObject({ code: "timeout", kind: "timeout" });
  });

  test("page HTML : le statut décide — panne serveur en 500, réponse hors contrat en 404", () => {
    expect(kanbanErrorFromSdk(sdkError(500, "<html>Erreur</html>"), "KANBAN_BOARD_GET_URL")).toMatchObject({ code: "invalidResponse", kind: "serverError" });
    expect(kanbanErrorFromSdk(sdkError(500, ""), "KANBAN_BOARD_GET_URL")).toMatchObject({ kind: "serverError" });
    expect(kanbanErrorFromSdk(sdkError(404, "<html>Not found</html>"), "KANBAN_BOARD_GET_URL")).toMatchObject({ code: "invalidResponse", kind: "invalidResponse" });
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

describe("pont vers le SDK", () => {
  test("appelle la constante avec le corps, sans transformation ni validation legacy, sous le jeton du site", async () => {
    const main = new FakeMainClient("jeton-site", "refresh-site");
    const bridge = new FakeBridge({ "board/get": () => ok({ boardId: "b1" }) });
    const client = createSdkKanbanClient(() => main, () => bridge);
    const body = { boardId: "b1", dueDate: null };

    await expect(client.post("KANBAN_BOARD_GET_URL", body, isBoardId)).resolves.toEqual({ boardId: "b1" });
    expect(bridge.calls).toEqual([{ route: "board/get", body: { boardId: "b1", dueDate: null }, token: "jeton-site", transform: false, validate: false }]);
    expect(bridge.getRefreshToken()).toBe("refresh-site");
    expect(body).toEqual({ boardId: "b1", dueDate: null });
  });

  test("jetons rafraîchis pendant l'appel : rendus au client du site", async () => {
    const main = new FakeMainClient("expire", "refresh-1");
    const bridge = new FakeBridge();
    bridge.on("board/sync", () => {
      bridge.setToken("neuf");
      bridge.setRefreshToken("refresh-2");
      return ok({ boardId: "b1" });
    });
    await createSdkKanbanClient(() => main, () => bridge).post("KANBAN_BOARD_SYNC_URL", { boardId: "b1" }, isBoardId);
    expect([main.getToken(), main.getRefreshToken()]).toEqual(["neuf", "refresh-2"]);
  });

  test("session du pont remise à zéro (rafraîchissement raté) : la session du site n'est PAS effacée", async () => {
    const main = new FakeMainClient("expire", "refresh-1");
    const bridge = new FakeBridge();
    bridge.on("board/get", () => {
      bridge.setToken(null);
      bridge.setRefreshToken(null);
      return refusal(401, "unauthorized", { reason: "invalidToken" });
    });
    await expect(createSdkKanbanClient(() => main, () => bridge).post("KANBAN_BOARD_GET_URL", { boardId: "b1" }, isAny)).rejects.toBeInstanceOf(KanbanAuthError);
    expect([main.getToken(), main.getRefreshToken()]).toEqual(["expire", "refresh-1"]);
  });

  test("un refus remonte en erreur kanban, avec sa raison", async () => {
    const bridge = new FakeBridge({ "card/update": () => refusal(422, "validation", { field: "title", reason: "contributorsLimit" }) });
    const failure = createSdkKanbanClient(() => new FakeMainClient(), () => bridge).post("KANBAN_CARD_UPDATE_URL", { boardId: "b1", cardId: "c1" }, isAny);
    await expect(failure).rejects.toMatchObject({ code: "validation", status: 422, detail: { field: "title" } });
  });

  test("client du site absent : erreur de session, aucun appel", async () => {
    const bridge = new FakeBridge();
    await expect(createSdkKanbanClient(() => null, () => bridge).post("KANBAN_BOARD_GET_URL", {}, isAny)).rejects.toBeInstanceOf(KanbanAuthError);
    expect(bridge.calls).toHaveLength(0);
  });

  test("annulation : avant l'appel, rien ne part ; à l'arrivée, la réponse est abandonnée", async () => {
    const bridge = new FakeBridge({ "board/get": () => ok({ boardId: "b1" }) });
    const client = createSdkKanbanClient(() => new FakeMainClient(), () => bridge);
    const before = new AbortController();
    before.abort(new Error("démonté"));
    await expect(client.post("KANBAN_BOARD_GET_URL", {}, isBoardId, { signal: before.signal })).rejects.toThrow("démonté");
    expect(bridge.calls).toHaveLength(0);

    const during = new AbortController();
    bridge.on("board/get", () => {
      during.abort(new Error("navigation"));
      return ok({ boardId: "b1" });
    });
    await expect(client.post("KANBAN_BOARD_GET_URL", {}, isBoardId, { signal: during.signal })).rejects.toThrow("navigation");
  });
});
