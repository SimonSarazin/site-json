import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  ROOT,
  loadManifest,
  loadExamples,
  loadConfig,
  resolveSelector,
} from "../../scripts/lib/archetypes";

/**
 * Gate de fraîcheur des archétypes de l'assistant de config
 * (.claude/skills/config-assistant/archetypes.json) et de ses exemples
 * canoniques (examples/*.json) — cf. commentaire/refonte-assistant-config.md,
 * axe B. Un archétype qui se dégrade (constat d'audit non assumé) ou un
 * snapshot qui dérive de sa config source CASSE ce test :
 * - constat assumé → le déclarer dans `knownFindings` du manifest (versionné) ;
 * - snapshot périmé → `npm run config:example -- <feature> --write`.
 */

const manifest = loadManifest();
const archetypeConfigs = new Set(manifest.archetypes.map((a) => a.config));

interface AuditFinding {
  category: string;
  path: string;
}
interface AuditReport {
  orphans: string[];
  configs: Record<string, { findings: AuditFinding[]; assumed: AuditFinding[] }>;
}

const findingKey = (f: AuditFinding) => `${f.category} @ ${f.path}`;

describe("archétypes de l'assistant config (gate de fraîcheur)", () => {
  it("chaque archétype existe et est enregistré dans sites.json (slug → config)", () => {
    const sites = JSON.parse(fs.readFileSync(path.join(ROOT, "sites.json"), "utf-8")) as {
      slug: string;
      config: string;
    }[];
    for (const a of manifest.archetypes) {
      expect(fs.existsSync(path.join(ROOT, a.config)), `fichier ${a.config}`).toBe(true);
      const site = sites.find((s) => s.slug === a.slug);
      expect(site, `slug "${a.slug}" dans sites.json`).toBeDefined();
      expect(site?.config, `config de "${a.slug}" dans sites.json`).toBe(a.config);
    }
  });

  it("chaque exemple provient d'un archétype et son snapshot égale le bloc source", () => {
    const examples = loadExamples();
    expect(examples.length).toBeGreaterThan(0);
    for (const doc of examples) {
      expect(archetypeConfigs, `source de "${doc.feature}" hors archétypes`).toContain(doc.source);
      expect(doc.snapshot, `snapshot vide pour "${doc.feature}" (lancer config:example -- ${doc.feature} --write)`).not.toBeNull();
      const extracted = resolveSelector(loadConfig(doc.source), doc.selector);
      expect(extracted, `dérive du snapshot "${doc.feature}" vs ${doc.source} (${doc.selector})`).toEqual(doc.snapshot);
    }
  });

  it(
    "audit:config ne trouve rien de non-assumé sur les archétypes (knownFindings exact)",
    () => {
      const run = spawnSync("npx", ["tsx", "scripts/audit-config.ts", "--json"], {
        cwd: ROOT,
        encoding: "utf-8",
        env: { ...process.env },
      });
      expect(run.error, `spawn audit:config impossible : ${run.error}`).toBeUndefined();
      expect(
        run.stdout,
        `sortie audit vide (status : ${run.status}, stderr : ${run.stderr})`,
      ).toBeTruthy();
      const report = JSON.parse(run.stdout) as AuditReport;

      for (const a of manifest.archetypes) {
        expect(report.orphans, `${a.config} orpheline`).not.toContain(a.config);
        // Archétype WIP (chantier actif) : gate d'audit allégé — pas d'égalité
        // stricte tant qu'il n'est pas gradué (retirer `wip` du manifest).
        if (a.wip) continue;
        const cfg = report.configs[a.config];
        // findings ∪ assumed : invariant quel que soit l'état du
        // .audit-baseline.json LOCAL (gitignoré) — seul knownFindings (versionné)
        // fait foi pour assumer un constat d'archétype.
        const actual = [...(cfg?.findings ?? []), ...(cfg?.assumed ?? [])].map(findingKey).sort();
        const assumed = a.knownFindings.map(findingKey).sort();
        // Égalité stricte : un constat NOUVEAU dégrade l'archétype ; un constat
        // déclaré mais disparu signifie que knownFindings doit être nettoyé.
        expect(actual, `constats d'audit de ${a.config}`).toEqual(assumed);
      }
    },
    60_000,
  );
});
