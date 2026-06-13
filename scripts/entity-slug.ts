/**
 * Recherche / vérifie un slug d'ENTITÉ Cocolight — prérequis dur d'un site :
 * le slug de sites.json/VITE_SLUG charge AUSSI l'entité au boot
 * (src/lib/apiClient.ts) ; sans entité portant ce slug, le site ne démarre
 * pas. Outil de l'assistant config (doc/26-assistant-config.md).
 *
 * Usage :
 *   npx tsx scripts/entity-slug.ts search <nom>   # candidats via globalAutocomplete (sans auth)
 *   npx tsx scripts/entity-slug.ts check <slug>   # l'entité existe ? (exit 0 = oui, 1 = non)
 *
 * `create` n'est volontairement PAS implémenté : la création exige une
 * authentification (addOrganization/addProject) — point ouvert du design
 * (credentials env vs création in-app via AddOrganizationModal).
 *
 * Backend : VITE_BASE_URL_BACKEND (env ou .env).
 */
import fs from "node:fs";
import path from "node:path";
import Cocolight from "@communecter/cocolight-api-client";

function readDotEnv(key: string): string | undefined {
  const p = path.join(process.cwd(), ".env");
  if (!fs.existsSync(p)) return undefined;
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const baseURL =
  process.env.VITE_BASE_URL_BACKEND ?? readDotEnv("VITE_BASE_URL_BACKEND") ?? "http://localhost:3000";

const [cmd, arg] = process.argv.slice(2);
if (!cmd || !arg || !["search", "check"].includes(cmd)) {
  console.error("Usage : entity-slug.ts <search <nom> | check <slug>>   (backend: VITE_BASE_URL_BACKEND)");
  process.exit(2);
}

const tokenStorageStrategy =
  await Cocolight.tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy("memory");
const client = new Cocolight.ApiClient({ baseURL, tokenStorageStrategy });
const api = new Cocolight.Api(null, client);

if (cmd === "check") {
  try {
    const entity = await api.entitySlug(arg);
    if (!entity) throw new Error("non résolue");
    const sd = (entity as { serverData?: { name?: string } }).serverData;
    console.log(`✓ slug "${arg}" PRIS — ${entity.getEntityType?.() ?? "?"} « ${sd?.name ?? "?"} »`);
    console.log(`  (utilisable comme slug de site si c'est bien VOTRE entité)`);
    process.exit(0);
  } catch {
    console.log(`✗ slug "${arg}" introuvable sur ${baseURL}`);
    console.log(`  → libre, mais il faudra CRÉER l'entité avant que le site boote`);
    process.exit(1);
  }
}

// search — extraction défensive : la réponse est un objet/array de résultats
// dont la forme varie ; on collecte tout ce qui porte slug+name.
type Candidate = { slug?: string; name?: string; collection?: string; type?: string };
function collect(value: unknown, out: Candidate[], depth = 0): void {
  if (depth > 4 || value == null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const v of value) collect(v, out, depth + 1);
    return;
  }
  const rec = value as Record<string, unknown>;
  if (typeof rec.slug === "string" && (typeof rec.name === "string" || typeof rec.title === "string")) {
    out.push({
      slug: rec.slug as string,
      name: (rec.name ?? rec.title) as string,
      collection: (rec.collection ?? rec.type) as string | undefined,
    });
    return;
  }
  for (const v of Object.values(rec)) collect(v, out, depth + 1);
}

try {
  const res = await api.endpointApi.globalAutocomplete({
    name: arg,
    searchType: ["NGO", "LocalBusiness", "Group", "GovernmentOrganization", "Cooperative", "projects"],
  });
  const candidates: Candidate[] = [];
  collect(res, candidates);
  if (candidates.length === 0) {
    console.log(`(aucune entité trouvée pour « ${arg} » sur ${baseURL})`);
    process.exit(1);
  }
  const seen = new Set<string>();
  for (const c of candidates) {
    if (!c.slug || seen.has(c.slug)) continue;
    seen.add(c.slug);
    console.log(`${(c.slug ?? "").padEnd(32)} ${(c.collection ?? "?").padEnd(16)} ${c.name ?? ""}`);
  }
} catch (e) {
  console.error(`✗ recherche échouée sur ${baseURL} : ${(e as Error).message}`);
  process.exit(1);
}
