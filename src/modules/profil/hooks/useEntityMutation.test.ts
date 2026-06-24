/**
 * Parité du cœur générique `runEntityMutation` vs les ex-hooks bespoke. Faux SDK capturant
 * (méthode, payload, scope) + faux draft pour l'édition. Prouve que le spec déclaratif reproduit
 * EXACTEMENT chaque chemin : create standard (org/projet/event), create costum (poi/tiers-lieu),
 * edit (submitEntityEdit), avec extras (role/parent/organizer/email/image) et scope (me vs me.costum).
 */
import { describe, it, expect } from "vitest";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { runEntityMutation, type EntityMutationSpec } from "./useEntityMutation";
import { buildParentReference, buildOrganizerReference } from "./mutationUtils";
// side-effect : enregistre pf:* / poi:* / tl:* + fournit les builders de référence.
import { buildProfileUpdateData } from "../forms/editProfilePayload";
import { buildAddPoiPayload } from "../forms/costum/poiEquipement/fns";
import { buildTiersLieuxPayload } from "../forms/costum/tiersLieu/fns";
import { getDefaultTiersLieuxValues } from "../forms/costum/tiersLieu/fns";

type Data = Record<string, unknown>;

/** Faux SDK : capture chaque appel {scope, method, payload} et compte les save(). */
function makeSdk() {
  const calls: Array<{ scope: string; method: string; payload: Data }> = [];
  let saves = 0;
  const target = (scope: string) => {
    const t: Record<string, unknown> = {};
    for (const m of ["organization", "project", "event", "poi"]) {
      t[m] = async (payload: Data) => {
        calls.push({ scope, method: m, payload });
        return { save: async () => { saves += 1; }, slug: "new-slug" };
      };
    }
    return t;
  };
  const me = { ...target("me"), id: "meId", serverData: { name: "Moi" }, costum: async (slug: string) => target(`costum:${slug}`) };
  return { me: me as unknown as EntityTypes, calls, getSaves: () => saves };
}

/** Faux draft éditable (submitEntityEdit) : data + save + removeProfilImage comptés. */
function makeEditable() {
  const e = {
    data: {} as Data, saves: 0, removes: 0, slug: "edited", serverData: { name: "X" },
    save: async () => { e.saves += 1; },
    removeProfilImage: async () => { e.removes += 1; },
  };
  return e;
}

const fakeRef = { id: "p1", getEntityType: () => "organizations", serverData: { name: "Parent" } } as unknown as EntityTypes;
const fakeFile = { name: "img.png" } as unknown as File;
const base = { successKey: "s", errorKey: "e", errorContext: "test" };

