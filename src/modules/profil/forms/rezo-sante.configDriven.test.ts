/**
 * Costums EcosystemeSanteReunion — les 4 formulaires (acteur / projet / ressource / lieu) sont chargés
 * depuis `config.prod.rezo-sante-reunion.json` par la VOIE UNIQUE `registerCostumForm`.
 *
 * Ce que ce test garde, et que rien d'autre ne garde (le 4ᵉ point vit dans le describe « lieu de santé ») :
 *
 * 0. Le contrat `lieux-sante` du 30/09 : tag imposé par le codec `fixedTags` = `defaultTags` de
 *    `/lieux-sante` = `hideTags` de sa carte = `$nin` de `/annuaire` et des pages thématiques ; scope de
 *    création et pays par défaut sur les 4 formulaires.
 *
 * 1. `thematic` et `beneficiaires` partent bien au payload. Ce ne sont PAS des champs inventés :
 *    `thematic` est au contrat de base `ADD_ORGANIZATION`, et les trois nœuds
 *    `costum.typeObj.{organizations,projects,poi}.dynFormCostum.beforeBuild.properties` du costum
 *    déclarent ce qui manque (`beneficiaires` côté projets). Un champ hors de cette union serait
 *    retiré EN SILENCE du `element/save` par le DraftProxy du SDK — le piège payé sur parent62.
 *
 * 2. La RÉCONCILIATION `tags` ⇄ `thematic` (codecs `rezoSante:*`, cf. `costum/rezo-sante/fns.ts`) :
 *    les thématiques ne s'affichent pas dans « Mots-clés », cocher pose le tag, **décocher le
 *    retire**, et un mot-clé libre reste supprimable. Elle vit dans le CHAMP et non dans une
 *    `mutation.stamps` : `op:"append"` ne sait qu'ajouter et refusionne `targetServerData`, ce qui
 *    rendait tout tag indélébile (état livré le matin du 08/09, corrigé le jour même).
 *
 * 3. Pourquoi `tags` et pas `thematic` porte le filtrage : toute la surface de filtrage du site
 *    interroge `tags` — les 6 pages `/theme/*` (`defaultFilters.tags.$in`) comme les filtres
 *    « Thématique » de `/projets`, `/annuaire` et `/ressources`. Les 6 libellés sont donc un contrat
 *    avec ces filtres ; le dernier test les compare aux `defaultFilters` réels du fichier de config
 *    plutôt qu'à une liste recopiée ici.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { valuesToPayload, seedFromEntity } from "@/modules/formEngine/engine/fieldPipeline";
import { formDescriptorToConfig } from "@/modules/formEngine";
import { buildPipelineDefaults } from "./jsonFormSubmit";
import { loadCostumForm, costumDoc } from "./costum/__fixtures__/configCostum";

const IDS = ["rezo-sante-acteur", "rezo-sante-projet", "rezo-sante-ressource"] as const;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const cfg = JSON.parse(readFileSync(resolve(ROOT, "config.prod.rezo-sante-reunion.json"), "utf8"));

/** Ce que le formulaire AFFICHE pour une fiche en base. */
const afficheDe = (id: string, enBase: Record<string, unknown>) =>
  seedFromEntity(loadCostumForm(id).descriptor, enBase);

/** Ce que le formulaire ENVOIE pour des valeurs saisies (mode édition = tous les champs émis). */
const envoieDe = (id: string, valeurs: Record<string, unknown>, mode: "add" | "edit" = "edit") =>
  valuesToPayload(loadCostumForm(id).descriptor, valeurs, { emitEmpty: mode === "edit" });

