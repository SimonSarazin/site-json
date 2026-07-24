/**
 * Régression : à la CRÉATION, les champs galerie/fichier doivent être seedés avec la FORME complète
 * `{existing,added,removedDocIds,contentKey,docType}` (pas le default `""`). Sinon le widget reçoit `""`,
 * produit à l'ajout une valeur sans `contentKey`/`removedDocIds` (`{...""}` = `{}`) → `isGalleryFieldValue`
 * (useEntityMutation) est FAUX → `processGalleryFields` saute le champ → aucun upload à la création.
 * (Bug « à l'ajout d'un article, les images ne s'uploadent pas ».) L'édition, elle, seedait déjà la forme.
 */
import { describe, it, expect } from "vitest";

import "./registerSpecFns";
import { registerCostumForm } from "./costum/costumFormRegistry";
import { specToConfig } from "./resolveModalSpec";
import type { EntityModalCtx } from "./entityModalSpec";
import type { CostumFormSchema } from "./costum/compileCostumSchema";

import parent62 from "../../../../config.prod.parent62.json";

const doc = (parent62 as { costumForms: Record<string, CostumFormSchema> }).costumForms["parent62-article"];

// Mêmes clés que `isGalleryFieldValue` de useEntityMutation (object + added[] + removedDocIds[] + contentKey:string).
function isGalleryFieldValue(v: unknown): boolean {
  const g = v as { added?: unknown; removedDocIds?: unknown; contentKey?: unknown } | null;
  return !!g && typeof g === "object" && Array.isArray(g.added) && Array.isArray(g.removedDocIds) && typeof g.contentKey === "string";
}

describe("parent62-article — seed galerie/fichier à la création (fix upload create)", () => {
  it("buildDefaults(add) pose la forme gallery reconnue par processGalleryFields (pas '')", () => {
    const { spec } = registerCostumForm(doc);
    const add = specToConfig(spec).buildDefaults({ mode: "add" } as EntityModalCtx) as Record<string, unknown>;

    expect(add.galerie).toMatchObject({ existing: [], added: [], removedDocIds: [], contentKey: "slider", docType: "image" });
    expect(add.documents).toMatchObject({ existing: [], added: [], removedDocIds: [], contentKey: "file", docType: "file" });

    // La garde CLÉ : la valeur seedée DOIT passer isGalleryFieldValue (sinon l'upload est sauté au create).
    expect(isGalleryFieldValue(add.galerie)).toBe(true);
    expect(isGalleryFieldValue(add.documents)).toBe(true);
    // Régression du bug : ce n'est PAS la chaîne vide.
    expect(add.galerie).not.toBe("");
    expect(add.documents).not.toBe("");
  });
});
