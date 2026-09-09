import { describe, expect, it } from "vitest";
import type { CagnotteFundableItem } from "../types";
// Import croisé assumé, réservé au test : on rejoue les VRAIS gestes de
// `MilestoneListField` (coform) pour couvrir la chaîne réelle, pas une liste
// fabriquée à la main.
import {
  normalizeDepenseValue,
  removeDepense,
  setDepenseOpen,
  updateDepense,
  type DepenseEntry,
} from "@/modules/coform/utils/depense";
import {
  asRecord,
  buildItemsFromRawDepenses,
  buildResourceFromAnswer,
  getEntityId,
  getNonEmptyRecord,
  getServerData,
  normalizeActionStatus,
  normalizeIdOrNull,
  readEntityPreferences,
  toArray,
  toArrayOrValues,
  toNumber,
  toSafeInt,
  toString,
} from "./dataTransform";

describe("asRecord", () => {
  it("retourne {} pour null/undefined/primitives", () => {
    expect(asRecord(null)).toEqual({});
    expect(asRecord(undefined)).toEqual({});
    expect(asRecord(42)).toEqual({});
    expect(asRecord("hello")).toEqual({});
    expect(asRecord(true)).toEqual({});
  });

  it("retourne l'objet tel quel pour un objet", () => {
    const obj = { foo: "bar", n: 1 };
    expect(asRecord(obj)).toBe(obj);
  });

  it("retourne un tableau tel quel (typé Record)", () => {
    const arr = [1, 2, 3];
    expect(asRecord(arr)).toBe(arr as unknown as Record<string, unknown>);
  });
});

describe("getNonEmptyRecord", () => {
  it("retourne null pour non-objet ou objet vide", () => {
    expect(getNonEmptyRecord(null)).toBeNull();
    expect(getNonEmptyRecord(undefined)).toBeNull();
    expect(getNonEmptyRecord("string")).toBeNull();
    expect(getNonEmptyRecord({})).toBeNull();
  });

  it("retourne l'objet s'il contient au moins une clé", () => {
    const obj = { a: 1 };
    expect(getNonEmptyRecord(obj)).toBe(obj);
  });
});

describe("toArray", () => {
  it("pass-through pour les tableaux", () => {
    const arr = [1, 2, 3];
    expect(toArray(arr)).toBe(arr);
  });

  it("retourne [] pour null/undefined", () => {
    expect(toArray(null)).toEqual([]);
    expect(toArray(undefined)).toEqual([]);
  });

  it("wrappe les valeurs scalaires en [value]", () => {
    expect(toArray(42)).toEqual([42]);
    expect(toArray("hello")).toEqual(["hello"]);
    expect(toArray(false)).toEqual([false]);
  });

  it("wrappe les objets en [obj]", () => {
    const obj = { foo: "bar" };
    expect(toArray(obj)).toEqual([obj]);
  });
});

describe("toArrayOrValues", () => {
  it("pass-through pour les tableaux", () => {
    expect(toArrayOrValues([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("retourne Object.values pour un objet", () => {
    expect(toArrayOrValues({ a: 1, b: 2, c: 3 })).toEqual([1, 2, 3]);
  });

  it("retourne [] pour null/undefined/primitive", () => {
    expect(toArrayOrValues(null)).toEqual([]);
    expect(toArrayOrValues(undefined)).toEqual([]);
    expect(toArrayOrValues(42)).toEqual([]);
  });
});

describe("toNumber", () => {
  it("retourne le number si fini", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(3.14)).toBe(3.14);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-5)).toBe(-5);
  });

  it("retourne 0 pour Infinity / NaN", () => {
    expect(toNumber(Infinity)).toBe(0);
    expect(toNumber(NaN)).toBe(0);
  });

  it("parse les strings numériques", () => {
    expect(toNumber("42")).toBe(42);
    expect(toNumber("3.14")).toBe(3.14);
  });

  it("retourne 0 pour null/undefined/strings invalides", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("not a number")).toBe(0);
  });
});

