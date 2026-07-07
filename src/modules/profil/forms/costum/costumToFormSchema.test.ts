/**
 * Garde du générateur `--format costumForm` (`costumToFormSchema`) :
 *  A. le généré passe la voie unique `registerCostumForm` (zod → compile → garde des clés) avec le SEUL
 *     barrel `sharedRegistrations` importé — prouve l'invariant « aucune clé hors clés génériques » ;
 *  B. mapping déterministe : widgets inverses de WIDGET_DEFAULTS, hidden exclus, presets → STAMP
 *     `mutation.inject.extraFields` (+ champs stampés omis), pattern adresse/image, chrome/mutation squelette.
 * Fixture d'artefact INLINE (déterministe) + base RÉELLE de la lib (`describeEntityForm`).
 */
import { describe, it, expect } from "vitest";
import { describeEntityForm } from "@communecter/cocolight-api-client";
import type { CostumFormDescriptor } from "@communecter/cocolight-api-client";
import "./sharedRegistrations"; // SEUL import de clés (PAS de fns métier) — prouve l'invariant shared-only
import { registerCostumForm } from "./costumFormRegistry";
import { CostumFormSchemaZod } from "./costumFormSchema.zod";
import { costumToFormSchema, descriptorToFormSchema, kebabCaseSlug } from "./costumToFormSchema";
import type { CostumExtensionsArtifact } from "@/modules/formEngine/config/costumToConfig";

const ARTEFACT: CostumExtensionsArtifact = {
  costumExtensions: {
    monCostumTest974: {
      organizations: {
        fields: [
          { name: "categorie", path: "categorie", schema: { type: "string" } },
          { name: "surface", path: "surface", schema: { type: "number" } },
          { name: "ouvert", path: "ouvert", schema: { type: "boolean" } },
          { name: "dateEnquete", path: "dateEnquete", schema: { type: "string", "x-format": "date" } },
          { name: "activites", path: "activites", schema: { type: "array" } },
          { name: "theme", path: "theme", schema: { type: "string" }, enum: ["eau", "air", "terre"] },
          { name: "publics", path: "publics", schema: { type: "string" }, enum: ["jeunes", "seniors"], multiple: true },
          { name: "meta", path: "meta", schema: { type: "object" } },
          { name: "interne", path: "interne", schema: { type: "string" } }, // caché (hidden) → exclu
          { name: "statut", path: "statut", schema: { type: "string" } },   // stampé (preset) → exclu
          { name: "alias", path: "extra.alias", schema: { type: "string" } }, // path ≠ name → path émis
        ],
        presets: { type: "NGO", statut: "valide" }, // couvre un champ BASE (type) et un champ COSTUM (statut)
        hidden: ["interne", "shortDescription"],    // costum caché + champ BASE masqué
        add: true,
        createLabel: "Créer la structure",
      },
    },
  },
};

const gen = () =>
  costumToFormSchema(ARTEFACT, "monCostumTest974", "organizations", describeEntityForm("organizations"));

