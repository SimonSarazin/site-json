import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Preflight — clés d'interface de l'AAC (`config.aac.detail.pageVariant`…), pour chaque config
 * de `sites.json` (une clé inconnue retombe sur `default` sans erreur) :
 *  - toute clé posée existe dans son registre ;
 *  - aucune clé n'est un slug de site (une interface se nomme d'après son design).
 * Les clés d'un registre sont lues dans son source, sans l'importer.
 */
const PROJECT_ROOT = path.resolve(__dirname, "../..");

interface VariantSlot {
  /** Où la clé se pose, pour les messages. */
  at: string;
  /** Les clés posées dans une config, avec leur emplacement exact. */
  collect: (cfg: Cfg) => Array<{ at: string; key: unknown }>;
  /** Source du registre qui doit les connaître. */
  registry: string;
}

interface DirectorySection {
  type?: string;
  props?: { cardVariant?: unknown; shellVariant?: unknown };
}
interface Cfg {
  aac?: {
    detail?: { pageVariant?: unknown };
    directory?: { defaultCardVariant?: unknown; defaultShellVariant?: unknown };
  };
  pages?: Array<{ path?: string; sections?: DirectorySection[] }>;
}

/** Une clé posée à la racine de `config.aac`. */
const atRoot = (at: string, read: (cfg: Cfg) => unknown) => (cfg: Cfg) => {
  const key = read(cfg);
  return key === undefined ? [] : [{ at, key }];
};

/** Une prop posée sur chaque section `aac-directory` de chaque page. */
const onDirectorySections = (prop: "cardVariant" | "shellVariant") => (cfg: Cfg) =>
  (cfg.pages ?? []).flatMap((page) =>
    (page.sections ?? [])
      .map((section, i) => ({ section, i }))
      .filter(({ section }) => section.type === "aac-directory" && section.props?.[prop] !== undefined)
      .map(({ section, i }) => ({ at: `pages[${page.path}].sections[${i}].props.${prop}`, key: section.props?.[prop] })),
  );

const ITEMS = "src/modules/aac/components/directory/variants/items.ts";
const SHELLS = "src/modules/aac/components/directory/variants/shells.ts";

const SLOTS: VariantSlot[] = [
  {
    at: "aac.detail.pageVariant",
    collect: atRoot("aac.detail.pageVariant", (cfg) => cfg.aac?.detail?.pageVariant),
    registry: "src/modules/aac/components/pageDetail/variants/registry.ts",
  },
  {
    at: "aac.directory.defaultCardVariant",
    collect: atRoot("aac.directory.defaultCardVariant", (cfg) => cfg.aac?.directory?.defaultCardVariant),
    registry: ITEMS,
  },
  { at: "aac-directory.props.cardVariant", collect: onDirectorySections("cardVariant"), registry: ITEMS },
  {
    at: "aac.directory.defaultShellVariant",
    collect: atRoot("aac.directory.defaultShellVariant", (cfg) => cfg.aac?.directory?.defaultShellVariant),
    registry: SHELLS,
  },
  { at: "aac-directory.props.shellVariant", collect: onDirectorySections("shellVariant"), registry: SHELLS },
];

/** Clés de premier niveau de l'objet passé à chaque `makeVariantRegistry(…)` du source, commentaires ignorés. */
function registryKeys(file: string): Set<string> {
  const src = fs
    .readFileSync(path.join(PROJECT_ROOT, file), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const keys = new Set<string>();
  for (const call of src.matchAll(/makeVariantRegistry\s*(?:<[^>]*>)?\s*\(\s*\{/g)) {
    let depth = 1;
    let i = (call.index ?? 0) + call[0].length;
    let token = "";
    for (; i < src.length && depth > 0; i++) {
      const c = src[i];
      if (c === "{" || c === "(" || c === "[") depth++;
      else if (c === "}" || c === ")" || c === "]") depth--;
      else if (depth === 1) {
        if (c === ":" && /^[A-Za-z_]\w*$/.test(token.trim())) keys.add(token.trim());
        token = c === "," || c === "\n" ? "" : token + c;
        continue;
      }
      if (depth === 1) token = "";
    }
  }
  return keys;
}

const sites: Array<{ slug: string; config: string }> = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "sites.json"), "utf-8"),
);
const SITE_SLUGS = new Set(sites.map((s) => s.slug.toLowerCase()));
const uniqueConfigs = [...new Set(["config.prod.json", ...sites.map((s) => s.config)])].filter((f) =>
  fs.existsSync(path.join(PROJECT_ROOT, f)),
);

/** `{config, emplacement, clé, registre}` de chaque clé d'interface posée. */
const declared = uniqueConfigs.flatMap((file) => {
  const cfg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, file), "utf-8")) as Cfg;
  return SLOTS.flatMap((slot) => slot.collect(cfg).map(({ at, key }) => ({ file, slot, at, key })));
});

describe("Preflight — clés d'interface de l'AAC", () => {
  test("chaque registre se lit, et déclare son `default`", () => {
    for (const slot of SLOTS) {
      expect(registryKeys(slot.registry).has("default"), `${slot.registry} : entrée « default » introuvable`).toBe(true);
    }
  });

  test("la lecture des registres voit aussi les entrées code-splittées", () => {
    // Contrôle du lecteur de registre lui-même.
    expect([...registryKeys(ITEMS)].sort()).toEqual(["default", "editorial"]);
    expect([...registryKeys(SHELLS)].sort()).toEqual(["default", "editorial"]);
  });

  test("toute clé posée existe dans son registre", () => {
    const inconnues = declared
      .filter(({ slot, key }) => typeof key !== "string" || !registryKeys(slot.registry).has(key))
      .map(({ file, slot, at, key }) => `${file} → ${at} = ${JSON.stringify(key)} (registre : ${slot.registry})`);
    expect(
      inconnues,
      `Clé(s) d'interface inconnue(s) — rendue(s) avec l'interface par défaut, sans erreur :\n  ${inconnues.join("\n  ")}`,
    ).toHaveLength(0);
  });

  test("aucune clé ne porte le nom d'un site", () => {
    const nommeesParSite = declared
      .filter(({ key }) => typeof key === "string" && SITE_SLUGS.has(key.toLowerCase()))
      .map(({ file, at, key }) => `${file} → ${at} = ${JSON.stringify(key)}`);
    expect(
      nommeesParSite,
      `Une interface se nomme d'après son DESIGN, jamais d'après un site :\n  ${nommeesParSite.join("\n  ")}`,
    ).toHaveLength(0);
  });

  test("aucune entrée de registre ne porte le nom d'un site", () => {
    const fautives = SLOTS.flatMap((slot) =>
      [...registryKeys(slot.registry)].filter((k) => SITE_SLUGS.has(k.toLowerCase())).map((k) => `${slot.registry} : ${k}`),
    );
    expect(fautives).toHaveLength(0);
  });
});
