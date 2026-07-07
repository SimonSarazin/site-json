[← Retour à l'index](README.md)

# 🚧 RFC — Assistant config : formulaires costum, config admin, cycle de vie des costums

> Document de RÉFLEXION (branche `feat/assistant-config-costum`) — rien n'est implémenté.
> Trois fils entrelacés : **(A)** l'assistant config génère les `costumForms` depuis la
> connaissance costum de la lib ; **(B)** il génère `config.admin` ; **(C)** repenser le cycle
> de vie d'un costum ajouté/modifié en base — aujourd'hui il faut **re-publier la lib npm**.
> Basé sur deux cartographies factuelles (2026-07-07) : l'outillage assistant et le pipeline
> costum complet.

## 0. L'état des lieux en une page

**La chaîne costum actuelle (build-time)** :

```
base Mongo (collection costum : typeObj.dynFormCostum.beforeBuild.properties,
            presets onload, hidden, add/createLabel, import.mapping)
  → scanner backend  tools/parity/scripts/costum-fields.mjs
    (délta par collection + inférence de TYPE par échantillonnage des VALEURS stockées)
  → costum-extensions.json  (artefact, garde anti-drift costum-fields:check)
  → vendorisé dans la lib → npm run generate:costum → 5 fichiers
    (schemas/<slug>.ts code-split · types.ts · registry.ts COSTUM_META+loaders ·
     runtime-map.ts COSTUM_RUNTIME sync 49 KB sans enums · normalize.ts)
  → npm publish → npm i dans site-json
```

**Le déséquilibre fondamental** : le **backend est toujours live** (`resolveActiveCostum` relit
la base à chaque save, `buildBinding` reconstruit la whitelist à chaque requête) ; seule la
**lib est figée** à la publication. Quand un costum change sans re-publication, 8 modes de
casse côté client (cartographiés) — les 2 pires :

- **L3 form vide** : costum créé hors registre → `describeForm()` sans module → 0 champ ;
- **L4 édition vide** : élément d'un costum hors registre → `resolveCostumCtxFromSource` → ctx
  NU → champs costum non éditables (le backend, lui, est prêt).

Les autres : champ nouveau non éditable (L1), presets/hidden périmés (L2/L7), enums périmés
(L5), coercition de type manquante (L6), hooks backend-only invisibles au client (L8 — par
construction, pas un bug).

**L'assistant config existant** : Skill + outillage déterministe (`config:schema`,
`config:validate`, `audit:config`, préversion live, test anti-dérive skill↔code). Et un
générateur **déjà là** : `npm run config:costum` (`scripts/gen-costum-config.ts`) = artefact +
`describeEntityForm()` lib → `costumToConfig()` → `JsonFormConfig`.

## Fil A — L'assistant génère les `costumForms`

### Ce qui manque réellement

1. **Écart de format** : `gen-costum-config` sort une `JsonFormConfig` (couche formEngine),
   mais `config.costumForms.<id>` attend un **`CostumFormSchema`** (document fusionné
   form+modale : `chrome`, `mutation`, `serializeGroups`, validé au boot par
   `registerCostumForm`). Il faut soit un convertisseur `JsonFormConfig → CostumFormSchema`,
   soit (mieux) faire sortir le bon format au générateur.
2. **Enrichissement métier** : le généré brut (widgets dérivés des types) est un point de
   départ — l'assistant doit ensuite proposer : regroupement en sections/wizard, libellés
   fr/en propres, codecs partagés (`address:read/write`, `monthYear`, `enumOrOther`…),
   `chrome` et `mutation`. C'est la partie conversationnelle.
3. **Recette dans la Skill** : une section « générer un formulaire costum » (comme les tables
   headers/footers), avec la boucle : `config:costum <slug> <collection>` → convertir →
   poser dans `costumForms` → `config:validate` → **le boot `registerCostumForm` est la garde
   finale** (clés inconnues = erreur claire).

### Proposition A

- A1 : `gen-costum-config` gagne un flag `--format costumForm` qui émet directement un
  `CostumFormSchema` posable (sections base/costum, widgets, `mutation.entityType` déduit,
  `chrome` squelette) ;
- A2 : recette Skill + entrée `config:schema costumForm` déjà existante pour la forme cible ;
- A3 : test préflight : chaque `config.costumForms.*` des configs du repo passe
  `registerCostumForm` à blanc (compile sans erreur de clé).

**Dépendance au fil C** : aujourd'hui le générateur lit l'ARTEFACT (`COSTUM_EXTENSIONS` env ou
chemin par défaut) — si C aboutit à un endpoint live, le générateur bascule dessus et n'est
plus jamais périmé.

