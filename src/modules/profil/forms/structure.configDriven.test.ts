/**
 * Costum « structure » (Ekilib.re) — formulaire d'ajout d'organisation 100 % config-driven, chargé depuis
 * `config.prod.maison-sport-sante-la-tampon.json` → `costumForms["structure"]` par la VOIE UNIQUE
 * `registerCostumForm` (celle du runtime : zod → compilation → garde des clés).
 *
 * On prouve que le document JSON :
 *  1. compile (donc toutes les clés citées — codecs, validate, image, invalidate — sont enregistrées) ;
 *  2. round-trip config → descripteur SANS PERTE (render + pipeline) ;
 *  3. produit un payload de CRÉATION conforme aux données réelles du costum (l'organisation
 *     « NOUT' SPORT ADAPTÉ » sert d'oracle : adresse imbriquée, thematic + tags, champs représentant) ;
 *  4. respecte le pattern « costum stamp » (§25 bonnes-pratiques) : `type`/`role` posés au CREATE seulement ;
 *  5. reproduit la logique d'affichage conditionnelle de l'ancien formulaire jQuery via `visibleIf`.
 */
import { describe, it, expect } from "vitest";
import type { Organization } from "@communecter/cocolight-api-client";
import { seedEntity, buildPayload, buildEditPayload, type FormSpec } from "@/modules/formEngine/engine/entityForm";
import { JsonFormConfigSchema } from "@/modules/formEngine/config/schema";
import { formDescriptorToConfig } from "@/modules/formEngine/config/formDescriptorToConfig";
import { configToDescriptor } from "@/modules/formEngine/config/configToDescriptor";
import { check } from "@/modules/formEngine";
import { ISO_COUNTRIES_FR } from "@/constants/CountryList";
import { loadCostumForm } from "./costum/__fixtures__/configCostum";
import { specToConfig } from "./resolveModalSpec";
import type { EntityModalCtx } from "./entityModalSpec";
import { thematicToTags } from "./costum/structure/fns";

const { descriptor, spec } = loadCostumForm("structure");

const tLoc = (l: import("@/types/locale-schema").LocalizedString) => l; // préserve le LocalizedString inline
const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const orgLike = (serverData: Record<string, unknown>) => ({ serverData }) as unknown as Organization;
const formSpec: FormSpec = { descriptor };

/** Valeurs de formulaire correspondant à l'organisation réelle « NOUT' SPORT ADAPTÉ ». */
const FILLED = {
  siren: "",
  name: "NOUT' SPORT ADAPTÉ",
  sigle: "",
  affiliate: "Oui",
  thematic: [
    "Sport",
    "Santé/prévention",
    "Social",
    "Insertion",
    "Culture",
    "Scolaire 1er degré - Maternelle et primaire",
    "Scolaire 2nd degré - Collège et Lycée",
    "Périscolaire 1er degré - Maternelle et primaire",
    "Périscolaire 2nd degré - Collège et Lycée",
  ],
  addressCountry: "RE",
  addressLocality: "Tampon",
  postalCode: "97430",
  streetAddress: "79 A, chemin Philomar",
  localityId: "54c0965cf6b95c141800a51e",
  email: "jeremy.enseignant.apa@gmail.com",
  telephone: "692211490",
  legalStatus: "Entreprise, Auto-entrepreneur, Sisa",
  representativeTitle: "Chef.fe d'entreprise",
  representativeCivility: "M.",
  representativeName: "BAUER",
  representativeFirstName: "Jérémy",
  representativeEmail: "jeremy.enseignant.apa@gmail.com",
  representativeTelephone: "692211490",
  responsableSameAsRepresent: false,
  personInChargeTitle: "Chef.fe d'entreprise",
  personInChargeCivility: "M.",
  personInChargeName: "BAUER",
  personInChargeFirstName: "Jérémy",
  personInChargeEmail: "jeremy.enseignant.apa@gmail.com",
  personInChargeTelephone: "692211490",
};

