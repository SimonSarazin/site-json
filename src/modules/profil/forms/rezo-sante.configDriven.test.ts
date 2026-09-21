/**
 * Costums EcosystemeSanteReunion — les 3 formulaires (acteur / projet / ressource) sont chargés depuis
 * `config.prod.rezo-sante-reunion.json` par la VOIE UNIQUE `registerCostumForm`.
 *
 * Ce que ce test garde, et que rien d'autre ne garde :
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
