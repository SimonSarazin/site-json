/**
 * Formulaire acteur « Institut Bleu » (config-driven, 0 code) — garde de PARITÉ du pipeline.
 *
 * Le document vit dans `config.prod.institut-bleu.json` → `costumForms["institut-bleu-acteur"]` et rejoue
 * le `dynFormCostum` legacy (« Formulaire d'autorisation de diffusion des données »). Ce test prouve les
 * propriétés dont dépend l'ANNUAIRE (qui filtre `displayAuth: "true"`, une CHAÎNE) et l'édition d'une
 * fiche existante (valeurs hors liste costum conservées).
 */
import { describe, it, expect } from "vitest";
import type { Organization } from "@communecter/cocolight-api-client";
import { seedEntity, buildPayload, buildEditPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import { buildZodSchema } from "@/modules/formEngine/engine/zodGen";
import { loadCostumForm } from "./costum/__fixtures__/configCostum";

const { descriptor, spec: modalSpec } = loadCostumForm("institut-bleu-acteur");
const orgLike = (serverData: Record<string, unknown>) => ({ serverData }) as unknown as Organization;
const spec: FormSpec = { descriptor, baseDefaults: () => ({}) };

describe("costumForm institut-bleu-acteur — identité du document", () => {
  it("cible les organisations du costum institutBleu", () => {
    expect(descriptor.collection).toBe("organizations");
    expect(descriptor.costumSlug).toBe("institutBleu");
    expect(modalSpec.mutation.entityType).toBe("organizations");
  });

  it("porte les 21 champs du formulaire legacy, dans 4 sections", () => {
    expect(Object.keys(descriptor.fields)).toHaveLength(21);
    expect(descriptor.sections.map((s) => s.id)).toEqual([
      "autorisation",
      "identite",
      "contact",
      "localisation",
    ]);
  });

  it("injecte les presets du formulaire legacy + la modération a priori", () => {
    const extra = modalSpec.mutation.inject?.extraFields as Record<string, unknown>;
    expect(extra).toMatchObject({ type: "LocalBusiness", role: "admin" });
    // `toBeValidated` voyage dans le PAYLOAD, comme pour `institut-bleu-event`. Le hook backend
    // `InstitutBleu.elementAfterSave` pose le même drapeau, mais APRÈS l'enregistrement : sans celui-ci,
    // l'entité existe un instant sans être modérée. Les deux écritures sont idempotentes — le serveur
    // rekeye `true` sur le costum actif (element.routes.ts:261), donc jamais un slug tiers.
    expect(extra.preferences).toEqual({ toBeValidated: true });
  });
});

describe("displayAuth — parité de TYPE (chaîne, pas booléen)", () => {
  it("READ : la chaîne serveur \"true\" seede le switch à true", () => {
    const values = seedEntity(spec, orgLike({ name: "Acteur", displayAuth: "true" }));
    expect(values.displayAuth).toBe(true);
  });

  it("READ : displayAuth absent → false", () => {
    expect(seedEntity(spec, orgLike({ name: "Acteur" })).displayAuth).toBe(false);
  });

  it("WRITE (create) : true → la CHAÎNE \"true\" — sinon l'acteur sort de l'annuaire", () => {
    const payload = buildPayload(spec, { ...seedEntity(spec, orgLike({})), name: "Acteur", displayAuth: true });
    expect(payload.displayAuth).toBe("true");
    expect(typeof payload.displayAuth).toBe("string");
  });

  it("WRITE (create) : false → la CHAÎNE \"false\"", () => {
    const payload = buildPayload(spec, { ...seedEntity(spec, orgLike({})), name: "Acteur", displayAuth: false });
    expect(payload.displayAuth).toBe("false");
  });

  it("WRITE (edit) : décocher l'autorisation envoie \"false\"", () => {
    const entity = orgLike({ name: "Acteur", displayAuth: "true" });
    const values = { ...seedEntity(spec, entity), displayAuth: false };
    expect(buildEditPayload(spec, values).displayAuth).toBe("false");
  });
});

describe("champs métier", () => {
  it("categoryThematic : les 8 catégories du costum, en multi-valeurs", () => {
    const field = descriptor.fields.categoryThematic;
    expect(field.multiple).toBe(true);
    expect(field.required).toBe(true);
    expect(field.enum).toHaveLength(8);
    const values = seedEntity(spec, orgLike({ categoryThematic: ["Pêche et produits de la mer"] }));
    expect(values.categoryThematic).toEqual(["Pêche et produits de la mer"]);
  });

  it("categoryThematic : plafond de 2 (legacy `maximumSelectionLength`) — saisie ET validation", () => {
    expect(descriptor.fields.categoryThematic.widgetProps?.maxItems).toBe(2);
    expect(descriptor.fields.categoryThematic.rules?.max).toBe(2);
    const schema = buildZodSchema(descriptor);
    const base = { ...seedEntity(spec, orgLike({})), name: "Acteur", email: "a@b.re", displayAuth: true };
    expect(schema.safeParse({ ...base, categoryThematic: ["Action de l'Etat en mer"] }).success).toBe(true);
    const bad = schema.safeParse({
      ...base,
      categoryThematic: ["Action de l'Etat en mer", "Energies Marines Renouvelables", "Nautisme"],
    });
    expect(bad.success).toBe(false);
    if (!bad.success)
      expect(bad.error.issues.some((i) => i.path[0] === "categoryThematic" && i.message === "validation.maxItems")).toBe(true);
  });

  it("tags : plafond de 5 mots-clés (saisie `maxTags` + validation `rules.max`)", () => {
    expect(descriptor.fields.tags.widgetProps?.maxTags).toBe(5);
    expect(descriptor.fields.tags.rules?.max).toBe(5);
  });

  it("legalStatus : l'enum couvre les valeurs hors liste costum présentes en base (pas de perte à l'édition)", () => {
    const values = (descriptor.fields.legalStatus.enum ?? []).map((o) => o.value);
    // 4 valeurs saisies hors liste officielle, mesurées sur les 48 acteurs de l'annuaire.
    expect(values).toEqual(
      expect.arrayContaining([
        "Etablissement public de l'Etat",
        "GIE",
        "syndicat professionnel",
        "Association Loi 1901",
      ]),
    );
    expect(seedEntity(spec, orgLike({ legalStatus: "GIE" })).legalStatus).toBe("GIE");
  });

  it("otherSociaNetworks : liste [{type, link}] pré-remplie des 4 réseaux du legacy", () => {
    const field = descriptor.fields.otherSociaNetworks;
    expect(field.widget).toBe("fieldArray");
    expect((field.widgetProps?.itemFields as Array<{ name: string }>).map((f) => f.name)).toEqual([
      "type",
      "link",
    ]);
    expect(field.default).toHaveLength(4);
  });

  it("l'adresse passe par le groupe sérialisé `address` (codec partagé)", () => {
    expect(descriptor.serializeGroups?.address).toMatchObject({
      serverKey: "address",
      read: "address:read",
      write: "address:write",
    });
    for (const name of ["addressCountry", "addressLocality", "postalCode", "streetAddress", "localityId"]) {
      expect(descriptor.fields[name].group, name).toBe("address");
    }
  });

  it("le site web est `link` (champ legacy IB), pas `url`", () => {
    expect(descriptor.fields.link).toBeDefined();
    expect(descriptor.fields.url).toBeUndefined();
    expect(seedEntity(spec, orgLike({ link: "https://institutbleu.re" })).link).toBe("https://institutbleu.re");
  });
});
