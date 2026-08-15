import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoClient, type Db } from "mongodb";
import { config } from "dotenv";

import Cocolight, { setCostumForceLive } from "@communecter/cocolight-api-client";
// Enregistre TOUTES les clés de registre (widgets, transforms, defaults, scopes…) — exactement comme au
// boot via EntityFormModal. Sans lui, `registerCostumForm` refuse les specs qui les référencent.
import "@/modules/profil/forms/registerSpecFns";
import { registerCostumForm } from "@/modules/profil/forms/costum/costumFormRegistry";
import { specToConfig } from "@/modules/profil/forms/resolveModalSpec";
import { runEntityMutation } from "@/modules/profil/hooks/useEntityMutation";
import type { CostumFormSchema } from "@/modules/profil/forms/costum/compileCostumSchema";

/**
 * E2E COMPLET des forms costum — ADD puis EDIT, par la VRAIE chaîne, contre un VRAI backend.
 *
 * Pourquoi passer par `runEntityMutation` plutôt que de reposter le payload soi-même : c'est le point
 * d'entrée UNIQUE de la création et de l'édition, et il enchaîne cinq phases qu'une réimplémentation
 * couvre toujours à moitié —
 *     payload + applyPayloadStamps → scope.X(payload).save()
 *       → processGalleryFields (images/documents, endpoint SÉPARÉ)
 *       → runPathValueStamps (ex. `reference.costum` + annotation de sous-type)
 *       → edit = submitEntityEdit (Object.assign + save + removeImage)
 * — dont trois n'étaient couvertes par aucun test. On lui passe les valeurs BRUTES du widget : c'est le
 * pipeline réel qui applique les transforms `write`, donc plus aucune table à maintenir ici.
 *
 * Ce que ce niveau prouve et qu'AUCUN contrôle de schéma ne peut prouver : la FORME STOCKÉE. Le bug qui
 * a motivé ce test venait de là — un import avait posé 30 fiches en tableaux là où 3 031 étaient en
 * chaînes, le scanner d'artefact a pris les 30 pour la norme, et les formulaires ont été bâtis dessus.
 * D'où l'assertion centrale : « ce que le formulaire écrit ressemble-t-il à ce que la colonne contient ? »
 *
 * DEUX MODES (`E2E_MODE`) : `bundle` (artefact vendoré) et `live` (inférence depuis l'`inputType`). Un
 * costum ABSENT de l'artefact retombe sur le live même en mode bundle — le test l'annonce au lieu de
 * faire croire à deux chemins. Un mode par PROCESSUS : `setCostumForceLive` et le cache costum sont des
 * singletons de module, sans invalidation exportée.
 *
 * AUTO-SKIP sans `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` dans `.env.test` (patron des e2e du backend) : la suite reste sans risque, ce test
 * écrivant dans une vraie base. Identifiants JAMAIS en dur — ce fichier est versionné.
 */

// Identifiants : `.env.test` (ignoré par git), via la convention DÉJÀ en place dans ce dépôt
// (`TEST_USER_EMAIL` / `TEST_USER_PASSWORD`) — pas de nouvelles clés, pas de valeur par défaut.
config({ path: resolve(__dirname, "../../.env.test"), quiet: true });
const EMAIL = process.env.TEST_USER_EMAIL;
const PWD = process.env.TEST_USER_PASSWORD;
const MODE = process.env.E2E_MODE === "live" ? "live" : "bundle";
const BACKEND = process.env.E2E_BACKEND ?? "http://127.0.0.1:5099";
const MONGO = process.env.E2E_MONGO ?? "mongodb://127.0.0.1:5018";
const MONGO_DB = process.env.E2E_MONGO_DB ?? "communecter";
const runner = EMAIL && PWD ? describe : describe.skip;

const RACINE = resolve(__dirname, "../..");
const TAG = randomBytes(3).toString("hex");

type Doc = Record<string, unknown>;

/** Tous les `costumForms` du parc — pas une table en dur, qui rouillerait au premier form ajouté. */
function tousLesForms(): Array<{ site: string; id: string; doc: CostumFormSchema }> {
  const out: Array<{ site: string; id: string; doc: CostumFormSchema }> = [];
  for (const f of readdirSync(RACINE).filter((x) => /^config\.prod.*\.json$/.test(x))) {
    const cfg = JSON.parse(readFileSync(resolve(RACINE, f), "utf8")) as { costumForms?: Record<string, CostumFormSchema> };
    for (const [id, doc] of Object.entries(cfg.costumForms ?? {})) {
      out.push({ site: f.replace("config.prod.", "").replace(".json", ""), id, doc });
    }
  }
  return out;
}

