/**
 * Parité du cœur générique `runEntityMutation` vs les ex-hooks bespoke. Faux SDK capturant
 * (méthode, payload, scope) + faux draft pour l'édition. Prouve que le spec déclaratif reproduit
 * EXACTEMENT chaque chemin : create standard (org/projet/event), create costum (poi/tiers-lieu),
 * edit (submitEntityEdit), avec extras (role/parent/organizer/email/image) et scope (me vs me.costum).
 */
import { describe, it, expect, vi } from "vitest";
import type { EntityTypes } from "@communecter/cocolight-api-client";
import { runEntityMutation, type EntityMutationSpec } from "./useEntityMutation";
import type { SpecStamp } from "../forms/entityModalSpec";
import { buildParentReference, buildOrganizerReference } from "./mutationUtils";
// side-effect : enregistre pf:* / poi:* / tl:* + fournit les builders de référence.
import { buildProfileUpdateData } from "../forms/editProfilePayload";
import { buildPayload } from "@/modules/formEngine/engine/entityForm";
import { addPoiDescriptor } from "../forms/addPoi.descriptor"; // porte ses transforms (address/geo) en side-effect
import { buildTiersLieuxPayload } from "../forms/costum/tiers-lieux/fns";
import { getDefaultTiersLieuxValues } from "../forms/costum/tiers-lieux/fns";
import { loadCostumForm } from "../forms/costum/__fixtures__/configCostum";

type Data = Record<string, unknown>;

// descripteur tiers-lieux compilé depuis le JSON de config (config.prod) via la voie unique — plus de descriptor.ts TS.
const { descriptor: tiersLieuxDescriptor } = loadCostumForm("tiers-lieux");

// Payload poi standard = pipeline générique direct sur addPoiDescriptor (plus de buildAddPoiPayload).
const buildAddPoiPayload = (d: Data) => buildPayload({ descriptor: addPoiDescriptor }, d) as Data;

/**
 * Faux SDK : capture chaque appel {scope, method, payload} et compte les save().
 *
 * L'entité rendue porte `updateField` et `serverData` comme toute instance `BaseEntity` réelle.
 * Sans eux, `runPathValueStamps` sortait sur son garde `if (!e.updateField)` : les 13 tests de
 * parité ci-dessous traversaient la création sans JAMAIS exercer le canal `pathValue` — celui par
 * lequel passe `reference.costum`, le champ qui rattache une fiche communale au costum régional.
 *
 * `serverData` est nécessaire au-delà de la présence : `fillIfEmpty` s'arbitre CONTRE l'entité
 * retournée par le save.
 */
function makeSdk(opts: { sansUpdateField?: boolean; serverData?: Data } = {}) {
  const calls: Array<{ scope: string; method: string; payload: Data }> = [];
  const updates: Array<{ field: string; value: unknown }> = [];
  let saves = 0;
  const target = (scope: string) => {
    const t: Record<string, unknown> = {};
    for (const m of ["organization", "project", "event", "poi"]) {
      t[m] = async (payload: Data) => {
        calls.push({ scope, method: m, payload });
        return {
          save: async () => { saves += 1; },
          slug: "new-slug",
          serverData: opts.serverData ?? {},
          ...(opts.sansUpdateField
            ? {}
            : { updateField: async (field: string, value: unknown) => { updates.push({ field, value }); } }),
        };
      };
    }
    return t;
  };
  // costum : fidèle à l'overload lib (string slug OU entité chargée → son serverData.slug).
  const me = { ...target("me"), id: "meId", serverData: { name: "Moi" },
    costum: async (arg: unknown) => target(`costum:${typeof arg === "string" ? arg : (arg as { serverData?: { slug?: string } })?.serverData?.slug ?? "entity"}`) };
  return { me: me as unknown as EntityTypes, calls, updates, getSaves: () => saves };
}

/** Faux draft éditable (submitEntityEdit) : data + save + removeProfilImage comptés. */
function makeEditable(serverData: Data = { name: "X" }) {
  const e = {
    data: {} as Data, saves: 0, removes: 0, slug: "edited", serverData,
    updates: [] as Array<{ field: string; value: unknown }>,
    save: async () => { e.saves += 1; },
    removeProfilImage: async () => { e.removes += 1; },
    updateField: async (field: string, value: unknown) => { e.updates.push({ field, value }); },
  };
  return e;
}

