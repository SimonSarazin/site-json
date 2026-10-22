import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * Ce que COÛTE l'éditeur à une page qui ne fait que lire : rien.
 *
 * L'éditeur et ce qu'il tire (Tiptap, ProseMirror) ne doivent arriver que par l'import différé du
 * magasin — jamais par un import statique, qui les mettrait dans le démarrage de toute page
 * portant un fil. La preuve se lit dans les sources : le graphe des imports STATIQUES de l'entrée
 * du module, suivi fichier par fichier. Un import de type ne compte pas, il ne survit pas à la
 * compilation.
 */

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MODULE = path.resolve(ICI, "../..");
const SRC = path.resolve(MODULE, "../..");
const LOURD = /^@tiptap\/|^prosemirror-/;

interface Imports {
  readonly statiques: string[];
  readonly differes: string[];
}

function importsDe(fichier: string): Imports {
  const source = ts.createSourceFile(fichier, readFileSync(fichier, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const statiques: string[] = [];
  const differes: string[] = [];
  for (const instruction of source.statements) {
    if (ts.isImportDeclaration(instruction) && !instruction.importClause?.isTypeOnly) {
      statiques.push((instruction.moduleSpecifier as ts.StringLiteral).text);
    }
    if (ts.isExportDeclaration(instruction) && instruction.moduleSpecifier && !instruction.isTypeOnly) {
      statiques.push((instruction.moduleSpecifier as ts.StringLiteral).text);
    }
  }
  const visiter = (noeud: ts.Node) => {
    if (ts.isCallExpression(noeud) && noeud.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [cible] = noeud.arguments;
      if (cible && ts.isStringLiteral(cible)) differes.push(cible.text);
    }
    ts.forEachChild(noeud, visiter);
  };
  visiter(source);
  return { statiques, differes };
}

/** Le fichier du dépôt qu'un import désigne — `null` pour un paquet. */
function fichierDe(depuis: string, importe: string): string | null {
  const base = importe.startsWith("@/") ? path.join(SRC, importe.slice(2))
    : importe.startsWith(".") ? path.resolve(path.dirname(depuis), importe)
    : null;
  if (base === null) return null;
  const candidats = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")];
  return candidats.find(candidat => existsSync(candidat) && statSync(candidat).isFile()) ?? null;
}

/** Tout ce que `entree` charge du dépôt par imports statiques, de proche en proche. */
function graphe(entree: string): string[] {
  const vus = new Set<string>();
  const aVoir = [entree];
  while (aVoir.length > 0) {
    const fichier = aVoir.pop()!;
    if (vus.has(fichier)) continue;
    vus.add(fichier);
    for (const importe of importsDe(fichier).statiques) {
      const cible = fichierDe(fichier, importe);
      // On reste dans le module : ce que le reste du dépôt charge n'est pas la question posée ici.
      if (cible !== null && cible.startsWith(MODULE)) aVoir.push(cible);
    }
  }
  return [...vus].sort();
}

const duModule = (fichier: string) => path.relative(MODULE, fichier);
const lourds = (fichiers: readonly string[]) =>
  fichiers.filter(fichier => importsDe(fichier).statiques.some(importe => LOURD.test(importe))).map(duModule);

describe("le graphe de l'éditeur", () => {
  const entree = graphe(path.join(MODULE, "index.ts"));

  it("l'entrée du module ne charge statiquement ni Tiptap ni ProseMirror", () => {
    expect(entree.length).toBeGreaterThan(30);
    expect(lourds(entree)).toEqual([]);
  });

  it("ni l'éditeur lui-même, ni le pont, ni son schéma", () => {
    const charges = entree.map(duModule);
    for (const piece of ["components/editor/EditorSurface.tsx", "lib/richText/markdownBridge.ts", "lib/richText/extensions.ts"]) {
      expect(charges).not.toContain(piece);
    }
    // La coquille, le magasin et le réglage du rendu, eux, sont là : ce sont eux que le fil emploie.
    for (const piece of ["components/CommentComposer.tsx", "components/editor/editorStore.ts", "lib/markdownEngine.ts", "lib/richText/linkAddress.ts"]) {
      expect(charges).toContain(piece);
    }
  });

  it("l'éditeur n'arrive que par l'import différé du magasin", () => {
    const portes = entree.filter(fichier => importsDe(fichier).differes.some(importe => fichierDe(fichier, importe)?.endsWith("EditorSurface.tsx")));
    expect(portes.map(duModule)).toEqual(["components/editor/editorStore.ts"]);
  });

  it("derrière cette porte, c'est bien lui qui tire Tiptap — la preuve ne passe pas à vide", () => {
    const derriere = graphe(path.join(MODULE, "components/editor/EditorSurface.tsx"));
    expect(lourds(derriere)).toEqual(["components/editor/EditorSurface.tsx", "lib/richText/extensions.ts", "lib/richText/markdownBridge.ts"]);
  });

  it("l'entrée légère des fiches (`launch`) ne tire rien du composer", () => {
    const leger = graphe(path.join(MODULE, "launch.ts")).map(duModule);
    expect(leger.filter(fichier => /editor\/|richText\/|CommentComposer/.test(fichier))).toEqual([]);
  });
});

/**
 * Même preuve, pour la modale de l'ESPACE d'un commun : elle se charge en différé depuis la fiche,
 * et n'a pas à emporter le panneau général, qu'elle ne rend jamais. Le test de `SpaceModal` double
 * son panneau : il ne voit donc que la modale et sa coquille. Ici c'est tout le graphe, panneau
 * compris.
 */
describe("le graphe de la modale de l'espace", () => {
  const modale = graphe(path.join(MODULE, "components/panel/SpaceModal.tsx")).map(duModule);

  it("ne charge ni le panneau général, ni son rail, ni sa modale", () => {
    for (const piece of ["components/panel/DiscussionPanel.tsx", "components/panel/CarrierRail.tsx", "components/panel/DiscussionModal.tsx"]) {
      expect(modale).not.toContain(piece);
    }
  });

  it("charge bien ce qu'elle rend — la preuve ne passe pas à vide", () => {
    for (const piece of ["components/panel/DiscussionModalShell.tsx", "components/panel/SpacePanel.tsx", "components/panel/ThreadColumn.tsx", "components/CommentThread.tsx"]) {
      expect(modale).toContain(piece);
    }
  });
});
