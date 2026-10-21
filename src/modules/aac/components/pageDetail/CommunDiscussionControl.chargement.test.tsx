// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CocolightContext, type CocolightContextType } from "@/contexts/CocolightContext";
import { LocalizationProvider } from "@/contexts/LocalizationProvider";
import "../../i18n";

/**
 * Ce que COÛTE le bouton « Discussion » à une fiche qu'on ne fait que lire : de quoi compter et
 * ouvrir, et rien du fil — ni composant, ni libellés, ni styles. La modale n'arrive qu'à
 * l'ouverture, ou quand on vise le bouton.
 *
 * Deux preuves, parce qu'aucune ne suffit seule :
 *   - à l'exécution : le fichier de la modale n'est pas importé tant qu'on n'a ni survolé ni ouvert.
 *     Elle ne dit rien d'une AUTRE pièce lourde que le bouton importerait directement ;
 *   - à la lecture : le graphe des imports statiques de l'entrée légère, suivi fichier par fichier.
 *
 * Un fichier à part, et c'est voulu : un module ne se charge qu'une fois par fichier de test — la
 * première preuve ne vaut qu'avant toute ouverture.
 */

const modale = vi.hoisted(() => ({ chargements: 0, prechauffages: 0, echec: false }));

// Le VRAI `lazy` de `vite-preload`, dont on compte les appels à `preload()` — et qu'on peut faire
// échouer : le morceau qui n'arrive pas (hors ligne, disparu après un déploiement).
vi.mock("vite-preload", async importOriginal => {
  const reel = await importOriginal<typeof import("vite-preload")>();
  const lazy: typeof reel.lazy = factory => {
    const composant = reel.lazy(factory);
    const prechauffer = composant.preload;
    composant.preload = () => {
      modale.prechauffages += 1;
      return modale.echec ? Promise.reject(new Error("morceau introuvable")) : prechauffer();
    };
    return composant;
  };
  return { ...reel, lazy };
});

// Le flux temps réel est une frontière (une connexion au hub) ; le reste de l'entrée légère est le vrai.
vi.mock("@/modules/comment/hooks/useDiscussionsRealtime", () => ({ useDiscussionsRealtime: () => "degrade" }));
vi.mock("@/modules/comment/components/panel/SpaceModal", () => {
  // La modale et tout ce qu'elle tire : le fil, le composer, le rendu markdown. La fabrique ne
  // s'exécute qu'au premier import — un import statique dans le bouton la déclencherait dès le
  // chargement de la fiche.
  modale.chargements += 1;
  return { default: () => <div data-testid="space-modal" /> };
});

const { CommunDiscussionControl } = await import("./CommunDiscussionControl");

const COMMUN = "65c3000000000000000000c1";
const APPEL = "65c3000000000000000000f1";

const ESPACE = {
  result: true,
  space: { type: "answers", id: COMMUN, title: "Titre du serveur", formId: APPEL },
  canComment: false,
  truncated: false,
  threads: [
    { key: `answers:${COMMUN}`, contextType: "answers", contextId: COMMUN, path: null, total: 5, unread: 0, last: 1_758_000_000, mine: false, title: null, carrier: null, virtual: false, kind: "general", group: null, audience: null },
  ],
};

