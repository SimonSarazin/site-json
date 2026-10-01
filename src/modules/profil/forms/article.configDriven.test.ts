/**
 * Costum « parent62-article » — chaque TYPE d'actualité coché (`category`, choix multiple) pose un mot-clé dans
 * `tags`, et ce sont ces mots-clés que lisent les pages et sections. Les codecs `p62article:tagsRead`/`tagsWrite` du champ `tags`
 * font SUIVRE le tag au type (cf. `costum/derivedTags.ts`) ; testé ici par la chaîne RÉELLE du formulaire
 * compilé depuis la config (`seedFromEntity` à l'édition, `valuesToPayload` au save).
 *
 * Ce que ce test verrouille, parce qu'une faute ne se voit nulle part :
 *  - « À la une » et « Zoom sur le réseau » posent EXACTEMENT les tags que filtrent leurs sections de
 *    l'accueil (carrousel `home-featured-poi`, teaser `zoom-reseau`), lus dans la config ;
 *  - changer de type RETIRE l'ancien tag — le défaut de l'ancien `mutation.stamps` `append`, qui le reposait ;
 *  - un tag posé à la main sur une fiche d'un autre type reste visible et modifiable ;
 *  - le choix multiple est stocké en TEXTE « a, b » — le contrat d'écriture POI type `category` en chaîne, un
 *    tableau ferait échouer la création — et une ancienne valeur unique se relit comme un choix ;
 *  - l'estampille ne revient pas (garde de non-retour).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { seedFromEntity, valuesToPayload } from "@/modules/formEngine/engine/fieldPipeline";
import { costumDoc, loadCostumForm } from "./costum/__fixtures__/configCostum";
import { TAG_PAR_TYPE_ACTUALITE } from "./costum/parent62-article/fns";

const doc = costumDoc("parent62-article") as unknown as {
  fields: { category: { enum: Array<{ value: string; label: { fr: string } }> } };
  mutation: { stamps?: Array<{ field: string }> };
};
const { descriptor } = loadCostumForm("parent62-article");

/** Tags affichés à l'ouverture de l'édition d'une fiche serveur. */
const tagsAffiches = (serveur: Record<string, unknown>) => seedFromEntity(descriptor, serveur).tags;
/** Payload envoyé au save pour ces valeurs de formulaire. */
const payload = (valeurs: Record<string, unknown>, edition: boolean) => valuesToPayload(descriptor, valeurs, { emitEmpty: edition });
/** Tags envoyés au save pour ces valeurs de formulaire. */
const tagsEnvoyes = (valeurs: Record<string, unknown>, edition: boolean) => payload(valeurs, edition).tags;

type PropsSection = { baseParams?: { defaultTags?: string[] }; filters?: { tags?: unknown } };

/** Props d'une section des pages de `config.prod.parent62.json`, par `id` (où qu'elle soit imbriquée). */
function propsDeSection(id: string): PropsSection {
  const racine = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const cfg = JSON.parse(readFileSync(resolve(racine, "config.prod.parent62.json"), "utf8"));
  let trouve: PropsSection | undefined;
  const parcourir = (noeud: unknown): void => {
    if (trouve || !noeud || typeof noeud !== "object") return;
    const n = noeud as { id?: string; props?: PropsSection };
    if (n.id === id) trouve = n.props ?? {};
    Object.values(noeud).forEach(parcourir);
  };
  parcourir(cfg.pages);
  if (!trouve) throw new Error(`section ${id} introuvable dans config.prod.parent62.json`);
  return trouve;
}