describe("toString", () => {
  it("retourne la string identique", () => {
    expect(toString("hello")).toBe("hello");
    expect(toString("")).toBe("");
  });

  it('retourne "" pour tout non-string', () => {
    expect(toString(42)).toBe("");
    expect(toString(null)).toBe("");
    expect(toString({ foo: "bar" })).toBe("");
    expect(toString(undefined)).toBe("");
  });
});

describe("normalizeActionStatus", () => {
  it("ne rend que `todo` ou `done` — `done` quelle que soit la casse", () => {
    expect(normalizeActionStatus("done")).toBe("done");
    expect(normalizeActionStatus("Done")).toBe("done");
    expect(normalizeActionStatus("todo")).toBe("todo");
  });

  it("tout statut inconnu, `disabled` compris, vaut `todo` — jamais verrouillé par erreur", () => {
    expect(normalizeActionStatus("disabled")).toBe("todo");
    expect(normalizeActionStatus("archived")).toBe("todo");
    expect(normalizeActionStatus(undefined)).toBe("todo");
    expect(normalizeActionStatus(null)).toBe("todo");
    expect(normalizeActionStatus(42)).toBe("todo");
  });
});

describe("getEntityId", () => {
  it("retourne la string si c'est une string", () => {
    expect(getEntityId("abc123")).toBe("abc123");
  });

  it("retourne '' pour null/undefined/primitives non-string", () => {
    expect(getEntityId(null)).toBe("");
    expect(getEntityId(undefined)).toBe("");
    expect(getEntityId(42)).toBe("");
  });

  it("extrait le .id direct", () => {
    expect(getEntityId({ id: "myId" })).toBe("myId");
  });

  it("extrait Mongo _id.$id", () => {
    expect(getEntityId({ _id: { $id: "mongoId" } })).toBe("mongoId");
  });

  it("extrait Mongo _id._str", () => {
    expect(getEntityId({ _id: { _str: "mongoStr" } })).toBe("mongoStr");
  });

  it("extrait $id à la racine", () => {
    expect(getEntityId({ $id: "rootDollarId" })).toBe("rootDollarId");
  });

  it("priorité : id > _id.$id > _id._str > $id", () => {
    expect(
      getEntityId({
        id: "winner",
        _id: { $id: "loser1", _str: "loser2" },
        $id: "loser3",
      }),
    ).toBe("winner");
  });

  it("retourne '' si aucun id trouvé", () => {
    expect(getEntityId({ foo: "bar" })).toBe("");
    expect(getEntityId({})).toBe("");
  });
});

describe("getServerData", () => {
  it("retourne _serverData en priorité", () => {
    const entity = {
      _serverData: { name: "from _serverData" },
      serverData: { name: "from serverData" },
    };
    expect(getServerData(entity)).toEqual({ name: "from _serverData" });
  });

  it("fallback sur serverData si _serverData absent ou vide", () => {
    expect(getServerData({ serverData: { name: "fallback" } })).toEqual({
      name: "fallback",
    });
    expect(getServerData({ _serverData: {}, serverData: { name: "ok" } })).toEqual({
      name: "ok",
    });
  });

  it("fallback sur le record direct si pas de serverData", () => {
    expect(getServerData({ name: "direct" })).toEqual({ name: "direct" });
  });

  it("retourne {} pour null/undefined/empty", () => {
    expect(getServerData(null)).toEqual({});
    expect(getServerData(undefined)).toEqual({});
    expect(getServerData({})).toEqual({});
  });
});

describe("readEntityPreferences", () => {
  it("lit entity.data.preferences", () => {
    const entity = { data: { preferences: { theme: "dark" } } };
    expect(readEntityPreferences(entity, "data")).toEqual({ theme: "dark" });
  });

  it("lit entity.serverData.preferences", () => {
    const entity = { serverData: { preferences: { theme: "light" } } };
    expect(readEntityPreferences(entity, "serverData")).toEqual({ theme: "light" });
  });

  it("retourne undefined si la source est absente", () => {
    expect(readEntityPreferences({ serverData: { name: "x" } }, "data")).toBeUndefined();
    expect(readEntityPreferences({}, "serverData")).toBeUndefined();
    expect(readEntityPreferences(null, "data")).toBeUndefined();
  });

  it("retourne undefined si preferences n'est pas un objet", () => {
    expect(readEntityPreferences({ data: { preferences: "string-pref" } }, "data")).toBeUndefined();
  });
});