/**
 * Clés STRUCTURELLES : pilotées par le socle (adresse/geo), par une ancre composite (dates d'event) ou
 * par une relation (parent/organizer). Leur donner une valeur inventée casse le pipeline réel —
 * `openingHours` attend une semaine, `parent` un ObjectId. On les laisse au socle.
 */
const STRUCTURELLES = new Set(["address", "addressCountry", "addressLocality", "postalCode", "streetAddress",
  "localityId", "codeInsee", "geo", "geoPosition", "startDate", "endDate", "recurrency", "openingHours",
  "timeZone", "eventDates", "parent", "organizer"]);

/** Valeur plausible pour un widget — l'`enum` déclaré prime, sinon on écrirait hors liste. */
function valeurPour(champ: string, def: Doc, nom: string): unknown {
  if (STRUCTURELLES.has(champ) || def.group) return undefined;
  const e = def.enum as unknown[] | undefined;
  const premiere = Array.isArray(e) && e.length ? ((e[0] as Doc)?.value ?? e[0]) : null;
  const multi = ["urlList", "multiselect", "checkboxGroup", "tags"].includes(String(def.widget))
    || (def.widget === "valueSelect" && (def.widgetProps as Doc | undefined)?.multiple !== false);
  if (/email/i.test(champ)) return "zz-e2e@example.org";
  // image/photo/logo : la LECTURE normalise en URL absolue (préfixe serveur) — une valeur non-URL serait
  // « modifiée » au round-trip d'édition sans que personne n'ait touché le champ.
  if (/image|photo|logo|avatar/i.test(champ) && def.widget !== "image") return "https://example.org/zz.png";
  if (/url/i.test(champ)) return multi ? ["https://example.org/zz"] : "https://example.org/zz";
  switch (def.widget) {
    case "switch": case "checkbox": case "toggle": return true;
    case "number": return 42;
    case "multiselect": case "checkboxGroup": case "tags": case "urlList": return [premiere ?? `ZZ ${champ}`];
    case "valueSelect": return multi ? [premiere ?? `ZZ ${champ}`] : (premiere ?? `ZZ ${champ}`);
    case "select": case "selectFromLists": return premiere ?? `ZZ ${champ}`;
    case "date": return "2026-01-15"; // ISO : la forme stockée du parc (mesuré IB "2024-04-16"), le read la round-trip
    // `hidden` ≠ « pas de valeur » : `description` et `tags` d'`equipements-sportifs` sont des champs de
    // CONTENU déclarés hidden (le legacy les masque) et partent bien dans element/save. Les hidden
    // STRUCTURELS, eux, sont déjà écartés plus haut.
    case "hidden": return def.type === "boolean" ? false : def.type === "array" ? [`ZZ ${champ}`] : def.type === "object" ? undefined : `ZZ ${champ}`;
    case "markdown": case "textarea": case "text": case "email": case "tel":
      return champ === "name" ? nom : `ZZ ${champ}`;
    default: return undefined; // image/file/location/eventDates : ancres pilotées à part (cf. socle)
  }
}

