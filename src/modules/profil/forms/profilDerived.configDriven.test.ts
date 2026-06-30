/**
 * PILOTE config-driven — entités STANDARD (citoyen/org/projet/event/poi) par DÉRIVATION.
 *
 * Contrairement aux costums (poi-équipement/tiers-lieu, 1 formulaire → descripteur unifié écrit à la main),
 * les entités standard ont des render add/edit DIFFÉRENTS partageant UN pipeline (PROFIL_DESCRIPTORS).
 * `mergeRenderPipeline(render, pipeline)` DÉRIVE le descripteur unifié config-convertible sans dupliquer
 * le pipeline ni toucher les sources DRY. On prouve, pour chaque descripteur EDIT :
 *  1. le descripteur fusionné se sérialise en `JsonFormConfig` VALIDE + round-trip sans perte ;
 *  2. seedEntity (READ) via le fusionné === `seedProfileFormValues` live (byte-parité) ;
 *  3. buildPayload (WRITE) via le fusionné === `buildProfileUpdateData` live (byte-parité) ;
 *  4. composites UI (_location/_social/_schedule/_eventDates) → renderOnly ; champs pipeline plats présents.
 *
 * La parité est garantie PAR CONSTRUCTION (l'ensemble des champs lus/écrits du fusionné = celui du pipeline,
 * les renderOnly étant ignorés par seedFromEntity/valuesToPayload) ; ce test la VÉRIFIE sur des valeurs réelles.
 */
import { describe, it, expect } from "vitest";
import { seedEntity, buildPayload, type FormSpec, type EntityLike } from "@/modules/formEngine/engine/entityForm";
import { JsonFormConfigSchema } from "@/modules/formEngine/config/schema";
import { formDescriptorToConfig } from "@/modules/formEngine/config/formDescriptorToConfig";
import { configToDescriptor } from "@/modules/formEngine/config/configToDescriptor";
import { mergeRenderPipeline } from "@/modules/formEngine/config/mergeRenderPipeline";
import { EDIT_DESCRIPTORS } from "./editProfile.descriptor";
import { addPoiDescriptor } from "./addPoi.descriptor";
import { addProjectDescriptor } from "./addProject.descriptor";
import { addOrganizationDescriptor } from "./addOrganization.descriptor";
import { buildAddEventDescriptor } from "./addEvent.descriptor";
import type { FormDescriptor } from "@/modules/formEngine";
// side-effect : enregistre les transforms pf:* + geo:* + expose PROFIL_DESCRIPTORS et le pipeline live.
import { PROFIL_DESCRIPTORS, seedProfileFormValues, buildProfileUpdateData } from "./editProfilePayload";

const tLoc = (l: unknown) => (typeof l === "string" ? l : ((l as { fr?: string })?.fr ?? ""));
const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// serverData de test (READ) — couvre tous les champs des 5 entités ; les transforms pf:* identiques des
// deux côtés rendent l'égalité indépendante de la validité fine des valeurs.
const serverData: Record<string, unknown> = {
  name: "Entité", slug: "entite", shortDescription: "sd", description: "desc",
  url: "https://x.fr", email: "x@y.fr", mobile: "0600000000", fixe: "0100000000",
  birthDate: "1990-05-01T00:00:00.000Z", type: "NGO", recurrency: true,
  startDate: "2026-01-01T10:00:00.000Z", endDate: "2026-01-02T10:00:00.000Z", timeZone: "Europe/Paris",
  parent: { "54c0p": { name: "Parent", type: "organizations", extra: 1 } },
  organizer: { "54c0o": { name: "Orga", type: "organizations" } },
  public: false, avancement: "running", urls: ["https://a.fr"], tags: ["t1", "t2"],
  openingHours: [{ dayOfWeek: "Mo", hours: [{ opens: "08:00", closes: "18:00" }] }],
  address: { addressCountry: "FR", addressLocality: "Lyon", localityId: "54c09653f6b95c141800849e", postalCode: "69001", streetAddress: "1 rue", level1: "L1", level1Name: "Rhône", codeInsee: "69123" },
  socialNetwork: { twitter: "https://t.co/x", facebook: "https://fb/x" },
};
const entity = { serverData } as EntityLike;

// valeurs de form (WRITE) — couvre champs simples + adresse plate + social plat + geo + dates + horaires.
const formValues: Record<string, unknown> = {
  name: "Entité", slug: "entite", shortDescription: "sd", description: "desc",
  url: "https://x.fr", email: "x@y.fr", mobile: "0600000000", fixe: "0100000000",
  birthDate: "1990-05-01", type: "NGO", recurrency: true,
  startDate: "2026-01-01T10:00:00.000Z", endDate: "2026-01-02T10:00:00.000Z", timeZone: "Europe/Paris",
  avancement: "running", urls: ["https://a.fr"], tags: ["t1", "t2"], public: false,
  parent: { "54c0p": { name: "Parent", type: "organizations" } },
  organizer: { "54c0o": { name: "Orga", type: "organizations" } },
  openingHours: [{ dayOfWeek: "Mo", hours: [{ opens: "08:00", closes: "18:00" }] }],
  addressCountry: "FR", addressLocality: "Lyon", localityId: "54c09653f6b95c141800849e",
  postalCode: "69001", streetAddress: "1 rue", level1: "L1", level1Name: "Rhône", codeInsee: "69123",
  twitter: "https://t.co/x", facebook: "https://fb/x",
  geo: { "@type": "GeoCoordinates", latitude: "45.76", longitude: "4.83" },
  geoPosition: { type: "Point", coordinates: [4.83, 45.76] },
};

