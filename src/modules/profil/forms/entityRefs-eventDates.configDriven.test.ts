/**
 * Édition INTACTE des références d'entité et des dates d'event — rejeu, sans réseau, du pipeline réel
 * (`registerCostumForm` → `specToConfig` → `buildDefaults` / `buildSpec(edit).buildPayload`) sur les
 * trois formulaires costum que la suite e2e du 02/10 a pris en défaut, en live comme en bundle :
 *
 *  - saintpaul-event : `organizer` (`finder`) relu ENRICHI puis renvoyé tel quel → 400 AJV
 *    « unexpected property _id / slug / id » (contrat ADD_EVENT : `additionalProperties:false`) ;
 *  - recovery-center SSBE : `parent` déclaré `tags` → relu `[]` → émis vide → parent EFFACÉ ;
 *  - session-formation SSBE : `startDate`/`endDate` relues en `Date` par le SDK → rejetées par le
 *    codec (chaînes seulement) → clear `""` (`payloadEmitEmptyOnEdit`) → dates EFFACÉES.
 *
 * Le `serverData` a la forme qu'une édition reçoit réellement : l'`about` (legacy comme Node) enrichit
 * chaque référence de `_id`/`slug`/`profilThumbImageUrl`, le SDK y ajoute `id` et relit les dates en
 * `Date` (`ApiClient._normalizeDate`). La forme STOCKÉE, elle, est `{<id>: {type, name}}`.
 *
 * Critère : une édition qui ne touche à rien doit renvoyer chaque référence EXACTEMENT comme la base
 * du diff du SDK (`transformEntityRefs`, SDK `src/types/transforms.ts` l.97-112 : `{type, name}`, dans
 * cet ordre) — le diff compare en `JSON.stringify`, donc à l'identique rien n'est renvoyé.
 */
import { describe, it, expect } from "vitest";
import { loadCostumForm } from "./costum/__fixtures__/configCostum";
import { specToConfig } from "./resolveModalSpec";
import type { EntityModalCtx } from "./entityModalSpec";

type Doc = Record<string, unknown>;

const ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const REF = "682b2ac5e05a1d45844340e7";

/** Une référence telle que l'édition la reçoit (about + SDK). */
const refEnrichie = (type: string, name: string) => ({
  [REF]: {
    type, name,
    _id: { $id: REF }, slug: "porteur", id: REF,
    profilThumbImageUrl: "https://example.org/upload/thumb.png",
  },
});

/** Base du diff du SDK (`transformEntityRefs`) : `{type, name}`, dans cet ordre. */
const baseDuDiff = (ref: Record<string, { type?: string; name?: string }>) =>
  Object.fromEntries(Object.entries(ref).map(([k, o]) => [k, { type: o?.type ?? "", name: o?.name }]));

const debut = new Date("2026-09-15T06:00:00.000Z");
const fin = new Date("2026-09-15T14:00:00.000Z");

const CAS: Array<{ id: string; collection: string; champRef: "organizer" | "parent"; serverData: Doc; dates: boolean }> = [
  {
    id: "saintpaul-event", collection: "events", champRef: "organizer", dates: true,
    serverData: {
      _id: { $id: ID }, id: ID, collection: "events", name: "ZZ event", type: "workshop",
      description: "ZZ description", timeZone: "Indian/Reunion",
      organizer: refEnrichie("organizations", "Club porteur"),
      startDate: debut, endDate: fin,
    },
  },
  {
    id: "sport-sante-bienetre-recovery-center", collection: "poi", champRef: "parent", dates: false,
    serverData: {
      _id: { $id: ID }, id: ID, collection: "poi", name: "ZZ centre", type: "recoveryCenter",
      parent: refEnrichie("organizations", "Sport Santé bien-être"),
    },
  },
  {
    id: "sport-sante-bienetre-session-formation", collection: "events", champRef: "parent", dates: true,
    serverData: {
      _id: { $id: ID }, id: ID, collection: "events", name: "ZZ session", type: "course",
      category: "sessionFormation", timeZone: "Indian/Reunion",
      parent: refEnrichie("organizations", "Centre de formation"),
      organizer: refEnrichie("organizations", "Sport Santé bien-être"),
      startDate: debut, endDate: fin,
    },
  },
];

const editCtx = (collection: string, serverData: Doc) =>
  ({
    mode: "edit", parent: null, scope: undefined, me: null, carrier: null, costum: undefined,
    entity: { serverData, data: serverData, id: ID, getEntityType: () => collection },
  }) as unknown as EntityModalCtx;

describe.each(CAS)("édition intacte — $id", ({ id, collection, champRef, serverData, dates }) => {
  const config = specToConfig(loadCostumForm(id).spec);
  const ctx = editCtx(collection, serverData);
  const seed = config.buildDefaults(ctx) as Doc;
  const payload = config.buildSpec(ctx).buildPayload({ ...seed }) as Doc;
  const attendu = baseDuDiff(serverData[champRef] as Record<string, { type?: string; name?: string }>);

  it(`le seed de « ${champRef} » est la forme stockée {id: {type, name}}`, () => {
    expect(seed[champRef]).toEqual(attendu);
    expect(Object.keys((seed[champRef] as Record<string, Doc>)[REF]!)).toEqual(["type", "name"]);
  });

  it(`le payload renvoie « ${champRef} » à l'identique de la base du diff (donc rien n'est renvoyé)`, () => {
    expect(JSON.stringify(payload[champRef])).toBe(JSON.stringify(attendu));
  });

  it("aucun `parent: []` (le vide qui effaçait le parent)", () => {
    expect(Array.isArray(payload.parent)).toBe(false);
    if (champRef === "parent") expect(payload.parent).toEqual(attendu);
  });

  it.runIf(dates)("startDate / endDate partent en ISO non vide, au même instant (ponctuel)", () => {
    for (const [k, d] of [["startDate", debut], ["endDate", fin]] as const) {
      const v = payload[k];
      expect(typeof v, k).toBe("string");
      expect(v, k).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
      expect(new Date(v as string).getTime(), k).toBe(d.getTime());
    }
  });
});

describe("session-formation — l'organizer reste hors payload", () => {
  it("`organizer` (hidden readOnly) n'est jamais émis : seul le `parent` est éditable", () => {
    const cas = CAS.find((c) => c.id === "sport-sante-bienetre-session-formation")!;
    const config = specToConfig(loadCostumForm(cas.id).spec);
    const ctx = editCtx(cas.collection, cas.serverData);
    const payload = config.buildSpec(ctx).buildPayload(config.buildDefaults(ctx) as Doc) as Doc;
    expect(payload).not.toHaveProperty("organizer");
  });
});