describe("costum structure Ekilib.re — document de config", () => {
  it("1. compile depuis la config par la voie unique (toutes les clés citées sont enregistrées)", () => {
    expect(descriptor.id).toBe("structure");
    expect(descriptor.collection).toBe("organizations");
    expect(spec.mutation.entityType).toBe("organizations");
    // `validate:addressComplete` + les codecs partagés sont résolus par la garde de registerCostumForm.
    expect(descriptor.validate).toBe("validate:addressComplete");
    expect(descriptor.serializeGroups?.address).toEqual({
      serverKey: "address", read: "address:read", write: "address:write",
    });
  });

  it("2. round-trip config → descripteur SANS PERTE (render + pipeline)", () => {
    const config = formDescriptorToConfig(descriptor);
    expect(() => JsonFormConfigSchema.parse(config)).not.toThrow();
    const d2 = configToDescriptor(config, { tLoc });
    expect(norm(d2).fields).toEqual(norm(descriptor).fields);
    expect(norm(d2).serializeGroups).toEqual(descriptor.serializeGroups);
    // points sensibles : ancres composites + champs dérivés
    expect(d2.fields.address).toMatchObject({ widget: "location", renderOnly: true });
    expect(d2.fields._imageFile).toMatchObject({ widget: "image", renderOnly: true });
    expect(d2.fields.postalCode).toMatchObject({ group: "address" });
    expect(d2.fields.geo).toMatchObject({ writeOnly: true, write: "geo:write" });
    // tags n'est plus writeOnly : sa valeur courante est seedée pour que le write MERGE (préservation
    // des tags étrangers — « mss ») au lieu de remplacer. cf. fns.ts structure:tagsFromThematic.
    expect(d2.fields.tags).toMatchObject({ write: "structure:tagsFromThematic" });
    expect(d2.fields.tags.writeOnly).toBeUndefined();
    expect(d2.fields.socialLinks).toMatchObject({ path: "socialNetwork", read: "social:read", write: "social:write" });
  });
});