describe("normalizeIdOrNull", () => {
  it("trim une string non-vide", () => {
    expect(normalizeIdOrNull("  abc  ")).toBe("abc");
    expect(normalizeIdOrNull("xyz")).toBe("xyz");
  });

  it('retourne null pour "" / espaces / non-string', () => {
    expect(normalizeIdOrNull("")).toBeNull();
    expect(normalizeIdOrNull("   ")).toBeNull();
    expect(normalizeIdOrNull(null)).toBeNull();
    expect(normalizeIdOrNull(undefined)).toBeNull();
    expect(normalizeIdOrNull(42)).toBeNull();
  });
});

describe("toSafeInt", () => {
  it("tronque les number finis", () => {
    expect(toSafeInt(42)).toBe(42);
    expect(toSafeInt(3.7)).toBe(3);
    expect(toSafeInt(-2.5)).toBe(-2);
    expect(toSafeInt(0)).toBe(0);
  });

  it("retourne 0 pour Infinity / NaN", () => {
    expect(toSafeInt(Infinity)).toBe(0);
    expect(toSafeInt(NaN)).toBe(0);
  });

  it("parse les strings (avec virgule décimale FR)", () => {
    expect(toSafeInt("42")).toBe(42);
    expect(toSafeInt("3,5")).toBe(3);
    expect(toSafeInt("1 234")).toBe(1234);
  });

  it("retourne 0 pour null/undefined/string invalide", () => {
    expect(toSafeInt(null)).toBe(0);
    expect(toSafeInt(undefined)).toBe(0);
    expect(toSafeInt("")).toBe(0);
    expect(toSafeInt("not a number")).toBe(0);
  });
});

describe("buildResourceFromAnswer", () => {
  const answer = {
    id: "answer-1",
    project: { id: "proj-1", name: "Projet du commun" },
    answers: {
      aapStep1: {
        titre: "Mon commun",
        depense: [
          { poste: "Palier 1", priceInt: 1000, milestone: "m1", financer: [{ id: "u1", name: "Alice", amount: 250 }] },
          { poste: "Palier 2", priceInt: 500, milestone: "m2" },
        ],
      },
    },
  };

  it("dérive projet, titre, paliers et totaux depuis la réponse", () => {
    const resource = buildResourceFromAnswer(answer);
    expect(resource).not.toBeNull();
    expect(resource!.id).toBe("answer-1");
    expect(resource!.answerId).toBe("answer-1");
    expect(resource!.projectId).toBe("proj-1");
    expect(resource!.name).toBe("Mon commun");
    expect(resource!.items).toHaveLength(2);
    expect(resource!.resourceTotalAmount).toBe(1500);
    expect(resource!.resourceFinancedAmount).toBe(250);
  });

  it("accepte un depense[] sérialisé en objet (pollution Mongo)", () => {
    const pollue = {
      ...answer,
      answers: { aapStep1: { ...answer.answers.aapStep1, depense: { 0: { poste: "Palier 1", priceInt: 1000 } } } },
    };
    expect(buildResourceFromAnswer(pollue)!.items).toHaveLength(1);
  });

  it("exclut les paliers clôturés des totaux, sans les retirer de la liste", () => {
    const avecClos = {
      ...answer,
      answers: {
        aapStep1: {
          depense: [
            { poste: "Ouvert", priceInt: 100 },
            { poste: "Clos", priceInt: 900, include: false },
          ],
        },
      },
    };
    const resource = buildResourceFromAnswer(avecClos)!;
    expect(resource.items).toHaveLength(2);
    expect(resource.resourceTotalAmount).toBe(100);
  });

  it("reste exploitable sans projet ni dépense — c'est ce qui distingue la phase proposition", () => {
    const resource = buildResourceFromAnswer({ id: "answer-2", answers: {} })!;
    expect(resource.projectId).toBeUndefined();
    expect(resource.items).toEqual([]);
    expect(resource.resourceTotalAmount).toBe(0);
  });

  it("retourne null sans identifiant de réponse — rien à financer", () => {
    expect(buildResourceFromAnswer({ answers: {} })).toBeNull();
    expect(buildResourceFromAnswer(null)).toBeNull();
  });

  it("lit l'étape demandée quand le commun n'utilise pas aapStep1", () => {
    const autreEtape = { id: "answer-3", answers: { etapeX: { titre: "Ailleurs", depense: [{ poste: "P", priceInt: 7 }] } } };
    expect(buildResourceFromAnswer(autreEtape, "etapeX")!.resourceTotalAmount).toBe(7);
    expect(buildResourceFromAnswer(autreEtape)!.items).toEqual([]);
  });
});