describe("runEntityMutation — parité avec les hooks bespoke", () => {
  it("CREATE organisation : scope=me, method=organization, role injecté, email vide supprimé", async () => {
    const sdk = makeSdk();
    const values = { name: "Org", type: "NGO", role: "admin", email: "", url: "", tags: ["t"], shortDescription: "" };
    const spec: EntityMutationSpec = {
      ...base, mode: "add", entityType: "organizations",
      buildPayload: (d) => buildProfileUpdateData("organizations", d),
      inject: { role: true, dropEmptyEmail: true },
    };
    const { entity } = await runEntityMutation(spec, values, { me: sdk.me });

    const expected = buildProfileUpdateData("organizations", values);
    expected.role = "admin"; delete expected.email; // email "" supprimé
    expect(sdk.calls).toHaveLength(1);
    expect(sdk.calls[0]).toMatchObject({ scope: "me", method: "organization" });
    expect(sdk.calls[0].payload).toEqual(expected);
    expect(sdk.getSaves()).toBe(1);
    expect((entity as { slug?: string }).slug).toBe("new-slug");
  });

  it("CREATE projet : parent injecté (buildParentReference)", async () => {
    const sdk = makeSdk();
    const values = { name: "Proj", url: "", tags: [], shortDescription: "" };
    const spec: EntityMutationSpec = {
      ...base, mode: "add", entityType: "projects",
      buildPayload: (d) => buildProfileUpdateData("projects", d),
      inject: { role: true, parent: fakeRef },
    };
    await runEntityMutation(spec, values, { me: sdk.me });

    const expected = buildProfileUpdateData("projects", values);
    expected.parent = buildParentReference(fakeRef);
    expect(sdk.calls[0]).toMatchObject({ scope: "me", method: "project" });
    expect(sdk.calls[0].payload).toEqual(expected);
  });

  it("CREATE event : organizer vide → fallback buildOrganizerReference(parent, me)", async () => {
    const sdk = makeSdk();
    const values = { name: "Ev", url: "", tags: [], shortDescription: "" };
    const spec: EntityMutationSpec = {
      ...base, mode: "add", entityType: "events",
      buildPayload: (d) => buildProfileUpdateData("events", d),
      inject: { organizerFallback: fakeRef },
    };
    await runEntityMutation(spec, values, { me: sdk.me });

    expect(sdk.calls[0]).toMatchObject({ scope: "me", method: "event" });
    expect(sdk.calls[0].payload.organizer).toEqual(buildOrganizerReference(fakeRef, sdk.me));
  });

  it("CREATE poi STANDARD : buildAddPoiPayload + parent + extraFields + image (profil_avatar)", async () => {
    const sdk = makeSdk();
    const values = { name: "Poi", type: "place", tags: [], _imageFile: fakeFile, _imageDeleted: false };
    const spec: EntityMutationSpec = {
      ...base, mode: "add", entityType: "poi", imageField: "_imageFile",
      buildPayload: (d) => buildAddPoiPayload(d as never),
      inject: { parent: fakeRef, extraFields: { source: { key: "x" } } },
    };
    await runEntityMutation(spec, values, { me: sdk.me });

    const expected = buildAddPoiPayload({ name: "Poi", type: "place", tags: [] } as never) as Data;
    expected.parent = buildParentReference(fakeRef);
    expected.source = { key: "x" };
    expected.profil_avatar = fakeFile;
    expect(sdk.calls[0]).toMatchObject({ scope: "me", method: "poi" });
    expect(sdk.calls[0].payload).toEqual(expected);
  });

  it("CREATE poi COSTUM : scope = me.costum(slug), method=poi", async () => {
    const sdk = makeSdk();
    const values = { name: "Equip", type: "place", tags: [] };
    const spec: EntityMutationSpec = {
      ...base, mode: "add", entityType: "poi", costumSlug: "equipementsSportifs974",
      buildPayload: (d) => buildAddPoiPayload(d as never),
    };
    await runEntityMutation(spec, values, { me: sdk.me });
    expect(sdk.calls[0]).toMatchObject({ scope: "costum:equipementsSportifs974", method: "poi" });
  });

  it("CREATE tiers-lieu : scope costum, method=organization, type/preferences (config) + logo", async () => {
    const sdk = makeSdk();
    const values = { ...getDefaultTiersLieuxValues(), name: "TL", _logoFile: fakeFile };
    const spec: EntityMutationSpec = {
      ...base, mode: "add", entityType: "organizations", costumSlug: "franceTiersLieux", imageField: "_logoFile",
      buildPayload: (d) => buildTiersLieuxPayload(d as never, { costum: {} }),
    };
    await runEntityMutation(spec, values, { me: sdk.me });
    expect(sdk.calls[0]).toMatchObject({ scope: "costum:franceTiersLieux", method: "organization" });
    expect(sdk.calls[0].payload.type).toBe("NGO"); // contexte costum CREATE (submit.extraData)
    expect(sdk.calls[0].payload.preferences).toEqual({ isOpenData: true, isOpenEdition: true });
    expect(sdk.calls[0].payload.profil_avatar).toBe(fakeFile);
  });

  it("EDIT poi : submitEntityEdit (Object.assign payload + image) + save ; payload pré-construit (identité)", async () => {
    const editable = makeEditable();
    const prebuilt = { name: "Stade", equip_eclair: false, address: { localityId: "abc" } };
    const values = { ...prebuilt, _imageFile: fakeFile, _imageDeleted: false };
    const spec: EntityMutationSpec = {
      ...base, mode: "edit", entityType: "poi", imageField: "_imageFile",
      target: editable as unknown as EntityTypes,
      buildPayload: (d) => d, // la modale a déjà construit le payload (buildPipelinePayload)
    };
    await runEntityMutation(spec, values, { me: null });

    expect(editable.saves).toBe(1);
    expect(editable.data).toMatchObject({ ...prebuilt, profil_avatar: fakeFile });
    expect("_imageFile" in editable.data).toBe(false); // champ UI retiré
    expect("_imageDeleted" in editable.data).toBe(false);
  });

  it("EDIT profil : identité + submitEntityEdit sans image", async () => {
    const editable = makeEditable();
    const prebuilt = { name: "Citoyen", slug: "cit", tags: [] };
    const spec: EntityMutationSpec = {
      ...base, mode: "edit", entityType: "citoyens",
      target: editable as unknown as EntityTypes,
      buildPayload: (d) => d,
    };
    await runEntityMutation(spec, { ...prebuilt }, { me: null });
    expect(editable.saves).toBe(1);
    expect(editable.data).toEqual(prebuilt);
    expect(editable.removes).toBe(0);
  });

  it("EDIT : imageDeleted sans nouveau fichier → removeProfilImage()", async () => {
    const editable = makeEditable();
    const spec: EntityMutationSpec = {
      ...base, mode: "edit", entityType: "poi", imageField: "_imageFile",
      target: editable as unknown as EntityTypes,
      buildPayload: (d) => d,
    };
    await runEntityMutation(spec, { name: "X", _imageDeleted: true }, { me: null });
    expect(editable.saves).toBe(1);
    expect(editable.removes).toBe(1);
  });
});
