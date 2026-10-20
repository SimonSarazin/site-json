import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { Note } from "../../scripts/lib/gitlab";
import { cheminDepuisRemote } from "../../scripts/lib/gitlab";
import {
  A_REMPLIR,
  blocVerifie,
  configsModifiees,
  extraireRefs,
  fichiersTestsModifies,
  fuiteSecrets,
  marqueur,
  noteExistante,
  nombreDeFichiers,
  parseEnTete,
  permalien,
  prenom,
  rendreNote,
  SECTIONS,
  sections,
  sectionVide,
  verdict,
  verifierRef,
} from "../../scripts/lib/mr-review";

/**
 * Verrouille la partie pure de `scripts/mr-review.ts` (review des MR GitLab).
 *
 * Le piège que ferme chaque groupe : une note de review qui cite une ligne
 * fausse, qui part en double, ou qui embarque une valeur de `.env` — trois
 * accidents déjà évités à la main, codés ici une fois pour toutes.
 */

const WEB = "https://gitlab.adullact.net/pixelhumain/site-json";
const SHA = "7d4fd8eb9c009257cbfc6a56e74fb850593213fe";

const note = (auteurId: number, body: string, system = false): Note =>
  ({ id: 1, body, system, author: { id: auteurId, username: "x", name: "X" }, created_at: "2026-10-07T00:00:00Z" });