## Fil B — L'assistant génère `config.admin`

Décision déjà actée (2026-07-07, doc/30) : pas de dérivation runtime — **génération
explicite**. Le générateur proposé :

- entrée : la config du site (`profiles.addConfig`, `costumForms`, modules actifs) ;
- sortie : bloc `admin` complet — `dashboard` + `members` (filters standard) + `content`
  (une section `resource` par type d'entité géré : colonnes par défaut
  `name`/`address.addressLocality`, `create/edit: "inherit"`, `rowActions` avec `validate` si
  le site a un workflow de validation, `bulkActions`) + `import-export` (`entityTypes` =
  types du site ∩ les 5 importables) + `reference` + `moderation` ;
- boucle : `config:validate` (le discriminatedUnion attrape tout) + préversion `/admin`.

Implémentation : soit un script `admin:scaffold` dédié, soit une recette Skill pure (l'assistant
génère le JSON en s'appuyant sur `config:schema` — qui devrait alors exposer un sélecteur
`admin`). **Reco : les deux** — le sélecteur `config:schema admin` est trivial et sert la
skill ; le scaffold script garantit le déterminisme du squelette.

## Fil C — Cycle de vie d'un costum : sortir de la re-publication

### Le nœud

La définition des champs costum est une **donnée** (elle vit en base, elle change avec les
déploiements) mais elle est traitée comme du **code** (bundlée, versionnée, publiée). Le
backend l'a déjà compris (résolution live à chaque save). La question : jusqu'où amener la
lib au même modèle ?

Note `getcostumjson` (VÉRIFIÉ sur pièces, 2026-07-07) : l'endpoint legacy porté
(`/co2/cms/getcostumjson?slug=`) sert le champ `costum` de l'élément **hôte** — qui CONTIENT le
`typeObj.dynFormCostum` complet pour les costums embarqués sur l'hôte (equipementsSportifs974 :
39 champs servis, vérifié live ; c'est le cas de nos déploiements site-json). Il ne suffit pas
À LUI SEUL pour 4 raisons : (1) **couverture** — 28/65 costums ont leur définition dans la
collection `costum` (engine : ctenat, siteDuPacte, hva…) et le legacy ne fusionne PAS dans
cette action (GetCostumJsonAction.php:20-21) ; endpoint legacy = réponse gelée, inextensible ;
(2) **format brut** legacy (inputTypes, presets `onload.actions`, hidden `<champ><inputType>`)
— la digestion vers la forme lib (schema/fields/setType) devrait migrer dans la lib ;
(3) pas d'**inférence de type par valeurs** possible ; (4) pas de résolution des **lists**
(enums, 22 costums) + cache `costumlite` potentiellement périmé après `updatecostum` sans
`resetcache`.

### Options

**Option 3bis — « zéro endpoint nouveau »** (ouverte par la vérification ci-dessus) : la lib
porte la digestion (fonction pure `typeObj → extensions`) et se nourrit de `getcostumjson`
pour les costums EMBARQUÉS sur l'hôte (nos déploiements) ; inférence de type dégradée à
`inputType` ; les 28 engine-costums restent sur l'artefact bundlé. Moins propre que
`costum/describe` (digestion dans la lib, couverture partielle, cache legacy) mais aucune
question de politique d'endpoint.

**Versant ÉCRITURE** (ajout/màj d'un costum par l'assistant) : le legacy expose `updatecostum`
+ `saveversion`/`restoreversion`/`resetcache` dans le même contrôleur CMS — non portés au
backend à ce jour. S'ils le sont (ports byte-compat, pas d'additif), l'assistant pourrait
créer/modifier un costum en base puis invalider le cache : la boucle complète
« définir → servir → former » se ferme sans re-publication.

| | Option 1 — statu quo outillé | Option 2 — tout runtime | Option 3 — hybride (reco) |
|---|---|---|---|
| Principe | garde `costum-fields:check` + régénération/publication à chaque drift | la lib fetch la définition à la demande, plus d'artefact | registre bundlé pour les costums connus (rapide, offline-safe) + **fetch live en fallback et pour rafraîchir** |
| Nouveau backend | rien | endpoint « describe » | endpoint « describe » |
| Latence form | 0 | +1 round-trip au 1er form | 0 si bundlé, +1 RT sinon |
| Costum nouveau | ❌ re-publier | ✅ immédiat | ✅ immédiat (chemin live) |
| Costum modifié | ❌ re-publier | ✅ immédiat | ✅ si chemin live prioritaire ou TTL cache |
| Types par VALEURS (L6) | scanner offline | ⚠️ coûteux à chaud | précalcul/cache backend |

