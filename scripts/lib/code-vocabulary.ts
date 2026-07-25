/**
 * Vocabulaires que la CONFIG doit respecter, DÉRIVÉS du code qui les résout —
 * jamais recopiés (une constante recopiée dérive : cf. lib/module-routes.ts).
 *
 * Utilisés par `audit:config` pour détecter les références qui échouent EN
 * SILENCE : une modale inconnue rend `null` (ModalRegistry.tsx:49 se contente
 * d'un console.log), une icône lucide inconnue rend `null` depuis un
 * `useEffect` (donc rien en SSR, aucune trace visible).
 */
import fs from "node:fs";
import path from "node:path";

const MODAL_REGISTRIES = [
  "src/modules/profil/components/add/ModalRegistry.tsx",
  "src/modules/profil/components/profile-edit/EditModalRegistry.tsx",
];

/** Modales BUILTIN : clés littérales des deux registres (`add-poi`, `edit-profile`…). */
export function builtinModalNames(root: string): string[] {
  const out = new Set<string>();
  for (const rel of MODAL_REGISTRIES) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    for (const m of fs.readFileSync(file, "utf-8").matchAll(/"((?:add|edit)-[a-z0-9-]+)":\s*\(\)/g))
      out.add(m[1]);
  }
  return [...out].sort();
}

/**
 * Costums enregistrés EN DUR (TypeScript) : `add-<id>` / `edit-<id>` y résolvent
 * aussi, en plus des `config.costumForms` du JSON. L'id EST le nom du dossier
 * (cf. le commentaire « id = identité costum » des deux registres).
 */
export function tsCostumIds(root: string): string[] {
  const dir = path.join(root, "src/modules/profil/forms/costum");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("__"))
    .map((d) => d.name)
    .sort();
}

/**
 * Tokens de couleur qu'un CSS de site expose à Tailwind (`@theme inline` :
 * `--color-x: var(--x)`). Sans ce mapping, un token pourtant injecté au runtime
 * par SiteTheme reste INATTEIGNABLE par une classe `bg-x`/`text-x`.
 */
export function mappedColorTokens(root: string, cssName: string): Set<string> {
  const file = path.join(root, "src", `${cssName}.css`);
  if (!fs.existsSync(file)) return new Set();
  return new Set(
    [...fs.readFileSync(file, "utf-8").matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  );
}

/**
 * Tokens réellement invoqués par une classe utilitaire dans le code source
 * (`bg-warning`, `text-success`…). Sert à ne signaler un token non mappé que
 * s'il a un consommateur — sinon le constat serait théorique.
 */
export function colorTokensUsedInCode(root: string): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name) && !e.name.includes(".test."))
        for (const m of fs
          .readFileSync(full, "utf-8")
          .matchAll(/\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(warning|success|info|error)(?:-foreground)?\b/g))
          out.add(m[1]);
    }
  };
  walk(path.join(root, "src"));
  return out;
}

/**
 * Noms d'icônes lucide valides (1901) — un fichier par icône dans le paquet.
 * Retourne un Set VIDE si lucide est absent : l'appelant doit alors sauter le
 * contrôle plutôt que tout flaguer.
 */
export function lucideIconNames(root: string): Set<string> {
  const dir = path.join(root, "node_modules/lucide-react/dist/esm/icons");
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".js"))
      .map((f) => f.slice(0, -3)),
  );
}
