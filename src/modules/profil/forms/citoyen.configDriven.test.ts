/**
 * Formulaire costum CITOYEN (docs/33 étape 5) — `costumForms["sport-sante-bienetre-citoyen"]` (SSBE) et
 * `costumForms["ekilibre-citoyen"]` (Ekilib.re), chargés depuis les VRAIES configs par la voie unique
 * `registerCostumForm`. Ce que l'on prouve, pour chacun :
 *  1. le document compile (clés de registre enregistrées : codecs adresse, geo, afterSubmit, invalidate) ;
 *  2. le READ seed les champs profil + `typepro`/`othersTypepro` depuis une fiche réelle ;
 *  3. le WRITE d'ÉDITION n'émet QUE les champs déclarés (vides typés), adresse recomposée, ancres
 *     composites jamais émises, et `typepro`/`othersTypepro` à la racine (c'est là que le legacy les lit) ;
 *  4. la spec de mutation épingle le costum du formulaire (`schemaCostumSlug`) en édition et refuse la
 *     création (un citoyen naît par l'inscription) ;
 *  5. `othersTypepro` n'est visible/exigé que si `typepro === "autres"`.
 */
import { describe, it, expect } from "vitest";
import type { EntityTypes, User } from "@communecter/cocolight-api-client";
import { seedEntity, buildEditPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import { JsonFormConfigSchema } from "@/modules/formEngine/config/schema";
import { formDescriptorToConfig } from "@/modules/formEngine/config/formDescriptorToConfig";
import { configToDescriptor } from "@/modules/formEngine/config/configToDescriptor";
import { check } from "@/modules/formEngine";
import { loadCostumForm } from "./costum/__fixtures__/configCostum";
import { specToConfig } from "./resolveModalSpec";
import type { EntityModalCtx } from "./entityModalSpec";
import { runEntityMutation, CITOYEN_CREATE_UNSUPPORTED } from "../hooks/useEntityMutation";

const tLoc = (l: import("@/types/locale-schema").LocalizedString) => l;
const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Fiche réelle (forme) d'un citoyen SSBE portant `typepro` — cf. 61 citoyens en base. */
const CITOYEN = {
  name: "Jean Test",
  slug: "jeantest",
  email: "jean@test.re",
  typepro: "autres",
  othersTypepro: "Ostéopathe",
  source: { key: "sportSanteBienetre", keys: ["sportSanteBienetre"] },
  address: { "@type": "PostalAddress", addressCountry: "RE", addressLocality: "Le Tampon", postalCode: "97430", streetAddress: "1 rue X", localityId: "54c0965cf6b95c141800a51e" },
};
const userLike = (serverData: Record<string, unknown>) =>
  ({ serverData, slug: serverData.slug, getEntityType: () => "citoyens" }) as unknown as User;

describe.each([
  ["sport-sante-bienetre-citoyen", "sportSanteBienetre"],
  ["ekilibre-citoyen", "associationEkilibre"],
])("costum citoyen %s", (id, slug) => {
  const { descriptor, spec } = loadCostumForm(id);
  const formSpec: FormSpec = { descriptor };

  it("1. compile depuis la config (collection citoyens, costumSlug du site, afterSubmit/invalidate résolus)", () => {
    expect(descriptor.id).toBe(id);
    expect(descriptor.collection).toBe("citoyens");
    expect(descriptor.costumSlug).toBe(slug);
    expect(spec.mutation.entityType).toBe("citoyens");
    expect(spec.afterSubmit).toBe("afterSubmit:reloadOnSlugChange");
    const config = formDescriptorToConfig(descriptor);
    expect(() => JsonFormConfigSchema.parse(config)).not.toThrow();
    const d2 = configToDescriptor(config, { tLoc });
    expect(norm(d2).fields).toEqual(norm(descriptor).fields);
    expect(d2.fields.address).toMatchObject({ widget: "location", renderOnly: true });
    expect(d2.fields.typepro).toMatchObject({ widget: "select", type: "string" });
    expect(d2.fields.typepro.enum?.map((o) => o.value)).toEqual([
      "Éducateur(ice) Sportif(ive)", "Enseignant(e) en APA", "Médecins", "Autre professionnels de Santé", "Dirigeant Associatif", "autres",
    ]);
  });

  it("2. READ : seed des champs profil + typepro/othersTypepro + adresse aplatie", () => {
    const values = seedEntity(formSpec, userLike(CITOYEN)) as Record<string, unknown>;
    expect(values).toMatchObject({
      name: "Jean Test", slug: "jeantest", email: "jean@test.re",
      typepro: "autres", othersTypepro: "Ostéopathe",
      addressLocality: "Le Tampon", postalCode: "97430", localityId: "54c0965cf6b95c141800a51e",
    });
  });

  it("3. WRITE édition : seuls les champs déclarés, vides typés, adresse recomposée, typepro à la racine", () => {
    const values = seedEntity(formSpec, userLike(CITOYEN)) as Record<string, unknown>;
    const payload = buildEditPayload(formSpec, { ...values, typepro: "Médecins", othersTypepro: "" }) as Record<string, unknown>;
    expect(payload).toMatchObject({ name: "Jean Test", slug: "jeantest", typepro: "Médecins", othersTypepro: "" });
    expect(payload.address).toMatchObject({ addressLocality: "Le Tampon", localityId: "54c0965cf6b95c141800a51e" });
    // Champs NON déclarés (source, roles, …) : jamais émis — ni l'ancre `address` composite, ni les membres plats.
    for (const k of ["source", "roles", "addressLocality", "postalCode", "streetAddress", "localityId", "addressCountry"]) {
      expect(payload).not.toHaveProperty(k);
    }
    // geo/geoPosition : writeOnly — non posés par le widget ici → omis (jamais « effacés » par un round-trip).
    expect(payload).not.toHaveProperty("geo");
    expect(payload).not.toHaveProperty("geoPosition");
    // Vides typés : un textarea non rempli s'émet "" (clear), les tags [].
    expect(payload.description).toBe("");
    expect(payload.tags).toEqual([]);
    expect(Object.keys(payload).sort()).toEqual([
      "address", "birthDate", "description", "email", "fixe", "mobile", "name", "othersTypepro",
      "shortDescription", "slug", "tags", "typepro", "url",
    ]);
  });

  it("4. spec édition : schemaCostumSlug épinglé, création refusée avant tout SDK", async () => {
    const cfg = specToConfig(spec);
    const entity = userLike(CITOYEN) as unknown as EntityTypes;
    const ctxEdit: EntityModalCtx = { mode: "edit", entity, me: entity };
    const edit = cfg.buildSpec(ctxEdit);
    expect(edit).toMatchObject({ mode: "edit", entityType: "citoyens", schemaCostumSlug: slug, navigateOnSuccess: false });
    // Le payload d'édition passe par le pipeline (emitEmpty) : typepro/othersTypepro émis.
    expect(edit.buildPayload({ name: "Jean Test", slug: "jeantest", typepro: "Médecins" })).toMatchObject({ typepro: "Médecins", othersTypepro: "" });

    const add = cfg.buildSpec({ mode: "add", entity: null, me: entity });
    expect(add.entityType).toBe("citoyens");
    await expect(runEntityMutation(add, { name: "X" }, { me: entity })).rejects.toThrow(CITOYEN_CREATE_UNSUPPORTED);
  });

  it("5. othersTypepro : visible et requis seulement si typepro === autres", () => {
    const f = descriptor.fields.othersTypepro;
    expect(check(f.visibleIf, { typepro: "autres" })).toBe(true);
    expect(check(f.visibleIf, { typepro: "Médecins" })).toBe(false);
    expect(check(f.requiredIf, { typepro: "autres" })).toBe(true);
    expect(check(f.requiredIf, { typepro: "" })).toBe(false);
  });
});