describe("costum structure Ekilib.re — WRITE (création)", () => {
  const payload = buildPayload(formSpec, FILLED) as Record<string, unknown>;

  it("3. recompose l'adresse imbriquée depuis les champs plats", () => {
    expect(payload.address).toMatchObject({
      "@type": "PostalAddress",
      addressCountry: "RE",
      addressLocality: "Tampon",
      postalCode: "97430",
      streetAddress: "79 A, chemin Philomar",
      localityId: "54c0965cf6b95c141800a51e",
    });
    // les membres du groupe ne fuient jamais à la racine du payload
    for (const k of ["addressCountry", "addressLocality", "postalCode", "streetAddress", "localityId"]) {
      expect(payload).not.toHaveProperty(k);
    }
  });

  it("4. émet les champs métier de la structure et du représentant", () => {
    expect(payload).toMatchObject({
      name: "NOUT' SPORT ADAPTÉ",
      affiliate: "Oui",
      email: "jeremy.enseignant.apa@gmail.com",
      // saisie `telephone` (codec de groupe LOSSLESS partagé du parc, _telSlot par défaut mobile)
      // → objet legacy {mobile:[…]} (128/138 orgs
      // réelles) — plus de clé racine plate.
      telephone: { mobile: ["692211490"] },
      legalStatus: "Entreprise, Auto-entrepreneur, Sisa",
      representativeTitle: "Chef.fe d'entreprise",
      representativeCivility: "M.",
      representativeName: "BAUER",
      representativeFirstName: "Jérémy",
      personInChargeName: "BAUER",
      personInChargeTelephone: "692211490", // CHAÎNE byte-fidèle — cf. test 9bis
    });
    expect(payload.thematic).toEqual(FILLED.thematic);
  });

  it("5. dérive `tags` (libellés courts) depuis `thematic` (libellés longs)", () => {
    // Exactement les tags de l'organisation réelle : « Periscolaire » sans accent, « 2eme » en toutes lettres.
    expect(payload.tags).toEqual([
      "Sport", "Santé/prévention", "Social", "Insertion", "Culture",
      "Scolaire 1er degré", "Scolaire 2nd degré", "Periscolaire 1er degré", "Periscolaire 2eme degré",
    ]);
  });

  it("6. omet `tags` quand aucune thématique n'est cochée (jamais d'écrasement accidentel)", () => {
    const p = buildPayload(formSpec, { ...FILLED, thematic: [] }) as Record<string, unknown>;
    expect(p).not.toHaveProperty("tags");
    expect(thematicToTags([])).toEqual([]);
    expect(thematicToTags(undefined)).toEqual([]);
  });

  it("7. pré-remplit le pays sur La Réunion à l'ouverture du formulaire", () => {
    //  la saisie démarre sur "RE", donc l'autocomplete de ville est utilisable dès le premier écran.
    const defaults = specToConfig(spec).buildDefaults({
      mode: "add", entity: null, parent: null, scope: undefined, me: null, carrier: null, costum: undefined,
    } as unknown as EntityModalCtx);
    expect(defaults.addressCountry).toBe("RE");
    // les autres champs d'adresse restent vides — seul le pays est amorcé
    expect(defaults.addressLocality).toBe("");
    expect(defaults.postalCode).toBe("");
    // "RE" est un territoire au régime FRANÇAIS → autocomplete de rue + code postal actifs (ISO_COUNTRIES_FR)
    expect(ISO_COUNTRIES_FR).toContain("RE");
  });

  it("8. les pièces justificatives ne partent JAMAIS dans le payload element/save", () => {
    // Le widget `file` collecte localement ; l'upload se fait APRÈS le save, via processGalleryFields →
    // entity.uploadDocument(). Double protection : `renderOnly` (pipeline) + purge des valeurs galerie
    // dans runEntityMutation. On vérifie ici la première.
    expect(descriptor.fields.statusFile).toMatchObject({ widget: "file", renderOnly: true });
    expect(descriptor.fields.responsableCivilePro).toMatchObject({ widget: "file", renderOnly: true });
    const p = buildPayload(formSpec, {
      ...FILLED,
      statusFile: { existing: [], added: [new File(["x"], "statuts.pdf")], removedDocIds: [], contentKey: "statusFile", docType: "file" },
    }) as Record<string, unknown>;
    expect(p).not.toHaveProperty("statusFile");
    expect(p).not.toHaveProperty("responsableCivilePro");
  });

  it("9. chaque pièce a son propre `contentKey` (documents distincts, pas d'écrasement)", () => {
    const wp = (n: string) => descriptor.fields[n].widgetProps as Record<string, unknown>;
    expect(wp("statusFile").contentKey).toBe("statusFile");
    expect(wp("responsableCivilePro").contentKey).toBe("responsableCivilePro");
    // docType "file" → _prepareUploadFile (large spectre) et non la whitelist MIME image
    expect(wp("statusFile").docType).toBe("file");
    expect(wp("responsableCivilePro").docType).toBe("file");
    expect(wp("statusFile").maxItems).toBe(1);
  });

  it("9bis. envoie siren/téléphones en CHAÎNE BYTE-FIDÈLE (le + et les espaces préservés)", () => {
    // L'ancien contournement `number:fromDigits` coerçait ces 3 champs en NOMBRE tronqué (perte du
    // 0 initial et du « + ») sur une prémisse FAUSSE : l'artefact costum livré les déclare en
    // `oneOf string|number` — les chaînes passent l'AJV telles quelles, et la base est 100 % strings
    // (« 0692 88 33 19 » observé). Politique du repo : stockage string byte-fidèle.
    const p = buildPayload(formSpec, {
      ...FILLED, siren: "123 456 789 00012", representativeTelephone: "+261 34 25 363 35",
      personInChargeTelephone: "06 92 00 11 22",
    }) as Record<string, unknown>;
    expect(p.siren).toBe("123 456 789 00012");
    expect(p.representativeTelephone).toBe("+261 34 25 363 35");
    expect(p.personInChargeTelephone).toBe("06 92 00 11 22");
    // la saisie `telephone` (groupe) sort en objet serveur — jamais de clé plate `mobile`.
    expect(p.telephone).toEqual({ mobile: ["692211490"] });
    expect(p).not.toHaveProperty("mobile");
  });

  it("9ter. omet les champs VIDES à la création (coerce:orUndef, patron email/url)", () => {
    const p = buildPayload(formSpec, {
      ...FILLED, siren: "", representativeTelephone: "", personInChargeTelephone: "",
    }) as Record<string, unknown>;
    for (const k of ["siren", "representativeTelephone", "personInChargeTelephone"]) {
      expect(p).not.toHaveProperty(k);
    }
  });

  it("9quater. ÉDITION : un champ vidé sort en \"\" (clear texte standard → $unset backend, EFFAÇABLE)", () => {
    // L'ancien `clear: null` rendait la valeur INEFFAÇABLE : `stripNullsInPlace` retirait la clé
    // avant l'envoi → jamais d'$unset, la valeur réapparaissait à la réouverture.
    const e = buildEditPayload(formSpec, { ...FILLED, siren: "" }) as Record<string, unknown>;
    expect(e.siren).toBe("");
  });

  it("10. omet `email`/`url` vides (le schéma backend impose un format sur ces champs)", () => {
    const p = buildPayload(formSpec, { ...FILLED, email: "", url: "" }) as Record<string, unknown>;
    expect(p).not.toHaveProperty("email");
    expect(p).not.toHaveProperty("url");
  });
});

