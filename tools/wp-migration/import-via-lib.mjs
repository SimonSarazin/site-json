#!/usr/bin/env node
/**
 * Import du CSV parent62 (ou autre costum) via la LIB `@communecter/cocolight-api-client`,
 * avec RETRY + THROTTLE. Reproduit exactement le pipeline de l'écran Admin → Import de site-json :
 *   login → me → entityBySlug(slug) → setCostumScope → (col→attr) → shapeImportRow → importElements.
 *
 * ▶ Lancer DEPUIS site-json/ (résout la lib + papaparse) :
 *     IMPORT_EMAIL='admin@…' IMPORT_PASSWORD='…' \
 *     IMPORT_BASE_URL='http://127.0.0.1:5080' \
 *     node tools/wp-migration/import-via-lib.mjs
 *
 * Variables (toutes optionnelles sauf EMAIL/PASSWORD) :
 *   IMPORT_BASE_URL  URL serveur (5080 legacy prod OU backend Node). def http://127.0.0.1:5080
 *   IMPORT_EMAIL / IMPORT_PASSWORD   identifiants ADMIN du costum (REQUIS)
 *   IMPORT_SLUG      slug costum (def parent62)   IMPORT_ORG_ID  id org hôte (def 6a51…f836)
 *   IMPORT_ORG_TYPE  collection hôte (def organizations)   IMPORT_TYPE  cible (def poi)
 *   IMPORT_CSV       chemin CSV (def ./out/parent62-articles-complet.csv)
 *   IMPORT_CHUNK     taille de lot (def 40)       IMPORT_THROTTLE_MS  pause entre lots (def 1200)
 *   IMPORT_MAX_RETRY retries par lot (def 3)      IMPORT_LIMIT  n premières lignes (0=tout)
 *   IMPORT_DRY_RUN=1 n'importe rien, affiche 1 ligne mise en forme
 */
import pkg from "@communecter/cocolight-api-client";
import Papa from "papaparse";
import { readFileSync } from "node:fs";

const { Api, tokenStorageStrategy } = pkg;

// ─────────────────────────── CONFIG ───────────────────────────
const CFG = {
  baseURL:  process.env.IMPORT_BASE_URL  || "http://127.0.0.1:5080",
  email:    process.env.IMPORT_EMAIL     || "",
  password: process.env.IMPORT_PASSWORD  || "",
  slug:     process.env.IMPORT_SLUG      || "parent62",
  orgId:    process.env.IMPORT_ORG_ID    || "6a51e88b3531fb2993efd836",
  orgType:  process.env.IMPORT_ORG_TYPE  || "organizations",
  type:     process.env.IMPORT_TYPE      || "poi",
  csv:      process.env.IMPORT_CSV       || new URL("./out/parent62-articles-complet.csv", import.meta.url).pathname,
  chunk:      Number(process.env.IMPORT_CHUNK || 15),          // petit lot : reste sous le timeout (download d'images)
  throttleMs: Number(process.env.IMPORT_THROTTLE_MS || 1000),
  timeoutMs:  Number(process.env.IMPORT_TIMEOUT_MS || 180000), // 3 min/requête (un lot de 15 images ~30-45s)
  maxRetry:   Number(process.env.IMPORT_MAX_RETRY || 3),
  limit:      Number(process.env.IMPORT_LIMIT || 0),
  dryRun:     process.env.IMPORT_DRY_RUN === "1",
};

// Repli col→attr si le costum ne renvoie pas de mapping (sinon dérivé de costum.import.mapping).
const FALLBACK_MAP = {
  "Titre": "name", "Type": "type", "Chapô": "shortDescription", "Description": "description",
  "Image": "profilImageUrl", "Tags": "tags", "Territoires": "territoires",
  "Publics": "publics", "Thèmes": "themes", "Date": "created",
};

// ───────────── shapeImportRow — port standalone de site-json/src/modules/admin/lib ─────────────
const ADDRESS_KEYS = {
  postalCode: "postalCode", addressLocality: "addressLocality", city: "addressLocality",
  ville: "addressLocality", streetAddress: "streetAddress", adresse: "streetAddress",
  addressCountry: "addressCountry", codeInsee: "codeInsee",
};
const countryFromPostalCode = (cp) =>
  /^971/.test(cp) ? "GP" : /^972/.test(cp) ? "MQ" : /^973/.test(cp) ? "GF"
  : /^974/.test(cp) ? "RE" : /^976/.test(cp) ? "YT" : "FR";

