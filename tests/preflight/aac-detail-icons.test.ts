import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { lucideIconNames } from "../../scripts/lib/code-vocabulary";

/**
 * Preflight — icônes des blocs de la fiche d'un commun (`aac.detail.sections[].icon`).
 *
 * Elles sont rendues par `<DynamicIcon>` (`lucide-react/dynamic`), dont le
 * catalogue est indexé en kebab-case (`users-round`, jamais `UsersRound`, qui est
 * le nom de l'export STATIQUE de `lucide-react`). Un nom inconnu lève « Name in
 * Lucide DynamicIcon not found » dans un `useEffect`, avalé par un `.catch` :
 * l'entrée de sommaire se rend SANS icône, sans signal en SSR ni au build.
 * C'est arrivé aux 7 blocs de `federationDesCae`, déclarés en PascalCase.
 *
 * Deux règles STRICTES sur chaque config déployée (`sites.json`) :
 *  - la forme : kebab-case (vérifiable sans `node_modules`) ;
 *  - l'existence dans le catalogue lucide (sautée si le paquet est absent).
 */
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const KEBAB = /^[a-z][a-z0-9-]*$/;

const sites: Array<{ slug: string; config: string }> = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, "sites.json"), "utf-8"),
);
const uniqueConfigs = [...new Set(["config.prod.json", ...sites.map((s) => s.config)])].filter((f) =>
  fs.existsSync(path.join(PROJECT_ROOT, f)),
);

interface DetailSection {
  id?: string;
  icon?: unknown;
}
interface CfgWithAac {
  aac?: { detail?: { sections?: DetailSection[] } };
}

/** `[chemin, icône]` de chaque bloc de fiche qui déclare une icône. */
function declaredIcons(configFile: string): Array<[string, unknown]> {
  const cfg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, configFile), "utf-8")) as CfgWithAac;
  const sections = cfg.aac?.detail?.sections ?? [];
  return sections
    .map((s, i): [string, unknown] => [`aac.detail.sections[${i}]${s.id ? ` (${s.id})` : ""}.icon`, s.icon])
    .filter(([, icon]) => icon !== undefined);
}

const LUCIDE_NAMES = lucideIconNames(PROJECT_ROOT);
const withIcons = uniqueConfigs
  .map((f) => ({ file: f, icons: declaredIcons(f) }))
  .filter((c) => c.icons.length > 0);

describe("Preflight — aac.detail.sections[].icon (DynamicIcon)", () => {
  test("le scan a porté sur les configs déployées", () => {
    expect(uniqueConfigs.length).toBeGreaterThan(0);
  });

  for (const { file, icons } of withIcons) {
    describe(file, () => {
      test("chaque icône est un nom lucide en kebab-case", () => {
        const fautives = icons
          .filter(([, icon]) => typeof icon !== "string" || !KEBAB.test(icon))
          .map(([at, icon]) => `${at} = ${JSON.stringify(icon)}`);
        expect(
          fautives,
          `Icône(s) hors forme kebab-case (DynamicIcon ne résout pas « UsersRound », seulement « users-round ») :\n  ${fautives.join("\n  ")}`,
        ).toHaveLength(0);
      });

      test("chaque icône existe dans le catalogue lucide", () => {
        if (LUCIDE_NAMES.size === 0) return; // lucide absent : rien à comparer
        const inconnues = icons
          .filter(([, icon]) => typeof icon === "string" && !LUCIDE_NAMES.has(icon))
          .map(([at, icon]) => `${at} = ${JSON.stringify(icon)}`);
        expect(
          inconnues,
          `Icône(s) hors catalogue lucide (${LUCIDE_NAMES.size} noms) — rendue(s) null sans erreur :\n  ${inconnues.join("\n  ")}`,
        ).toHaveLength(0);
      });
    });
  }
});
