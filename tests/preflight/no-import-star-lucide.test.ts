import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Anti-régression — interdit `import * as LucideIcons from "lucide-react"`.
 *
 * Ce pattern défait le tree-shaking de Vite et force ~1900 icônes (~1 MB)
 * dans le chunk qui l'utilise. Cf. CLAUDE.md §Known Issues 1.
 *
 * Pour les icônes dynamiques, utiliser `<DynamicIcon name={iconName} />`
 * (depuis `lucide-react/dynamic`). Pour les icônes statiques, utiliser des
 * imports nommés : `import { MapPin } from "lucide-react"`.
 */

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const SRC_DIR = path.join(PROJECT_ROOT, "src");

function walkSource(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSource(full, files);
    } else if (
      entry.isFile() &&
      /\.(ts|tsx|js|jsx)$/.test(entry.name) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx")
    ) {
      files.push(full);
    }
  }
  return files;
}

// Pattern : import * as <Anything> from "lucide-react"
// Tolérant aux espaces et aux guillemets simples/doubles
const FORBIDDEN_PATTERN = /import\s*\*\s*as\s+\w+\s+from\s+['"]lucide-react['"]/;

describe("Preflight — Lucide React tree-shaking", () => {
  const sourceFiles = walkSource(SRC_DIR);
  // Lecture unique du contenu au moment de la collecte (hors timeout de test) —
  // évite de relire le disque dans chaque test, ce qui devenait flaky/timeout
  // (> 5 s par défaut) à mesure que le nombre de fichiers source grossit.
  const sources = sourceFiles.map((file) => ({ file, content: fs.readFileSync(file, "utf-8") }));

  test("aucun fichier ne fait `import * as X from \"lucide-react\"`", () => {
    const offenders = sources
      .filter(({ content }) => FORBIDDEN_PATTERN.test(content))
      .map(({ file }) => path.relative(PROJECT_ROOT, file));
    if (offenders.length > 0) {
      console.error(
        "\n❌ Régression tree-shaking lucide-react détectée. Fichiers à corriger :\n" +
          offenders.map((f) => `  - ${f}`).join("\n") +
          "\n\nUtilisez `import { IconName } from \"lucide-react\"` ou `<DynamicIcon name=… />`.\n"
      );
    }
    expect(offenders).toEqual([]);
  });

  test("aucun fichier n'importe l'icône-set complet depuis 'lucide-react/icons'", () => {
    // Variante : `import * as Icons from "lucide-react/icons"` (chemin alternatif)
    const altPattern = /import\s*\*\s*as\s+\w+\s+from\s+['"]lucide-react\/icons['"]/;
    const offenders = sources
      .filter(({ content }) => altPattern.test(content))
      .map(({ file }) => path.relative(PROJECT_ROOT, file));
    expect(offenders).toEqual([]);
  });

  test("scanne effectivement plus de 100 fichiers source", () => {
    // Garde-fou : si le walk plante silencieusement et trouve 0 fichier,
    // les autres tests passeraient à tort.
    expect(sourceFiles.length).toBeGreaterThan(100);
  });
});