describe("costum structure Ekilib.re — spec de mutation", () => {
  const carrier = { id: "carrier-id", serverData: { slug: "associationEkilibre" } };
  const ctx = (mode: "add" | "edit", entity: unknown = null) =>
    ({ mode, entity, parent: null, scope: undefined, me: null, carrier, costum: undefined }) as unknown as EntityModalCtx;
  const config = specToConfig(spec);

  it("11. CREATE : scope costum + stamp type/role (§25)", () => {
    const m = config.buildSpec(ctx("add"));
    expect(m.entityType).toBe("organizations");
    // Slug CONSTANT = `associationEkilibre` : depuis la copie du chantier A (plan mss-la-tampon),
    // le costum du site porte SES propres déclarations (typeObj.organizations 43 props + 3 amendées
    // dont `statusActor`) — le site n'écrit plus sous le costum régional ssbe.
    expect(m.costumSlug).toBe("associationEkilibre");
    // `statusActor` : toute nouvelle structure entre en file de validation ("En cours"), jamais
    // publiée directement — create-only, l'édition ne réémet pas la clé (cf. test suivant).
    // REVENU au canal payload (inject) : déclaré au dynForm copié, il passe la whitelist — le
    // stamp pathValue de contournement est retiré (byte-diff L=B prouvé, probe save-structure-eki).
    // `type` sélectionne la VARIANTE costum (pickCostumOverlay : discriminator === data.type) :
    // "Cooperative" = structure adhérente ; déclaré AUSSI en `identity` (2e couche de la triple
    // déclaration — discriminant costumSubType), l'inject restant l'écrivain.
    expect(m.inject?.extraFields).toEqual({ type: "Cooperative", role: "admin", statusActor: "En cours" });
    expect(m.inject?.dropEmptyEmail).toBe(true);
    expect(m.stamps).toBeUndefined();
    expect(m.imageField).toBe("_imageFile");
  });

  it("12. EDIT : ni scope costum ni stamp — `type`/`role` ne sont jamais réémis", () => {
    const m = config.buildSpec(ctx("edit", orgLike({ name: "x" })));
    expect(m.costumSlug).toBeUndefined();
    expect(m.inject).toBeUndefined();
    const edited = buildEditPayload(formSpec, FILLED) as Record<string, unknown>;
    expect(edited).not.toHaveProperty("type");
    expect(edited).not.toHaveProperty("role");
    // Clé ABSENTE (≠ vide) → Object.assign ne touche pas le statut : une structure validée le reste.
    expect(edited).not.toHaveProperty("statusActor");
  });
});