describe("buildResourceFromAnswer — financeurs servis en objet keyé par id", () => {
  it("somme les montants au lieu de compter un financeur fantôme à 0 (forme Mongo)", () => {
    // Régression C8 (MR 53) : `toArray` emballait l'objet entier en UN financeur
    // sans `id` ni `amount` — financement à zéro, cofinanceur fantôme.
    const answer = {
      id: "answer-4",
      answers: {
        aapStep1: {
          depense: [
            {
              poste: "Dev",
              price: 1000,
              financer: {
                u1: { id: "u1", name: "Alice", amount: 250 },
                u2: { id: "u2", name: "Bob", amount: 100 },
              },
            },
          ],
        },
      },
    };
    const resource = buildResourceFromAnswer(answer)!;
    expect(resource.resourceFinancedAmount).toBe(350);
    expect(resource.items[0].allFunding.map((f) => f.financerId)).toEqual(["u1", "u2"]);
  });
});

/**
 * Régression 1.3 (MR 53) : dans `MilestoneListField`, `rawDepenses` est la valeur
 * react-hook-form — déjà modifiée par le geste — et `enrichedItems` la photo
 * serveur (`targetResource.items`), figée jusqu'à la soumission. Retourner l'item
 * enrichi tel quel faisait « gagner » le serveur sur la saisie : ligne supprimée
 * toujours affichée, palier clôturé resté « open », montant édité perdu — et, par
 * cascade, « Modifier » ouvrait la modale sur une autre ligne.
 *
 * Les gestes sont rejoués avec les VRAIS helpers du champ (`removeDepense`,
 * `setDepenseOpen`, `updateDepense`, `normalizeDepenseValue`) pour que le test
 * couvre la chaîne réelle, pas une liste fabriquée à la main.
 */
