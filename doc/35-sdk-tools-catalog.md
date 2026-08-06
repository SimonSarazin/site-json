[← Retour à l'index](README.md)

# SDK attendu — module `toolsCatalog` (catalogue d'outils d'usage)

> **Les cinq endpoints existent et sont déployés côté backend** (module `costum`, commit
> `15c5a91af`) — ils sont simplement **absents du SDK** `@communecter/cocolight-api-client`.
> Ce document décrit le contrat tel qu'il est implémenté, pour pouvoir le déclarer sans le
> deviner, ainsi que les méthodes et types que le module `toolsCatalog` consomme déjà.

Le module front est livré (`src/modules/toolsCatalog/`) et compile aujourd'hui contre une copie
locale du SDK. **Tant que ces cinq endpoints ne sont pas publiés, un `npm install` propre casse le
`tsc` de site-json** : la version déclarée (`^1.0.171`) ne contient ni les méthodes ni les types
ci-dessous.

Chaîne PHP (module `costum`, contrôleur `FrancetierslieuxController`) :

| Route | Action |
|---|---|
| `toolscatalog` | `controllers/actions/franceTierslieux/ToolsCatalogListAction.php` |
| `toolusers` | `controllers/actions/franceTierslieux/ToolUsersAction.php` |
| `communinfo` | `controllers/actions/franceTierslieux/CommunInfoAction.php` |
| `communlist` | `controllers/actions/franceTierslieux/CommunListAction.php` |
| `savecriteria` | `controllers/actions/franceTierslieux/navigator/SaveCriteriaAction.php` |

---

## 1. Modèle mental (à lire en premier)

Un **outil** n'est pas un document : c'est une **agrégation**. Les réponses coform portent des
définitions d'outils (`answers.criterias{key}`) et des usages (`answers.yesOrNo{key}.{criteriaId}`
= `{criteria, usage, happiness, note}`). Le backend regroupe ces occurrences **par nom normalisé,
à travers les catégories**, puis joint l'enrichissement éditorial (collection `navigatorcriteria` :
lien, description, image, open source).

Trois conséquences pour le SDK :

1. **Les DTO retournés sont plats** — ce ne sont pas des entités. Ils n'ont pas de champ
   `collection`, donc **`_linkEntities` les jetterait silencieusement** (cf. §5).
2. **L'id d'un outil est son nom normalisé**, pas un ObjectId. Il est stable entre deux pages, ce
   qui rend le slice de pagination déterministe.
3. **Les suffixes de clés sont dynamiques** (`criterias{key}` / `yesOrNo{key}`) : ils viennent du
   form, jamais d'une constante. D'où les paramètres `step` et `finderPath` sur les deux premiers
   endpoints.

---

## 2. Les cinq endpoints

Tous en `POST`, `application/x-www-form-urlencoded`, sous `/costum/francetierslieux/`.

| Constante | Path | Auth | Rôle |
|---|---|---|---|
| `COSTUM_TOOLS_CATALOG` | `toolscatalog` | — | liste paginée / recherchable / filtrable |
| `COSTUM_TOOL_USERS` | `toolusers` | — | lieux utilisateurs d'un outil (lazy, ouverture de modale) |
| `COSTUM_COMMUN_INFO` | `communinfo` | — | fiche du commun rattaché à un outil |
| `COSTUM_SAVE_TOOL_ENRICHMENT` | `savecriteria` | **bearer** | upsert de l'enrichissement d'un outil |
| `COSTUM_COMMUN_LIST` | `communlist` | **bearer** | `{id, title}` des communs (select de rattachement) |

### 2.1 `toolscatalog` — liste

| Paramètre | Type | Défaut | Effet |
|---|---|---|---|
| `formId` | `string` | — | ✅ requis — form des réponses |
| `step` | `string` | — | ✅ requis — champ id du form dont les inputs sont les catégories d'usage |
| `finderPath` | `string` | — | ✅ requis — dot-path du lieu dans la réponse |
| `name` | `string` | — | recherche, **accent et casse-insensible côté serveur** |
| `filters` | `object` | — | `{ category?, usage?, isOpenSource? }` |
| `sortBy` | `object` | `{totalOccurrences:-1, title:1}` | `{ <champ>: 1\|-1 }` |
| `indexMin` | `number` | `0` | skip |
| `indexStep` | `number` | `24` | limit |

Réponse `{ results: ToolCatalogItem[], count: { total }, facets? }`. `count.total` est un **nombre
d'outils** (pas de documents answer) — c'est lui qui fait terminer le défilement infini.

`facets` (`{categories, usages, usagesByCategory}`) est calculé sur le catalogue **complet**, pas
sur la page : les filtres ne se vident pas au fil du scroll.

### 2.2 `toolusers` — détail

`formId`, `step`, `finderPath`, plus `criteriaIds` (**JSON `string[]` sérialisé**) et `inputKeys`
(idem, optionnel). Réponse `{ results: ToolUser[] }`.