describe("costumToFormSchema — squelette CostumFormSchema posable (fil A / F2)", () => {
  it("A. passe CostumFormSchemaZod ET registerCostumForm avec les seules clés de sharedRegistrations", () => {
    const doc = gen();
    expect(doc).not.toBeNull();
    const parsed = CostumFormSchemaZod.safeParse(doc);
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues)).toBe(true);
    expect(() => registerCostumForm(doc!)).not.toThrow(); // garde des clés incluse (aucune fn métier importée)
  });

  it("B1. identité + sections base/costum + chrome/mutation squelette", () => {
    const doc = gen()!;
    expect(doc.id).toBe("mon-costum-test-974");
    expect(kebabCaseSlug("equipementsSportifs974")).toBe("equipements-sportifs-974");
    expect(doc.entityType).toBe("organizations"); // vocabulaire PLURIEL EntityKind (convention tiers-lieux)
    expect(doc.collection).toBe("organizations");
    expect(doc.costumSlug).toBe("monCostumTest974");
    expect(doc.sections.map((s) => s.id)).toEqual(["base", "costum"]);
    expect(doc.chrome.title.add).toEqual({ fr: "Ajouter — monCostumTest974" });
    expect(doc.chrome.submitLabel?.add).toEqual({ fr: "Créer la structure" }); // createLabel de l'artefact
    expect(doc.mutation.successKey).toEqual({ add: "toast.add.organizationSuccess", edit: "toast.profile.updateSuccess" });
    expect(doc.mutation.errorContext).toEqual({ add: "EntityFormModal · ADD_ORGANIZATION", edit: "EntityFormModal · UPDATE_ORGANIZATION" });
    expect(doc.mutation.invalidateFn).toEqual({ fn: "invalidate:standard", params: { userList: "organizations" } });
  });

  it("B2. widgets déduits des types (inverse WIDGET_DEFAULTS), required jamais deviné, path ≠ name émis", () => {
    const f = gen()!.fields;
    expect(f.categorie).toEqual({ widget: "text", label: { fr: "Categorie" } });
    expect(f.surface.widget).toBe("number");
    expect(f.ouvert.widget).toBe("switch");
    expect(f.dateEnquete.widget).toBe("date");
    expect(f.activites.widget).toBe("tags");
    expect(f.theme).toMatchObject({ widget: "select", enum: [{ value: "eau", label: "eau" }, { value: "air", label: "air" }, { value: "terre", label: "terre" }] });
    expect(f.publics.widget).toBe("multiselect");
    expect(f.meta).toMatchObject({ widget: "hidden", type: "object" }); // pas de widget objet générique
    expect(f.alias.path).toBe("extra.alias");
    for (const name of ["categorie", "surface", "ouvert", "theme", "publics"]) {
      expect(f[name].required, `required deviné sur ${name}`).toBeUndefined();
    }
  });

  it("B3. exclusions : hidden (costum + base masqué) et champs stampés par preset → inject.extraFields", () => {
    const doc = gen()!;
    expect(doc.fields.interne).toBeUndefined();          // costum caché
    expect(doc.fields.shortDescription).toBeUndefined(); // base masquée par l'artefact
    expect(doc.fields.statut).toBeUndefined();           // stampé costum
    expect(doc.fields.type).toBeUndefined();             // stampé base (l'injection écraserait la saisie)
    expect(doc.mutation.inject).toEqual({ extraFields: { type: "NGO", statut: "valide" } });
  });

  it("B4. base org : pattern adresse (groupe + codec partagé), image (bloc modale), formats email/tel/markdown", () => {
    const doc = gen()!;
    expect(doc.serializeGroups).toEqual({ address: { serverKey: "address", read: "address:read", write: "address:write" } });
    expect(doc.fields.address.widget).toBe("location");
    for (const m of ["addressCountry", "addressLocality", "postalCode", "streetAddress", "localityId"]) {
      expect(doc.fields[m], `membre de groupe ${m}`).toEqual({ widget: "hidden", group: "address" });
    }
    expect(doc.image).toEqual({ field: "profil_avatar", existingUrlFrom: "image:profilUrl" });
    expect(doc.fields.profil_avatar.widget).toBe("image");
    expect(doc.fields.email.widget).toBe("email");
    expect(doc.fields.telephone.widget).toBe("tel");
    expect(doc.fields.description.widget).toBe("textarea"); // markdown
    expect(doc.fields.url).toMatchObject({ widget: "text", rules: { url: true } });
    expect(doc.fields.name.required).toBe(true); // required de la BASE curée conservé
  });

  it("gardes : collection non créable ou slug absent → null", () => {
    expect(costumToFormSchema(ARTEFACT, "monCostumTest974", "badges", null)).toBeNull();
    expect(costumToFormSchema(ARTEFACT, "inconnu", "organizations", null)).toBeNull();
  });

  describe("voie LIVE — descriptorToFormSchema (describeForm → CostumFormSchema)", () => {
    // Forme exacte de scope.describeForm() (source live unifiée) — avec enum (présent hors registre).
    const desc: CostumFormDescriptor = {
      slug: "costumLive974",
      collection: "poi",
      costumId: "6a04155ed047177b92399685",
      costumType: "organizations",
      add: true,
      createLabel: "Ajouter un équipement",
      presets: { type: "recoveryCenter" },
      hidden: ["typeCache"],
      fields: [
        { name: "equip_sol", path: "equip_sol", type: "string", multiple: false, enum: ["Bitume", "Gazon"], hidden: false },
        { name: "aps_name", path: "aps_name", type: "array", multiple: true, hidden: false },
        { name: "type", path: "type", type: "string", multiple: false, hidden: false }, // stampé (preset) → omis
        { name: "typeCache", path: "typeCache", type: "string", multiple: false, hidden: true }, // caché → omis
      ],
    };

    const doc = descriptorToFormSchema(desc, null)!;

    it("produit un CostumFormSchema VALIDE + id kebab", () => {
      expect(doc).not.toBeNull();
      expect(doc.id).toBe("costum-live-974");
      expect(CostumFormSchemaZod.safeParse(doc).success).toBe(true);
    });

    it("enum → widget select ; array → tags ; preset stampé → inject + omis ; caché → omis", () => {
      expect(doc.fields.equip_sol).toMatchObject({ widget: "select" });
      expect(doc.fields.equip_sol.enum).toEqual([{ value: "Bitume", label: "Bitume" }, { value: "Gazon", label: "Gazon" }]);
      expect(doc.fields.aps_name).toMatchObject({ widget: "tags" });
      expect(doc.fields.type).toBeUndefined(); // stampé
      expect(doc.fields.typeCache).toBeUndefined(); // caché
      expect(doc.mutation.inject?.extraFields).toEqual({ type: "recoveryCenter" });
    });
  });
});