describe("costum structure Ekilib.re — READ + visibleIf (parité avec l'ancien formulaire)", () => {
  it("13. relit une organisation existante (adresse éclatée en champs plats)", () => {
    const values = seedEntity(formSpec, orgLike({
      name: "NOUT' SPORT ADAPTÉ",
      affiliate: "Oui",
      thematic: FILLED.thematic,
      legalStatus: "Entreprise, Auto-entrepreneur, Sisa",
      representativeName: "BAUER",
      address: {
        "@type": "PostalAddress", addressCountry: "RE", addressLocality: "Tampon",
        postalCode: "97430", streetAddress: "79 A, chemin Philomar", localityId: "54c0965cf6b95c141800a51e",
      },
    }));
    expect(values).toMatchObject({
      name: "NOUT' SPORT ADAPTÉ",
      affiliate: "Oui",
      postalCode: "97430",
      streetAddress: "79 A, chemin Philomar",
      legalStatus: "Entreprise, Auto-entrepreneur, Sisa",
      representativeName: "BAUER",
    });
    // `tags` est writeOnly (dérivé de thematic) → jamais relu dans le formulaire
    expect(values.tags).toBeUndefined();
  });

  it.each([
    ["statusPrimaire", { legalStatus: "Collectivité" }, true],
    ["statusPrimaire", { legalStatus: "Autre" }, false],
    ["statusSecondaire", { legalStatus: "Collectivité", statusPrimaire: "Intercommunalité" }, true],
    ["statusSecondaire", { legalStatus: "Collectivité", statusPrimaire: "Commune" }, false],
    ["statusCommunale", { legalStatus: "Collectivité", statusPrimaire: "Commune" }, true],
    ["statusCommunale", { legalStatus: "Collectivité", statusPrimaire: "Région" }, false],
    ["autreDescription", { legalStatus: "Autre" }, true],
    ["autreDescription", { legalStatus: "Association loi 1901" }, false],
    // Pièces justificatives : « Statuts » réservé à l'entreprise, RC pro aussi pour asso et GIP.
    ["statusFile", { legalStatus: "Entreprise, Auto-entrepreneur, Sisa" }, true],
    ["statusFile", { legalStatus: "Association loi 1901" }, false],
    ["statusFile", { legalStatus: "Collectivité" }, false],
    ["responsableCivilePro", { legalStatus: "Entreprise, Auto-entrepreneur, Sisa" }, true],
    ["responsableCivilePro", { legalStatus: "Association loi 1901" }, true],
    ["responsableCivilePro", { legalStatus: "Groupement d'Intérêt Publique" }, true],
    ["responsableCivilePro", { legalStatus: "Collectivité" }, false],
    ["responsableCivilePro", { legalStatus: "" }, false],
    ["affiliateTo", { affiliate: "Oui" }, true],
    ["affiliateTo", { affiliate: "Non" }, false],
    ["otherRepresentativeTitle", { representativeTitle: "Autre..." }, true],
    ["otherRepresentativeTitle", { representativeTitle: "Président" }, false],
    ["personInChargeName", { responsableSameAsRepresent: false }, true],
    ["personInChargeName", { responsableSameAsRepresent: true }, false],
    ["otherPersonInChargeTitle", { responsableSameAsRepresent: false, personInChargeTitle: "Autre..." }, true],
    ["otherPersonInChargeTitle", { responsableSameAsRepresent: true, personInChargeTitle: "Autre..." }, false],
  ])("14. %s visible=%o → %s", (field, values, expected) => {
    expect(check(descriptor.fields[field].visibleIf, values)).toBe(expected);
  });
  /**
   * 15. Groupes `enumOrOther` sur les deux titres : le serveur stocke le titre RÉEL dans la clé que
   * lit la fiche publique (PreviewStructure ne lit QUE `representativeTitle`/`personInChargeTitle`,
   * jamais les `other*`). Avant ce codec, une présidente qui choisissait « Autre... » et saisissait
   * « Coordinatrice » voyait sa fiche afficher « Autre... ».
   */
  describe("15. titres « Autre... » — codec de groupe enumOrOther", () => {
    it("écrit le texte libre DANS la clé lue par la fiche", () => {
      const payload = buildEditPayload(formSpec, {
        ...FILLED,
        representativeTitle: "Autre...",
        otherRepresentativeTitle: "Coordinatrice",
        responsableSameAsRepresent: false,
        personInChargeTitle: "Autre...",
        otherPersonInChargeTitle: "Éducatrice APA",
      }) as Record<string, unknown>;
      expect(payload.representativeTitle).toBe("Coordinatrice");
      expect(payload.personInChargeTitle).toBe("Éducatrice APA");
      // Les porteurs de saisie ne partent PLUS comme clés serveur séparées (le groupe recompose).
      expect(payload).not.toHaveProperty("otherRepresentativeTitle");
      expect(payload).not.toHaveProperty("otherPersonInChargeTitle");
    });

    it("laisse passer une valeur connue sans la déplacer", () => {
      const payload = buildEditPayload(formSpec, {
        ...FILLED,
        representativeTitle: "Président",
        otherRepresentativeTitle: "",
      }) as Record<string, unknown>;
      expect(payload.representativeTitle).toBe("Président");
    });

    it("relit un titre libre stocké en base vers le couple select + texte", () => {
      const values = seedEntity(formSpec, orgLike({ representativeTitle: "Coordinatrice" })) as Record<string, unknown>;
      expect(values.representativeTitle).toBe("Autre...");
      expect(values.otherRepresentativeTitle).toBe("Coordinatrice");
    });

    it("relit une valeur connue telle quelle, sans texte libre", () => {
      const values = seedEntity(formSpec, orgLike({ personInChargeTitle: "Maire.sse" })) as Record<string, unknown>;
      expect(values.personInChargeTitle).toBe("Maire.sse");
      expect(values.otherPersonInChargeTitle).toBe("");
    });
  });
});