> La recherche se fait **par `criteriaIds`**, jamais par regex sur le nom : l'action legacy
> `GetAnswerByNameToolAction` construit un `MongoRegex` non échappé à partir du nom de l'outil.

### 2.3 `communinfo` — fiche du commun

`communId` (24hex, `_id` de la réponse AAP du commun) et `formId` (24hex, form AAP des communs).

> ⚠️ **`formId` est obligatoire : c'est un verrou de périmètre, pas un confort.** L'endpoint est
> `auth: none` ; sans lui, n'importe quel ObjectId permettrait de lire n'importe quelle réponse.
> Le serveur vérifie `answer.form === formId`. Pour la même raison, **le step et les clés de champs
> sont figés en constantes côté serveur** : les exposer en paramètres rouvrirait le re-pointage.

Réponse `{ commun: CommunInfo }` ou `{ commun: null }` (jamais de 500 sur entrée invalide : les cas
fail-closed renvoient `null` en HTTP 200). Les postes financiers sont **recalculés serveur** et ne
contiennent que `{label, target, collected}` — **jamais les `financer[]`**, qui portent des données
nominatives.

### 2.4 `savecriteria` — enrichissement (bearer)

Upsert d'un document `navigatorcriteria` **par nom d'outil**. `name` est la clé d'upsert et est
requis ; les autres champs sont optionnels, et la distinction compte :

- **clé absente** ⇒ champ laissé inchangé
- **chaîne vide** ⇒ champ effacé

| Champ | Remarque |
|---|---|
| `name` | nom EXACT de l'outil (clé d'upsert) |
| `url` | lien de l'outil |
| `urlTool` | lien du commun, porte l'ancre `#detail-un-commun.communId.<24hex>` |
| `description` | markdown |
| `isOpenSource` | **`"true"` / `"false"` en STRING** — forme historique, le JS legacy compare `=== "true"` |
| `imageTool` | `docPath` relatif retourné par `UPLOAD_DOCUMENT`, ou URL http(s) |
| `imageToolId` | id du document uploadé |

Réponse `{ results: boolean, msg: string, data?, name? }` — forme historique **partagée avec les
vues legacy `listTools`**, à ne pas normaliser.

> ⚠️ Le `msg` d'échec est du **français en dur côté PHP**. Ne pas l'afficher tel quel : le module
> le conserve dans l'`Error` pour le diagnostic et rend une clé i18n à l'utilisateur.

**Autorisation** : `Authorisation::isInterfaceAdmin()`, 401 sinon. Le costum courant est résolu
depuis `costumSlug`, injecté par `_withCostumContext` (§4). Cette action était **ouverte sans
aucune authentification** avant le commit `15c5a91af`.

### 2.5 `communlist` — options du select (bearer)

`formId` (24hex). Réponse `{ results: CommunListItem[] }`, triée par titre, plafonnée à 1000.
Même gate admin que `savecriteria`.

---

## 3. Méthodes attendues

```ts
// Form — le formId vient de l'entité (this.id)
Form.toolsCatalog(params: {
  step: string; finderPath: string; name?: string;
  filters?: Record<string, unknown>; sortBy?: Record<string, 1 | -1>;
  indexMin?: number; indexStep?: number;
}): Promise<ToolsCatalogPage>

Form.getToolUsers(params: {
  step: string; finderPath: string;
  criteriaIds: string | string[];      // sérialisé en JSON si tableau
  inputKeys?: string | string[];
}): Promise<ToolUser[]>                 // extrait `.results` / `.data.results`

// Answer — le communId est l'id de l'answer (this.id)
Answer.getCommunInfo(opts?: { formId?: string }): Promise<CommunInfo | null>

// BaseEntity — voir §4 pour le POURQUOI de cet emplacement
BaseEntity.saveToolEnrichment(input: ToolEnrichmentInput): Promise<ToolEnrichmentResult>
BaseEntity.getCommunList(formId: string): Promise<CommunListItem[]>
```

Types à exporter (`src/api/serverDataType/`) : `ToolCatalogItem`, `ToolUser`,
`ToolsCatalogFacets`, `ToolsCatalogPage`, `ToolEnrichmentInput`, `ToolEnrichmentResult`,
`CommunListItem` (`ToolsCatalog.ts`) et `CommunInfo`, `CommunFundingPoste` (`CommunInfo.ts`).

### `ToolCatalogItem` — trois champs d'URL, à ne pas confondre

| Champ | Contenu |
|---|---|
| `url` | **fusion d'AFFICHAGE** : `url` s'il existe, sinon `urlTool` (comportement legacy) |
| `urlOwn` | `navigatorcriteria.url` **brut** — ce que l'admin a saisi |
| `urlTool` | `navigatorcriteria.urlTool` **brut** — le lien du commun, avec son ancre |