// composites UI attendus en renderOnly (selon l'entité)
const COMPOSITES: Record<string, string[]> = {
  citoyens: ["_location", "_social"],
  organizations: ["_location", "_schedule"],
  projects: ["_location"],
  events: ["_location", "_eventDates", "description"], // event.description : rendue mais non pilotée → renderOnly
  poi: ["_location"],
};

describe.each(Object.keys(EDIT_DESCRIPTORS))("DÉRIVATION config-driven standard — %s (edit)", (entityType) => {
  const render = EDIT_DESCRIPTORS[entityType];
  const pipeline = PROFIL_DESCRIPTORS[entityType];
  const merged = mergeRenderPipeline(render, pipeline);
  const config = formDescriptorToConfig(merged);
  const d2 = configToDescriptor(config, { tLoc });

  const mergedSpec: FormSpec = { descriptor: merged };
  const d2Spec: FormSpec = { descriptor: d2 };

  it("1. fusionné → JsonFormConfig VALIDE + round-trip sans perte (serializeGroups préservés)", () => {
    expect(() => JsonFormConfigSchema.parse(config)).not.toThrow();
    expect(config.serializeGroups).toEqual(pipeline.serializeGroups);
    expect(norm(d2).fields).toEqual(norm(merged).fields);
    expect(norm(d2).serializeGroups).toEqual(merged.serializeGroups);
  });

  it("2. seedEntity (READ) via fusionné === seedProfileFormValues live (byte-parité)", () => {
    const live = seedProfileFormValues(entityType, entity);
    expect(seedEntity(mergedSpec, entity)).toEqual(live);
    expect(seedEntity(d2Spec, entity)).toEqual(live); // ET via le descripteur ISSU DE LA CONFIG
  });

  it("3. buildPayload (WRITE) via fusionné === buildProfileUpdateData live (byte-parité)", () => {
    const live = buildProfileUpdateData(entityType, formValues);
    expect(buildPayload(mergedSpec, formValues)).toEqual(live);
    expect(buildPayload(d2Spec, formValues)).toEqual(live); // ET via le descripteur ISSU DE LA CONFIG
  });

  it("4. composites UI → renderOnly ; champs pipeline plats (adresse) présents", () => {
    for (const c of COMPOSITES[entityType]) {
      expect(merged.fields[c], `${c} doit exister`).toBeTruthy();
      expect(merged.fields[c].renderOnly, `${c} doit être renderOnly`).toBe(true);
    }
    // membres plats du groupe adresse (pipeline-only) injectés
    expect(merged.fields.addressCountry).toMatchObject({ group: "address" });
    expect(merged.fields.localityId).toMatchObject({ group: "address" });
  });
});

// ── ADD : render add (différent de edit) + MÊME pipeline → dérivation config + parité WRITE ──────────────
// (pas de parité READ : la création part de defaults, pas de seedProfileFormValues.) Le champ `address`
// (widget location) et `role` (org, injecté hors pipeline par le hook) → renderOnly → omis du payload pipeline.
const ADD_DESCRIPTORS: Array<[string, string, FormDescriptor]> = [
  ["poi", "addPoi", addPoiDescriptor],
  ["projects", "addProject", addProjectDescriptor],
  ["organizations", "addOrganization", addOrganizationDescriptor],
  ["events", "addEvent", buildAddEventDescriptor(false)],
];

describe.each(ADD_DESCRIPTORS)("DÉRIVATION config-driven standard — %s (%s, add)", (entityType, _label, render) => {
  const pipeline = PROFIL_DESCRIPTORS[entityType];
  const merged = mergeRenderPipeline(render, pipeline);
  const config = formDescriptorToConfig(merged);
  const d2 = configToDescriptor(config, { tLoc });

  it("fusionné → JsonFormConfig VALIDE + round-trip sans perte", () => {
    expect(() => JsonFormConfigSchema.parse(config)).not.toThrow();
    expect(norm(d2).fields).toEqual(norm(merged).fields);
    expect(config.serializeGroups).toEqual(pipeline.serializeGroups);
  });

  it("buildPayload (WRITE) via fusionné (et via config) === buildProfileUpdateData live", () => {
    const live = buildProfileUpdateData(entityType, formValues);
    expect(buildPayload({ descriptor: merged }, formValues)).toEqual(live);
    expect(buildPayload({ descriptor: d2 }, formValues)).toEqual(live);
  });

  it("composite `address` (location) → renderOnly ; jamais émis tel quel", () => {
    expect(merged.fields.address).toMatchObject({ widget: "location", renderOnly: true });
    expect("address" in buildPayload({ descriptor: merged }, { ...formValues, address: { foo: 1 } })).toBe(true); // = objet du serializeGroup, pas le composite
  });
});
