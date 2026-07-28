/**
 * Préflight des règles de rendu PAR ITEM (`list.itemRules`) de toutes les configs de site.
 *
 * Ce fichier est le SEUL endroit où `ListItemRuleSchema` est réellement exécuté : la config JSON
 * n'est jamais parsée par Zod au runtime. Sans ces tests, une règle mal orthographiée, mal ordonnée,
 * testant un champ non projeté ou pointant un presenter sans son contrat ne produit AUCUNE erreur —
 * juste un rendu qui retombe silencieusement sur la carte par défaut.
 */
import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ListItemRuleSchema, type ListConf, type ListItemRule } from "@/modules/search/schema";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const sites: { slug: string; config: string }[] = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "sites.json"), "utf-8"),
);

/** Champs SYNTHÉTIQUES fournis par `entityMatchData` — jamais à projeter (cf. src/lib/entityMatch.ts). */
const SYNTHETIC_FIELDS = new Set(["collection", "sourceKey", "sourceKeys"]);

interface RuleSet {
  path: string;
  rules: ListItemRule[];
  /** Le bloc `list` qui porte les règles — sert de base à la fusion. */
  list: ListConf;
  /** `baseParams.defaultFields` de la section sœur, `undefined` si non déclaré. */
  defaultFields?: string[];
}

function readDefaultFields(parent: Record<string, unknown> | undefined): string[] | undefined {
  const bp = parent?.baseParams as Record<string, unknown> | undefined;
  const fields = bp?.defaultFields;
  return Array.isArray(fields) && fields.length > 0 ? (fields as string[]) : undefined;
}

/** Toutes les listes portant des `itemRules`, où qu'elles soient dans l'arbre de config. */
function collectRuleSets(
  node: unknown,
  trail: string,
  parent: Record<string, unknown> | undefined,
  out: RuleSet[] = [],
): RuleSet[] {
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectRuleSets(v, `${trail}[${i}]`, parent, out));
    return out;
  }
  if (!node || typeof node !== "object") return out;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.itemRules)) {
    out.push({
      path: `${trail}.itemRules`,
      rules: obj.itemRules as ListItemRule[],
      list: obj as ListConf,
      defaultFields: readDefaultFields(parent),
    });
  }
  // `obj` devient le parent de ses enfants : c'est ainsi qu'un bloc `list` retrouve
  // le `baseParams` de la même section (tous deux enfants de `props`).
  for (const [k, v] of Object.entries(obj)) collectRuleSets(v, `${trail}.${k}`, obj, out);
  return out;
}

/** Champs référencés par un prédicat (chemins complets, dot-paths inclus). */
function fieldsOf(pred: unknown, out: Set<string> = new Set()): Set<string> {
  if (!pred || typeof pred !== "object") return out;
  const p = pred as Record<string, unknown>;
  if (typeof p.field === "string") out.add(p.field);
  for (const branch of [p.and, p.or]) if (Array.isArray(branch)) branch.forEach((b) => fieldsOf(b, out));
  if (p.not) fieldsOf(p.not, out);
  return out;
}

/** Presenter EFFECTIF d'une règle — `card`/`preview` sont fusionnés sur la base (cf. resolveListItemConf). */
function effectivePresenters(rule: ListItemRule, list: ListConf): { card?: string; preview?: string } {
  const card = { ...list.card, ...rule.card };
  const preview = { ...list.preview, ...rule.preview };
  return { card: card.variant || card.type, preview: preview.type };
}

const configs = [...new Set(sites.map((s) => s.config))]
  .map((file) => ({ file, abs: path.resolve(PROJECT_ROOT, file) }))
  .filter(({ abs }) => fs.existsSync(abs))
  .map(({ file, abs }) => ({
    file,
    ruleSets: collectRuleSets(JSON.parse(fs.readFileSync(abs, "utf-8")), "config", undefined),
  }))
  .filter(({ ruleSets }) => ruleSets.length > 0);