> 🐛 **Piège vécu.** Pré-remplir l'éditeur avec `url` recopie le lien **du commun** dans le lien
> **de l'outil** dès que `navigatorcriteria.url` est vide (cas de Dokos, Oceco…). D'où `urlOwn`.
> Règle générale : ne jamais pré-remplir un éditeur avec un champ d'affichage dérivé.

`communId` est extrait serveur de l'ancre `#detail-un-commun.communId.<24hex>` (`urlTool`
prioritaire, puis `url`) et vaut `""` si aucun. Le champ `url` d'affichage, lui, **conserve son
ancre** — la stripper casse des liens légitimes.

---

## 4. ⚠️ Emplacement des deux méthodes bearer

`saveToolEnrichment` et `getCommunList` doivent vivre sur **`BaseEntity`**, pas sur `Organization`.

Elles passent par `_withCostumContext`, qui lit `this.serverData.slug/id` de l'élément **HOST** du
costum — et ce host peut être une organisation **ou un projet**. `CocolightProvider` type d'ailleurs
`entity: Organization | Project | null`. Le costum `navigatorDesTierslieux` est porté par un
**projet** (`projects/649ed498f93ee7202e6c8b12`).

C'est déjà la convention du SDK : `searchCostum`, `searchEventsCostum`, `costumEventRequestActors`,
`costumEventRequestSubevents`, `costumEventRequestDates` et `isAdmin()` sont toutes sur `BaseEntity`.

> **Symptôme si on se trompe** : `carrier.saveToolEnrichment is not a function` **au runtime**,
> avec un `tsc` vert des deux côtés — le `entity as Organization` côté consommateur est un cast
> TypeScript sans vérification à l'exécution.

Ces méthodes ne peuvent **pas** être portées par `Form` : un `Form` n'a ni slug ni id d'élément
host, donc `_withCostumContext` y échoue.

---

## 5. ⚠️ Pagination — ne pas passer par le moteur générique

`toolsCatalog` retourne la **page brute**, sans `_createPaginatorEngine`.

`BaseEntity._linkEntities` élimine tout objet dépourvu de champ `collection` : les
`ToolCatalogItem` étant des DTO plats, la totalité des résultats serait **silencieusement jetée**.
Le défilement infini est donc piloté côté front par `useInfiniteQueryScroll` (`pageParam` =
`indexMin`), à partir de `count.total` et de la longueur cumulée.

Même raison que pour l'annuaire des communs AAC (`directoryproposal`), cf. `doc/34-module-aac.md`
§13.4-b — document présent sur la branche `aac-dev`.

---

## 6. Déclaration et régénération

La source est **`endpoints-copie.json`** (racine du package, **pas** `src/api/`). Modèles utiles :
`COSTUM_FILTER_COFORM` (route costum sans jumeau Node) et `COFORM_ANSWERS_SEARCH` (champs de
pagination).

```bash
npm run generate:methodeapi      # → src/api/EndpointApi.ts + EndpointApi.types.ts
npm run generate:module:publish  # → src/endpoints.module.ts
npm run build:esm:rollup && npm run build:types
```

Les fichiers générés ne s'éditent **jamais** à la main. Vérifier les noms camelCase produits
(`costumToolsCatalog`, `costumToolUsers`, `costumCommunInfo`, `costumSaveToolEnrichment`,
`costumCommunList`) avant de câbler les méthodes.

> ⚠️ Insérer les blocs dans `endpoints-copie.json` **textuellement**. Un aller-retour
> `JSON.parse`/`JSON.stringify` reformate le fichier et produit un diff illisible.

---

## 7. Ce que consomme site-json aujourd'hui

| Appel | Fichier |
|---|---|
| `api.form({id}).toolsCatalog(...)` | `src/modules/toolsCatalog/hooks/useToolsCatalog.ts` |
| `api.form({id}).getToolUsers(...)` | `src/modules/toolsCatalog/hooks/useToolDetail.ts` |
| `api.answer({id}).getCommunInfo(...)` | `src/modules/toolsCatalog/hooks/useCommunInfo.ts` |
| `entity.saveToolEnrichment(...)` + `entity.uploadDocument(...)` | `src/modules/toolsCatalog/hooks/useToolEnrichmentMutation.ts` |
| `entity.getCommunList(formId)` | `src/modules/toolsCatalog/hooks/useCommunList.ts` |

L'upload d'image passe par le flux document générique déjà présent au SDK :
`uploadDocument(file, { contentKey: "icons", docType: "image" })` → `{docId, docPath}`, reportés
dans `imageTool` / `imageToolId`. Même `contentKey` que le legacy.

---

## Voir aussi

- `doc/34-module-aac.md` §13 (branche `aac-dev`) — même exercice pour `directoryproposal`
- [Module CoForm](21-module-coform.md) — les réponses dont le catalogue est synthétisé
- [API & authentification](11-api-authentification.md) · [Sections dynamiques](06-sections-dynamiques.md)