describe("costums EcosystemeSanteReunion — écriture", () => {
  it("projet : thematic et beneficiaires partent au payload, les thématiques rejoignent tags", () => {
    const payload = envoieDe("rezo-sante-projet", {
      name: "Marche nordique à Saint-Leu",
      thematic: ["Activité physique", "Bien-être mental"],
      beneficiaires: ["Personnes de plus de 55 ans", "Personnes en perte d’autonomie"],
      tags: ["littoral"],
    }, "add");

    expect(payload.thematic).toEqual(["Activité physique", "Bien-être mental"]);
    expect(payload.beneficiaires).toEqual(["Personnes de plus de 55 ans", "Personnes en perte d’autonomie"]);
    expect(payload.tags).toEqual(["littoral", "Activité physique", "Bien-être mental"]);
  });

  it("aucune thématique choisie : seuls les mots-clés libres partent", () => {
    expect(envoieDe("rezo-sante-ressource", { name: "Guide", type: "link", thematic: [], tags: ["libre"] }, "add").tags)
      .toEqual(["libre"]);
  });

  it("les 3 formulaires n'AFFICHENT pas les thématiques dans « Mots-clés »", () => {
    const enBase = { name: "N", thematic: ["Nutrition"], tags: ["Nutrition", "littoral"] };
    for (const id of IDS) {
      const affiche = afficheDe(id, enBase);
      expect(affiche.tags, `${id} : la thématique ne doit pas doubler dans les mots-clés`).toEqual(["littoral"]);
      expect(affiche.thematic, id).toEqual(["Nutrition"]);
    }
  });

  it("DÉCOCHER une thématique retire son tag", () => {
    const enBase = { name: "N", thematic: ["Nutrition"], tags: ["Nutrition", "littoral"] };
    for (const id of IDS) {
      const affiche = afficheDe(id, enBase);
      // l'utilisateur décoche tout dans « Thématiques » et ne touche à rien d'autre
      const payload = envoieDe(id, { ...affiche, name: "N", thematic: [] });
      expect(payload.tags, `${id} : « Nutrition » doit disparaître des tags`).toEqual(["littoral"]);
      expect(payload.thematic, id).toEqual([]);
    }
  });

  it("COCHER une thématique de plus pose son tag, sans perdre les autres", () => {
    const enBase = { name: "N", thematic: ["Nutrition"], tags: ["Nutrition", "littoral"] };
    const affiche = afficheDe("rezo-sante-projet", enBase);
    const payload = envoieDe("rezo-sante-projet", { ...affiche, name: "N", thematic: ["Nutrition", "Sommeil"] });
    expect(payload.tags).toEqual(["littoral", "Nutrition", "Sommeil"]);
  });

  it("un mot-clé LIBRE reste supprimable", () => {
    const enBase = { name: "N", thematic: ["Nutrition"], tags: ["Nutrition", "littoral"] };
    const payload = envoieDe("rezo-sante-projet", { name: "N", thematic: ["Nutrition"], tags: [] });
    expect(payload.tags, "« littoral » retiré doit rester retiré").toEqual(["Nutrition"]);
    expect(enBase.tags).toContain("littoral"); // il était bien en base au départ
  });

  it("une édition sans modification réécrit exactement les mêmes tags", () => {
    const enBase = { name: "N", thematic: ["Nutrition"], tags: ["Nutrition", "littoral"] };
    const affiche = afficheDe("rezo-sante-projet", enBase);
    const payload = envoieDe("rezo-sante-projet", { ...affiche, name: "N" });
    expect([...(payload.tags as string[])].sort()).toEqual([...enBase.tags].sort());
  });

  it("un tag égal à une thématique NON renseignée sur la fiche est préservé", () => {
    // Fiche importée : « Nutrition » est un mot-clé libre de son point de vue, il reste visible et
    // n'est pas supprimé au save.
    const enBase = { name: "N", tags: ["Nutrition"] };
    const affiche = afficheDe("rezo-sante-projet", enBase);
    expect(affiche.tags).toEqual(["Nutrition"]);
    expect(envoieDe("rezo-sante-projet", { ...affiche, name: "N" }).tags).toEqual(["Nutrition"]);
  });

  it("les 3 formulaires relisent thematic depuis l'entité, et le projet ses bénéficiaires", () => {
    for (const id of IDS) {
      expect(afficheDe(id, { name: "N", thematic: ["Nutrition"] }).thematic, id).toEqual(["Nutrition"]);
    }
    expect(afficheDe("rezo-sante-projet", { name: "N", beneficiaires: ["0 à 3 ans"] }).beneficiaires)
      .toEqual(["0 à 3 ans"]);
  });

  it("aucun formulaire ne porte d'estampille tags — la réconciliation vit dans le champ", () => {
    // Garde de non-retour : une `mutation.stamps` `append` sur `tags` réintroduirait la refusion de
    // `targetServerData` et rendrait les tags à nouveau indélébiles.
    for (const id of IDS) {
      expect(costumDoc(id).mutation.stamps, `${id} : pas d'estampille attendue`).toBeUndefined();
    }
  });

  it("annuaire : le payload de création satisfait les exigences d'ADD_ORGANIZATION", () => {
    // Deux contraintes du schéma de CRÉATION, toutes deux vérifiées côté CLIENT par AJV — un manquement
    // lève `ApiValidationError: ADD_ORGANIZATION - Request validation failed` sans qu'aucune requête ne
    // parte, donc sans rien à lire côté serveur :
    //   · `role` est REQUIS (`enum: ["admin","member"]`) et n'a AUCUN défaut au schéma. Il ne vient pas
    //     de la machinerie de mutation mais d'un CHAMP du formulaire — c'est ainsi que procède le
    //     formulaire générique du parc (`addOrganization.descriptor.ts` + `inject.role`).
    //   · `email` est `{format:"email"}` SANS alternative `const:""`, contrairement à `url` ou `geo`.
    //     Le pipeline émettant `""` pour tout champ texte vide à la création, il faut l'OMETTRE.
    const creation = envoieDe("rezo-sante-acteur", { name: "Association Test", type: "NGO", role: "admin", email: "" }, "add");
    expect(creation.role, "role est requis par ADD_ORGANIZATION").toBe("admin");
    expect(creation).not.toHaveProperty("email");

    const renseigne = envoieDe("rezo-sante-acteur", { name: "Association Test", type: "NGO", role: "admin", email: "a@b.re" }, "add");
    expect(renseigne.email).toBe("a@b.re");

    const vidage = envoieDe("rezo-sante-acteur", { name: "Association Test", type: "NGO", role: "admin", email: "" });
    expect(vidage.email, "en édition, le vidage doit rester possible").toBe("");
  });

  it("annuaire : le champ role est proposé, avec « admin » par défaut", () => {
    const champ = costumDoc("rezo-sante-acteur").fields.role as { default: string; required: boolean; enum: { value: string }[] };
    expect(champ.default).toBe("admin");
    expect(champ.required).toBe(true);
    expect(champ.enum.map((o) => o.value)).toEqual(["admin", "member"]);
    // le formulaire générique qu'on remplace posait la question : ne pas l'escamoter
    expect(costumDoc("rezo-sante-acteur").sections[0]?.groups?.[0]?.fields).toContain("role");
  });

  it("chaque thématique proposée est reconnue par le filtre d'au moins une page /theme/*", () => {
    const filtres = new Set<string>();
    for (const page of cfg.pages as { sections?: { props?: Record<string, unknown> }[] }[]) {
      for (const section of page.sections ?? []) {
        const inValues = ((section.props?.baseParams as { defaultFilters?: { tags?: { $in?: string[] } } } | undefined)
          ?.defaultFilters?.tags?.$in) ?? [];
        for (const v of inValues) filtres.add(v);
      }
    }
    expect(filtres.size).toBeGreaterThan(0); // la sonde lit bien quelque chose

    for (const id of IDS) {
      const options = (costumDoc(id).fields.thematic as { enum: { value: string }[] }).enum.map((o) => o.value);
      expect(options.length, id).toBe(6);
      expect(options.filter((v) => !filtres.has(v)), `${id} : thématiques sans page`).toEqual([]);
    }
  });
});

