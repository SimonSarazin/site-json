import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ————————————————————————————————————————————————————————————
// Mocks
// ————————————————————————————————————————————————————————————

// Track every ApiClient instance created to verify isolation
let apiClientInstances: object[] = [];

// Track storageType passed to createDefaultMultiServerTokenStorageStrategy
let lastStorageType: string | undefined;

vi.mock("@communecter/cocolight-api-client", () => {
  const mockTokenStorage = { type: "mock-storage" };

  const createDefaultMultiServerTokenStorageStrategy = vi.fn(
    async function (storageType: string) {
      lastStorageType = storageType;
      return { ...mockTokenStorage, storageType };
    },
  );

  // Must use `function` (not arrow) so `new` works
  function MockApiClient(this: Record<string, unknown>, config: Record<string, unknown>) {
    this._mockId = Math.random().toString(36).slice(2);
    this.config = config;
    this.isConnected = false;
    apiClientInstances.push(this);
  }

  const mockEntitySlug = vi.fn().mockResolvedValue(null);

  function MockApi(this: Record<string, unknown>) {
    this.entitySlug = mockEntitySlug;
  }

  // Static method: Cocolight.Api.userApi(client)
  (MockApi as unknown as Record<string, unknown>).userApi = function (client: { isConnected: boolean }) {
    return { client, meIsconnected: vi.fn() };
  };

  return {
    default: {
      tokenStorageStrategy: {
        createDefaultMultiServerTokenStorageStrategy,
      },
      ApiClient: MockApiClient,
      Api: MockApi,
      helper: {
        fromEntityJSON: vi.fn().mockReturnValue({ id: "mock-entity" }),
      },
    },
    // Named exports the module also uses
    ApiClient: MockApiClient,
    Api: MockApi,
  };
});

vi.mock("@/lib/constant/common", () => ({
  getBaseUrl: vi.fn(() => "http://mock-api.test"),
  getSlug: vi.fn(() => "test-slug"),
}));

// ————————————————————————————————————————————————————————————
// Helpers — toggle server / client environment
// ————————————————————————————————————————————————————————————

const originalWindow = globalThis.window;

function simulateServer() {
  // @ts-expect-error — intentionally deleting window to simulate server
  delete globalThis.window;
}

function simulateClient() {
  // Provide a minimal window-like object
  // @ts-expect-error — intentionally setting a partial window
  globalThis.window = { __ENV__: {} };
}

function restoreEnv() {
  if (originalWindow !== undefined) {
    globalThis.window = originalWindow;
  } else {
    // @ts-expect-error — restore original state
    delete globalThis.window;
  }
}

// ————————————————————————————————————————————————————————————
// Test suites
// ————————————————————————————————————————————————————————————