describe("costum parent62-article — types d'actualité", () => {
  it("propose « À la une » et « Zoom sur le réseau » à côté des types existants", () => {
    expect(doc.fields.category.enum.map((e) => [e.value, e.label.fr])).toEqual([
      ["actualite", "Article simple"],
      ["appel-projet", "Appel à projets"],
      ["offre-emploi", "Offre d'emploi"],
      ["a-la-une", "À la une"],
      ["zoom", "Zoom sur le réseau"],
    ]);
  });

  it("chaque type de la table des tags existe dans le formulaire (pas de clé orpheline)", () => {
    const types = doc.fields.category.enum.map((e) => e.value);
    expect(Object.keys(TAG_PAR_TYPE_ACTUALITE).filter((t) => !types.includes(t))).toEqual([]);
  });

  it("« À la une » pose exactement le tag que filtre le carrousel de l'accueil", () => {
    const [tagCarrousel] = propsDeSection("home-featured-poi").baseParams?.defaultTags ?? [];
    expect(tagsEnvoyes({ name: "x", category: ["a-la-une"], tags: [] }, false)).toEqual([tagCarrousel]);
  });

  it("« Zoom sur le réseau » pose exactement le tag que filtre la section « Zoom sur le réseau » de l'accueil", () => {
    const tagSection = propsDeSection("zoom-reseau").filters?.tags;
    expect(tagsEnvoyes({ name: "x", category: ["zoom"], tags: [] }, false)).toEqual([tagSection]);
  });

  it("chaque type pose son tag à la création ; « Article simple » n'en pose aucun", () => {
    expect(tagsEnvoyes({ category: ["zoom"], tags: ["Famille"] }, false)).toEqual(["Famille", "Zoom"]);
    expect(tagsEnvoyes({ category: ["appel-projet"], tags: [] }, false)).toEqual(["Appels à projets"]);
    expect(tagsEnvoyes({ category: ["offre-emploi"], tags: [] }, false)).toEqual(["Offres d'emploi"]);
    expect(tagsEnvoyes({ category: ["actualite"], tags: ["Famille"] }, false)).toEqual(["Famille"]);
  });
});

describe("costum parent62-article — type en choix multiple", () => {
  it("est un choix multiple", () => {
    expect(descriptor.fields.category.widget).toBe("multiselect");
  });

  it("pose le tag de CHAQUE type coché : « À la une » + « Zoom » alimente les deux sections de l'accueil", () => {
    expect(tagsEnvoyes({ category: ["a-la-une", "zoom"], tags: [] }, false)).toEqual(["A la une", "Zoom"]);
  });

  it("stocke les types en texte « a, b » — le contrat d'écriture POI attend une chaîne", () => {
    expect(payload({ name: "x", category: ["a-la-une", "zoom"], tags: [] }, false).category).toBe("a-la-une, zoom");
  });

  it("relit en choix multiple un texte stocké, comme une ancienne valeur unique", () => {
    expect(seedFromEntity(descriptor, { category: "a-la-une, zoom" }).category).toEqual(["a-la-une", "zoom"]);
    expect(seedFromEntity(descriptor, { category: "appel-projet" }).category).toEqual(["appel-projet"]);
  });

  it("décocher « À la une » en gardant « Zoom » retire seulement « A la une »", () => {
    const serveur = { category: "a-la-une, zoom", tags: ["Famille", "A la une", "Zoom"] };
    expect(tagsAffiches(serveur)).toEqual(["Famille"]);
    expect(tagsEnvoyes({ category: ["zoom"], tags: tagsAffiches(serveur) }, true)).toEqual(["Famille", "Zoom"]);
  });
});

describe("costum parent62-article — le tag suit le type à l'édition", () => {
  const alaune = { category: "a-la-une", tags: ["Famille", "A la une"] };

  it("masque le tag du type enregistré dans « Mots-clés »", () => {
    expect(tagsAffiches(alaune)).toEqual(["Famille"]);
  });

  it("passer de « À la une » à « Zoom » retire « A la une » (l'actualité sort du bandeau)", () => {
    expect(tagsEnvoyes({ category: ["zoom"], tags: tagsAffiches(alaune) }, true)).toEqual(["Famille", "Zoom"]);
  });

  it("passer en « Article simple » retire le tag ; tout vider envoie un tableau vide, pas une chaîne", () => {
    expect(tagsEnvoyes({ category: ["actualite"], tags: tagsAffiches(alaune) }, true)).toEqual(["Famille"]);
    expect(tagsEnvoyes({ category: [], tags: [] }, true)).toEqual([]);
  });

  it("garde visible un « A la une » posé à la main sur un autre type", () => {
    expect(tagsAffiches({ category: "actualite", tags: ["A la une"] })).toEqual(["A la une"]);
  });

  it("n'a plus d'estampille sur `tags` : c'est elle qui reposait l'ancien tag (garde de non-retour)", () => {
    expect((doc.mutation.stamps ?? []).filter((s) => s.field === "tags")).toEqual([]);
  });
});
