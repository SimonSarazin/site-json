/**
 * Préflight — contrat de la carte « équipe » de la section `member`.
 *
 * `card.rattachement` est OBLIGATOIRE dès que `card.type: "team"` : le module `profil` ne code
 * aucune convention de repli (il est générique), et à l'exécution `exigerConvention` fait échouer
 * la section. Ce gate attrape l'oubli AVANT le rendu, avec le MÊME contrat (`{slug}`, préfixe
 * `--…`). Il refuse aussi l'ancienne prop `territoire` (filtre client sur une liste paginée),
 * remplacée par `filters` (serveur) + `fields` (projection).
 *
 * Périmètre : toutes les configs qu'un serveur peut charger — `config.prod*.json`, `config.dev.json`,
 * `site-config.json`, et la config pointée par `SITE_CONFIG_PATH` si elle est posée — les mêmes
 * que la résolution à 3 niveaux des serveurs. Une SECTION est un objet `type: "member"` porteur
 * d'un `props` objet, où qu'il soit (rangée `gridLayout`, `leftSection`…) ; un champ de formulaire
 * qui s'appellerait `member` sans `props` n'est pas compté.
 *
 * parent62 : le filtre serveur est une ÉGALITÉ Mongo — chaque `filters.territoires` doit être,
 * lettre pour lettre, un `label` du référentiel `src/data/territoires62.ts` (« valeur EXACTE
 * stockée en base »). Sans ce gate, une faute de config masquerait un coordonnateur sans bruit.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { TERRITOIRES_62 } from "@/data/territoires62";

const ROOT = path.resolve(__dirname, "../..");

interface MemberProps {
  territoire?: unknown;
  filters?: unknown;
  fields?: unknown;
  card?: { type?: string; rattachement?: { cheminGabarit?: unknown; prefixeCouleur?: unknown } };
}
interface MemberFound { file: string; page: string; id: string; props: MemberProps }

function collect(node: unknown, file: string, page: string, out: MemberFound[]): void {
  if (Array.isArray(node)) { for (const v of node) collect(v, file, page, out); return; }
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (o.type === "member" && o.props && typeof o.props === "object" && !Array.isArray(o.props)) {
    out.push({ file, page, id: String(o.id ?? "?"), props: o.props as MemberProps });
  }
  for (const v of Object.values(o)) collect(v, file, page, out);
}

const candidats = [
  ...fs.readdirSync(ROOT).filter((f) => /^config\.prod.*\.json$/.test(f)).map((f) => path.join(ROOT, f)),
  path.join(ROOT, "config.dev.json"),
  path.join(ROOT, "site-config.json"),
  ...(process.env.SITE_CONFIG_PATH ? [path.resolve(ROOT, process.env.SITE_CONFIG_PATH)] : []),
];
const fichiers = [...new Set(candidats)].filter((f) => fs.existsSync(f)).sort();

const sections: MemberFound[] = [];
for (const fichier of fichiers) {
  const cfg = JSON.parse(fs.readFileSync(fichier, "utf8")) as { pages?: Array<{ path?: string; sections?: unknown }> };
  for (const pg of cfg.pages ?? []) collect(pg.sections, path.basename(fichier), String(pg.path ?? "?"), sections);
}
const team = sections.filter((s) => s.props.card?.type === "team");
const LABELS_62 = new Set(TERRITOIRES_62.map((t) => t.label));

describe("preflight — section member, carte « équipe »", () => {
  it("sentinelle d'énumération : au moins une config porte une carte « équipe »", () => {
    expect(fichiers.length).toBeGreaterThan(0);
    expect(team.length).toBeGreaterThan(0);
  });

  it("aucune section member n'utilise plus `territoire` (filtre client retiré)", () => {
    const fautifs = sections.filter((s) => s.props.territoire !== undefined).map((s) => `${s.file} ${s.page} #${s.id}`);
    expect(fautifs).toEqual([]);
  });

  for (const s of team) {
    it(`${s.file} ${s.page} #${s.id} — card.rattachement complet (même contrat qu'exigerConvention)`, () => {
      const r = s.props.card?.rattachement;
      expect(r, "card.rattachement manquant").toBeDefined();
      expect(typeof r?.cheminGabarit).toBe("string");
      expect(String(r?.cheminGabarit)).toContain("{slug}");
      expect(String(r?.prefixeCouleur)).toMatch(/^--[a-z][a-z0-9-]*$/);
    });

    it(`${s.file} ${s.page} #${s.id} — filters/fields bien typés`, () => {
      if (s.props.filters !== undefined) {
        expect(s.props.filters && typeof s.props.filters === "object" && !Array.isArray(s.props.filters)).toBe(true);
        expect(Object.keys(s.props.filters as object).length).toBeGreaterThan(0);
      }
      if (s.props.fields !== undefined) {
        expect(Array.isArray(s.props.fields)).toBe(true);
        for (const f of s.props.fields as unknown[]) expect(typeof f).toBe("string");
      }
    });
  }

  describe("parent62 — `filters.territoires` = un label EXACT du référentiel", () => {
    const p62 = sections.filter((s) => s.file === "config.prod.parent62.json" && s.props.filters && typeof s.props.filters === "object");
    it("sentinelle : les pages territoire filtrent bien sur `territoires`", () => {
      expect(p62.filter((s) => (s.props.filters as Record<string, unknown>).territoires !== undefined).length).toBe(9);
    });
    for (const s of p62) {
      const valeur = (s.props.filters as Record<string, unknown>).territoires;
      if (valeur === undefined) continue;
      it(`${s.page} #${s.id} — "${String(valeur)}" est un label de territoires62.ts`, () => {
        expect(LABELS_62.has(String(valeur)), `valeur inconnue : ${JSON.stringify(valeur)}`).toBe(true);
      });
    }
  });
});
