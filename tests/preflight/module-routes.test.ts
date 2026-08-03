import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { moduleRoutePrefixes } from "../../scripts/lib/module-routes";

/**
 * Anti-dérive de la dérivation des préfixes de routes de modules
 * (scripts/lib/module-routes.ts), consommée par `audit:config` pour ne pas
 * flaguer un lien interne valide en `lien-mort`.
 *
 * La dérivation repose sur une lecture TEXTUELLE de `src/modules/*\/routes.tsx`
 * (les fichiers sont des littéraux plats). Un refactor qui change leur forme la
 * casserait SILENCIEUSEMENT — d'où ce test : si un module cesse de contribuer
 * son préfixe, c'est ici que ça pète, pas dans 30 faux positifs d'audit.
 */

const ROOT = path.resolve(__dirname, "../..");
const prefixes = moduleRoutePrefixes(ROOT);

describe("préfixes de routes de modules (dérivés du code)", () => {
  it("chaque module portant un routes.tsx contribue au moins un préfixe", () => {
    const dir = path.join(ROOT, "src/modules");
    const withRoutes = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "routes.tsx")))
      .map((d) => d.name);

    expect(withRoutes.length).toBeGreaterThan(0);
    for (const mod of withRoutes) {
      const src = fs.readFileSync(path.join(dir, mod, "routes.tsx"), "utf-8");
      // Un routes.tsx sans aucun `path:` littéral (routes purement index) est légitime.
      if (!/path:\s*"/.test(src)) continue;
      const contributes = prefixes.some((p) =>
        new RegExp(`path:\\s*"/?${p.slice(1)}(/|")`).test(src),
      );
      expect(contributes, `le module "${mod}" ne contribue aucun préfixe`).toBe(true);
    }
  });

  it("les routes IMBRIQUÉES ne deviennent pas des préfixes racine", () => {
    // ampli déclare `community`/`stats`/`news` comme enfants de `ampli/:slug` :
    // leur path est RELATIF, ils ne fondent aucune route racine.
    for (const nested of ["/community", "/stats", "/news"]) {
      expect(prefixes, `${nested} est une route imbriquée, pas un préfixe`).not.toContain(nested);
    }
    expect(prefixes).toContain("/ampli");
  });

  it("couvre les routes citées par la skill config-assistant", () => {
    for (const p of ["/profil", "/login", "/register", "/recover-password", "/coform", "/admin", "/blog"]) {
      expect(prefixes, `préfixe ${p} attendu`).toContain(p);
    }
  });
});
