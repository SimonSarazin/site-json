import { describe, test, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { AdminConfigSchema } from "@/modules/admin/schema";

import {
  applyAdminBlock,
  deriveAdminConfig,
  deriveEntityTypes,
  findTopLevelKeySpan,
  parseArgs,
  ScaffoldError,
} from "../admin-scaffold";

/**
 * Tests du générateur du bloc `config.admin` (scripts/admin-scaffold.ts,
 * RFC doc/31 fil B / F1) : dérivation des types depuis addConfig+costumForms,
 * validité Zod du scaffold, insertion textuelle prudente et refus d'écraser
 * sans --force (unitaire + CLI réel).
 */

/** Fixture : addConfig hétérogènes (event désactivé partout) + un costumForm citoyens. */
const fixture = {
  profiles: {
    citoyens: {
      sections: [
        {
          type: "profile-header",
          showAddDropdown: true,
          addConfig: {
            organization: true,
            project: true,
            event: false,
            poi: true,
            custom: [{ modalKey: "add-mon-form", label: { fr: "Ajouter" } }],
          },
        },
      ],
    },
    organizations: {
      sections: [
        { type: "profile-header", addConfig: { organization: false, project: true, event: false, poi: true } },
      ],
    },
  },
  costumForms: {
    "mon-form": { id: "mon-form", entityType: "citoyens", mutation: { entityType: "citoyens" } },
  },
};

type Tab = { id: string; access?: string; sections: Array<Record<string, unknown>> };
const tabById = (block: { tabs?: unknown }, id: string): Tab | undefined =>
  (block.tabs as Tab[]).find((t) => t.id === id);

describe("deriveEntityTypes", () => {
  test("croise addConfig (false = désactivé) et costumForms.entityType, ordre canonique", () => {
    expect(deriveEntityTypes(fixture)).toEqual(["organizations", "projects", "poi", "citoyens"]);
  });

  test("addConfig vide = tous les types (défaut true de AddConfigSchema)", () => {
    const config = { profiles: { citoyens: { sections: [{ addConfig: {} }] } } };
    expect(deriveEntityTypes(config)).toEqual(["organizations", "projects", "events", "poi"]);
  });

  test("costumForms seul suffit (entityType top-level, sinon mutation.entityType)", () => {
    expect(deriveEntityTypes({ costumForms: { a: { entityType: "poi" } } })).toEqual(["poi"]);
    expect(deriveEntityTypes({ costumForms: { a: { mutation: { entityType: "events" } } } })).toEqual(["events"]);
  });

  test("aucune source → aucun type", () => {
    expect(deriveEntityTypes({})).toEqual([]);
  });
});

describe("deriveAdminConfig", () => {
  const block = deriveAdminConfig(fixture);

  test("le scaffold passe AdminConfigSchema (validation Zod stricte)", () => {
    const r = AdminConfigSchema.safeParse(block);
    if (!r.success) expect.fail(r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
  });

  test("survit à un aller-retour JSON (ce qui sera écrit dans la config)", () => {
    const r = AdminConfigSchema.safeParse(JSON.parse(JSON.stringify(block)));
    expect(r.success).toBe(true);
  });

  test("content : une section resource par type, dans l'ordre", () => {
    const content = tabById(block, "content");
    expect(content?.sections.map((s) => s.entityType)).toEqual(["organizations", "projects", "poi", "citoyens"]);
    for (const s of content!.sections) {
      expect(s.type).toBe("resource");
      expect(s.create).toBe("inherit");
      expect(s.edit).toBe("inherit");
      expect(s.rowActions).toEqual(["edit", "delete", "validate", "reference"]);
      expect(s.bulkActions).toEqual(["validate", "export", "delete"]);
    }
  });

  test("colonnes : name + Commune, mais pas de colonne adresse pour citoyens", () => {
    const content = tabById(block, "content");
    const poi = content!.sections.find((s) => s.entityType === "poi");
    expect(poi?.columns).toEqual(["name", { path: "address.addressLocality", label: { fr: "Commune" } }]);
    const citoyens = content!.sections.find((s) => s.entityType === "citoyens");
    expect(citoyens?.columns).toEqual(["name"]);
  });

  test("import/export : intersection avec les types importables/exportables", () => {
    const ie = tabById(block, "import-export");
    const imp = ie!.sections.find((s) => s.type === "import");
    const exp = ie!.sections.find((s) => s.type === "export");
    // events absent du site → absent des deux ; citoyens importable mais PAS exportable.
    expect(imp?.entityTypes).toEqual(["poi", "organizations", "projects", "citoyens"]);
    expect(exp?.entityTypes).toEqual(["organizations", "projects", "poi"]);
  });

  test("reference : tous les types du site ; moderation : superAdmin", () => {
    const ref = tabById(block, "reference");
    expect(ref?.sections[0].entityTypes).toEqual(["organizations", "projects", "poi", "citoyens"]);
    expect(tabById(block, "moderation")?.access).toBe("superAdmin");
  });

  test("members : filters standard complets", () => {
    expect(tabById(block, "members")?.sections[0].filters).toEqual([
      "toBeValidated",
      "isAdmin",
      "isInviting",
      "text",
    ]);
  });

  test("site sans types : dashboard/members/moderation seuls, et le bloc reste valide", () => {
    const empty = deriveAdminConfig({});
    expect((empty.tabs ?? []).map((t) => t.id)).toEqual(["dashboard", "members", "moderation"]);
    expect(AdminConfigSchema.safeParse(empty).success).toBe(true);
  });
});

describe("applyAdminBlock — insertion textuelle prudente", () => {
  // Formatage NON canonique volontaire (objets inline, espace parasite) comme les configs du repo.
  const quirkyRaw = `{
  "meta": { "name": "Site X", "label": { "fr": "Site X", "en": "Site X" } },
   "profiles": {},
  "pages": []
}`;
  const block = { enabled: true, tabs: [] };

  test("insère la clé admin en préservant le formatage existant byte à byte", () => {
    const next = applyAdminBlock(quirkyRaw, block);
    const reparsed = JSON.parse(next);
    expect(reparsed.admin).toEqual(block);
    // Tout le contenu d'origine (avant l'accolade finale) est intact, quirks compris.
    expect(next.startsWith(quirkyRaw.slice(0, quirkyRaw.lastIndexOf("]") + 1))).toBe(true);
    expect(next).toContain('   "profiles": {},');
    expect(reparsed.meta).toEqual({ name: "Site X", label: { fr: "Site X", en: "Site X" } });
  });

  test("préserve la fin de fichier (avec et sans newline final)", () => {
    expect(applyAdminBlock(quirkyRaw + "\n", block).endsWith("}\n")).toBe(true);
    expect(applyAdminBlock(quirkyRaw, block).endsWith("}")).toBe(true);
  });

  test("refuse d'écraser une clé admin existante sans force", () => {
    const withAdmin = `{\n  "meta": {},\n  "admin": { "enabled": false }\n}`;
    expect(() => applyAdminBlock(withAdmin, block)).toThrow(ScaffoldError);
    expect(() => applyAdminBlock(withAdmin, block)).toThrow(/--force/);
  });

  test("force : remplace la clé admin À SA PLACE sans toucher au reste", () => {
    const withAdmin = `{\n  "meta": { "name": "Y" },\n  "admin": { "enabled": false, "tabs": [] },\n  "pages": []\n}`;
    const next = applyAdminBlock(withAdmin, block, { force: true });
    const reparsed = JSON.parse(next);
    expect(reparsed.admin).toEqual(block);
    expect(Object.keys(reparsed)).toEqual(["meta", "admin", "pages"]); // position conservée
    expect(reparsed.meta).toEqual({ name: "Y" });
  });
});

describe("findTopLevelKeySpan", () => {
  test("ignore les clés admin imbriquées et les occurrences dans des chaînes", () => {
    const raw = `{\n  "a": { "admin": 1, "s": "\\"admin\\": fake" },\n  "admin": [1, { "x": "}" }],\n  "b": 2\n}`;
    const span = findTopLevelKeySpan(raw, "admin");
    expect(span).not.toBeNull();
    expect(raw.slice(span!.start, span!.end)).toBe(`"admin": [1, { "x": "}" }]`);
  });

  test("null si la clé n'existe qu'imbriquée", () => {
    expect(findTopLevelKeySpan(`{ "a": { "admin": 1 } }`, "admin")).toBeNull();
  });
});

describe("parseArgs", () => {
  test("fichier + flags", () => {
    expect(parseArgs(["c.json"])).toEqual({ file: "c.json", write: false, force: false });
    expect(parseArgs(["c.json", "--write", "--force"])).toEqual({ file: "c.json", write: true, force: true });
  });
  test("erreurs d'usage", () => {
    expect(parseArgs([])).toHaveProperty("error");
    expect(parseArgs(["c.json", "--frce"])).toHaveProperty("error");
    expect(parseArgs(["a.json", "b.json"])).toHaveProperty("error");
  });
});

describe("CLI réel (tsx)", () => {
  const ROOT = path.resolve(__dirname, "../..");
  const SCRIPT = path.join(ROOT, "scripts/admin-scaffold.ts");
  const TSX = path.join(ROOT, "node_modules/.bin/tsx");

  const run = (args: string[]) => {
    try {
      const stdout = execFileSync(TSX, [SCRIPT, ...args], { cwd: ROOT, encoding: "utf-8" });
      return { code: 0, stdout };
    } catch (e) {
      const err = e as { status: number | null; stdout: string };
      return { code: err.status ?? -1, stdout: err.stdout ?? "" };
    }
  };

  test("--write insère, re-run sans --force refuse (fichier intact), --force remplace", { timeout: 60_000 }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-scaffold-"));
    const file = path.join(dir, "config.test.json");
    fs.writeFileSync(file, JSON.stringify({ profiles: fixture.profiles, costumForms: fixture.costumForms }, null, 2) + "\n");
    try {
      expect(run([file, "--write"]).code).toBe(0);
      const written = fs.readFileSync(file, "utf-8");
      const admin = JSON.parse(written).admin;
      expect(AdminConfigSchema.safeParse(admin).success).toBe(true);

      // Refus sans --force : exit 1 et fichier byte-inchangé.
      expect(run([file, "--write"]).code).toBe(1);
      expect(fs.readFileSync(file, "utf-8")).toBe(written);

      expect(run([file, "--write", "--force"]).code).toBe(0);
      expect(JSON.parse(fs.readFileSync(file, "utf-8")).admin).toEqual(admin);

      // Mode stdout : n'écrit jamais, la sortie parse et passe le schéma.
      const dry = run([file]);
      expect(dry.code).toBe(0);
      expect(AdminConfigSchema.safeParse(JSON.parse(dry.stdout)).success).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
