import { describe, expect, it, vi } from "vitest";
import type { GetMembersNoAdminData, GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";
import { fetchNetworkMembers, filterNetworkMembers, networkSkills } from "./networkMembers";

describe("network members directory", () => {
  it("loads every organization and member page, excludes pending links and deduplicates people", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: `m${index}`, name: `Member ${index}` }));
    const getMembersNoAdmin = vi.fn(async (params: GetMembersNoAdminData) => {
      if (params.filters["links.memberOf.host"]) {
        return { results: params.indexMin === 0 ? firstPage : [{ id: "shared", name: "Shared", skills: ["Code"] }] };
      }
      return { results: [{ id: "shared", name: "Shared", skills: ["Code"] }] };
    });
    const next = vi.fn(async () => ({ results: [{ id: "org2" }], hasNext: false }));
    const host = {
      id: "host",
      searchCostum: vi.fn(async (_params: Partial<GlobalAutocompleteCostumData>) => ({ results: [{ id: "org1" }], hasNext: true, next })),
      endpointApi: { getMembersNoAdmin },
    };

    const members = await fetchNetworkMembers(host, ["network"]);
    expect(members).toHaveLength(101);
    expect(next).toHaveBeenCalledOnce();
    expect(getMembersNoAdmin).toHaveBeenCalledTimes(4);
    for (const [params] of getMembersNoAdmin.mock.calls) {
      const link = Object.keys(params.filters).find((key) => key.endsWith(".toBeValidated"));
      expect(link).toBeDefined();
      expect(params.filters[link!]).toEqual({ $exists: false });
      expect(params.filters[link!.replace(".toBeValidated", ".isInviting")]).toEqual({ $exists: false });
      expect(params.fields).toContain("skills");
    }
    expect(host.searchCostum.mock.calls[0][0]).toMatchObject({ sourceKey: ["network"], searchType: ["organizations"] });
  });

  it("derives options and filters by the actual skills and name", () => {
    const members = [
      { id: "a", name: "Alice", skills: ["Design", "Code", "Code"] },
      { id: "b", name: "Bob", skills: ["Code"] },
      { id: "c", name: "Claire" },
    ];
    expect(networkSkills(members)).toEqual(["Code", "Design"]);
    expect(filterNetworkMembers(members, "Code", "")).toEqual(members.slice(0, 2));
    expect(filterNetworkMembers(members, "Code", "ALI")).toEqual([members[0]]);
    expect(filterNetworkMembers(members, "Design", "Bob")).toEqual([]);
    expect(filterNetworkMembers(members, "", "")).toEqual(members);
  });

  it("does not present a partial network when organization pagination is unavailable", async () => {
    const host = {
      id: "host",
      searchCostum: vi.fn(async () => ({ results: [{ id: "org1" }], hasNext: true })),
      endpointApi: { getMembersNoAdmin: vi.fn() },
    };
    await expect(fetchNetworkMembers(host, ["network"])).rejects.toThrow("toutes les organisations");
    expect(host.endpointApi.getMembersNoAdmin).not.toHaveBeenCalled();
  });

  it("surfaces invalid or failed member responses", async () => {
    const host = {
      id: "host",
      searchCostum: vi.fn(async () => ({ results: [], hasNext: false })),
      endpointApi: { getMembersNoAdmin: vi.fn(async () => ({ results: "invalid" })) },
    };
    await expect(fetchNetworkMembers(host, ["network"])).rejects.toThrow();
    host.endpointApi.getMembersNoAdmin.mockRejectedValueOnce(new Error("network failure"));
    await expect(fetchNetworkMembers(host, ["network"])).rejects.toThrow("network failure");
  });
});