/**
 * 4ᵉ formulaire, `rezo-sante-lieu` (30/09) : une organisation taguée « lieux-sante », le marqueur qui
 * la place dans l'annuaire `/lieux-sante`. Le tag est IMPOSÉ par le codec de groupe `fixedTags`
 * (params en config) : jamais saisi, jamais retirable, jamais affiché en doublon dans « Mots-clés ».
 */
describe("costum EcosystemeSanteReunion — lieu de santé", () => {
  const LIEU = "rezo-sante-lieu";
  const TAG = "lieux-sante";
  const lieuxSante = (
    cfg.pages as Array<{ path: string; sections: Array<{ type: string; props: Record<string, unknown> }> }>
  ).find((pg) => pg.path === "/lieux-sante");

  it("la création pose le tag d'annuaire, le type et le rôle sans que l'utilisateur les saisisse", () => {
    const creation = envoieDe(LIEU, { name: "Cabinet Test", tags: ["pharmacie"] }, "add");
    expect(creation.tags).toEqual([TAG, "pharmacie"]);
    // `type` et `role` viennent d'`inject.extraFields` (ajoutés au payload par la mutation, hors pipeline),
    // pas d'un champ : le document doit les porter, sinon ADD_ORGANIZATION refuse la création.
    expect(costumDoc(LIEU).mutation.inject?.extraFields).toEqual({ type: "LocalBusiness", role: "admin" });
  });

  it("sans mot-clé libre, le tag d'annuaire part quand même — la fiche n'en sort jamais", () => {
    expect(envoieDe(LIEU, { name: "Cabinet Test", tags: [] }, "add").tags).toEqual([TAG]);
    expect(envoieDe(LIEU, { name: "Cabinet Test", tags: [] }, "edit").tags).toEqual([TAG]);
  });

  it("le formulaire n'affiche pas le tag d'annuaire dans « Mots-clés », et un mot-clé libre reste supprimable", () => {
    const enBase = { name: "Cabinet Test", tags: [TAG, "pharmacie", "garde"] };
    const affiche = afficheDe(LIEU, enBase);
    expect(affiche.tags).toEqual(["pharmacie", "garde"]);
    const sansGarde = { ...affiche, tags: ["pharmacie"] };
    expect(envoieDe(LIEU, sansGarde).tags).toEqual([TAG, "pharmacie"]);
  });

  it("le tag imposé au formulaire est celui que la page et sa carte filtrent — un seul contrat", () => {
    const params = (costumDoc(LIEU).serializeGroups as Record<string, { params?: { fixed?: string[] } }>).tags.params;
    expect(params?.fixed).toEqual([TAG]);
    const liste = lieuxSante?.sections.find((s) => s.type === "searchProStatic")?.props as
      | { baseParams: { defaultTags?: string[] }; list: { card: { tagColors?: { hideTags?: string[] } } } }
      | undefined;
    expect(liste?.baseParams.defaultTags, "la liste filtre sur le tag").toEqual([TAG]);
    // `hideTags` (égalité stricte), pas `hidePrefixes` : « lieux-sante-mentale » resterait visible.
    expect(liste?.list.card.tagColors?.hideTags, "la carte ne le répète pas").toEqual([TAG]);
  });

  it("revue du 30/09 : bouton public, cache carte invalidé, thèmes sans lieux, route sondable, fiche sans marqueur", () => {
    const entete = lieuxSante?.sections.find((s) => s.type === "searchHeader")?.props as
      | { buttons: Array<{ requiresAdmin?: boolean }> }
      | undefined;
    // Défaut du moteur : un bouton `modal` n'est rendu que pour un admin du costum.
    expect(entete?.buttons[0].requiresAdmin, "le référencement est ouvert à tout utilisateur connecté").toBe(false);
    // La vue carte de searchProStatic a son propre préfixe de cache (30 min) : sans lui, un lieu créé
    // n'apparaît pas sur la carte déjà ouverte.
    for (const id of [...IDS, LIEU]) {
      const keys = (costumDoc(id).mutation.invalidateFn as unknown as { params: { searchKeys: string[] } }).params.searchKeys;
      expect(keys, id).toEqual(expect.arrayContaining(["searchCostumStatic", "searchCostumStaticMapAll"]));
    }
    // Les 6 pages thématiques listent des organisations du même périmètre : les lieux en sont exclus aussi.
    const themes = (cfg.pages as Array<{ path: string; sections: Array<{ type: string; props: Record<string, unknown> }> }>)
      .filter((pg) => pg.path.startsWith("/theme/"));
    expect(themes).toHaveLength(6);
    for (const pg of themes) {
      const props = pg.sections.find((s) => s.type === "searchProStatic")?.props as
        | { baseParams: { defaultFilters: { tags: { $in: string[]; $nin?: string[] } } } }
        | undefined;
      expect(props?.baseParams.defaultFilters.tags.$nin, pg.path).toEqual([TAG]);
    }
    // Le discriminant vit dans `editModalMatch` : c'est ce que sonde la garde d'impact (`__effective__`).
    const route = (cfg.profiles.organizations.editModals as Array<{ editModal: string; editModalMatch?: Record<string, unknown> }>)[0];
    expect(route.editModal).toBe(`edit-${LIEU}`);
    expect(route.editModalMatch).toEqual({ tags: TAG });
    // La fiche ne lit pas le marqueur sous « Thématiques » : `profile-tags.hideTags`.
    const fiche = cfg.profiles.organizations.tabs[0].sections[0].leftSections.find(
      (s: { type: string }) => s.type === "profile-tags",
    ) as { hideTags?: string[] };
    expect(fiche.hideTags).toEqual([TAG]);
  });

  it("un lieu n'est pas un acteur : /annuaire et l'onglet admin Annuaire excluent le tag, l'onglet Lieux le cible", () => {
    // `$nin` est une égalité EXACTE côté serveur (searchFilters) : l'exclusion ne tient que parce que le
    // formulaire écrit le tag tel quel — d'où la comparaison stricte avec `params.fixed`.
    const fixe = (costumDoc(LIEU).serializeGroups as Record<string, { params?: { fixed?: string[] } }>).tags.params?.fixed;
    const acteurs = (cfg.pages as Array<{ path: string; sections: Array<{ type: string; props: Record<string, unknown> }> }>)
      .find((pg) => pg.path === "/annuaire")?.sections.find((s) => s.type === "searchProStatic")?.props as
      | { baseParams: { defaultFilters?: { tags?: { $nin?: string[] } } } }
      | undefined;
    expect(acteurs?.baseParams.defaultFilters?.tags?.$nin).toEqual(fixe);

    type Onglet = { id: string; sections: Array<{ entityType?: string; source?: { defaultTags?: string[]; defaultFilters?: { tags?: { $nin?: string[] } } }; create?: string }> };
    const onglets = cfg.admin.tabs as Onglet[];
    const admAnnuaire = onglets.find((t) => t.id === "annuaire")?.sections[0];
    const admLieux = onglets.find((t) => t.id === "lieux-sante")?.sections[0];
    expect(admAnnuaire?.source?.defaultFilters?.tags?.$nin).toEqual(fixe);
    expect(admLieux?.source?.defaultTags).toEqual(fixe);
    expect(admLieux?.create).toBe(`add-${LIEU}`);
  });

  it("email et téléphone : l'email vide est omis à la création, le téléphone passe par son groupe", () => {
    const creation = envoieDe(LIEU, { name: "Cabinet Test", email: "", telephone: "0262000000", tags: [] }, "add");
    expect(creation).not.toHaveProperty("email");
    expect(creation.telephone, "groupe telephone recomposé").toBeTruthy();
    expect(envoieDe(LIEU, { name: "Cabinet Test", email: "c@x.re", tags: [] }, "add").email).toBe("c@x.re");
  });

  it("recette locale du 30/09 : chaque formulaire crée DANS le costum, et le pays est pré-rempli « RE »", () => {
    // Sans `scope`, la création reposait sur le costum AMBIANT (`useCocolight().entity`) : nul quand le
    // carrier ne se résout pas au boot → fiche créée SANS `source`, donc jamais dans le périmètre
    // (« Test lieu », base locale, 30/09). Le widget d'adresse, lui, ne cherche les villes qu'une fois
    // le pays choisi : « RE » est celui de 4 345 des 4 360 organisations réunionnaises en base.
    for (const id of [...IDS, LIEU]) {
      const doc = costumDoc(id) as { costumSlug: string; scope?: { slugFrom?: string; constant?: string } };
      expect(doc.scope, id).toEqual({ slugFrom: "constant", constant: doc.costumSlug });
      const defauts = buildPipelineDefaults(formDescriptorToConfig(loadCostumForm(id).descriptor), { serverData: {} });
      expect(defauts.addressCountry, `${id} : pays par défaut`).toBe("RE");
      // Une fiche existante garde SON pays : le défaut ne vaut qu'en création.
      expect(afficheDe(id, { name: "N", address: { addressCountry: "FR", localityId: "x" } }).addressCountry).toBe("FR");
    }
  });

  it("décision du 01/10 : les cartes de lieu n'ont ni « Contacter » ni « Suivre »", () => {
    const liste = lieuxSante?.sections.find((s) => s.type === "searchProStatic")?.props as
      | { list: { card: { showActions?: boolean } } }
      | undefined;
    expect(liste?.list.card.showActions).toBe(false);
  });

  it("le bouton de la page ouvre ce formulaire, et sa route d'édition passe AVANT celle de l'acteur", () => {
    const entete = lieuxSante?.sections.find((s) => s.type === "searchHeader")?.props as
      | { buttons: Array<{ modal?: string }> }
      | undefined;
    expect(entete?.buttons.map((b) => b.modal)).toEqual([`add-${LIEU}`]);
    const routes = (cfg.profiles.organizations.editModals as Array<{ editModal: string }>).map((r) => r.editModal);
    expect(routes.indexOf(`edit-${LIEU}`)).toBeLessThan(routes.indexOf("edit-rezo-sante-acteur"));
  });
});
