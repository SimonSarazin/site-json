import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Preflight — les logos de l'en-tête et du pied de page (`logo`, `logoDark`,
 * `logoOverlay`) qui pointent un fichier LOCAL existent dans `public/`.
 *
 * `HeaderLogo` ne rend QUE l'image (`resolveHeaderLogo`) ou, à défaut,
 * `logoIcon` — jamais `logoTitle`. Un `header.logo` dont le fichier manque
 * donne donc une image cassée (`/img` répond 404) avec `alt=""` : le site est
 * publié SANS marque visible, sans qu'aucun garde-fou ne le dise —
 * `audit:config` le signale (`asset-manquant`), mais n'est pas bloquant.
 * Cas réel : `federationDesCae`, dont le logo n'a jamais été commité.
 *
 * Les URL absolues (http/https) sont hors contrôle : servies par un tiers.
 * Règle STRICTE : vraie sur toutes les configs déployées (`sites.json`).
 */
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const LOGO_KEYS = ["logo", "logoDark", "logoOverlay"] as const;

const sites: Array<{ slug: string; config: string }> = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "sites.json"), "utf-8"),
);
const uniqueConfigs = [...new Set(["config.prod.json", ...sites.map((s) => s.config)])].filter((f) =>
  fs.existsSync(path.join(PROJECT_ROOT, f)),
);

type Chrome = Partial<Record<(typeof LOGO_KEYS)[number], unknown>>;
interface CfgChrome {
  header?: Chrome;
  footer?: Chrome;
}

/** `[chemin, valeur]` des logos LOCAUX (chaîne non vide, ni http(s), ni data:). */
function localLogos(configFile: string): Array<[string, string]> {
  const cfg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, configFile), "utf-8")) as CfgChrome;
  const out: Array<[string, string]> = [];
  for (const zone of ["header", "footer"] as const) {
    for (const key of LOGO_KEYS) {
      const v = cfg[zone]?.[key];
      if (typeof v !== "string" || !v || /^(https?:)?\/\//i.test(v) || v.startsWith("data:")) continue;
      out.push([`${zone}.${key}`, v]);
    }
  }
  return out;
}

describe("Preflight — logos header/footer : le fichier local existe dans public/", () => {
  test("le scan a porté sur les configs déployées", () => {
    expect(uniqueConfigs.length).toBeGreaterThan(0);
  });

  for (const file of uniqueConfigs) {
    const logos = localLogos(file);
    if (logos.length === 0) continue;

    test(file, () => {
      const manquants = logos
        .filter(([, v]) => !fs.existsSync(path.join(PROJECT_ROOT, "public", v.replace(/^\//, ""))))
        .map(([at, v]) => `${at} = ${v}`);
      expect(
        manquants,
        `Logo(s) absent(s) de public/ — l'en-tête rend une image cassée, sans repli sur \`logoTitle\` :\n  ${manquants.join("\n  ")}`,
      ).toHaveLength(0);
    });
  }
});