runner(`forms costum — add + edit e2e (mode ${MODE})`, () => {
  let mc: MongoClient;
  let base: Db;
  let me: Doc;
  let socle: Doc;
  const crees: Array<{ coll: string; id: unknown }> = [];
  let comparaisons = 0;
  let modificationsTestees = 0;
  let vidagesTestes = 0;
  const bundle: Doc = JSON.parse(readFileSync(resolve(RACINE, "tests/preflight/__contract__/costum-types.json"), "utf8")).costums;

  beforeAll(async () => {
    setCostumForceLive(MODE === "live");
    mc = new MongoClient(MONGO);
    await mc.connect();
    base = mc.db(MONGO_DB);

    // Adresse EMPRUNTÉE à une fiche réelle : le contrat d'adresse est exigeant (`@type`, `level1`,
    // `localityId` = `_id` réel de `cities`…) et le reconstituer à la main revient à tester ma
    // reconstitution. Une adresse déjà en base satisfait le contrat par construction.
    const gabarit = await base.collection("poi").findOne(
      { "address.localityId": { $exists: true }, "address.level1": { $exists: true }, geo: { $exists: true },
        name: { $not: /^ZZ / } },                    // jamais une fiche de test comme gabarit
      { projection: { address: 1, geo: 1, geoPosition: 1 }, sort: { _id: 1 } },  // déterministe
    );
    expect(gabarit, "aucune fiche avec adresse complète pour servir de gabarit").toBeTruthy();
    // Le formulaire n'attend PAS un objet `address` : il porte les champs MEMBRES du groupe de
    // sérialisation (`addressCountry`, `localityId`…), que `address:write` recombine. Passer l'objet
    // court-circuitait le groupe et faisait planter le transform. On aplatit donc le gabarit.
    const a = gabarit!.address as Record<string, unknown>;
    socle = {
      addressCountry: a.addressCountry, addressLocality: a.addressLocality, postalCode: a.postalCode,
      streetAddress: a.streetAddress, localityId: a.localityId, codeInsee: a.codeInsee,
      geo: gabarit!.geo, ...(gabarit!.geoPosition ? { geoPosition: gabarit!.geoPosition } : {}),
    };

    const client = new (Cocolight as unknown as Doc).ApiClient({ baseURL: BACKEND, costumForceLive: MODE === "live" });
    const userApi = (Cocolight as unknown as Doc).Api.userApi(client);
    await userApi.login(EMAIL, PWD);
    const connecte = await userApi.meIsconnected();
    me = await new (Cocolight as unknown as Doc).Api(connecte, userApi.client).me();
    expect(me, "authentification impossible").toBeTruthy();
  }, 60_000);

  afterAll(async () => {
    // 1. CATCH-ALL par nom d'abord : une entité créée puis non retrouvée (crash avant `crees.push`)
    //    reste orpheline si on ne nettoie que par _id. On collecte ses _id AVANT suppression pour
    //    purger aussi ses satellites.
    const ids = new Set(crees.map(({ id }) => String(id)));
    for (const c of ["poi", "organizations", "events", "projects"]) {
      const orphelines = await base.collection(c).find({ name: { $regex: `ZZ E2E .*${TAG}` } }, { projection: { _id: 1 } }).toArray();
      for (const o of orphelines) ids.add(String(o._id));
      await base.collection(c).deleteMany({ name: { $regex: `ZZ E2E .*${TAG}` } });
    }
    // 2. Satellites de CHAQUE save (mesuré : le save émet news + activityStream + activityStreamReference,
    //    et pose des LIENS BIDIRECTIONNELS sur le parent/organizer — l'org PORTEUSE, une entité de PROD).
    const lienKeys: Record<string, number> = {};
    for (const id of ids) {
      await base.collection("slugs").deleteMany({ id });
      await base.collection("news").deleteMany({ $or: [{ "object.id": id }, { "target.id": id }] });
      await base.collection("activityStream").deleteMany({ $or: [{ "object.id": id }, { "target.id": id }] });
      await base.collection("activityStreamReference").deleteMany({ $or: [{ "object.id": id }, { "target.id": id }] });
      for (const t of ["poi", "projects", "events", "organizations", "memberOf"]) lienKeys[`links.${t}.${id}`] = 1;
    }
    if (Object.keys(lienKeys).length) {
      // $unset des liens fantômes partout où ils ont pu être posés (porteuse, utilisateur de test…)
      for (const c of ["organizations", "citoyens", "projects", "events"]) {
        await base.collection(c).updateMany(
          { $or: Object.keys(lienKeys).map((k) => ({ [k]: { $exists: true } })) },
          { $unset: lienKeys },
        );
      }
    }
    let reste = 0;
    for (const c of ["poi", "organizations", "events", "projects"]) {
      reste += await base.collection(c).countDocuments({ name: { $regex: `ZZ E2E .*${TAG}` } });
    }
    let liensRestants = 0;
    if (ids.size) {
      for (const c of ["organizations", "citoyens"]) {
        liensRestants += await base.collection(c).countDocuments({ $or: [...ids].map((id) => ({ [`links.poi.${id}`]: { $exists: true } })) });
      }
    }
    await mc.close();
    expect(reste, "la base doit rester à 0 résidu").toBe(0);
    expect(liensRestants, "aucun lien fantôme ne doit rester sur les entités de prod").toBe(0);
    // 3. PLANCHER de preuve : l'assertion de forme saute les colonnes < 5 fiches — sur une base
    //    inadaptée elle dégénérerait en 0 comparaison sans bruit. On exige un minimum global.
    expect(comparaisons, `l'assertion de forme n'a comparé que ${comparaisons} champ(s) — base de référence inadaptée ?`).toBeGreaterThanOrEqual(Number(process.env.E2E_MIN_COMPARAISONS ?? 30));
    // La phase d'édition doit avoir EXERCÉ modification et effacement — pas seulement re-sauvé. Sans ce
    // plancher, un sélecteur qui ne trouve aucun candidat ferait passer la suite en ne prouvant rien.
    expect(modificationsTestees, "aucune MODIFICATION réelle exercée par la phase d'édition").toBeGreaterThanOrEqual(10);
    expect(vidagesTestes, "aucun EFFACEMENT de champ optionnel exercé par la phase d'édition").toBeGreaterThanOrEqual(8);
  }, 120_000);

  for (const { site, id, doc } of tousLesForms()) {
    it(`${site}/${id}`, async () => {
      const coll = String(doc.collection ?? doc.entityType);
      const slug = String(doc.costumSlug ?? "");
      const nom = `ZZ E2E ${site} ${id} ${TAG}`;
      const bundleConnu = !!(bundle as Doc)[slug]?.[coll];

      const { spec } = registerCostumForm(doc);
      // `carrier` = entité PORTEUSE du costum, celle que le site obtient via `me.entityBySlug(slug)`
      // (`apiClient.ts:120`). Sans elle, `resolveCostumSlug(scope.slugFrom="carrier")` rend `undefined`,
      // l'entité naît HORS costum, et le DraftProxy refuse ses champs (« le champ X n'est pas autorisé »).
      const config = specToConfig(spec);
      const carrier = await (me as { entityBySlug: (s: string) => Promise<unknown> }).entityBySlug(slug);
      expect(carrier, `porteur du costum ${slug} introuvable`).toBeTruthy();
      // `scope` = contexte costum DÉRIVÉ du porteur (`config.resolveScope`), tel que la modale le calcule.
      // Il alimente les défauts (`POI_ADDRESS_BASE` lit `scope.addressCountry`), les `extraFieldsFromScope`
      // et la résolution `slugFrom:"derived"`. Sans lui, les défauts du form plantent.
      const scope = config.resolveScope?.(carrier as never);
      // `parent` = la PORTEUSE : le chemin nominal du parc (création depuis le profil du site), et la
      // forme mesurée en base (2/2 formations SSBE portent `parent = {<idPorteuse>: {type,name}}`).
      const ctxBase = { me, carrier, parent: carrier, scope } as never;

      // ── ADD : la chaîne complète (payload+stamps → save → galerie → stamps pathValue)
      // Les valeurs partent des DÉFAUTS RÉELS du formulaire (`buildDefaults`, ce que la modale seede),
      // pas d'un objet fabriqué : les ancres composites y sont déjà dans leur forme attendue (semaine
      // d'`openingHours`, structures de galerie…). Les remplir à la main faisait planter les transforms
      // sur `undefined` — je testais ma reconstitution, pas le formulaire.
      const ctxAdd = { ...(ctxBase as object), mode: "add", entity: null } as never;
      const values: Doc = { ...(config.buildDefaults(ctxAdd) as Doc) };
      for (const [champ, def] of Object.entries((doc.fields ?? {}) as Record<string, Doc>)) {
        const v = valeurPour(champ, def, nom);
        if (v !== undefined) values[champ] = v;
      }
      // …et SEULEMENT les clés que ce formulaire déclare : en pousser d'autres fait refuser l'entité
      // par le DraftProxy (« le champ X n'est pas autorisé »), ce qui est un faux échec de ma part.
      const declares = new Set(Object.keys((doc.fields ?? {}) as Doc));
      for (const [k, v] of Object.entries(socle)) if (declares.has(k) && v !== undefined) values[k] = v;
      values.name = nom;
      if (coll === "events") { values.startDate = "2026-09-15T10:00:00+04:00"; values.endDate = "2026-09-15T18:00:00+04:00"; }

      const specAdd = config.buildSpec(ctxAdd);
      let entity: unknown;
      try {
        ({ entity } = await runEntityMutation(specAdd as never, values, { me: me as never, contextEntity: carrier as never }));
      } catch (e) {
        // Les détails AJV vivent dans `e.messages`, que la sérialisation vitest perd : on les remonte
        // dans le texte de l'erreur — sans eux, « Request validation failed » est indiagnosticable.
        const det = (e as { messages?: string[] }).messages;
        throw det?.length ? new Error(`${(e as Error).message}\n      ${det.join("\n      ")}`) : e;
      }
      const cree = await base.collection(coll).findOne({ name: nom });
      expect(cree, `entité non trouvée en base après création (mode ${bundleConnu ? MODE : "live — costum non bundlé"})`).toBeTruthy();
      crees.push({ coll, id: cree!._id });

      // ── FORME STOCKÉE : comparée à la forme DOMINANTE de la colonne dans le costum
      const ecarts: string[] = [];
      for (const champ of Object.keys((doc.fields ?? {}) as Doc)) {
        if (champ === "name" || !(champ in cree!)) continue;
        const dom = await base.collection(coll).aggregate([
          { $match: { "source.keys": slug, [champ]: { $exists: true, $ne: null }, _id: { $ne: cree!._id } } },
          { $group: { _id: { $type: `$${champ}` }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 1 },
        ]).toArray();
        if (!dom[0] || dom[0].n < 5) continue;                  // trop peu de données pour faire foi
        // typeof JS et $type BSON ne parlent pas la même langue : une Date relue est un `object`, un
        // booléen BSON s'appelle `bool`, un nombre `double`/`int`. Sans normalisation des DEUX côtés,
        // le comparateur fabriquait de faux écarts (« écrit object, la colonne est date »).
        const norme = (v: unknown): string =>
          v instanceof Date ? "date" : Array.isArray(v) ? "array"
          : typeof v === "boolean" ? "bool" : typeof v === "number" ? "number" : typeof v;
        const normeBson = (t: string): string => (["double", "int", "long", "decimal"].includes(t) ? "number" : t);
        comparaisons++;
        const ecrit = norme(cree![champ]);
        const colonne = normeBson(String(dom[0]._id));
        if (ecrit !== colonne) ecarts.push(`${champ} : écrit ${ecrit}, la colonne est ${colonne} (${dom[0].n} fiches)`);
      }

      // ── EDIT — le VRAI round-trip, sur TOUS les champs éligibles, en DEUX passes :
      //   passe 1 — MODIFIER tous les champs modifiables (texte libre, multi, booléens basculés) et
      //             vérifier chaque nouvelle valeur en base, le reste intact ;
      //   passe 2 — VIDER tous les champs OPTIONNELS vidables et vérifier chaque effacement.
      // Le seed vient du pipeline réel (`buildDefaults` mode edit sur l'instance hydratée du create) —
      // jamais d'`entityBySlug(String(slug))` : un slug absent donnerait "undefined" et relirait
      // potentiellement une AUTRE entité, de prod.
      const ctxEdit = { ...(ctxBase as object), mode: "edit", entity } as never;
      const champsDoc = (doc.fields ?? {}) as Record<string, Doc>;
      const specEdit = config.buildSpec(ctxEdit);
      // champs cibles d'un stamp `append` : le form les ACCUMULE à chaque save (fusion voulue, parité
      // legacy — ex. les tags d'institut-bleu-acteur reçoivent categoryThematic) → ni « modifiables »
      // ni « vidables » au sens de ce test.
      const stampes = new Set(((doc.mutation as Doc | undefined)?.stamps as Doc[] | undefined ?? [])
        .filter((st) => st.op === "append").map((st) => String(st.field)));
      const exclus = (k: string, d2: Doc) => d2.required || d2.renderOnly || (d2 as { readOnly?: boolean }).readOnly || d2.group
        || k === "name" || stampes.has(k)
        || /url|email|image|photo|logo|avatar|date|^parent$|^organizer$|^trainer$/i.test(k) || k.startsWith("_");

      // ── passe 1 : tout modifier
      const v1: Doc = { ...(config.buildDefaults(ctxEdit) as Doc) };
      const modifies: Array<[string, unknown]> = [];
      for (const [k, d2] of Object.entries(champsDoc)) {
        if (exclus(k, d2) || !(k in cree!)) continue;
        const w = String(d2.widget);
        if (["text", "textarea", "markdown"].includes(w)) { v1[k] = `ZZ MOD ${k} ${TAG}`; modifies.push([k, v1[k]]); }
        else if (["tags", "multiselect", "checkboxGroup"].includes(w) && !d2.enum) { v1[k] = [`ZZ MOD ${k}`]; modifies.push([k, v1[k]]); }
        else if (["switch", "checkbox", "toggle"].includes(w)) { v1[k] = !(cree![k] === true || cree![k] === "TRUE" || cree![k] === "true" || cree![k] === "Oui"); modifies.push([k, v1[k]]); }
        else if (w === "number") { v1[k] = 77; modifies.push([k, 77]); }
      }
      v1.name = nom;
      modificationsTestees += modifies.length;
      await runEntityMutation(specEdit as never, v1, { me: me as never, contextEntity: carrier as never });
      const apres1 = await base.collection(coll).findOne({ _id: cree!._id });
      for (const [k] of modifies) {
        const attendu = v1[k]; const obtenu = apres1?.[k];
        // la forme STOCKÉE prime : un booléen modifié ressort dans la forme de la colonne (write),
        // un tableau en CSV… on compare par équivalence de lecture, pas par identité brute.
        const lireBool = (x: unknown) => x === true || (typeof x === "string" && ["true", "1", "oui", "yes"].includes(x.trim().toLowerCase()));
        const egal = typeof attendu === "boolean" ? lireBool(obtenu) === attendu
          : Array.isArray(attendu) ? JSON.stringify(Array.isArray(obtenu) ? obtenu : String(obtenu ?? "").split(",").map((x) => x.trim()).filter(Boolean)) === JSON.stringify(attendu)
          : typeof attendu === "number" ? String(obtenu) === String(attendu)
          : obtenu === attendu;
        if (!egal) ecarts.push(`ÉDITION(mod) ${k} : attendu ${JSON.stringify(attendu)}, base ${JSON.stringify(obtenu)?.slice(0, 50)}`);
      }
      // intacts après passe 1
      const touches1 = new Set([...modifies.map(([k]) => k), "name"]);
      const phpVide = (v: unknown) => v === false || v === "" || v == null || (Array.isArray(v) && v.length === 0);
      for (const champ of Object.keys(champsDoc)) {
        if (touches1.has(champ) || !(champ in cree!)) continue;
        const av = cree![champ]; const ap = apres1?.[champ];
        if (phpVide(av) && ap === undefined) continue; // strip PHP fidèle (empty → unset au re-save)
        if (JSON.stringify(av) !== JSON.stringify(ap)) ecarts.push(`ÉDITION(intact) ${champ} : ${JSON.stringify(av)?.slice(0, 40)} → ${JSON.stringify(ap)?.slice(0, 40)}`);
      }

      // ── passe 2 : tout vider (optionnels)
      const v2: Doc = { ...(config.buildDefaults({ ...(ctxBase as object), mode: "edit", entity } as never) as Doc) };
      const vides: string[] = [];
      for (const [k, d2] of Object.entries(champsDoc)) {
        if (exclus(k, d2) || !(k in (apres1 ?? {}))) continue;
        const w = String(d2.widget);
        if (["text", "textarea", "markdown"].includes(w)) { v2[k] = ""; vides.push(k); }
        else if (["tags", "multiselect", "checkboxGroup"].includes(w)) { v2[k] = []; vides.push(k); }
      }
      v2.name = nom;
      vidagesTestes += vides.length;
      if (vides.length) {
        await runEntityMutation(specEdit as never, v2, { me: me as never, contextEntity: carrier as never });
        const apres2 = await base.collection(coll).findOne({ _id: cree!._id });
        for (const k of vides) {
          const v = apres2?.[k];
          const efface = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
          if (!efface) ecarts.push(`ÉDITION(vidage) ${k} : non effacé (${JSON.stringify(v)?.slice(0, 50)})`);
        }
      }

      expect(ecarts, `${site}/${id} — forme écrite divergente`).toEqual([]);
    }, 60_000);
  }
});