describe("buildItemsFromRawDepenses — la ligne brute (saisie) prime sur la photo serveur", () => {
  function serverItem(
    depenseIndex: number,
    name: string,
    price: number,
    milestoneId: string,
    extra: Partial<CagnotteFundableItem> = {},
  ): CagnotteFundableItem {
    return {
      fromType: "depense",
      itemId: String(depenseIndex),
      milestoneId,
      depenseIndex,
      name,
      description: "",
      price,
      status: "open",
      actions: [],
      funding: [],
      currentFunding: 0,
      unpaidFunding: 0,
      userPledge: 0,
      allFunding: [],
      ...extra,
    };
  }

  // Photo serveur : [0] Développement 5 000 € (ms-a), [1] Hébergement 300 € (ms-b).
  const server = (): CagnotteFundableItem[] => [
    serverItem(0, "Développement", 5000, "ms-a"),
    serverItem(1, "Hébergement", 300, "ms-b"),
  ];

  const localInitial = (): DepenseEntry[] => [
    { poste: "Développement", price: 5000, milestone: "ms-a" },
    { poste: "Hébergement", price: 300, milestone: "ms-b" },
  ];

  it("suppression locale de la ligne 0 → seule la survivante reste, appariée par milestoneId", () => {
    const local = removeDepense(localInitial(), 0);
    const enriched = server();
    const items = buildItemsFromRawDepenses(normalizeDepenseValue(local), enriched);

    expect(items.map((i) => i.name)).toEqual(["Hébergement"]);
    expect(items[0].milestoneId).toBe("ms-b");
    // L'item retourné n'est plus l'objet serveur tel quel…
    expect(items[0]).not.toBe(enriched[0]);
    expect(items[0]).not.toBe(enriched[1]);
    // … et son index est l'index LOCAL, celui que `list[item.depenseIndex]` relit.
    expect(items[0].depenseIndex).toBe(0);
    expect(items[0].itemId).toBe("0");
  });

  it("clôture locale (include:false) → le palier passe en « close »", () => {
    const local = setDepenseOpen(localInitial(), 0, false);
    const items = buildItemsFromRawDepenses(normalizeDepenseValue(local), server());
    expect(items[0].status).toBe("close");
    expect(items[1].status).toBe("open");
  });

  it("montant édité localement à 7 000 → price 7 000, pas l'ancien montant serveur", () => {
    const local = updateDepense(localInitial(), 0, { price: 7000 });
    const items = buildItemsFromRawDepenses(normalizeDepenseValue(local), server());
    expect(items[0].price).toBe(7000);
  });

  it("libellé et description édités localement sont ceux affichés", () => {
    const local = updateDepense(localInitial(), 1, { poste: "Hébergement mutualisé", description: "Serveur partagé" });
    const items = buildItemsFromRawDepenses(normalizeDepenseValue(local), server());
    expect(items[1].name).toBe("Hébergement mutualisé");
    expect(items[1].description).toBe("Serveur partagé");
  });

  it("ajout local d'une 3e ligne → toute la liste reflète le local", () => {
    const local: DepenseEntry[] = [...localInitial(), { poste: "Formation", price: 900, milestone: "ms-c" }];
    const items = buildItemsFromRawDepenses(normalizeDepenseValue(local), server());
    expect(items.map((i) => i.name)).toEqual(["Développement", "Hébergement", "Formation"]);
    expect(items.map((i) => i.depenseIndex)).toEqual([0, 1, 2]);
  });

  it("cascade « Modifier » : l'item affiché et la ligne relue par `list[depenseIndex]` sont la même", () => {
    // Avant : affiché « Développement » (item serveur 0), édité « Hébergement »
    // (list[0] local) — valider écrasait la survivante.
    const local = removeDepense(localInitial(), 0);
    const items = buildItemsFromRawDepenses(normalizeDepenseValue(local), server());
    const affiche = items[0];
    const valeursInitiales = { name: String(local[affiche.depenseIndex]?.poste ?? "") };
    expect(affiche.name).toBe("Hébergement");
    expect(valeursInitiales.name).toBe("Hébergement");
  });

  it("de l'enrichi apparié, on ne reprend que les actions et les agrégats de financement", () => {
    const enriched = server();
    const actions = [{ id: "act-1", name: "Installer" }] as unknown as CagnotteFundableItem["actions"];
    const allFunding = [
      { id: "u1", financerName: "Alice", financerId: "u1", amount: 250, date: 1, paymentStatus: "paid", transactionId: "t1" },
    ] as CagnotteFundableItem["allFunding"];
    enriched[1] = serverItem(1, "Hébergement", 300, "ms-b", {
      actions,
      allFunding,
      funding: allFunding,
      currentFunding: 250,
      unpaidFunding: 250,
      userPledge: 250,
    });

    // Après suppression de la ligne 0, la survivante (ms-b) est en position 0.
    const local = updateDepense(removeDepense(localInitial(), 0), 0, { price: 7000 });
    const [item] = buildItemsFromRawDepenses(normalizeDepenseValue(local), enriched);

    expect(item.actions).toBe(actions);
    expect(item.allFunding).toBe(allFunding);
    expect(item.funding).toBe(allFunding);
    expect(item.currentFunding).toBe(250);
    expect(item.unpaidFunding).toBe(250);
    expect(item.userPledge).toBe(250);
    // … tandis que les champs édités restent ceux de la saisie.
    expect(item.price).toBe(7000);
    expect(item.name).toBe("Hébergement");
    expect(item.depenseIndex).toBe(0);
  });

  it("une ligne sans milestone n'est jamais appariée par position", () => {
    // L'item serveur 0 (ms-a) était retourné pour TOUTE ligne locale en position 0.
    const local: DepenseEntry[] = [{ poste: "Sans palier", price: 10 }];
    const enriched = server();
    enriched[0] = serverItem(0, "Développement", 5000, "ms-a", { currentFunding: 999 });
    const [item] = buildItemsFromRawDepenses(normalizeDepenseValue(local), enriched);
    expect(item.name).toBe("Sans palier");
    expect(item.price).toBe(10);
    expect(item.milestoneId).toBe("");
    expect(item.currentFunding).toBe(0);
  });

  it("neutre pour des dépenses SERVEUR (fiche AAC) : brut et enrichi décrivent la même ligne", () => {
    // `CommunFinancingSection` / `CommunFinancingCard` / `CommunCofinancersTable`
    // passent `answers.<step>.depense` du document (clé `price`, jamais `priceInt`)
    // et les items de l'enveloppe : la fusion doit rendre exactement l'enrichi,
    // à l'identité d'objet près.
    const actions = [{ id: "act-1" }] as unknown as CagnotteFundableItem["actions"];
    const enriched = [
      serverItem(0, "Développement", 5000, "ms-a", { actions, currentFunding: 250 }),
      serverItem(1, "Hébergement", 300, "ms-b"),
    ];
    const document = [
      { poste: "Développement", price: 5000, milestone: "ms-a", financer: [{ id: "u1", amount: 250 }] },
      { poste: "Hébergement", price: 300, milestone: "ms-b", include: true },
    ];
    const items = buildItemsFromRawDepenses(document, enriched);
    expect(items).toHaveLength(2);
    items.forEach((item, i) => {
      expect(item.name).toBe(enriched[i].name);
      expect(item.price).toBe(enriched[i].price);
      expect(item.status).toBe(enriched[i].status);
      expect(item.milestoneId).toBe(enriched[i].milestoneId);
      expect(item.depenseIndex).toBe(enriched[i].depenseIndex);
      expect(item.itemId).toBe(enriched[i].itemId);
      expect(item.actions).toBe(enriched[i].actions);
      expect(item.currentFunding).toBe(enriched[i].currentFunding);
    });
  });

  it("sans item enrichi : financeurs en objet keyé par id → montants sommés, pas de financeur fantôme", () => {
    // Régression C8 (MR 53), même famille que C7 côté adaptateur.
    const raw = [
      {
        poste: "Dev",
        price: 100,
        financer: {
          u1: { id: "u1", name: "Alice", amount: 250 },
          u2: { id: "u2", name: "Bob", amount: 100 },
        },
      },
    ];
    const [item] = buildItemsFromRawDepenses(raw, []);
    expect(item.currentFunding).toBe(350);
    expect(item.allFunding.map((f) => f.financerId)).toEqual(["u1", "u2"]);
    expect(item.allFunding.map((f) => f.amount)).toEqual([250, 100]);
  });

  it("contrôle : sans enrichi, la saisie locale est reflétée telle quelle", () => {
    const local = updateDepense(setDepenseOpen(removeDepense(localInitial(), 0), 0, false), 0, { price: 7000 });
    const items = buildItemsFromRawDepenses(normalizeDepenseValue(local), []);
    expect(items.map((i) => i.name)).toEqual(["Hébergement"]);
    expect(items[0].status).toBe("close");
    expect(items[0].price).toBe(7000);
  });
});
