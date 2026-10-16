import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Preflight (build requis) — chaque module chargé en `lazy(() => import("…"))` garde sa façade
 * dans le manifest client : vite-preload cherche son chemin source comme clé du manifest pour
 * émettre ses modulepreload SSR. Cf. `src/modules/aac/variants/lazyVariants.ts`.
 * Ignoré sans `dist/client` (lancer `npm run build`).
 */
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const MANIFEST = path.join(PROJECT_ROOT, "dist/client/.vite/manifest.json");
const SRC = path.join(PROJECT_ROOT, "src");

const hasBuild = () => fs.existsSync(MANIFEST);

/**
 * Modules déjà sans façade, à traiter à part. La liste ne peut que rétrécir : un module réparé
 * doit en être retiré, un nouveau module sans façade fait échouer le test.
 */
const KNOWN_WITHOUT_FACADE = new Set([
  "src/modules/toolsCatalog/sections/ToolsCatalogSection.tsx",
  "src/modules/auth/components/forms/RegisterForm.tsx",
  "src/modules/interop/components/DiscourseLink.tsx",
  "src/modules/interop/components/MediawikiLink.tsx",
  "src/modules/interop/DiscourseSection.tsx",
  "src/modules/interop/MediawikiSection.tsx",
  "src/modules/search/components/SwitchDetailsMode.tsx",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
}

/** Résout un spécifieur d'import vers un fichier du dépôt (alias `@/` compris). */
function resolveSpecifier(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.join(SRC, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(from), specifier)
      : null;
  if (!base) return null;
  const candidates = [base, `${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

/** `[déclarant, cible]` de chaque `lazy(() => import("…"))` du dépôt, cible en chemin relatif. */
function lazyTargets(): Array<{ declaredIn: string; target: string }> {
  const found: Array<{ declaredIn: string; target: string }> = [];
  for (const file of walk(SRC)) {
    const src = fs.readFileSync(file, "utf-8");
    // Le `lazy` de vite-preload seulement : `React.lazy` n'alimente pas le collecteur.
    if (!/from\s+["']vite-preload["']/.test(src)) continue;
    for (const m of src.matchAll(/\blazy\(\s*\(\)\s*=>\s*import\(\s*["']([^"']+)["']\s*\)/g)) {
      const resolved = resolveSpecifier(file, m[1]);
      if (!resolved || !/\.(tsx|jsx)$/.test(resolved)) continue; // le plugin n'injecte que dans du JSX
      found.push({
        declaredIn: path.relative(PROJECT_ROOT, file).replace(/\\/g, "/"),
        target: path.relative(PROJECT_ROOT, resolved).replace(/\\/g, "/"),
      });
    }
  }
  return found;
}

describe("Preflight — façades des modules lazy (manifest client)", () => {
  test("le relevé trouve bien les pages lazy du dépôt", () => {
    const targets = lazyTargets().map((t) => t.target);
    expect(targets).toContain("src/modules/aac/pages/AacCommunDetailPage.tsx");
    expect(targets).toContain("src/modules/aac/sections/AacDirectorySection.tsx");
  });

  test.skipIf(!hasBuild())("chaque cible de `lazy(() => import())` a sa clé source dans le manifest", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf-8")) as Record<string, unknown>;
    const sansFacade = lazyTargets()
      .filter(({ target }) => !(target in manifest) && !KNOWN_WITHOUT_FACADE.has(target))
      .map(({ declaredIn, target }) => `${target} (lazy dans ${declaredIn})`);
    expect(
      [...new Set(sansFacade)],
      `Module(s) lazy sans façade dans dist/client/.vite/manifest.json — leurs modulepreload SSR ` +
        `sont perdus en silence. Cause habituelle : un \`import()\` déclaré DANS le chunk de la page ` +
        `(cf. src/modules/aac/variants/lazyVariants.ts) :\n  ${[...new Set(sansFacade)].join("\n  ")}`,
    ).toHaveLength(0);
  });

  test.skipIf(!hasBuild())("la dette connue ne contient que des modules encore sans façade", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf-8")) as Record<string, unknown>;
    const repares = [...KNOWN_WITHOUT_FACADE].filter((target) => target in manifest);
    expect(repares, `Réparé(s) — à retirer de KNOWN_WITHOUT_FACADE :\n  ${repares.join("\n  ")}`).toHaveLength(0);
  });
});