describe("Preflight — list.itemRules", () => {
  if (configs.length === 0) {
    test("aucune config n'utilise itemRules (rien à vérifier)", () => expect(true).toBe(true));
  }

  for (const { file, ruleSets } of configs) {
    describe(file, () => {
      for (const { path: where, rules, list, defaultFields } of ruleSets) {
        const label = (i: number) => `${where}[${i}] (${rules[i].id ?? "sans id"})`;

        test(`${where} — chaque règle est conforme au schéma`, () => {
          rules.forEach((rule, i) => {
            const parsed = ListItemRuleSchema.safeParse(rule);
            expect(parsed.success, `${label(i)} : ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
          });
        });

        test(`${where} — chaque règle produit au moins une surcharge`, () => {
          rules.forEach((rule, i) => {
            const effective = rule.card || rule.preview || rule.testimonial || rule.resource || rule.itemAction;
            expect(effective, `${label(i)} : règle sans effet`).toBeTruthy();
          });
        });

        test(`${where} — une règle sans \`when\` (catch-all) est la DERNIÈRE`, () => {
          const idx = rules.findIndex((r) => r.when === undefined);
          if (idx !== -1) {
            expect(idx, `${where}[${idx}] : catch-all placé avant d'autres règles → il les masque toutes`).toBe(
              rules.length - 1,
            );
          }
        });

        test(`${where} — les \`id\` de règles sont uniques`, () => {
          const ids = rules.map((r) => r.id).filter(Boolean) as string[];
          expect(ids.length - new Set(ids).size, `${where} : id de règle dupliqué`).toBe(0);
        });

        test(`${where} — toute règle testant \`type\` ancre aussi \`collection\``, () => {
          // `serverData.type` a deux sémantiques (sous-type POI vs sous-type d'organisation) :
          // sans ancrage sur `collection`, une règle POI attrape aussi les organisations.
          rules.forEach((rule, i) => {
            const fields = fieldsOf(rule.when);
            if (fields.has("type")) {
              expect(fields.has("collection"), `${label(i)} : teste \`type\` sans \`collection\``).toBe(true);
            }
          });
        });

        // ── Invariant : PROJECTION ────────────────────────────────────────────
        // Un champ absent de `defaultFields` vaut `undefined` au runtime : la règle ne matche
        // JAMAIS, sans la moindre erreur. Seul un `console.warn` DEV le signale aujourd'hui.
        test(`${where} — les champs testés sont projetés par baseParams.defaultFields`, () => {
          if (!defaultFields) return; // pas de projection déclarée → jeu par défaut du backend
          const projected = new Set(defaultFields);
          rules.forEach((rule, i) => {
            const missing = [...fieldsOf(rule.when)]
              .map((f) => f.split(".")[0])
              .filter((root) => !SYNTHETIC_FIELDS.has(root) && !projected.has(root));
            expect(
              [...new Set(missing)],
              `${label(i)} : champ(s) testé(s) hors defaultFields → la règle ne matchera jamais`,
            ).toEqual([]);
          });
        });

        // ── Invariant : CONTRAT DE PRESENTER ──────────────────────────────────
        // `testimonial`/`resource` REMPLACENT (jamais de fusion) : une règle qui bascule sur l'un
        // de ces presenters sans porter ni hériter son bloc rend les défauts génériques, en silence.
        test(`${where} — un presenter typé dispose de son contrat (porté ou hérité)`, () => {
          rules.forEach((rule, i) => {
            const { card, preview } = effectivePresenters(rule, list);
            for (const family of ["testimonial", "resource"] as const) {
              if (card !== family && preview !== family) continue;
              const contract = rule[family] ?? list[family];
              expect(
                contract,
                `${label(i)} : presenter « ${family} » sans bloc \`${family}\` (ni dans la règle, ni sur la liste)`,
              ).toBeTruthy();
            }
          });
        });

        // ── Invariant : ACTION EXPLOITABLE ────────────────────────────────────
        test(`${where} — une action \`link\` porte un gabarit`, () => {
          rules.forEach((rule, i) => {
            const action = rule.itemAction ?? list.itemAction;
            if (action?.kind !== "link") return;
            expect(
              Boolean(action.to || action.toById),
              `${label(i)} : kind "link" sans \`to\` ni \`toById\` → aucune navigation possible`,
            ).toBe(true);
          });
        });
      }
    });
  }
});