function shapeImportRow(row, map) {
  const out = {};
  for (const [rawKey, rawValIn] of Object.entries(row)) {
    let key = String(rawKey).trim();
    if (map) { const m = map[key] ?? map[rawKey]; if (!m) continue; key = m.trim(); } // en-tête → attr (hors map = ignorée)
    const v = typeof rawValIn === "string" ? rawValIn.trim() : rawValIn;
    if (!key || v === "" || v == null) continue;
    if (key.includes(".")) { // clé pointée → imbrication
      const parts = key.split("."); let cur = out;
      for (let i = 0; i < parts.length - 1; i++) { const p = parts[i]; if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {}; cur = cur[p]; }
      cur[parts[parts.length - 1]] = v; continue;
    }
    const ak = ADDRESS_KEYS[key]; if (ak) { const a = out.address ?? (out.address = {}); a[ak] = v; continue; } // alias adresse → address{}
    if (key === "tags" && typeof v === "string") { out.tags = v.split(/[;,]/).map((t) => t.trim()).filter(Boolean); continue; }
    out[key] = v; // territoires/publics/themes restent en "a,b,c" → cast ARRAY côté backend (import.mapping)
  }
  const a = out.address;
  if (a && Object.keys(a).length && !a.addressCountry) a.addressCountry = countryFromPostalCode(String(a.postalCode ?? ""));
  return out;
}

// ─────────────────────────── helpers ───────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isAuthErr = (e) => /401|403|auth|token|unauthorized|connect/i.test(String(e?.message ?? e));

async function connect() {
  const strat = await tokenStorageStrategy.createDefaultMultiServerTokenStorageStrategy("memory");
  const api = await Api.userLogin(CFG.email, CFG.password, { baseURL: CFG.baseURL, tokenStorageStrategy: strat, timeout: CFG.timeoutMs });
  const me = await api.me();
  const carrier = await me.entityBySlug(CFG.slug);
  if (typeof carrier.hasCostumScope === "function" && !carrier.hasCostumScope()) {
    carrier.setCostumScope(CFG.slug, { costumId: CFG.orgId, costumType: CFG.orgType });
  }
  return { api, carrier };
}

// ─────────────────────────── main ───────────────────────────
async function main() {
  if (!CFG.email || !CFG.password) {
    console.error("⛔ IMPORT_EMAIL et IMPORT_PASSWORD requis (admin du costum " + CFG.slug + ").");
    process.exit(1);
  }
  console.log(`▶ Import "${CFG.type}" sur ${CFG.baseURL} — costum=${CFG.slug}`);

  let { api, carrier } = await connect();

  // col→attr depuis le costum (costum.import.mapping), sinon repli.
  let map = FALLBACK_MAP;
  try {
    const cj = await carrier.getCostumJson();
    const m = cj?.data?.import?.mapping ?? cj?.import?.mapping;
    if (Array.isArray(m) && m.length) map = Object.fromEntries(m.filter((x) => x?.col && x?.attr).map((x) => [x.col, x.attr]));
  } catch { /* repli FALLBACK_MAP */ }
  console.log("  col→attr:", map);

  // CSV → lignes mises en forme
  const parsed = Papa.parse(readFileSync(CFG.csv, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) console.warn("  ⚠ CSV parse warnings:", parsed.errors.slice(0, 3));
  let rows = parsed.data.map((r) => shapeImportRow(r, map)).filter((r) => r.name);
  if (CFG.limit > 0) rows = rows.slice(0, CFG.limit);
  console.log(`  ${rows.length} lignes | chunk=${CFG.chunk} throttle=${CFG.throttleMs}ms timeout=${CFG.timeoutMs}ms retry=${CFG.maxRetry}`);

  if (CFG.dryRun) { console.log("  DRY-RUN — 1re ligne mise en forme :\n", JSON.stringify(rows[0], null, 1).slice(0, 500)); return; }

  let created = 0, updated = 0, errors = 0; const failed = [];
  const total = rows.length; const t0 = Date.now();

  for (let i = 0; i < rows.length; i += CFG.chunk) {
    const chunk = rows.slice(i, i + CFG.chunk);
    for (let attempt = 1; attempt <= CFG.maxRetry; attempt++) {
      try {
        // importElements gère costumSlug/Id/Type (via _costumCtx), rowIndex, JSON.stringify + résumé.
        const res = await carrier.importElements(CFG.type, chunk, { chunkSize: chunk.length });
        created += res.summary.created; updated += res.summary.updated; errors += res.summary.errors;
        break;
      } catch (e) {
        if (attempt === CFG.maxRetry) { failed.push([i, String(e?.message ?? e).slice(0, 160)]); }
        else { await sleep(1500 * attempt); if (isAuthErr(e)) { try { ({ api, carrier } = await connect()); } catch { /* réessaie au tour suivant */ } } }
      }
    }
    const secs = Math.round((Date.now() - t0) / 1000);
    process.stdout.write(`\r  ${Math.min(i + CFG.chunk, total)}/${total} | +${created} ~${updated} !${errors}${failed.length ? ` KO:${failed.length}` : ""} | ${secs}s   `);
    await sleep(CFG.throttleMs);
  }

  console.log(`\n=== TERMINÉ : ${created} créés, ${updated} mis à jour, ${errors} erreurs de ligne, ${failed.length} lots échoués ===`);
  failed.slice(0, 15).forEach(([i, e]) => console.log(`  ⚠ lot@${i}: ${e}`));
  if (failed.length) process.exitCode = 2;
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
