/**
 * Matrice OPTION × PRESENTER des listes de recherche.
 *
 * Le dump de `section:searchPro` décrit très bien CHAQUE option de `list.card`
 * / `list.preview`, mais jamais sur QUELS types elle a un effet : `shareButton`
 * n'est lu que par la carte `overlay`, `imageFit` que par `image-cover`,
 * `showFunding` que par `funding`. Une option posée sur le mauvais type est
 * ignorée EN SILENCE — la carte s'affiche, l'option ne fait rien.
 *
 * Tout est dérivé par analyse statique : table de dispatch (SearchCard.tsx /
 * Preview.tsx) + lectures `card?.x` / `preview?.x` dans chaque composant, en
 * suivant les délégations locales (CardResource → resource/CardResourceCard).
 */
import fs from "node:fs";
import path from "node:path";

const COMPONENTS_DIR = "src/modules/search/components";
const SEARCH_MODULE = "src/modules/search";

/** Tous les .tsx du dossier des presenters, indexés par nom de composant. */
function componentFiles(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith(".tsx")) out.set(e.name.slice(0, -4), full);
    }
  };
  walk(path.join(root, COMPONENTS_DIR));
  return out;
}

/** Lectures `x.opt`, `x?.opt` et `const { a, b } = x` dans une source. */
function readsOf(src: string, rootName: string): Set<string> {
  const out = new Set<string>(
    [...src.matchAll(new RegExp(`\\b${rootName}\\??\\.(\\w+)`, "g"))].map((m) => m[1]),
  );
  for (const m of src.matchAll(new RegExp(`(?:const|let)\\s*\\{([^}]*)\\}\\s*=\\s*${rootName}\\b`, "g"))) {
    for (const part of m[1].split(",")) {
      const name = part.split(":")[0].split("=")[0].trim();
      if (name) out.add(name);
    }
  }
  return out;
}

function collect(
  component: string,
  rootName: string,
  files: Map<string, string>,
  seen = new Set<string>(),
): Set<string> {
  if (seen.has(component)) return new Set();
  seen.add(component);
  const file = files.get(component);
  if (!file) return new Set();
  const src = fs.readFileSync(file, "utf-8");
  const out = readsOf(src, rootName);
  // Délégation locale : une carte racine peut déléguer à sa feuille.
  for (const m of src.matchAll(/import\s+(?:\{\s*)?(\w+)[^;]*from "\.[^"]*"/g)) {
    if (/^(Card|Preview)/.test(m[1])) for (const o of collect(m[1], rootName, files, seen)) out.add(o);
  }
  return out;
}

export interface PresenterEntry {
  /** Valeur de config (`card.type` / `preview.type`). */
  type: string;
  component: string;
  /** Options que le composant lit réellement. */
  options: string[];
  /** Le dispatcheur transmet-il le bloc de config au composant ? */
  receivesConfig: boolean;
}

function dispatchTable(root: string, file: string, rootName: string, files: Map<string, string>): PresenterEntry[] {
  const src = fs.readFileSync(path.join(root, COMPONENTS_DIR, file), "utf-8");
  const out: PresenterEntry[] = [];
  // Capture jusqu'au `/>` fermant : la liste de props peut contenir des `/`
  // (casts `import("@communecter/…")`) et s'étaler sur plusieurs lignes.
  for (const m of src.matchAll(/case "([\w-]+)":\s*(?:\n\s*)?return <(\w+)([\s\S]*?)\/>/g)) {
    const [, type, component, propsSrc] = m;
    out.push({
      type,
      component,
      options: [...collect(component, rootName, files)].filter((o) => o !== "type" && o !== "variant").sort(),
      receivesConfig: new RegExp(`\\b${rootName}=`).test(propsSrc),
    });
  }
  return out;
}

export interface PresenterMatrix {
  cards: PresenterEntry[];
  previews: PresenterEntry[];
  /** Options lues quelque part dans le module search (pas seulement par un presenter). */
  cardOptionsUsedAnywhere: Set<string>;
}

export function presenterMatrix(root: string): PresenterMatrix {
  const files = componentFiles(root);
  const anywhere = new Set<string>();
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name) && !e.name.includes(".test."))
        for (const o of readsOf(fs.readFileSync(full, "utf-8"), "card")) anywhere.add(o);
    }
  };
  walk(path.join(root, SEARCH_MODULE));
  return {
    cards: dispatchTable(root, "SearchCard.tsx", "card", files),
    previews: dispatchTable(root, "Preview.tsx", "preview", files),
    cardOptionsUsedAnywhere: anywhere,
  };
}

/** `option → types qui l'honorent`, pour impression en commentaire de dump. */
export function optionIndex(entries: PresenterEntry[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of entries) for (const o of e.options) out.set(o, [...(out.get(o) ?? []), e.type]);
  return new Map([...out].sort(([a], [b]) => a.localeCompare(b)));
}
