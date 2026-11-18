import type { GetMembersNoAdminData, GlobalAutocompleteCostumData } from "@communecter/cocolight-api-client";
import { z } from "zod";
import { toStringArray } from "@/helpers/toStringArray";
import { buildSearchPayload } from "./buildSearchPayload";

interface NetworkPage {
  results: { id?: string | null }[];
  hasNext: boolean;
  next?: () => Promise<NetworkPage>;
}

interface NetworkHost {
  id?: string | null;
  searchCostum: (params: Partial<GlobalAutocompleteCostumData>) => Promise<NetworkPage>;
  endpointApi: { getMembersNoAdmin: (params: GetMembersNoAdminData) => Promise<unknown> };
}

const memberSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullish(),
  slug: z.string().nullish(),
  shortDescription: z.string().nullish(),
  profilImageUrl: z.string().nullish(),
  profilMediumImageUrl: z.string().nullish(),
  skills: z.unknown().optional(),
});
const responseSchema = z.object({ results: z.array(memberSchema) });

export type NetworkMember = z.infer<typeof memberSchema>;
const PAGE_SIZE = 100;
const MAX_RESULTS = 5000;
const CONCURRENCY = 4;

export async function fetchNetworkMembers(entity: NetworkHost, sourceKey: string[]): Promise<NetworkMember[]> {
  if (!entity.id) throw new Error("Identifiant de l'entité du réseau manquant");
  const baseParams = {
    sourceKey,
    defaultFields: ["collection"],
    indexStepList: PAGE_SIZE,
  };
  const payload = buildSearchPayload(baseParams, { name: "", type: ["organizations"], mapUsed: false });
  let page = await entity.searchCostum(payload);
  const orgIds = new Set([entity.id]);
  let organizationsLoaded = 0;
  while (true) {
    organizationsLoaded += page.results.length;
    if (organizationsLoaded > MAX_RESULTS) {
      throw new Error("Limite de chargement des organisations atteinte");
    }
    for (const org of page.results) {
      if (!org.id) throw new Error("Identifiant d'organisation manquant");
      orgIds.add(org.id);
    }
    if (!page.hasNext) break;
    if (organizationsLoaded >= MAX_RESULTS || page.results.length === 0 || typeof page.next !== "function") {
      throw new Error("Impossible de charger toutes les organisations du réseau");
    }
    page = await page.next();
  }

  async function membersOf(id: string): Promise<NetworkMember[]> {
    const members: NetworkMember[] = [];
    for (let indexMin = 0; indexMin <= MAX_RESULTS; indexMin += PAGE_SIZE) {
      const params: GetMembersNoAdminData = {
        indexMin,
        indexStep: PAGE_SIZE,
        searchType: ["citoyens"],
        initType: "",
        count: true,
        countType: ["citoyens"],
        notSourceKey: true,
        locality: "",
        fediverse: false,
        fields: ["name", "slug", "shortDescription", "profilImageUrl", "profilMediumImageUrl", "skills"],
        filters: {
          [`links.memberOf.${id}`]: { $exists: true },
          [`links.memberOf.${id}.toBeValidated`]: { $exists: false },
          [`links.memberOf.${id}.isInviting`]: { $exists: false },
        },
      };
      const response = responseSchema.parse(await entity.endpointApi.getMembersNoAdmin(params));
      if (members.length + response.results.length > MAX_RESULTS) {
        throw new Error("Limite de chargement des membres atteinte");
      }
      members.push(...response.results);
      if (response.results.length < PAGE_SIZE) return members;
    }
    throw new Error("Limite de chargement des membres atteinte");
  }

  const ids = [...orgIds];
  const people = new Map<string, NetworkMember>();
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const groups = await Promise.all(ids.slice(i, i + CONCURRENCY).map(membersOf));
    for (const group of groups) {
      for (const member of group) {
        people.set(member.id, member);
        if (people.size > MAX_RESULTS) {
          throw new Error("Limite de chargement des personnes du réseau atteinte");
        }
      }
    }
  }
  return [...people.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "fr"));
}

export function memberSkills(member: NetworkMember): string[] {
  return [...new Set(toStringArray(member.skills).map((skill) => skill.trim()))];
}

export function networkSkills(members: NetworkMember[]): string[] {
  return [...new Set(members.flatMap(memberSkills))].sort((a, b) => a.localeCompare(b, "fr"));
}

export function filterNetworkMembers(members: NetworkMember[], skill: string, search: string): NetworkMember[] {
  const term = search.trim().toLocaleLowerCase();
  return members.filter((member) =>
    (!skill || memberSkills(member).includes(skill)) &&
    (!term || (member.name ?? "").toLocaleLowerCase().includes(term)));
}
