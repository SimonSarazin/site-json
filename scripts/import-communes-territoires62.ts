/**
 * Import one-shot des listes de communes des 9 territoires du Réseau
 * Parentalité 62 depuis les PDF officiels du WordPress parent62.org
 * (T0.5 — source de `TERRITOIRES_62.communes` et des pages territoire).
 *
 * Usage : npx tsx scripts/import-communes-territoires62.ts [dossier-pdfs]
 *  - sans argument : télécharge les 9 PDF depuis parent62.org ;
 *  - avec [dossier-pdfs] : lit les PDF déjà téléchargés dans ce dossier
 *    (mêmes noms de fichiers) — utile hors ligne ou si le fetch Node est
 *    bloqué (le serveur exige de toute façon un User-Agent navigateur).
 * Prérequis : `pdftotext` (poppler-utils) disponible dans le PATH.
 *
 * Le script n'écrit AUCUN fichier du dépôt : il imprime sur stdout, pour
 * chaque territoire, (a) le littéral `communes: [...]` à coller dans
 * `src/data/territoires62.ts`, (b) la liste HTML `<ul class="p62-communes">`
 * à coller dans la page territoire de `config.prod.parent62.json`, et
 * (c) un décompte par territoire à contrôler visuellement contre les PDF.
 * La relecture humaine du diff reste le garde-fou (noms publiés tels quels).
 */

import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseCommunesPdfText } from "../src/data/parseCommunesPdfText";

const PDF_BASE = "https://www.parent62.org/wp-content/uploads/2020/10";

/** Le serveur WordPress renvoie 403 aux user-agents non navigateur. */
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0";

/** Slugs alignés sur src/data/territoires62.ts (slugs courts corrigés). */
const SOURCES: Array<{ slug: string; pdf: string }> = [
  { slug: "arrageois", pdf: "Liste-des-communes-Arrageois-1.pdf" },
  { slug: "artois", pdf: "Liste-des-communes-Artois.pdf" },
  { slug: "audomarois", pdf: "Liste-des-communes-Audomarois-1.pdf" },
  { slug: "boulonnais", pdf: "Liste-des-communes-Boulonnais-1.pdf" },
  { slug: "calaisis", pdf: "Liste-des-communes-Calaisis-1.pdf" },
  { slug: "entre-mer-et-terres", pdf: "Liste-des-communes-EMT-1.pdf" },
  { slug: "fsm-henin-carvin", pdf: "Liste-des-communes-FSMHeninCarvin.pdf" },
  { slug: "fsm-lens-lievin", pdf: "Liste-des-communes-FSMlenLievin.pdf" },
  { slug: "ternois-bruaysis", pdf: "Liste-des-communes-TernoisBruaysis-1.pdf" },
];

function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function main(): Promise<void> {
  const localDir = process.argv[2];
  const workDir = localDir ?? (await mkdtemp(path.join(tmpdir(), "communes62-")));
  const all: Array<{ slug: string; communes: string[] }> = [];

  for (const { slug, pdf } of SOURCES) {
    const pdfPath = path.join(workDir, pdf);
    if (!localDir) {
      const url = `${PDF_BASE}/${pdf}`;
      const response = await fetch(url, { headers: { "User-Agent": BROWSER_UA } });
      if (!response.ok) {
        throw new Error(`Téléchargement échoué (${response.status}) : ${url}`);
      }
      await writeFile(pdfPath, Buffer.from(await response.arrayBuffer()));
    }
    const text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], {
      encoding: "utf-8",
    });
    all.push({ slug, communes: parseCommunesPdfText(text) });
  }

  console.log("=== (c) Décompte par territoire — à contrôler contre les PDF ===");
  for (const { slug, communes } of all) {
    console.log(`${slug.padEnd(22)} ${communes.length} communes`);
  }
  console.log(`${"TOTAL".padEnd(22)} ${all.reduce((n, t) => n + t.communes.length, 0)}`);

  console.log("\n=== (a) Littéraux pour src/data/territoires62.ts ===");
  for (const { slug, communes } of all) {
    console.log(`// ${slug}`);
    console.log(`communes: ${JSON.stringify(communes)},`);
  }

  console.log("\n=== (b) Listes HTML pour config.prod.parent62.json ===");
  for (const { slug, communes } of all) {
    const items = communes.map((c) => `<li>${escapeHtml(c)}</li>`).join("");
    console.log(`<!-- ${slug} -->`);
    console.log(`<ul class="p62-communes">${items}</ul>`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