describe("mr-review : permaliens et en-tête", () => {
  test("permalien : SHA complet, ancre L ou L-M, pas de double slash", () => {
    expect(permalien(`${WEB}/`, SHA, "src/a.ts", 12)).toBe(`${WEB}/-/blob/${SHA}/src/a.ts#L12`);
    expect(permalien(WEB, SHA, "doc/28-module-formengine.md", 409, 410)).toBe(`${WEB}/-/blob/${SHA}/doc/28-module-formengine.md#L409-410`);
    // Une fin ≤ début n'est pas une plage.
    expect(permalien(WEB, SHA, "a.ts", 5, 5)).toMatch(/#L5$/);
  });

  test("parseEnTete lit le format des notes postées à la main (SHA court ou long)", () => {
    expect(parseEnTete("## Review — MR 76 (`judi-reso-sante`, commit `7d4fd8eb`)\n\nSalut")).toEqual({ iid: 76, branche: "judi-reso-sante", sha: "7d4fd8eb" });
    expect(parseEnTete(`intro\n## Review — MR 7 (\`a/b\`, commit \`${SHA}\`)`)?.sha).toBe(SHA);
    expect(parseEnTete("## Review de la MR 76")).toBeNull();
  });
});

describe("mr-review : références fichier:ligne", () => {
  const corps = `## Review — MR 76 (\`b\`, commit \`${SHA.slice(0, 8)}\`)
1. [\`src/x.ts:42\`](${WEB}/-/blob/${SHA}/src/x.ts#L42) et [\`doc/d.md:3\`](${WEB}/-/blob/${SHA}/doc/d.md#L3-4)
2. une réf nue \`scripts/lib/mr-review.ts:10\` et la même en lien [x](${WEB}/-/blob/${SHA}/src/x.ts#L42)
3. pas une réf : \`14:30\`, \`v1.2:3\`, http://host:8080/x`;

  test("extraireRefs : permaliens et réfs nues, dédoublonnées, sans faux positifs", () => {
    const refs = extraireRefs(corps);
    expect(refs.map((r) => `${r.fichier}:${r.ligne}${r.ligneFin ? `-${r.ligneFin}` : ""}`)).toEqual([
      "src/x.ts:42",
      "doc/d.md:3-4",
      "scripts/lib/mr-review.ts:10",
    ]);
    expect(refs[0].sha).toBe(SHA);
    expect(refs[2].sha).toBeUndefined();
  });

  const arbre = new Map<string, string>([
    [`${SHA}:src/x.ts`, "l1\nl2\n  const x = 42;\n"],
    [`${SHA}:doc/d.md`, "a\nb\nc\nd"],
  ]);
  const lire = (sha: string, f: string) => arbre.get(`${sha}:${f}`) ?? null;

  test("verifierRef : ok rend la ligne source, pour le contrôle visuel", () => {
    expect(verifierRef({ fichier: "src/x.ts", ligne: 3, source: "" }, SHA, lire)).toEqual({ ok: true, ligne: "const x = 42;" });
    expect(verifierRef({ fichier: "doc/d.md", ligne: 3, ligneFin: 4, source: "" }, SHA, lire).ok).toBe(true);
  });

  test("verifierRef : fichier absent, ligne hors fichier (le \\n final ne compte pas), SHA étranger", () => {
    expect(verifierRef({ fichier: "src/y.ts", ligne: 1, source: "" }, SHA, lire).raison).toMatch(/absent/);
    expect(verifierRef({ fichier: "src/x.ts", ligne: 4, source: "" }, SHA, lire).raison).toBe("ligne 4 hors fichier (3 lignes)");
    expect(verifierRef({ fichier: "doc/d.md", ligne: 3, ligneFin: 5, source: "" }, SHA, lire).raison).toMatch(/hors fichier/);
    expect(verifierRef({ fichier: "src/x.ts", ligne: 1, sha: "deadbeef", source: "" }, SHA, lire).raison).toMatch(/SHA deadbeef/);
    // Un SHA court qui préfixe le head est le même commit.
    expect(verifierRef({ fichier: "src/x.ts", ligne: 1, sha: SHA.slice(0, 8), source: "" }, SHA, lire).ok).toBe(true);
  });
});

describe("mr-review : idempotence du POST", () => {
  const moi = 7;
  test("ma note est reconnue par le marqueur OU par l'en-tête (notes d'avant l'outil)", () => {
    const parMarqueur = noteExistante([note(moi, `texte\n${marqueur(SHA)}`)], moi, SHA);
    expect(parMarqueur?.perimee).toBe(false);
    const parEnTete = noteExistante([note(moi, "## Review — MR 76 (`b`, commit `7d4fd8eb`)")], moi, SHA);
    expect(parEnTete?.sha).toBe("7d4fd8eb");
    expect(parEnTete?.perimee).toBe(false);
  });

  test("SHA ancien → périmée ; autre auteur, note système ou sans en-tête → ignorées", () => {
    expect(noteExistante([note(moi, "## Review — MR 76 (`b`, commit `0000000`)")], moi, SHA)?.perimee).toBe(true);
    expect(noteExistante([note(99, `## Review — MR 76 (\`b\`, commit \`${SHA}\`)`)], moi, SHA)).toBeNull();
    expect(noteExistante([note(moi, `## Review — MR 76 (\`b\`, commit \`${SHA}\`)`, true)], moi, SHA)).toBeNull();
    expect(noteExistante([note(moi, "merci, je regarde")], moi, SHA)).toBeNull();
  });

  test("la plus récente gagne (les notes arrivent triées desc)", () => {
    const r = noteExistante([note(moi, `## Review — MR 1 (\`b\`, commit \`${SHA}\`)`), note(moi, "## Review — MR 1 (`b`, commit `0000000`)")], moi, SHA);
    expect(r?.perimee).toBe(false);
  });
});

describe("mr-review : rendu de la note", () => {
  test("rendreNote : substitution stricte, un placeholder inconnu lève", () => {
    expect(rendreNote("MR {{iid}} par {{prenom}}", { iid: "76", prenom: "Judi" })).toBe("MR 76 par Judi");
    expect(() => rendreNote("{{inconnu}}", {})).toThrow(/inconnu/);
  });

  test("blocVerifie : ✓ / ✗ / non exécuté, durées en secondes", () => {
    const md = blocVerifie(
      [
        { nom: "lint", code: 0, dureeMs: 41_400, resume: "propre" },
        { nom: "test:preflight", code: 1, dureeMs: 900, resume: "3 échec(s) sur 120 tests" },
        { nom: "tests", code: null, dureeMs: 0, resume: "aucun fichier de test modifié" },
      ],
      "testé sur 7d4fd8e",
    );
    expect(md.split("\n")).toEqual([
      "_testé sur 7d4fd8e_",
      "- ✓ `lint` — propre — 41 s",
      "- ✗ `test:preflight` — 3 échec(s) sur 120 tests — 1 s",
      "- — tests — non exécuté (aucun fichier de test modifié)",
    ]);
  });

  const noteComplete = (bloquant: string) => `## Review — MR 1 (\`b\`, commit \`7d4fd8e\`)

**Verdict : <!-- verdict -->.**

${SECTIONS.bloquant}

${bloquant}

${SECTIONS.verifier}

— rien

${SECTIONS.nettoyage}

1. du code mort

${SECTIONS.verifie}

- ✓ \`lint\` — 2 s
`;

  test("sections : chaque corps est découpé sur son titre", () => {
    const s = sections(noteComplete("1. perte de données"));
    expect(s[SECTIONS.bloquant]).toBe("1. perte de données");
    expect(s[SECTIONS.verifier]).toBe("— rien");
    expect(s[SECTIONS.verifie]).toMatch(/lint/);
  });

  test("sectionVide : vide, placeholder seul ou « — rien »", () => {
    expect(sectionVide(undefined)).toBe(true);
    expect(sectionVide(A_REMPLIR)).toBe(true);
    expect(sectionVide("— rien à signaler")).toBe(true);
    expect(sectionVide("1. un point")).toBe(false);
  });

  test("verdict dérivé : section 1 remplie OU gate rouge ⇒ bloquant", () => {
    expect(verdict(noteComplete("— rien"), [{ nom: "lint", code: 0, dureeMs: 1 }])).toBe("non bloquant");
    expect(verdict(noteComplete("1. perte de données"), [])).toBe("bloquant");
    expect(verdict(noteComplete("— rien"), [{ nom: "typecheck", code: 2, dureeMs: 1 }])).toBe("bloquant");
    expect(verdict(noteComplete("— rien"), [{ nom: "tests", code: null, dureeMs: 0 }])).toBe("non bloquant");
  });
});

describe("mr-review : divers", () => {
  test("prenom : « NOM Prénom », « Prénom Nom », minuscule, vide", () => {
    expect(prenom("ANGERS Nathan")).toBe("Nathan");
    expect(prenom("Anatole Rakotoson")).toBe("Anatole");
    expect(prenom("judi RAKOTO")).toBe("Judi");
    expect(prenom("")).toBe("");
  });

  test("fichiers de tests et configs du diff", () => {
    const diff = ["src/a.test.tsx", "src/b.ts", "tests/preflight/c.test.ts", "config.prod.rezo-sante-reunion.json", "config.prod.json", "doc/config.prod.x.json"];
    expect(fichiersTestsModifies(diff)).toEqual(["src/a.test.tsx", "tests/preflight/c.test.ts"]);
    expect(configsModifiees(diff)).toEqual(["config.prod.rezo-sante-reunion.json", "config.prod.json"]);
  });

  test("fuiteSecrets : valeur ≥ 12 car. présente → clé rendue ; courtes ignorées", () => {
    const env = { VITE_MAPTILER_API_KEY: "abcdefghijklmnop", PORT: "5173", VITE_SLUG: "parent62" };
    expect(fuiteSecrets("clé abcdefghijklmnop sur 5173 parent62", env)).toEqual(["VITE_MAPTILER_API_KEY"]);
    expect(fuiteSecrets("rien", env)).toEqual([]);
  });

  test("nombreDeFichiers et cheminDepuisRemote", () => {
    expect(nombreDeFichiers("32")).toBe(32);
    expect(nombreDeFichiers("1000+")).toBe(1000);
    expect(nombreDeFichiers(undefined)).toBe(0);
    expect(cheminDepuisRemote("git@gitlab.adullact.net:pixelhumain/site-json.git")).toBe("pixelhumain/site-json");
    expect(cheminDepuisRemote("https://gitlab.adullact.net/pixelhumain/site-json")).toBe("pixelhumain/site-json");
    expect(cheminDepuisRemote("n'importe quoi")).toBeNull();
  });
});

/* ── Anti-dérive : script ↔ skill ↔ template ↔ package.json ─────────────── */

const ROOT = path.resolve(__dirname, "../..");
const lire = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf-8");

describe("mr-review : le skill, le template et le script restent alignés", () => {
  const script = lire("scripts/mr-review.ts");
  const skill = lire(".claude/skills/mr-review/SKILL.md");
  const template = lire(".claude/skills/mr-review/references/note-template.md");

  test("SKILL.md : frontmatter, description « À utiliser dès qu'on », alias npm", () => {
    expect(skill).toMatch(/^---\nname: mr-review\n/);
    expect(skill).toMatch(/À utiliser dès qu'on/);
    expect(skill).toContain("npm run mr:review");
    const pkg = JSON.parse(lire("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts["mr:review"]).toBe("tsx scripts/mr-review.ts");
  });

  test("chaque sous-commande du script est citée dans usage() et dans le skill", () => {
    const m = /const COMMANDES = \[([^\]]+)\]/.exec(script);
    expect(m).not.toBeNull();
    const commandes = [...m![1].matchAll(/"([a-z-]+)"/g)].map((x) => x[1]);
    expect(commandes.length).toBeGreaterThanOrEqual(7);
    const usage = script.slice(script.indexOf("function usage()"), script.indexOf("process.exit(2);"));
    for (const c of commandes) {
      expect(usage, `usage() ne décrit pas ${c}`).toMatch(new RegExp(`^\\s+${c}\\b`, "m"));
      expect(skill, `SKILL.md ne cite pas ${c}`).toMatch(new RegExp(`\\b${c}\\b`));
    }
  });

  test("le template porte l'en-tête, les 4 sections et les placeholders que le script attend", () => {
    expect(template).toMatch(/^## Review — MR \{\{iid\}\} \(`\{\{branche\}\}`, commit `\{\{shaShort\}\}`\)/);
    for (const titre of Object.values(SECTIONS)) expect(template).toContain(`${titre}\n`);
    for (const ph of ["{{prenom}}", "{{verdict}}", "{{verifie}}", "{{cloture}}"]) expect(template).toContain(ph);
    expect(template).toContain(A_REMPLIR);
    // Aucun placeholder que le script ne renseigne pas.
    const attendus = new Set(["iid", "branche", "shaShort", "prenom", "verdict", "verifie", "cloture"]);
    for (const [, nom] of template.matchAll(/\{\{(\w+)\}\}/g)) expect(attendus.has(nom), `{{${nom}}} inconnu du script`).toBe(true);
  });

  test(".gitignore ignore l'état local .mr-review/", () => {
    expect(lire(".gitignore")).toMatch(/^\.mr-review\/$/m);
  });
});
