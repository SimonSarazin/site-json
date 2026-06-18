import { describe, test, expect, beforeAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Préflight — contrats CLI des scripts d'outillage (`scripts/`).
 *
 * Anti-régression sur les EXIT CODES et la forme de sortie de validate-config,
 * audit-config et config-schema — ces scripts sont consommés par l'assistant config
 * (doc/26) ET par la CI (`.gitlab-ci.yml` : `audit:config --strict`), donc leurs
 * contrats doivent rester stables.
 *
 * Les scripts sont des CLI à effets de bord au chargement (parse argv + process.exit),
 * non importables : on les SPAWN via le binaire `tsx` local. Tous les spawns tournent
 * en parallèle dans un `beforeAll` (chaque invocation recompile site-schema.ts → coûteux
 * en série).
 */

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");
const TSX = path.join(ROOT, "node_modules", ".bin", "tsx");

type Res = { status: number; stdout: string; stderr: string };

async function runScript(script: string, args: string[]): Promise<Res> {
  try {
    const { stdout, stderr } = await execFileAsync(TSX, [path.join("scripts", script), ...args], {
      cwd: ROOT,
      encoding: "utf-8",
      maxBuffer: 16 * 1024 * 1024,
    });
    return { status: 0, stdout, stderr };
  } catch (e) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    return { status: typeof err.code === "number" ? err.code : 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

let R: Record<string, Res>;

beforeAll(async () => {
  const brokenJson = path.join(os.tmpdir(), `siteforge-broken-${process.pid}.json`);
  fs.writeFileSync(brokenJson, "{ ceci n'est pas du JSON ", "utf-8");

  const [
    validateOk,
    validateBrokenJson,
    validateAbsent,
    validateNoArg,
    auditJson,
    schemaSections,
    schemaBadSection,
    schemaNoArg,
  ] = await Promise.all([
    runScript("validate-config.ts", ["config.prod.json"]),
    runScript("validate-config.ts", [brokenJson]),
    runScript("validate-config.ts", ["config.prod.__inexistant__.json"]),
    runScript("validate-config.ts", []),
    runScript("audit-config.ts", ["--json", "--file", "config.prod.json"]),
    runScript("config-schema.ts", ["sections"]),
    runScript("config-schema.ts", ["section:__type_inexistant__"]),
    runScript("config-schema.ts", []),
  ]);

  fs.rmSync(brokenJson, { force: true });
  R = { validateOk, validateBrokenJson, validateAbsent, validateNoArg, auditJson, schemaSections, schemaBadSection, schemaNoArg };
}, 90_000);

describe("Preflight — contrats CLI des scripts", () => {
  describe("validate-config", () => {
    test("config valide → exit 0 + « valide »", () => {
      expect(R.validateOk.status).toBe(0);
      expect(R.validateOk.stdout).toMatch(/valide/);
    });
    test("JSON cassé → exit 1", () => {
      expect(R.validateBrokenJson.status).toBe(1);
    });
    test("fichier absent → exit 2", () => {
      expect(R.validateAbsent.status).toBe(2);
    });
    test("sans argument → exit 2 + usage", () => {
      expect(R.validateNoArg.status).toBe(2);
      expect(R.validateNoArg.stderr).toMatch(/Usage/);
    });
  });

  describe("audit-config", () => {
    test("--json --file → exit 0 + structure {configs, totalActive}", () => {
      expect(R.auditJson.status).toBe(0);
      const parsed = JSON.parse(R.auditJson.stdout) as { configs?: unknown; totalActive?: unknown };
      expect(parsed.configs).toBeTypeOf("object");
      expect(parsed.totalActive).toBeTypeOf("number");
    });
  });

  describe("config-schema", () => {
    test("sections → exit 0 + catalogue non vide", () => {
      expect(R.schemaSections.status).toBe(0);
      expect(R.schemaSections.stdout.trim().length).toBeGreaterThan(0);
    });
    test("section:<type inconnu> → exit 1", () => {
      expect(R.schemaBadSection.status).toBe(1);
    });
    test("sans argument → exit 2", () => {
      expect(R.schemaNoArg.status).toBe(2);
    });
  });
});