/** La fiche, réduite à son bouton — et le bouton, une fois son compteur arrivé. */
async function monterLaFiche(): Promise<HTMLElement> {
  const cocolight = { api: { discussions: { space: vi.fn(async () => ESPACE) } }, me: null, entity: null, helper: {} } as unknown as CocolightContextType;
  render(
    <MemoryRouter initialEntries={[`/aac/commun/${COMMUN}`]}>
      <QueryClientProvider client={new QueryClient()}>
        <CocolightContext.Provider value={cocolight}>
          <LocalizationProvider>
            <CommunDiscussionControl answerId={COMMUN} communTitle="Une instance peertube" />
          </LocalizationProvider>
        </CocolightContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  await waitFor(() => expect(document.querySelector("[data-commun-discussion-total]")).toBeTruthy());
  return screen.getByRole("button", { name: /Discussion/ });
}

describe("le code de la modale", () => {
  it("n'arrive ni avec la fiche ni avec le compteur : au survol du bouton, et sans la monter", async () => {
    const bouton = await monterLaFiche();
    await waitFor(() => expect(document.querySelector("[data-commun-discussion-total]")).toBeTruthy());
    // La fiche est affichée, son compteur aussi : le fil n'est pas le prix d'une fiche qu'on lit.
    expect(screen.queryByTestId("space-modal")).toBeNull();
    expect(modale.chargements).toBe(0);

    fireEvent.mouseEnter(bouton);
    expect(modale.prechauffages).toBe(1);
    // Viser le bouton suffit à le faire venir : au clic, la modale n'attend pas.
    await waitFor(() => expect(modale.chargements).toBe(1));
    expect(screen.queryByTestId("space-modal")).toBeNull();
    // Préchauffer n'est pas attendre : le bouton ne se dit pas occupé pour autant.
    expect(bouton.hasAttribute("aria-busy")).toBe(false);
  });

  it("un préchauffage qui échoue ne laisse pas de rejet orphelin : l'import sera retenté à l'ouverture", async () => {
    const orphelins: unknown[] = [];
    const noter = (raison: unknown) => { orphelins.push(raison); };
    process.on("unhandledRejection", noter);
    modale.echec = true;
    try {
      const bouton = await monterLaFiche();
      fireEvent.focus(bouton);
      expect(modale.prechauffages).toBeGreaterThan(0);
      // Un rejet resté sans suite se signale une fois la file de microtâches vidée.
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(orphelins).toEqual([]);
    } finally {
      modale.echec = false;
      process.off("unhandledRejection", noter);
    }
  });
});

/**
 * Le graphe des imports STATIQUES, lu dans les sources. Un import de type ne compte pas (il ne
 * laisse rien dans le code livré) ; un `import()` non plus — c'est précisément le différé.
 */
describe("le graphe de l'entrée légère", () => {
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
  const MODULE = path.join(SRC, "modules/comment");
  const relatif = (fichier: string) => path.relative(SRC, fichier).split(path.sep).join("/");

  /** Les modules qu'un fichier importe pour de bon : `import … from`, `import "…"`, `export … from`. */
  function importsDe(fichier: string): string[] {
    const source = ts.createSourceFile(fichier, readFileSync(fichier, "utf8"), ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
    const out: string[] = [];
    for (const instruction of source.statements) {
      if (ts.isImportDeclaration(instruction) && !instruction.importClause?.isTypeOnly) {
        out.push((instruction.moduleSpecifier as ts.StringLiteral).text);
      }
      if (ts.isExportDeclaration(instruction) && instruction.moduleSpecifier && !instruction.isTypeOnly) {
        out.push((instruction.moduleSpecifier as ts.StringLiteral).text);
      }
    }
    return out;
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

  /** Tout ce que `entree` charge du module `comment`, de proche en proche. */
  function graphe(entree: string): string[] {
    const vus = new Set<string>();
    const aVoir = [entree];
    while (aVoir.length > 0) {
      const fichier = aVoir.pop()!;
      if (vus.has(fichier)) continue;
      vus.add(fichier);
      // Une feuille de style ou un JSON ne se lisent pas comme du code : ils comptent, sans suite.
      if (!/\.tsx?$/.test(fichier)) continue;
      for (const importe of importsDe(fichier)) {
        const cible = fichierDe(fichier, importe);
        if (cible !== null && cible.startsWith(MODULE + path.sep)) aVoir.push(cible);
      }
    }
    return [...vus].map(relatif).sort();
  }

  const leger = graphe(path.join(MODULE, "launch.ts"));

  it("porte de quoi compter et ouvrir", () => {
    expect(leger).toContain("modules/comment/hooks/useSpaceLauncher.ts");
    expect(leger).toContain("modules/comment/hooks/useDiscussionSpaceQuery.ts");
    expect(leger).toContain("modules/comment/lib/space.ts");
  });

  // Un seul composant, l'HÔTE de la modale : il ne la monte que par un import différé (`lib/spaceModalChunk`),
  // et ne tire lui-même aucun autre composant (vérifié ci-dessous).
  const HOTE = "modules/comment/components/panel/SpaceModalHost.tsx";

  it("ne tire AUCUN composant — ni le fil, ni le composer, ni les panneaux — hormis l'hôte de la modale", () => {
    expect(leger.filter(fichier => fichier.includes("/components/"))).toEqual([HOTE]);
    const tireParLHote = importsDe(path.join(SRC, HOTE))
      .map(importe => fichierDe(path.join(SRC, HOTE), importe))
      .filter((cible): cible is string => cible !== null)
      .map(relatif);
    expect(tireParLHote.filter(fichier => fichier.includes("/components/"))).toEqual([]);
  });

  it("ni les libellés, ni les styles, ni l'entrée complète du module", () => {
    expect(leger.filter(fichier => /\/i18n(\/|\.ts$)|\.css$|\.json$/.test(fichier))).toEqual([]);
    expect(leger).not.toContain("modules/comment/index.ts");
  });

  it("reste petit — une quinzaine de fichiers, pas le module entier", () => {
    // Un garde-fou grossier, à relever en conscience : il dit que des pièces de plus sont entrées
    // (onze fichiers le 12/10, quand la modale en tire cinquante-huit). Seize le 14/10 : l'hôte de la
    // modale et ses trois aides — registre des hôtes, morceau différé, nom des boutons — y sont entrés,
    // pour que la fiche et le formulaire d'une question partagent UNE modale.
    expect(leger.length).toBeLessThanOrEqual(16);
  });

  const FICHE = path.join(SRC, "modules/aac/components/pageDetail");
  const duModule = (fichier: string) => importsDe(path.join(FICHE, fichier)).filter(importe => importe.startsWith("@/modules/comment"));

  it.each(["CommunDiscussionControl.tsx", "CommunMilestoneDiscussionButton.tsx"])(
    "%s ne prend du module QUE cette entrée", fichier => {
      expect(duModule(fichier)).toEqual(["@/modules/comment/launch"]);
    });

  it("la modale, elle, n'arrive que par l'import différé de l'hôte — partagé par la fiche et ses boutons", () => {
    expect(leger).not.toContain("modules/comment/components/panel/SpaceModal.tsx");
    expect(readFileSync(path.join(SRC, "modules/comment/lib/spaceModalChunk.ts"), "utf8"))
      .toContain('lazy(() => import("../components/panel/SpaceModal"))');
    expect(duModule("communDiscussion.ts")).toEqual(["@/modules/comment/launch"]);
    for (const fichier of ["CommunDiscussionControl.tsx", "CommunMilestoneDiscussionButton.tsx"]) {
      expect(importsDe(path.join(FICHE, fichier))).toContain("./communDiscussion");
    }
  });
});
