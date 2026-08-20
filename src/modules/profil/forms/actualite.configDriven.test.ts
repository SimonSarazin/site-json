/**
 * Costum « actualite » (Ekilib.re) — costumForm POI 100 % config-driven, chargé depuis
 * `config.prod.maison-sport-sante-la-tampon.json` → `costumForms["actualite"]` par la VOIE UNIQUE
 * `registerCostumForm` (celle du runtime : zod → compilation → garde des clés).
 *
 * Contrairement à `structure`, aucun `fns.ts` : tous les champs sont des widgets natifs du moteur
 * (text/select/date/markdown/switch) — ce test prouve juste que le document compile et que le
 * payload de création porte le costum-stamp `type:"article"` sans rien perdre côté champs métier.
 *
 * `type:"article"` et le champ `category` (pas `actualiteCategory`) sont imposés par le costum
 * backend `associationEkilibre` (`typeObj.article.dynFormCostum`) — alignés le 18/08 après lecture
 * de sa config réelle, cf. doc-projets/maison-sport-sante-la-tampon.md §9.7.
 */
import { describe, it, expect } from "vitest";
import { buildPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import { JsonFormConfigSchema } from "@/modules/formEngine/config/schema";
import { formDescriptorToConfig } from "@/modules/formEngine/config/formDescriptorToConfig";
import { configToDescriptor } from "@/modules/formEngine/config/configToDescriptor";
import { costumDoc, loadCostumForm } from "./costum/__fixtures__/configCostum";

const { descriptor, spec } = loadCostumForm("actualite");

const tLoc = (l: import("@/types/locale-schema").LocalizedString) => l; // préserve le LocalizedString inline
const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const formSpec: FormSpec = { descriptor };

const FILLED = {
  name: "Nouveau créneau Marche Nordique",
  category: "Nouveau créneau",
  publicationDate: "2026-08-10",
  description: "**Un nouveau créneau** ouvre au gymnase du Tampon.",
  link: "https://ekilib.re/creneaux",
  publicationStatus: "Publié",
  featured: false,
};

describe("costum actualite Ekilib.re — document de config", () => {
  it("1. compile depuis la config par la voie unique (toutes les clés citées sont enregistrées)", () => {
    expect(descriptor.id).toBe("actualite");
    expect(descriptor.collection).toBe("poi");
    expect(spec.mutation.entityType).toBe("poi");
  });

  it("2. round-trip config → descripteur SANS PERTE (render + pipeline)", () => {
    const config = formDescriptorToConfig(descriptor);
    expect(() => JsonFormConfigSchema.parse(config)).not.toThrow();
    const d2 = configToDescriptor(config, { tLoc });
    expect(norm(d2).fields).toEqual(norm(descriptor).fields);
  });

  it("3. le scope de création résout le carrier du site (pas un costum constant, contrairement à structure)", () => {
    // `scope` vit dans le doc costum brut (entityModalSpec), pas dans le descripteur formEngine —
    // lu directement sur le document source pour ne rien dupliquer en dur ici.
    const doc = costumDoc("actualite") as { scope?: { slugFrom?: string } };
    expect(doc.scope).toEqual({ slugFrom: "carrier" });
  });

  it("3bis. le costum-stamp `type:article` est injecté au create, jamais retapé en dur ailleurs", () => {
    const doc = costumDoc("actualite") as { mutation?: { inject?: { extraFields?: Record<string, unknown> } } };
    expect(doc.mutation?.inject?.extraFields).toEqual({ type: "article" });
  });

  it("3ter. `parent` = le porteur du site (`parentFromCarrier`), pas le default AJV `@userId`", () => {
    // Sans ça, ADD_POI reçoit un `parent` absent du payload réel (le default AJV du schéma de base
    // n'est jamais réémis vers le réseau) → rejet backend générique ("Contenu Invalide costumType").
    const doc = costumDoc("actualite") as { mutation?: { inject?: { parentFromCarrier?: boolean } } };
    expect(doc.mutation?.inject?.parentFromCarrier).toBe(true);
  });
});

describe("costum actualite Ekilib.re — WRITE (création)", () => {
  const payload = buildPayload(formSpec, FILLED) as Record<string, unknown>;

  it("4. émet tous les champs métier de l'actualité", () => {
    expect(payload).toMatchObject({
      name: "Nouveau créneau Marche Nordique",
      category: "Nouveau créneau",
      publicationDate: "2026-08-10",
      description: "**Un nouveau créneau** ouvre au gymnase du Tampon.",
      link: "https://ekilib.re/creneaux",
      publicationStatus: "Publié",
    });
  });

  it("5. les 5 valeurs de catégorie du costumForm sont exactement celles du CDC", () => {
    const enumValues = (descriptor.fields.category.enum as Array<{ value: string }> | undefined)
      ?.map((o) => o.value);
    expect(enumValues).toEqual([
      "Nouveau créneau",
      "Évènement",
      "Information santé",
      "Fermeture/modification",
      "Autre",
    ]);
  });

  it("6. les 3 valeurs de statut du costumForm sont exactement celles du CDC", () => {
    const enumValues = (descriptor.fields.publicationStatus.enum as Array<{ value: string }> | undefined)
      ?.map((o) => o.value);
    expect(enumValues).toEqual(["Brouillon", "Publié", "Archivé"]);
  });

  it("7. le champ `featured` est un switch (booléen), jamais une saisie libre", () => {
    expect(descriptor.fields.featured).toMatchObject({ widget: "switch" });
  });
});
