import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import { walkSections, type SectionLike } from "@/lib/sectionContainers";
import { answerGroupFieldPath, type AnswerGroupConf } from "@/modules/search/lib/answerFilterClause";

/**
 * GARDE DES FACETTES « PAR RÉPONSES ».
 *
 * Les groupes `filtersByAnswers` / `filtersByPath` ont deux cibles possibles
 * (`filterTarget`) et se trompent EN SILENCE : une facette mal ciblée s'affiche
 * normalement, avec ses options, et vide simplement la liste au clic. C'est le
 * défaut qui a coûté trois jours sur `/creneaux` (La Tampon) — filtrage par `_id`
 * d'organisation sur une liste qui porte les réponses elles-mêmes.
 *
 * Deux règles, toutes deux statiques :
 *  1. `filterTarget: "answers"` sans chemin = no-op silencieux (retombe sur `_id`) ;
 *  2. dans un `gridLayout`, si la liste sœur porte `defaultTypes: ["answers"]`, les
 *     groupes de la colonne de filtres DOIVENT cibler les answers.
 *
 * La règle 2 est délibérément portée par la GARDE et non par le runtime : lire la
 * section sœur est légitime pour un contrôle qui voit toute la config, mais en ferait
 * un couplage entre colonnes d'un conteneur de mise en page côté app.
 *
 * Limite assumée : la règle 2 ne couvre que le `gridLayout` (filtres + liste dans le
 * même conteneur). Un hero portant des facettes pour une liste sœur de la page n'est
 * pas apparié — aucun cas du parc aujourd'hui.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const SITES = readdirSync(ROOT)
  .filter((f) => /^config\.prod\..+\.json$/.test(f))
  .sort()
  .map((f) => ({
    site: f.replace(/^config\.prod\./, "").replace(/\.json$/, ""),
    cfg: JSON.parse(readFileSync(join(ROOT, f), "utf8")) as {
      pages?: Array<{ path?: string; sections?: SectionLike[] }>;
    },
  }));

type Props = {
  filtersByAnswers?: Record<string, AnswerGroupConf>;
  filtersByPath?: Record<string, AnswerGroupConf>;
  baseParams?: { defaultTypes?: string[] };
  leftSection?: SectionLike;
  rightSection?: SectionLike;
};

const groupesDe = (section: SectionLike | undefined): Record<string, AnswerGroupConf> => {
  const p = (section?.props ?? {}) as Props;
  return { ...(p.filtersByAnswers ?? {}), ...(p.filtersByPath ?? {}) };
};

/** Toutes les déclarations du parc, à plat : `<site> <page>/<groupe>`. */
function declarations() {
  const out: Array<{ ref: string; conf: AnswerGroupConf }> = [];
  for (const { site, cfg } of SITES) {
    for (const page of cfg.pages ?? []) {
      for (const section of walkSections(page.sections ?? [])) {
        for (const [id, conf] of Object.entries(groupesDe(section))) {
          out.push({ ref: `${site} ${page.path ?? "?"}/${id}`, conf });
        }
      }
    }
  }
  return out;
}

/** Colonnes d'un `gridLayout` : groupes déclarés d'un côté, `defaultTypes` de l'autre. */
function grilles() {
  const out: Array<{ ref: string; groupes: Record<string, AnswerGroupConf>; types: string[] }> = [];
  for (const { site, cfg } of SITES) {
    for (const page of cfg.pages ?? []) {
      for (const section of walkSections(page.sections ?? [])) {
        if (section.type !== "gridLayout") continue;
        const p = (section.props ?? {}) as Props;
        const colonnes = [p.leftSection, p.rightSection];
        const groupes = Object.assign({}, ...colonnes.map(groupesDe)) as Record<string, AnswerGroupConf>;
        if (Object.keys(groupes).length === 0) continue;
        const types = colonnes.flatMap(
          (c) => ((c?.props ?? {}) as Props).baseParams?.defaultTypes ?? [],
        );
        out.push({ ref: `${site} ${page.path ?? "?"}`, groupes, types });
      }
    }
  }
  return out;
}

describe("facettes « par réponses » (garde de cible)", () => {
  it("le parc déclare bien des groupes — sinon la garde ne garde rien", () => {
    expect(declarations().length).toBeGreaterThan(0);
  });

  it("`filterTarget: \"answers\"` exige un `path`/`thematicPath` exploitable", () => {
    const muets = declarations()
      .filter(({ conf }) => conf.filterTarget === "answers" && !answerGroupFieldPath(conf))
      .map(({ ref }) => ref);
    expect(muets, "groupes ciblant les answers sans chemin (filtre silencieusement ignoré)").toEqual([]);
  });

  it("une liste d'`answers` impose des facettes ciblant les answers", () => {
    const mal = grilles()
      .filter(({ types }) => types.includes("answers"))
      .flatMap(({ ref, groupes }) =>
        Object.entries(groupes)
          .filter(([, conf]) => conf.filterTarget !== "answers")
          .map(([id]) => `${ref}/${id}`),
      );
    expect(mal, "facettes filtrant par _id d'élément lié sur une liste de réponses (résultat toujours vide)").toEqual([]);
  });

  it("hors liste d'`answers`, la cible historique reste le défaut (aucune migration forcée)", () => {
    const forces = grilles()
      .filter(({ types }) => types.length > 0 && !types.includes("answers"))
      .flatMap(({ ref, groupes }) =>
        Object.entries(groupes)
          .filter(([, conf]) => conf.filterTarget === "answers")
          .map(([id]) => `${ref}/${id}`),
      );
    expect(forces, "groupes ciblant les answers sur une liste qui n'en porte pas").toEqual([]);
  });
});