### L'endpoint « describe » (cœur de l'option 3)

`POST /co2/costum/describe` (slug, collection) → **exactement la forme d'une entrée
`costumExtensions[slug][collection]`** (`schema`, `fields[]` avec `setType`/`enum`/`hidden`,
`presets`, `add`, `createLabel`) + `costumMeta` (id/type/host/engine). Implémentation backend :
réutiliser la logique du scanner (`costum-fields.mjs`) **sortie du dossier parity** vers
`src/shared/` (elle devient du code produit), avec :

- l'extraction `typeObj.dynFormCostum` : à chaud, coût négligeable (1 doc costum) ;
- l'**inférence de type par valeurs** : PAS à chaud — précalculée (cache Mongo/TTL, ou le
  résultat du dernier scan versionné en collection dédiée), sinon dégradée à l'inférence par
  `inputType` seul.

⚠️ **Question de politique** : c'est un endpoint **additif hors legacy** (le PHP n'a pas
d'équivalent — le front legacy reçoit le costum entier via la page). À assumer comme
endpoint « cocolight-only » documenté (précédent : refreshtoken ?), ou à refuser au nom de la
byte-parité stricte — à trancher.

### Côté lib (incréments)

- **C1** : `resolveCostumScope`/`setCostumScope` : quand le slug est hors registre (ou sur
  demande explicite `{ refresh: true }`), fetch `describe` → construit le
  `CostumRuntimeContext` complet au lieu du ctx NU. **Comble L3+L4** (form vide, édition
  vide) — les deux casses majeures.
- **C2** : `describeForm()` : chemin live prioritaire avec cache mémoire par session
  (TTL court) → **comble L2/L5/L7** (presets, enums, hidden à jour).
- **C3** : coercition de type live (`setType`/`storageTyped` depuis le describe) → **comble
  L1/L6**. L'artefact bundlé devient un simple *warm cache* — la garde de drift change de
  rôle : elle ne bloque plus, elle informe.
- Site-json : `registerCostumForms` lit `window.__CONFIG__` (statique) — pour un costum créé
  à chaud SANS entrée costumForms, la voie B (`describeForm` → `costumToConfig` →
  `registerCostumForm` dynamique) devient enfin implémentable — c'est le chaînon qui rend le
  fil A « auto-rafraîchissant ».

## Décisions à trancher

1. **Politique d'endpoint** : accepte-t-on un endpoint additif cocolight-only
   (`costum/describe`) hors périmètre legacy ? (Sinon : option 3bis via `getcostumjson`,
   couverture partielle et digestion dans la lib.)
2. **Priorité des chemins** dans la lib : bundlé-d'abord (fallback live) ou live-d'abord
   (fallback bundlé) ? Reco : bundlé-d'abord + `refresh` explicite, live-d'abord pour les
   slugs hors registre.
3. **Inférence de type à chaud** : cache backend précalculé (où ? collection dédiée ? TTL ?)
   ou dégradation à `inputType` seul sur le chemin live ?
4. **Format de sortie du fil A** : `CostumFormSchema` directement (reco) ou garder
   `JsonFormConfig` + convertisseur ?
5. **Fil B** : script `admin:scaffold` + recette Skill (reco « les deux ») ?

## Découpage proposé (indicatif)

| Phase | Contenu | Débloque |
|---|---|---|
| **F1** | `config:schema admin` + recette Skill admin + scaffold | fil B complet |
| **F2** | `gen-costum-config --format costumForm` + recette Skill + préflight costumForms | fil A (build-time) |
| **F3** | backend `costum/describe` (extraction typeObj à chaud, types en cache) | fondation C |
| **F4** | ✅ **C1 FAIT** (scope live hors registre via getcostumjson : liveDigest + resolveCostumScope tier 3b + LIVE_CTX_CACHE + loadCostumScope — comble L3/L4, lib master c24db5f) ; reste C2 (describeForm live+cache pour rafraîchir presets/enums/hidden = L2/L5/L7) | L3/L4 ✅ |
| **F5** | lib C3 (types live) + registerCostumForm dynamique site-json | boucle complète sans re-publication |

F1/F2 sont indépendants de F3-F5 et livrables immédiatement.

## Voir aussi

- [Assistant Config](26-assistant-config.md) · [Module formEngine](28-module-formengine.md)
- [Module Admin](30-module-admin.md) — la config générée par le fil B
- Backend : `tools/parity/scripts/costum-fields.mjs` (scanner), `src/shared/costumHooks.ts`
  (résolution live) · Lib : `src/costum/runtime.ts` (CostumScope, resolveCostumCtxFromSource)
