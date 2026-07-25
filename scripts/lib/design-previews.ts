/**
 * Pont vers `.design-sync/previews/` — 152 stories VERSIONNÉES portant des
 * compositions de props RÉELLES (valeurs plausibles, commentaire d'usage :
 * « Usage réel : home de Rézo la mer / Cyber Réunion »).
 *
 * C'est la meilleure ressource de conception du repo et elle était invisible
 * pour l'assistant : le JSON Schema donne la FORME (types, enums), la story
 * donne la COMPOSITION (quelles props on renseigne vraiment, avec quoi dedans).
 * Contrairement à `ds-bundle/` (gitignoré, régénérable, absent d'un clone
 * frais), ces fichiers sont dans git.
 *
 * Le lien type de section → story est DÉRIVÉ de SectionRenderer.tsx (la table
 * `lazy(() => import(…))` fait déjà foi pour la parité SECTION_META).
 */
import fs from "node:fs";
import path from "node:path";

const PREVIEWS_DIR = ".design-sync/previews";

function previewNames(root: string): Set<string> {
  const dir = path.join(root, PREVIEWS_DIR);
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => f.slice(0, -4)),
  );
}

/** Chemin repo-relatif de la story d'un composant, si elle existe. */
export function componentPreview(root: string, component: string): string | undefined {
  return previewNames(root).has(component) ? `${PREVIEWS_DIR}/${component}.tsx` : undefined;
}

/**
 * `hero-parallax` → `.design-sync/previews/HeroParallax.tsx`. Les sections
 * data-driven (search*, agenda, cagnotte, blog…) n'ont pas de story : une
 * composition de props statique n'y montrerait rien.
 */
export function sectionPreviews(root: string): Map<string, string> {
  const src = path.join(root, "src/components/sections/SectionRenderer.tsx");
  const out = new Map<string, string>();
  if (!fs.existsSync(src)) return out;
  const names = previewNames(root);
  for (const m of fs
    .readFileSync(src, "utf-8")
    .matchAll(/"?([\w-]+)"?:\s*lazy\(\(\)\s*=>\s*import\("([^"]+)"\)/g)) {
    const component = m[2].split("/").pop() ?? "";
    if (names.has(component)) out.set(m[1], `${PREVIEWS_DIR}/${component}.tsx`);
  }
  return out;
}

/** Stories des variantes de chrome (les 6 headers, les 4 footers). */
export function chromePreviews(root: string, prefix: "Header" | "Footer"): string[] {
  return [...previewNames(root)]
    .filter((n) => n.startsWith(prefix))
    .sort()
    .map((n) => `${PREVIEWS_DIR}/${n}.tsx`);
}