/**
 * Faux draft éditable dont le proxy REJETTE les champs hors liste blanche — réplique du
 * `[DraftProxy]` de la lib, dont la liste est celle du costum de PROVENANCE (`source.key`) et
 * non celle du site. `setCostumScope(slug, {pinSchema:true})` ouvre les champs de `slug`.
 */
function makeEditableAvecListeBlanche(autorises: string[], champsCostum: Record<string, string[]>) {
  const scopes: Array<{ slug: string; opts?: { pinSchema?: boolean } }> = [];
  let permis = new Set(autorises);
  const e = {
    saves: 0, slug: "edited", serverData: { name: "X" }, scopes,
    data: new Proxy({} as Data, {
      set: (cible, prop, valeur) => {
        if (typeof prop !== "string") return false;
        if (!permis.has(prop)) throw new Error(`[DraftProxy] Le champ "${prop}" n'est pas autorisé.`);
        cible[prop] = valeur;
        return true;
      },
    }),
    setCostumScope: (slug: string, opts?: { pinSchema?: boolean }) => {
      scopes.push({ slug, opts });
      // Sans `pinSchema`, la lib ne pose que le scope d'ADMINISTRATION : le schéma ne bouge pas.
      if (opts?.pinSchema) permis = new Set([...permis, ...(champsCostum[slug] ?? [])]);
    },
    save: async () => { e.saves += 1; },
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
      buildPayload: (d) => buildTiersLieuxPayload(d as never, tiersLieuxDescriptor, { costum: {} }),
      // STAMP costum : type/preferences posés au CREATE par runEntityMutation via inject.extraFields.
      inject: { extraFields: { type: "NGO", preferences: { isOpenData: true, isOpenEdition: true } } },
    };
    await runEntityMutation(spec, values, { me: sdk.me });
    expect(sdk.calls[0]).toMatchObject({ scope: "costum:franceTiersLieux", method: "organization" });
    expect(sdk.calls[0].payload.type).toBe("NGO"); // STAMP costum (inject.extraFields)
    expect(sdk.calls[0].payload.preferences).toEqual({ isOpenData: true, isOpenEdition: true });
    expect(sdk.calls[0].payload.profil_avatar).toBe(fakeFile);
  });

  it("CREATE RACINE sous déploiement costum : scope = costum AMBIANT (me.costum(contextEntity))", async () => {
    const sdk = makeSdk();
    const contextEntity = { id: "ctx", getEntityType: () => "organizations", serverData: { slug: "youthCare" } } as unknown as EntityTypes;
    const values = { name: "Org", type: "NGO", url: "", tags: [], shortDescription: "" };
    const spec: EntityMutationSpec = {
      ...base, mode: "add", entityType: "organizations",
      buildPayload: (d) => buildProfileUpdateData("organizations", d),
    };
    // ni costumSlug ni spec.target → le costum AMBIANT du déploiement s'applique (legacy : tout create estampillé)
    await runEntityMutation(spec, values, { me: sdk.me, contextEntity });
    expect(sdk.calls[0]).toMatchObject({ scope: "costum:youthCare", method: "organization" });
  });

  it("CREATE sous PARENT sur site costum : ambiant appliqué + lien parent préservé dans le payload", async () => {
    const sdk = makeSdk();
    const contextEntity = { id: "ctx", getEntityType: () => "organizations", serverData: { slug: "youthCare" } } as unknown as EntityTypes;
    const spec: EntityMutationSpec = {
      ...base, mode: "add", entityType: "projects",
      target: fakeRef, // parent SDK (spec.target)
      buildPayload: (d) => buildProfileUpdateData("projects", d),
    };
    await runEntityMutation(spec, { name: "Proj", url: "", tags: [], shortDescription: "" }, { me: sdk.me, contextEntity });
    expect(sdk.calls[0].scope).toBe("costum:youthCare");                       // ambiant MALGRÉ le parent
    expect(sdk.calls[0].payload.parent).toEqual(buildParentReference(fakeRef)); // lien parent préservé (payload)
  });

  it("CREATE EVENT sous parent sur site costum : ambiant + ORGANIZER (pas parent) préservé dans le payload", async () => {
    const sdk = makeSdk();
    const contextEntity = { id: "ctx", getEntityType: () => "organizations", serverData: { slug: "youthCare" } } as unknown as EntityTypes;
    const spec: EntityMutationSpec = {
      ...base, mode: "add", entityType: "events",
      target: fakeRef, // parent SDK → pour un event, l'auto-injection vise organizer
      buildPayload: (d) => buildProfileUpdateData("events", d),
    };
    await runEntityMutation(spec, { name: "Ev", url: "", tags: [], shortDescription: "" }, { me: sdk.me, contextEntity });
    expect(sdk.calls[0].scope).toBe("costum:youthCare");
    expect(sdk.calls[0].payload.organizer).toEqual(buildOrganizerReference(fakeRef, sdk.me));
  });

  it("CREATE : costumSlug EXPLICITE prime sur l'ambiant du déploiement", async () => {
    const sdk = makeSdk();
    const contextEntity = { id: "ctx", getEntityType: () => "organizations", serverData: { slug: "youthCare" } } as unknown as EntityTypes;
    const spec: EntityMutationSpec = {
      ...base, mode: "add", entityType: "poi", costumSlug: "equipementsSportifs974",
      buildPayload: (d) => buildAddPoiPayload(d as never),
    };
    await runEntityMutation(spec, { name: "P", type: "place", tags: [] }, { me: sdk.me, contextEntity });
    expect(sdk.calls[0].scope).toBe("costum:equipementsSportifs974"); // explicite gagne
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

  /**
   * Régression : éditer un lieu LISTÉ par un costum annuaire mais venu d'ailleurs. La liste blanche
   * du draft est celle de sa PROVENANCE (`source.key` = `franceTierslieux`, un costum hors registre,
   * ou rien) — elle ne contient pas les champs du formulaire du site, donc l'écriture était rejetée
   * (`[DraftProxy] Le champ "holderOrganization" n'est pas autorisé.`) alors que la CRÉATION, elle,
   * passait par `me.costum(slug)`. Retirer `schemaCostumSlug` (ou son `pinSchema`) refait échouer ces
   * tests — c'est tout leur objet.
   */
  describe("EDIT costum : épingle du schéma du formulaire (schemaCostumSlug)", () => {
    const CHAMPS_COSTUM = { navigatorDesTierslieux: ["holderOrganization", "typePlace", "manageModel"] };
    const specEdit = (target: unknown, schemaCostumSlug?: string): EntityMutationSpec => ({
      ...base, mode: "edit", entityType: "organizations",
      target: target as EntityTypes, buildPayload: (d) => d, schemaCostumSlug,
    });

    it("épingle le costum du formulaire AVANT l'écriture → les champs costum passent", async () => {
      const editable = makeEditableAvecListeBlanche(["name"], CHAMPS_COSTUM);
      await runEntityMutation(
        specEdit(editable, "navigatorDesTierslieux"),
        { name: "Le lieu", holderOrganization: "SCIC Machin" },
        { me: null },
      );
      expect(editable.scopes).toEqual([{ slug: "navigatorDesTierslieux", opts: { pinSchema: true } }]);
      expect(editable.data).toMatchObject({ name: "Le lieu", holderOrganization: "SCIC Machin" });
      expect(editable.saves).toBe(1);
    });

    it("sans schemaCostumSlug : aucun scope posé et le champ costum est refusé", async () => {
      const editable = makeEditableAvecListeBlanche(["name"], CHAMPS_COSTUM);
      await expect(
        runEntityMutation(specEdit(editable), { name: "Le lieu", holderOrganization: "SCIC Machin" }, { me: null }),
      ).rejects.toThrow(/n'est pas autorisé/);
      expect(editable.scopes).toEqual([]);
    });

    it("entité sans setCostumScope (ancienne instance / faux SDK) : pas d'appel, pas de crash", async () => {
      const editable = makeEditable();
      await runEntityMutation(specEdit(editable, "navigatorDesTierslieux"), { name: "Le lieu" }, { me: null });
      expect(editable.saves).toBe(1);
    });
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

/**
 * Canal PATHVALUE — les écritures post-save, jusqu'ici couvertes par rien.
 *
 * L'enjeu dépasse le mécanisme : `reference.costum` passe par ce canal. C'est le champ qui rattache
 * une fiche créée sur un site COMMUNAL au costum RÉGIONAL, et donc tout le modèle réseau (la commune
 * possède sa donnée via `source.key`, le régional l'affiche via `reference.costum`). Tant que le
 * faux SDK n'exposait pas `updateField`, `runEntityMutation` sortait sur son garde et la seule
 * preuve que le rattachement se posait venait d'une MIGRATION — pas d'une création observée.
 *
 * `preparePathValueStamps` (choix du mode, évaluation des valeurs) est testée à part dans
 * `forms/stamps.test.ts` ; ici on teste le CÂBLAGE : ce qui atteint réellement l'entité.
 */
describe("runEntityMutation — canal pathValue (stamps post-save)", () => {
  const REF: SpecStamp[] = [
    { field: "reference.costum", value: ["equipementsSportifs974"], op: "set", on: "add", channel: "pathValue" },
    { field: "reference.costumTypes.equipementsSportifs974", value: "recoveryCenter", op: "set", on: "add", channel: "pathValue" },
  ];
  const specPoi = (over: Partial<EntityMutationSpec> = {}): EntityMutationSpec => ({
    ...base, mode: "add", entityType: "poi", buildPayload: (d) => d, stamps: REF, ...over,
  });

  it("CRÉATION : le rattachement régional atteint l'entité, chemin et valeur intacts", async () => {
    const sdk = makeSdk();
    await runEntityMutation(specPoi(), { name: "Stade" }, { me: sdk.me });
    expect(sdk.updates).toEqual([
      { field: "reference.costum", value: ["equipementsSportifs974"] },
      { field: "reference.costumTypes.equipementsSportifs974", value: "recoveryCenter" },
    ]);
  });

  it("le stamp n'entre PAS dans le payload de création — c'est une écriture d'après", async () => {
    const sdk = makeSdk();
    await runEntityMutation(specPoi(), { name: "Stade" }, { me: sdk.me });
    expect(sdk.calls[0].payload).toEqual({ name: "Stade" });
  });

  it("`on: \"add\"` ne rejoue pas à l'édition", async () => {
    const editable = makeEditable();
    await runEntityMutation(
      specPoi({ mode: "edit", target: editable as unknown as EntityTypes }),
      { name: "Stade" },
      { me: null },
    );
    expect(editable.updates).toEqual([]);
  });

  it("`on: \"both\"` rejoue à l'édition, sur l'entité éditée", async () => {
    const editable = makeEditable();
    await runEntityMutation(
      specPoi({ mode: "edit", target: editable as unknown as EntityTypes,
        stamps: [{ field: "reference.costum", value: ["eq974"], op: "set", on: "both", channel: "pathValue" }] }),
      { name: "Stade" },
      { me: null },
    );
    expect(editable.updates).toEqual([{ field: "reference.costum", value: ["eq974"] }]);
  });

  it("fillIfEmpty s'arbitre contre le serverData POST-SAVE : le serveur a déjà posé → on s'abstient", async () => {
    const stamps: SpecStamp[] = [{ field: "dateSign", value: "2026-01-01", op: "fillIfEmpty", on: "add", channel: "pathValue" }];
    const dejaPose = makeSdk({ serverData: { dateSign: "2025-06-30" } });
    await runEntityMutation(specPoi({ stamps }), { name: "X" }, { me: dejaPose.me });
    expect(dejaPose.updates).toEqual([]);

    const vide = makeSdk({ serverData: {} });
    await runEntityMutation(specPoi({ stamps }), { name: "X" }, { me: vide.me });
    expect(vide.updates).toEqual([{ field: "dateSign", value: "2026-01-01" }]);
  });

  it("un échec d'écriture ne fait PAS échouer la mutation (canal non bloquant), mais se voit", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sdk = makeSdk();
    const casse = { ...sdk.me } as unknown as Record<string, unknown>;
    casse.poi = async () => ({ save: async () => {}, slug: "s", serverData: {},
      updateField: async () => { throw new Error("legacy 500"); } });
    const { entity } = await runEntityMutation(specPoi(), { name: "X" }, { me: casse as unknown as EntityTypes });
    expect((entity as { slug?: string }).slug).toBe("s"); // la création, elle, a réussi
    expect(warn).toHaveBeenCalledTimes(2); // un warn par stamp perdu
    warn.mockRestore();
  });

  it("une entité SANS updateField ne perd plus le stamp en silence", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sdk = makeSdk({ sansUpdateField: true });
    await runEntityMutation(specPoi(), { name: "X" }, { me: sdk.me });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0][0])).toContain("reference.costum");
    warn.mockRestore();
  });
});
