import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { sectionPreviews, chromePreviews, componentPreview } from "../../scripts/lib/design-previews";
import { Header, Footer } from "@/types/site-schema";

/**
 * Anti-dérive du pont vers `.design-sync/previews/` (stories de props réelles
 * exposées par `config:schema`). Le lien type ⇄ story est dérivé de la table
 * `lazy()` de SectionRenderer.tsx : un refactor de cette table, un renommage de
 * composant ou une story supprimée casse le pont SILENCIEUSEMENT — la sortie
 * cesse simplement de proposer la composition, sans rien signaler.
 */

const ROOT = path.resolve(__dirname, "../..");
const previews = sectionPreviews(ROOT);

/** Valeurs d'un ZodEnum éventuellement enveloppé (ZodDefault/ZodOptional). */
function enumOptions(schema: unknown): string[] {
  let cur: unknown = schema;
  for (let i = 0; i < 4; i++) {
    const rec = cur as { options?: unknown; def?: { innerType?: unknown } };
    if (Array.isArray(rec.options)) return rec.options as string[];
    if (rec.def?.innerType) cur = rec.def.innerType;
    else break;
  }
  throw new Error("enum introuvable");
}

describe("stories de props (.design-sync/previews) ⇄ code", () => {
  it("le pont section ⇄ story reste fourni (ratchet)", () => {
    // 42 au 2026-07-25. Seuil qu'on ne peut que MONTER : sous ce nombre, c'est
    // une régression du pont, pas un choix.
    expect(previews.size).toBeGreaterThanOrEqual(42);
  });

  it("chaque story référencée existe réellement sur le disque", () => {
    for (const [type, rel] of previews) {
      expect(fs.existsSync(path.join(ROOT, rel)), `story de "${type}" : ${rel}`).toBe(true);
    }
  });

  it("les 6 headers et les 4 footers ont leur story (choix de design éclairé)", () => {
    const headers = chromePreviews(ROOT, "Header");
    const footers = chromePreviews(ROOT, "Footer");
    // `default` n'est pas un design (il délègue) → pas de story attendue.
    const realHeaders = enumOptions(Header.shape.type).filter((t) => t !== "default");
    const realFooters = enumOptions(Footer.shape.type).filter((t) => t !== "default");
    expect(headers.length).toBeGreaterThanOrEqual(realHeaders.length);
    expect(footers.length).toBeGreaterThanOrEqual(realFooters.length);
    for (const c of ["HeaderMegaMenu", "HeaderTransparentScroll", "FooterContactPartners", "FooterSidebarColumns"]) {
      expect(componentPreview(ROOT, c), `story ${c}`).toBeDefined();
    }
  });
});