describe("apiClient", () => {
  beforeEach(() => {
    // Reset module registry so each test gets fresh module-level state
    vi.resetModules();
    apiClientInstances = [];
    lastStorageType = undefined;
  });

  afterEach(() => {
    restoreEnv();
  });

  // ──────────────────────────────────────
  // A. Serveur — Isolation
  // ──────────────────────────────────────
  describe("Server — isolation (typeof window === 'undefined')", () => {
    it("initApiClient() returns a valid result", async () => {
      simulateServer();
      const { initApiClient } = await import("@/lib/apiClient");

      const result = await initApiClient();

      expect(result).toBeDefined();
      expect(result.client).toBeDefined();
      expect(result.api).toBeDefined();
      expect(result.userApiInstance).toBeDefined();
    });

    it("two successive calls return different instances (no cache)", async () => {
      simulateServer();
      const { initApiClient } = await import("@/lib/apiClient");

      const r1 = await initApiClient();
      const r2 = await initApiClient();

      expect(r1.client).not.toBe(r2.client);
      expect(r1.api).not.toBe(r2.api);
    });

    it("10 parallel calls return 10 distinct instances (concurrency)", async () => {
      simulateServer();
      const { initApiClient } = await import("@/lib/apiClient");

      const results = await Promise.all(
        Array.from({ length: 10 }, () => initApiClient()),
      );

      const clients = results.map((r) => r.client);
      const uniqueClients = new Set(clients);
      expect(uniqueClients.size).toBe(10);
    });

    it("a failing call (slug resolution error) does not affect the next one", async () => {
      simulateServer();
      const Cocolight = (await import("@communecter/cocolight-api-client")).default;
      const { initApiClient } = await import("@/lib/apiClient");

      // Make entitySlug reject on the Api mock for the first call
      // entitySlug is set in the MockApi constructor; we override the
      // prototype-level behavior by spying on the Api constructor result.
      const origApi = Cocolight.Api;
      let callCount = 0;
      // @ts-expect-error — replacing constructor temporarily
      Cocolight.Api = function (this: Record<string, unknown>, ...args: unknown[]) {
        (origApi as unknown as (...a: unknown[]) => void).apply(this, args);
        callCount++;
        if (callCount === 1) {
          // First Api instance: entitySlug rejects
          this.entitySlug = vi.fn().mockRejectedValue(new Error("slug resolution failed"));
        }
      };
      // Preserve static method
      (Cocolight.Api as unknown as Record<string, unknown>).userApi = (origApi as unknown as Record<string, unknown>).userApi;

      // First call — slug resolution fails but the function still returns
      const r1 = await initApiClient();
      expect(r1).toBeDefined();
      expect(r1.client).toBeDefined();

      // Restore original Api
      Cocolight.Api = origApi;

      // Second call — should work normally with a fresh instance
      const r2 = await initApiClient();
      expect(r2).toBeDefined();
      expect(r2.client).not.toBe(r1.client);
    });

    it("uses storageType 'memory'", async () => {
      simulateServer();
      const { initApiClient } = await import("@/lib/apiClient");

      await initApiClient();

      expect(lastStorageType).toBe("memory");
    });
  });

  // ──────────────────────────────────────
  // B. Client — Singleton
  // ──────────────────────────────────────
  describe("Client — singleton (typeof window !== 'undefined')", () => {
    it("first call initializes and returns a result", async () => {
      simulateClient();
      const { initApiClient } = await import("@/lib/apiClient");

      const result = await initApiClient();

      expect(result).toBeDefined();
      expect(result.client).toBeDefined();
      expect(result.api).toBeDefined();
      expect(result.userApiInstance).toBeDefined();
    });

    it("second call returns the same instance (cache)", async () => {
      simulateClient();
      const { initApiClient } = await import("@/lib/apiClient");

      const r1 = await initApiClient();
      const r2 = await initApiClient();

      expect(r1.client).toBe(r2.client);
      expect(r1.api).toBe(r2.api);
      expect(r1.userApiInstance).toBe(r2.userApiInstance);
    });

    it("resetApiState() then new call returns a fresh instance", async () => {
      simulateClient();
      const { initApiClient, resetApiState } = await import("@/lib/apiClient");

      const r1 = await initApiClient();
      resetApiState();
      const r2 = await initApiClient();

      expect(r2.client).not.toBe(r1.client);
    });

    it("getApiClient(), getUserApi(), getApi() return the singletons", async () => {
      simulateClient();
      const { initApiClient, getApiClient, getUserApi, getApi } =
        await import("@/lib/apiClient");

      const result = await initApiClient();

      const c = await getApiClient();
      const u = await getUserApi();
      const a = await getApi();

      expect(c).toBe(result.client);
      expect(u).toBe(result.userApiInstance);
      expect(a).toBe(result.api);
    });

    it("uses storageType 'localStorage'", async () => {
      simulateClient();
      const { initApiClient } = await import("@/lib/apiClient");

      await initApiClient();

      expect(lastStorageType).toBe("localStorage");
    });
  });
});
