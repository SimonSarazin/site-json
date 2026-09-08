[← Retour à la doc](README.md)

# Module AAC — Appel à Communs

> **État : LIVRÉ — annuaire, fiche, financement, droits.** Le module rend l'**annuaire des
> communs** (sections `aac-directory` / `aac-highlight`, route `/aac`), la **fiche d'un commun**
> (`/aac/commun/:answerId` : financement via la cagnotte, sélection admin, paliers et actions,
> contributeurs, blocs de prose déclarés en config, galerie), le **dépôt et l'édition** d'un commun
> par CoForm, et les **droits** (§6) calculés sur les gates réels du form (`coremu`,
> `onlymemberaccess`…). Restent au backlog : campagnes, panier, doublonnage, immuabilité `paid`
> (§10). Ce document est le point d'entrée pour intégrer ces besoins sans re-faire les erreurs
> du legacy.

---

## 1. Modèle mental (à lire en premier)

- Un **commun** = **une réponse CoForm** (document `answers`). Ce n'est PAS une entité
  indépendante : tout part d'une `Answer`.
- La hiérarchie réelle est **AAC → Campagne → Commun**. Une **campagne isole** ses communs,
  financements, paniers et stats. Sa référence est **portée par les données du commun**
  (campagne « active implicite ») — **jamais** par un état d'UI.
- Depuis un commun partent **deux branches PARALLÈLES** (pas séquentielles) :
  **(A) Financement** et **(B) Projet** (`Dépense → Milestone → Action → Paiement`).
- La **« validation » d'un commun est un simple toggle admin**, sans action métier.
  ⚠️ **Ne jamais gater le financement ou la génération de projet sur « validé »** : un
  commun `pending` est finançable ET convertible en projet.

```
AAC (form aap/aac) ──> Campagne ──> Commun (= Answer coform)
                                      ├── (A) Financement : depense[].financer[] → panier → paiement → payé (immuable)
                                      └── (B) Projet : génération (IRRÉVERSIBLE) → milestones → actions → paiement
```

---

## 2. Le contrat de données

Le SDK type `answers` en `Record<string, unknown>` : **le contrat AAP/oceco n'est typé nulle
part côté SDK**. La source de vérité locale est **[`src/modules/aac/types.ts`](../src/modules/aac/types.ts)**.

| Objet | Chemin / forme | À savoir |
|---|---|---|
| **Commun** | `answers.aapStep<N>.<key>` | `status` = **TABLEAU append-only** (verbes empilés), pas un scalaire. États : `créé / pending / validé`. |
| **Dépense** | `answers.<depenseStepKey>.depense[]` | `{ poste, price, milestone: <milestoneId>, financer[] }`. ⚠️ **L'étape n'est PAS toujours `aapStep1`** (cf. §4). Les **logs vivent DANS la dépense** (`historique`). |
| **Financer** | `depense.financer[]` | `{ amount, date, user, id, name, type, fundingType }` — **deux axes distincts** (cf. encadré). |
| **Milestone** | `project.oceco.milestones[]` | Lien **1:1** avec la dépense via `depense.milestone === milestone.milestoneId`. Le montant reste porté par la **dépense** (jamais dupliqué). |
| **Action** | `milestone.actions[]` | Contrainte **Σ(actions.montant) ≤ depense.montant**. |
| **Campagne** | déclarée sur l'`aapConfig` (`campagne.<id>`) | `{ type: simple\|doublonnage, dates{début, fin, débutCofinancement, ouverturePaiement}, montantDisponibleDoublonnage, porteur, provider }`. |

> ### ⚠️ `financer` : deux axes à NE PAS confondre
> - **`type`** = nature de l'**entité** (`citoyen` \| `organisation`)
> - **`fundingType`** = nature du **financement** (aujourd'hui `prepaid` en dur)
>
> Le **porteur / doublonnage est un `fundingType`**, PAS un type d'entité. Un doublonnage =
> une **2ᵉ entrée `financer` SÉPARÉE** (500 € financeur + 100 € porteur = **600 €**, jamais
> fusionnés).

**Champs RÉSERVÉS** (déclarés dans `types.ts`, **absents des données actuelles** — à confirmer
au GATE §9) : `financer.paymentStatus`, `financer.campaign`, `financer.finkey`,
`depense.paiements[]`, `depense.historique[]`, et les entités net-new `Campagne`, `Panier`, `AacLog`.

---

## 3. Configuration (côté site)

**Un seul AAC par site.** Le patron est celui de `config.ampli`, mais **singulier** (objet, pas
tableau). Le site déclare son formulaire dans `config.aac`, puis pose les sections du module
dans ses pages :

```jsonc
// config.prod.<site>.json — extrait de config.prod.federationDesCae.json
{
  "aac": {
    "formId": "677e7e389058e31575550ac8",               // ← source de vérité UNIQUE
    "directory": { "fields": { /* §3.1 */ } },         // facultatif
    "detail":    { "gallery": "…", "sections": [ /* §3.2 */ ] }   // facultatif
  },

  "pages": [
    { "path": "/", "sections": [
      { "type": "aac-highlight", "id": "contribuer", "props": {
          "title": { "fr": "Contributeurs aux communs" },
          "tone": "primary",
          "cta": { "label": { "fr": "Contribuez aux communs" }, "href": "/aac/communs" },
          "count": { "source": "communs", "label": { "fr": "Communs déposés" } }
      } },
      { "type": "aac-directory", "id": "apercu", "props": {
          "title": { "fr": "Découvrez les communs" },
          "variant": "preview", "pageSize": 6, "showDepositButton": false,
          "moreLink": { "href": "/aac/communs", "label": { "fr": "Voir tous les communs" } }
      } }
    ] },
    { "path": "/aac/communs", "sections": [
      { "type": "aac-directory", "id": "aac", "props": {
          "title": { "fr": "Les communs identifiés" }, "columns": 3, "pageSize": 12, "variant": "full"
      } }
    ] }
  ]
}
```

**Le bloc `config.aac`** — `AacConfigSchema` dans [`modules/aac/schema.ts`](../src/modules/aac/schema.ts),
déclaré dans [`src/types/site-schema.ts`](../src/types/site-schema.ts) juste après `ampli` :

| clé | rôle |
|---|---|
| `formId` | le **form parent** (`type:aap`, `aapType:aac`). Obligatoire. |
| `directory.fields` | quel champ du document porte quel rôle sur la carte d'annuaire — §3.1 |
| `detail.gallery` / `detail.sections[]` | la fiche d'un commun : galerie et blocs de prose — §3.2 |

**Les trois sections** — aucune ne porte de `formId` : toutes lisent `config.aac.formId`
(`useSite().config.aac`). Props dans [`schema.ts`](../src/modules/aac/schema.ts) :

| `type` | rôle | props |
|---|---|---|
| `aac-directory` | **l'annuaire des communs** : filtres (recherche, usages, tags, maturité, tri), grille ou liste, défilement infini, bouton « Je dépose un commun » | `title`, `description`, `className`, `display` (`grid` \| `list`, mode initial), `columns` (1-4), `pageSize` (1-100), `filters{search,usage,tags,maturity,sort}`, `emptyText`, `showDepositButton`, `depositButtonLabel`, `variant` (`full` \| `preview`), `moreLink{href,label}` |
| `aac-highlight` | bande d'appel à l'action avec médaillon chiffré — le nombre de communs est **compté** (mode `countonly`), jamais saisi | `title` (requis), `description`, `className`, `tone` (`primary` \| `muted`), `cta{label,href}`, `count{source:"communs",label}` |
| `aac` | aperçu de **diagnostic** de la config résolue (`AacConfigStub`) — pas une surface utilisateur | `title`, `className` |

`variant: "preview"` rend les mêmes cartes, bornées à `pageSize`, sans filtre ni compteur ni
défilement, suivies de `moreLink` : c'est l'aperçu d'une page d'accueil. Sans `moreLink`, l'aperçu
est un cul-de-sac. Un filtre activé dont la question n'a pas pu être résolue est **masqué**, jamais
rendu inerte.

⚠️ Les `.default()` Zod de ces props sont **documentaires** : la config n'est pas parsée par Zod à
l'exécution, chaque composant applique ses propres défauts.

**Les deux routes** ([`routes.tsx`](../src/modules/aac/routes.tsx), chargées en `lazy`) :

| route | page | rôle |
|---|---|---|
| `/aac` | `AacPage` | l'annuaire complet (`aac-directory` en `full`) — **sans paramètre**, un seul AAC par site |
| `/aac/commun/:answerId` | `AacCommunDetailPage` | la fiche d'un commun (une `Answer`) : héros, financement (si `coremu`, §6), paliers et actions, contributeurs, blocs de prose §3.2, galerie |

Une page de module rend **son propre chrome** (`SiteHeader` / `SiteFooter`, cf. §5).

**Prérequis backend** : le form + son `aapConfig` doivent exister. Sans `config.aac.formId`,
les sections et les routes affichent un message explicite (pas de crash).

### 3.1 `directory.fields` — quel CHAMP porte quel RÔLE

Facultatif, et **seulement quand l'heuristique se trompe** : l'annuaire sait déjà déduire ses
champs (§ chaîne ci-dessous). Le bloc sert d'échappatoire déterministe.

```jsonc
"aac": {
  "formId": "677e7e389058e31575550ac8",
  "directory": {
    "fields": {
      // une RÉPONSE : chemin complet, l'étape en fait partie
      "description": "answers.aapStep1.aapStep1lzi62x3etw49gyc424d",
      "maturity":    "answers.aapStep1.aapStep1m2ucu54mopm33osqxpd",
      // un chemin à la RACINE du document : pas d'étape, profondeur libre
      "title":       "name",
      "users":       "links.cae"
    }
  }
}
```

**Deux formes, lues par `parseFieldPath`** :

- **`answers.<étape>.<idQuestion>`** — une réponse au formulaire. L'étape fait partie du
  chemin : un form AAP en compte 4 ou 5, l'id seul n'en désigne aucune, et la seule devinette
  disponible serait l'étape du RÔLE (`depenseStepKey`, ou `evalStepKey` pour `choose`) — juste
  dans le cas canonique, fausse dès qu'une question sort de son étape attendue, et
  indisponible quand la dérivation échoue. C'est aussi la forme de `form.mapping` en base et
  celle de la lecture réelle (`answers[étape][id]`).
- **tout le reste** — un chemin à la **racine** du document, de profondeur libre : soit un
  champ que le backend pré-calcule (`name`, `descriptionStr`, `tags`, `image`, `funds`,
  `user_count`, `interrest_count`), soit une branche métier (`links.cae`, `links.tls`,
  `allVoteCount.love`). Rien n'y est contraint : cette arborescence n'est pas la nôtre.
  Seul le monde `answers` impose sa profondeur — un `answers.<x>` d'une autre forme est une
  faute, et non une lecture racine.

⚠️ **Un champ racine est en lecture seule côté carte** : `parsePropositionData` le calcule
**après** la requête, il n'est stocké dans aucun document. `aacQueryParams.serverPath` refuse
donc de l'envoyer comme chemin Mongo — recherche, facette tags et tri alpha repassent côté
client (balayage), et le garde-brouillons `$exists` n'est pas posé. Sans cette garde, un
`{name: {$exists: true}}` viderait l'annuaire entier.

Le schéma ([`modules/aac/schema.ts`](../src/modules/aac/schema.ts)) ne contraint donc **pas**
la forme de la valeur : une regex assez étroite pour les questions refuserait les champs
racine.

Les 8 rôles, et ce que chacun pilote **au-delà de la carte** :

| rôle | carte | ailleurs |
|---|---|---|
| `title` | titre | `textPath` de la recherche, tri alphabétique, **et** le filtre anti-brouillons `{path:{$exists:true}}` |
| `description` | texte | — |
| `tags` | chips | `tagsPath` envoyé au serveur quand une facette tag est cochée |
| `maturity` | — | filtre « maturité » (ses OPTIONS viennent de la question) ; **aucun repli backend** : non résolu ⇒ `null` et filtre masqué |
| `image` | visuel | — |
| `depense` | jauge de financement | repli quand `funds` n'est pas pré-calculé |
| `choose` | badge « en attente » | lu sur l'étape d'ÉVALUATION, pas celle de dépôt |
| `users` | nombre de membres | **le seul rôle qui ne parle pas du formulaire** — cf. ci-dessous |

**`users` : le vivier dépend de la PLATEFORME, pas du form.** Un même commun peut être porté
par deux AAC, avec des membres différents de part et d'autre : `links.cae` sur la fédération
des CAE, `links.tls` sur les communs des tiers-lieux. Le chemin est donc libre — rien n'oblige
à passer par `links`. La valeur pointée peut être une map d'utilisateurs, un tableau d'ids ou
`null` (les trois existent en base) : on compte ses entrées.

Non renseigné ⇒ repli sur `user_count`, qui **n'est pas** le nombre de membres : le backend y
met la taille de `links.contributors`. Renseigné ⇒ **aucun repli** — « 0 membre sur cette
plateforme » est une réponse juste, alors que `user_count` afficherait le chiffre d'un autre
ensemble.

**Chaîne de résolution**, du plus explicite au plus devinatoire
([`lib/resolveAacCardFields.ts`](../src/modules/aac/lib/resolveAacCardFields.ts)) :

`config` → `form.mapping` → scan (type/libellé) → défaut canonique
(`titre`/`description`/`tags`/`image`/`depense`/`choose` ; ni `maturity` ni `users` n'en ont
un) → `null`.

Le résultat porte un champ **`source`** (`"config" | "mapping" | "scan" | "default" | "none"`)
qui dit lequel a répondu : c'est par lui qu'on diagnostique une carte vide.

⚠️ Deux échecs **silencieux** à connaître :

- un chemin désignant une question ABSENTE du formulaire est quand même honoré (référence
  « nue », `options: []`) — rien ne casse, mais le filtre correspondant ne ramène rien. Rien
  ne vérifie l'existence des ids : c'est à la charge de l'auteur du config ;
- une valeur de forme intermédiaire (`aapStep1.q_x`, `answers.q_x`, chemin à 4 segments) n'est
  **pas** appliquée : `parseFieldPath` rend `null` et la chaîne continue sur le scan. Comme la
  config n'est jamais parsée par Zod au runtime, la faute ne se voit qu'en lisant `source`.

**Trouver l'id d'une question** (aucun outil livré) — le document du form se lit sans auth :

```bash
curl -s -X POST "$VITE_BASE_URL_BACKEND/survey/coform/getformbyid" \
     -d "parentFormId=<formId>"
```

`data.subForms` donne l'ordre des étapes, `data.inputs.<étape>.inputs` la table
`id → {label, type, position}`, et `data.params` les listes d'options (clé nue, ou préfixée
`radioNew<id>` / `checkboxNew<id>` / `categorizedCheckbox<id>`…). On repère la question par son
**libellé**, et on écrit `answers.<étape>.<id>`.

### 3.2 `detail` — la fiche d'un commun

La fiche (`/aac/commun/:answerId`) rend ses blocs structurels d'elle-même (héros, financement,
paliers, contributeurs, galerie). Les **blocs de prose** — les questions de l'appel qui méritent
une section — sont **déclarés**, jamais devinés : contrairement à l'annuaire, aucune heuristique
ne peut dire quelles questions d'un appel font une section, ni dans quel ordre
([`lib/resolveAacDetailSections.ts`](../src/modules/aac/lib/resolveAacDetailSections.ts)).

```jsonc
// extrait de config.prod.federationDesCae.json
"aac": {
  "formId": "677e7e389058e31575550ac8",
  "detail": {
    "gallery": "aapStep1.image",                        // subKey des documents de la galerie
    "sections": [
      { "id": "modele",      "title": { "fr": "Modèle économique" },  "icon": "Layers",
        "field": "answers.aapStep1.aapStep1lpvinn7ld70wbk7w339" },
      { "id": "gouvernance", "title": { "fr": "Mode de gouvernance" }, "icon": "UsersRound",
        "field": "answers.aapStep1.aapStep1lpvioouzejcnjy7ffw" }
    ]
  }
}
```

| clé | rôle |
|---|---|
| `gallery` | le `subKey` des documents joints à montrer en galerie (`answers.<étape>.<id>` côté document ⇒ `<étape>.<id>`). **Omis ⇒ pas de galerie.** |
| `sections[].id` | ancre DOM et cible du sommaire — unique (un doublon est écarté) |
| `sections[].field` | **même grammaire que `directory.fields`** (§3.1) : `answers.<étape>.<id>` ou chemin racine. Illisible ⇒ entrée écartée |
| `sections[].title` | omis ⇒ le **libellé de la question** elle-même (l'intitulé vient de l'appel, pas d'une traduction générique) ; repli ultime : l'`id` |
| `sections[].kicker` | sur-titre optionnel |
| `sections[].icon` | nom d'icône lucide (`DynamicIcon`) ; inconnu ou omis ⇒ icône par défaut |

**Règle : pas de déclaration ⇒ zéro bloc, par conception.** `resolveAacDetailSections` rend `[]`
dès que `detail.sections` est absent ou vide, et `useAacGallerySubKey()` rend `null` sans
`detail.gallery`. Une fiche sans prose ni galerie sur un nouveau site n'est pas un bug : c'est le
bloc `detail` qui manque — et rien ne le signale à `config:validate` (tout y est optionnel).

---

## 4. Le résolveur `AacConfig` — le cœur du socle

**[`lib/resolveAacConfig.ts`](../src/modules/aac/lib/resolveAacConfig.ts)** est une fonction
**PURE** (testée, 9 tests) qui normalise `form.serverData` + le doc `aapConfig` en un objet
unique. **Toute la logique legacy fragile est ici** — ne la ré-implémentez pas ailleurs.

```ts
resolveAacConfig(formId, formData, configData?) → AacResolvedConfig
// via le hook : useAacConfig(formId) → { config, isLoading, error }   (0 nouvel endpoint)
```

Les règles qu'il reproduit — **chacune est un piège du legacy** :

| Règle | Détail |
|---|---|
| **`subForms` a DEUX formes** | **TABLEAU** sur le form (ordre des étapes) vs **OBJET** sur l'aapConfig. Le form fait foi, et il peut être un **SOUS-ENSEMBLE** des steps du config. |
| **Dispatch 4 vs 5 étapes** | 5 steps ⇒ éval/financement/suivi = index **2/3/4** ; 4 steps ⇒ **1/2/3**. Raffiné par **scan des clés/types d'input**. **Jamais de `aapStepN` en dur.** |
| **`depenseStepKey` variable** | L'étape portant `depense[]` est **résolue**, pas supposée. ⚠️ Le code `cagnotte` réutilisé lit `answers.aapStep1.depense` **en dur** → il faut le **paramétrer**, pas le cloner. |
| **Priorité des critères** | `formParent.evaluationCriteria` (si `activateLocalCriteria`) **>** `aapConfig…params.config.criterions`. Exposé via `criteriaSource`. |
| **Coercions** | `coeff` string → number, rôles **CSV → array**, flags `"true"` → bool. |
| **Config org-spécifique** | Deux configs CoForm coexistent (**template héritable** vs **org-spécifique**) → on lit **celle pointée par `form.config`**. |

Sortie (`AacResolvedConfig`) : `steps[]`, `roles{depenseStepKey, evalStepKey, financementStepKey,
suiviStepKey}`, `criteria[]`, `criteriaSource`, `gates`, `campaigns[]`.

> **Nommage — ne pas confondre :**
> - **`AacConfig`** (`schema.ts`) = le bloc **DÉCLARÉ** dans `config.aac` (juste `{ formId }`).
> - **`AacResolvedConfig`** (`types.ts`) = la config **RÉSOLUE** (sortie du résolveur).

---

## 5. Architecture du module

```
src/modules/aac/
  module.config.ts          # { name:"aac", type:"core", enabled:true } → auto-découvert
  index.ts                  # side-effects i18n + permissions/register EN PREMIER, puis exports
  routes.tsx                # /aac (pas de param — un seul AAC par site)
  schema.ts                 # AacConfigSchema (bloc site) + AacSectionSchema (section)
  types.ts                  # CONTRAT : Commun/Depense/Financer + Campagne/Panier/Log RÉSERVÉS
  lib/resolveAacConfig.ts   # résolveur PUR (+ .test.ts)
  lib/formParent.ts         # firstParent(form) → le CONTEXTE porteur d'un appel (+ .test.ts)
  lib/objectiveHelpers.ts   # dont resolveCommunOwnerIds : qui gère les paliers d'un commun
  hooks/useAacConfig.ts     # résolveur câblé (api.form ×2, 0 nouvel endpoint)
  hooks/useCommunFundingContext.ts # où vit un commun : l'appel où il a été DÉPOSÉ
  hooks/useCommunFundingHost.ts    # l'entité de ce contexte — celle qui détient l'enveloppe
  hooks/useCommunProjectEntity.ts  # le Project lié : droits + oceco.milestones
  hooks/useCommunRawDepenses.ts    # depense[] : ...RawDepenses pour l'affichage,
                                   #   ...RawDepensesDocument (brut) pour l'écriture
  hooks/useAacPermissions.ts
  permissions/              # types, defaults, calculators/aac.ts, register, index
  constants/queryKeys.ts    # AAC_QUERY_KEYS
  components/AacConfigStub.tsx  # section (export default, `import "../i18n"` en 1re ligne)
  pages/AacPage.tsx         # page de la route
  i18n.ts + i18n/{fr,en}.json
```

**Enregistrements hors module** (à connaître si vous ajoutez une section) :
`src/types/site-schema.ts` (union + `config.aac`), `src/components/sections/SectionRenderer.tsx`
(`LazySections`, `lazy` de **vite-preload**, cible en **export default**),
`src/lib/queryKeys.ts` (barrel), `src/components/admin/section-meta.ts`,
`scripts/audit-config.ts` (`/aac` dans `KNOWN_ROUTE_PREFIXES`),
`.claude/skills/config-assistant/SKILL.md` (table Modules — **testée**).

> ⚠️ **Le chrome du site n'est pas automatique sur une route de module.** Les routes de module
> sont montées sous `RootLayout` (providers + `<Outlet/>`), **pas** sous `SiteRenderer` (qui rend
> header/footer des pages JSON). Une page de module **doit rendre `<SiteHeader/>` + `<SiteFooter/>`
> elle-même** (patron `AmpliPage`/`ProfilePage`/`CoFormPage`) — sinon **le menu disparaît**.

---

## 6. Permissions

Namespace `"aac"` → `useAacPermissions(entity, data)`. **5 dimensions** (spec métier) :
accès formulaire, lecture des réponses, modification, participation aux actions, contribution
financière.

- **Bypass admin-costum TOTAL** : résolu **centralement** par `usePermissions` (`isCostumAdmin`)
  — le calculateur ne le ré-implémente pas.
- **Gate MAÎTRE `coremu`** — lu à la **racine du form** (`form.coremu`, booléen ou chaîne
  `"true"` : `filter_var(FILTER_VALIDATE_BOOLEAN)` côté PHP). Posé par la préconfiguration
  « Système de coremuneration » d'`aap.js` (`Form::switchcoremu`), lu par `detailProposal.php:105`.
  **OFF ⇒ aucun bloc financement** sur la fiche, admin compris (`canViewFunding`) ; contribuer
  exige en plus d'être connecté (`canContributeFunding`). La clé n'est **ni dans `params`, ni sur
  l'aapConfig** ; `coRemuneration` n'a jamais existé. Un form sans `coremu` (c'est le cas du form
  CAE) masque le financement **comme le legacy** : c'est la préconfiguration qu'il faut (re)jouer,
  pas le front. Qui peut financer une fois le bloc affiché (`params.financerLimitRoles` /
  `limitTypes`) n'est pas porté aujourd'hui.
- **Dépôt = 3 modes** (ouvert / membres / rôles), toujours **connecté** — les gardes de
  `Coform::getFormAccessInfo`. Le dépôt n'est **jamais** ouvert à tous par défaut. Il n'existe
  **pas** de clé `standalone` : c'est un mode de **requête** legacy (`.standalone.true`,
  `filters.formStandalone`), pas une option du form — le gate qu'on en dérivait valait toujours
  `false`. La seule dispense de compte du legacy est `temporarymembercanreply` (compte temporaire
  par email), non portée.
- **`anyOnewithLinkCanAnswer`** (« avoir le lien suffit pour répondre », `form.js`) : un
  **connecté** peut lire et modifier une réponse **sans lien au contexte** de l'appel
  (`IndexAction.php:237`, sous `session['userId']`). Ce n'est **pas** un dépôt sans connexion.
  Porté par `canEditCommun`.
- **Lecture** : publique, sauf `onlymemberaccess` (membres et admins — `Form.php:1869`). Pas de
  clé `annuaire` : la restriction de **listing** (`onlyAdminCanSeeList`) est appliquée par le
  backend, §13.5.
- **Compte temporaire** : un answer peut avoir pour auteur un **compte temporaire (email seul,
  sans `userId`)** → tout calcul ancré sur `userId` doit tolérer son absence.
- **Manquant, à ajouter au moment du financement** : la **garde d'immuabilité `paid`**
  (aucun garde en lecture seule n'existe aujourd'hui sur un financement payé).

**Paliers et actions d'un commun** — droits calculés par le namespace `cagnotte`, pas `aac` :
`useCommunObjectivesController` passe l'entité **du projet lié SEULE** (jamais de repli sur l'org du
site, cf. `doc/18` §Pièges n°4) et `ownerIds: resolveCommunOwnerIds(answer)` = **le déposant**. Le
déposant n'est admin d'aucune entité : sans cette liste, il ne pouvait ni créer un palier ni
ajouter une action sur SON commun.

Droit final : **admin du projet lié OU déposant du commun**. L'admin de l'appel n'y est pas — voir
ci-dessous.

⚠️ **Deux règles voisines mais DISTINCTES**, à ne pas réunifier :

| Action | Qui | Où |
|---|---|---|
| Sélectionner / valider un commun | admin de l'appel | `aac` (`canSelectCommun`) |
| **Générer / Associer un projet** | admin de l'appel **ou** déposant | `CommunProjectControl.canManageProject` |
| **Ajouter / éditer palier et action** | admin du **projet lié** **ou** déposant | `cagnotte` + `ownerIds` |

Porter l'appel autorise à instruire et à **promouvoir** un commun, pas à écrire dans le plan de
financement d'autrui. L'admin de l'appel retrouve les paliers dès qu'il administre le projet lié —
ce qui est le cas courant quand c'est lui qui l'a généré.

## 7. Query keys

`AAC_QUERY_KEYS` ([`constants/queryKeys.ts`](../src/modules/aac/constants/queryKeys.ts)) suit la
convention du repo, **plus une spécificité AAC** :

- **`campaignId`** entre dans les clés des données scopées campagne (**isolation stricte**).
- **`userId` en DERNIER segment** sur les données user-scopées (mes votes/éval/financements/« vu »),
  et **absent** des données publiques (config, listing) pour préserver la mutualisation du cache.

---

## 8. Ce qu'on RÉUTILISE (ne rien réécrire)

| Besoin | Réutiliser | Où |
|---|---|---|
| Rendu + persistance d'un commun | `SmartCoForm` → `answer.save()` / `processUploads()` | `modules/coform` |
| Financement (`depense[].financer[]`) | `useFundingEnvelope`, `useSaveCagnotteContribution`, types `Funding*` (dont `FundingMilestone` qui porte déjà `answerDepenseIndex`/`projectMilestoneIndex`) | `modules/cagnotte` |
| Dashboards | `dashboard.ts` + `dimensions.ts` (**array-aware**, lit `answers.<form>.serverData.answers.<section>.<field>`) | `modules/observatoire` |
| Listing / filtres / cartes | `useSearchQuery` (`searchType:['answers']`), `CardAnswer`, `parseCoformAnswer`, `FiltersSection` | `modules/search` |
| Évaluation | `useMultiEvalData` + `MultiEvalRadarTabs`/`Dialog` (radar **prêt**), `EvaluationField`/`EvaluationVoteCell` | `modules/coform` |
| Parsing de données non typées | `utils/dataTransform.ts` (`asRecord`, `toArrayOrValues`, `getServerData`…) | `modules/cagnotte` |

---

## 9. ⚠️ Pièges à connaître AVANT de coder

1. **`unknown` = perte de donnée SILENCIEUSE.** Un type d'input AAP non mappé rend une boîte rouge
   **et droppe sa valeur au save**. **Ne déposez pas de vrai commun via un form non mappé.**
   Types encore non mappés : `newDepenseList`, `aap.selection`, `chooseProposal`, `multiDecide`,
   `suiviFromBudget`, `generateprojectbtn`, `tags`, `categorizedCheckbox`.
   *(Déjà mappés : `finder`, `checkboxNew`, `radioNew`, `evaluation.evaluation`, et l'alias
   `titleSeparator` → `sectionTitle`.)*
2. **Pollution `{}` ↔ `[]` (MongoDB).** Un champ **array** (`depense[]`) **DOIT** déclarer
   `getFieldShape = 'array'` **+ un default**, sinon un `[]` legacy arrive en `{}` et casse le
   resolver Zod au submit.
3. **Stockage legacy non uniforme.** `FIELD_PREFIX_MAP` préfixe certains champs
   (`finder` → `finder{key}`, `commonTable` → `yesOrNo{key}`) et `ROOT_LEVEL_FIELDS` stocke
   `evaluation`/`commonTable` **à la RACINE** de `answers` (pas sous `answers[subFormId]`).
4. **Les options ne sont PAS sur l'input** : elles vivent dans `formData.params[<clé préfixée>]`
   (`radioNew{key}`, `checkboxNew{key}`, `config{key}`/`criterias{key}`…). Tout champ config-lourd
   doit parser `params` dans `parseCoFormFields`, sinon il rend vide.
5. **Cloner `cagnotte` est dangereux** : il hardcode `answers.aapStep1.depense`, `fundingType:'prepaid'`,
   et **`normalizePaymentStatus` défaute à `paid`** (⇒ toute contribution naît « payée »).
   **Forker/paramétrer**, pas cloner.
6. **Sur-financement conservé** : si une dépense est diminuée après financement, le financé **PEUT
   dépasser** le montant (« 5500 € financés sur 5000 € »). **Ne jamais plafonner à 100 %**, ne pas
   dériver le financé depuis `remaining`.
7. **`mapping` de l'aapConfig potentiellement PÉRIMÉ** (constaté en base) → prévoir un fallback par
   nom de champ. Et **jamais de clé littérale** `aapStep1lurze…` (les inputKeys sont générés).
8. **Dérive de version SDK** : le repo `cocolight-api-client` peut être **en retard** sur le paquet
   installé. **Coder contre `node_modules`**, pas contre les sources du repo.
9. **Un commun listé ici n'y a pas forcément été DÉPOSÉ.** Il suffit qu'un admin d'ici l'ait
   sélectionné (`answers.aapStep2.choose.<contextId>`). Sa **fiche** est rendue avec le formulaire
   de l'appel COURANT (`directory.formId ?? answer.form`), mais son **financement** appartient à
   son appel d'origine : l'enveloppe est scopée à l'entité appelante (cf. `doc/18` §Pièges n°2bis),
   donc la lire depuis l'entité du site ne le trouve pas. Résoudre l'hôte avec
   `useCommunFundingContext` + `useCommunFundingHost` — et ne JAMAIS laisser une ressource
   introuvable retomber sur une autre : la modale de financement écrirait dans le
   `depense[].financer[]` du mauvais commun.

   Deux corollaires côté écriture : suspendre l'enveloppe tant que l'hôte se résout
   (`useCommunFundingHost().isLoading` → `useFundingEnvelope(..., { enabled })`), sinon on part
   sur l'entité du site le temps d'un aller-retour ; et passer l'étape RÉSOLUE
   (`config.roles.depenseStepKey`) aux replis document, `buildResourceFromAnswer` comme
   `useCommunRawDepenses`, plutôt que de laisser jouer leur défaut `DEFAULT_AAC_STEP`.
   Sur les limites du repli lui-même (index Mongo, suppression refusée) : `doc/18` §Pièges n°2bis.
10. **Les `.default()` des schémas de section ne jouent PAS à l'exécution** (la config n'est jamais
   parsée par Zod au runtime — cf. `doc/05`, encadré d'en-tête). Un sous-objet de la config arrive
   donc **tel quel**, et un défaut de destructuration (`filters = {…}`) ne joue que s'il est
   **absent** : `"filters": { "search": false }` sur `aac-directory` éteignait les quatre autres
   filtres. Fusionner **clé par clé** (`resolveDirectoryFilters`, `lib/directoryFilters.ts`), dont le
   défaut est tenu aligné sur le schéma par un test — et faire de même pour tout nouveau sous-objet
   à défauts.

---

## 10. 🚧 GATE — à confirmer sur données réelles

Plusieurs mappings du résolveur sont **best-effort** et marqués `⚠️ GATE` dans le code. **À valider
avant de construire le financement** (base `pixelhumain1` ; AAC de référence : form FTL
`6438366673d20a0de1533c77`, 87 communs réels) :

- la **clé de référence CAMPAGNE portée par l'answer** — **introuvable dans le code** ; sans elle
  **tout le scope financement est indéfini** (bloquant) ;
- la forme réelle de `depense[].financer[]` sur un **answer déjà financé** (présence de
  `paymentStatus` / `campaign` / porteur) ;
- les clés réelles des **9 domaines** de l'`aapConfig` — le flag de financement, lui, est
  **tranché** : `form.coremu` (§6), et non `coRemuneration` ;
- les gates `annuaire` / `standalone` — **tranché** : clés fantômes, retirées du résolveur (§6) ;
- le lien `depense.milestone` ↔ `project.oceco.milestones[].milestoneId`.

**Décisions ouvertes** : (a) de **nouveaux endpoints SDK** seront très probablement nécessaires pour
le financement (panier, paiement, budget doublonnage : **rien n'existe** côté SDK) ; (b) la **sync
dépense↔milestone** est « backend-only » selon la spec, alors que `cagnotte` fait déjà une **sync
client** → à trancher pour éviter une double-sync divergente.

---

## 11. Roadmap — par où intégrer les besoins

Ordre validé : **Dépôt → Consultation/listing → Évaluation/sélection → Financement ∥ Projet.**

### Ajouter un type de champ CoForm (le besoin n°1 : `newDepenseList`)

Patron canonique — précédent : `LocationField`. **5 à 6 touchpoints** :

1. l'union `componentType` — `modules/coform/types.ts`
2. le mapping `mapCoFormTypeToComponentType` — `modules/coform/utils/formParser.ts`
3. le schéma Zod — `generateZodSchema` (même fichier)
4. le `case` de rendu dans le `switch` de `DynamicCoForm` (+ import)
5. le composant `components/XxxField.tsx` (+ util de (dé)normalisation du blob legacy,
   modèle : `utils/coformLocality.ts`)
6. **pour un array** (`depense[]`) : `generateDefaultValues` **+** `getFieldShape = 'array'`
   — **obligatoire** (cf. piège n°2)

### Autres jalons

- **Listing** : **livré** (`aac-directory`, `parseAacAnswer`) — la visibilité est celle du
  backend (§13.5) ; il n'existe pas de flag `annuaire` (§6).
- **Évaluation** : le **radar multi-éval est prêt** (`useMultiEvalData` + `MultiEvalRadarTabs`).
  Le champ **selection 2D + admissibilité** est à construire. *(Signal donnée : la matrice jury
  n'est peuplée sur AUCUN AAC réel — l'éval effective est `selection` + `admissibility`.)*
- **Financement** : cf. pièges 5/6 + GATE §10 (campagne, panier, doublonnage, immuabilité `paid`).
- **Projet** : réutiliser `FundingMilestone`/`FundingAction` ; génération **irréversible**.

---

## 12. Tests & vérification

```bash
npx vitest run --config vitest.config.unit.ts src/modules/aac   # résolveur (pur)
npm run config:validate -- config.prod.<site>.json              # le bloc config.aac
npm run audit:config -- --file config.prod.<site>.json          # `strip: 0` ⇒ config.aac bien lu
npm run test:preflight                                          # parité i18n fr/en + union sections
npx tsc -b --noEmit
```

**Filets automatiques** : le typage `SectionPropsMap ↔ LazySections` **casse le build** si l'union
et le renderer désynchronisent ; `i18n-files.test.ts` casse sur toute divergence de clés fr↔en ;
`skill-integrity.test.ts` casse si la table Modules du SKILL config-assistant dérive.

---

## 13. Annuaire des communs — endpoint `directoryproposal`

> **L'annuaire des communs a déjà son endpoint métier dédié côté backend** — il est simplement
> **absent du SDK** `@communecter/cocolight-api-client`. Cette section documente son contrat tel
> qu'il est implémenté, pour pouvoir le déclarer sans le deviner.

Chaîne PHP (module `citizenToolKit`) : `controllers/aap/DirectoryProposalAction.php` →
`models/Aap.php :: globalAutocompleteProposal()` → constructeur de requête
`globalAutocompleteProposalQuery()` → post-traitement `parsePropositionData()`. Route déclarée dans
`co2/controllers/AapController.php` (clé `directoryproposal`).

C'est le squelette du `globalAutocomplete` générique (`searchParams` → `SearchNew::addQuery` →
`PHDB::findAndFieldsAndSortAndLimitAndIndex`), **plus une quinzaine de branches de filtres propres à
l'AAP** et un enrichissement métier de chaque réponse.

### 13.1 Route et modes

```
POST /co2/aap/directoryproposal/source/{source}/form/{form}
```

PathParams Yii en **paires clé/valeur, ordre libre** — `…/countonly/true/form/{form}` est valide.

| PathParam | Requis | Effet |
|---|---|---|
| `form` | ✅ | id du **form parent** AAC |
| `source` | — | slug du costum (des appels sans `source` existent en prod) |
| `newcounter/true` | — | renvoie **uniquement** le nombre de communs **non vus** par l'utilisateur |
| `countonly/true` | — | renvoie **uniquement** le compte, sans `results` |

Les trois modes sont exclusifs et produisent **trois formes de réponse différentes** (§13.3).

### 13.2 Paramètres de requête (corps POST)

**a) Paramètres généraux**

| Paramètre | Type | Défaut | Effet |
|---|---|---|---|
| `searchType` | `string[]` | — | `searchType[0]` = **collection interrogée** ; tous les `find`/`count` s'y appliquent |
| `name` | `string` | — | recherche texte (`SearchNew::searchText`) |
| `textPath` | `string` | — | chemin de la recherche texte ; sinon le défaut de `searchText` |
| `searchTags` | `string[]` | — | tags (`SearchNew::searchTags`), opérateur `$in` |
| `tagsPath` | `string` | `tags` | chemin des tags |
| `userId` | `string` | — | restreint à `user = <userId>` |
| `sortBy` | `object` \| `string[]` | `{ updated: -1 }` | map `{champ: 1\|-1}` (valeurs castées en `int`), ou liste de champs ⇒ `1` |
| `fields` | `string[]` | `[]` | projection |
| `indexMin` | `int` | `0` | offset |
| `indexStep` | `int` \| `"all"` | `100` | taille de page ; `"all"` ⇒ `findAndSort` **sans limite** |
| `count` | clé présente | — | si présente, ajoute `count.<searchType[0]>` à la réponse |
| `filters` | `object` | — | cf. tableau **b** |

**b) Clés de `filters` à traitement spécial** — toute clé non listée retombe dans
`SearchNew::searchFilters` (pass-through). Les clés traitées sont **consommées** (retirées avant le
pass-through).

| Clé | Valeur | Traduction |
|---|---|---|
| `form` | `string` | `$or` **à trois voies** : `form`, `answers.aapStep2.choose.<elId>.value = "selected"`, `links.aacForm.<formId>` `$exists` |
| `formStandalone` | `bool` | désactive le gate `onlyAdminCanSeeList` (§13.5) |
| `address` | `string` | regex accent-insensible sur `<mapping.address>.postalCode` et `.name` |
| `views` | `["seen"]` \| `["notSeen"]` | `views.<userId>` `$exists` `true`/`false` |
| `vote` | truthy | `vote.<userId>` `$exists` |
| `inproject` | `["inproject"]` \| `["inproposal"]` | `project.id` `$exists` `true`/`false` |
| `admissibility` | `["admissible"]` \| `["inadmissible"]` | `$or` de `answers.aapStep2.admissibility.<membreId>` sur **toute la communauté** de l'entité porteuse |
| `quartiers` | `string[]` | `answers.aapStep1.interventionArea` `$in` |
| `<path>.choose.<…>` | `string[]` | `$in` ; la valeur `notselected` ajoute une branche `$exists: false` |
| `answers.aapStep1.depense.financer.idAndName` | `"<id>-idAndName-<nom>"` | `$or` sur `…financer.name` et `…financer.id` |
| `oneSubOrganization` | `string[]` (valeurs `a-b` éclatées sur `-`) | `form` `$in` — ⚠️ branche **conditionnée à `filters.form` non vide**, donc inatteignable dès que `form` est fourni (cf. encadré) |
| `allSubOrganisation` | `string[]` | `form` `$in` — ⚠️ tente d'y ajouter `filters.form`, déjà consommé (cf. encadré) |
| `status` | `string[]` | `unnotified` ⇒ `status` `$ne` `notified` **et** `$ne` `notificationSent`. La clé n'est retirée que si `unnotified` est **la seule** valeur ; sinon le tableau **entier** repart en pass-through |

> ⚠️ **L'ordre de consommation compte.** La branche `form` s'exécute **en premier** et fait
> `unset(filters.form)`. Les branches `oneSubOrganization` et `allSubOrganisation`, qui viennent
> ensuite, relisent pourtant cette clé : la première est **conditionnée** à `filters.form` non vide
> (⇒ jamais atteinte quand `form` est fourni, le cas normal), la seconde **ajoute la valeur absente**
> à sa liste `$in`. Ne pas compter sur ces deux filtres pour scoper un multi-formulaires tant que le
> backend n'a pas été corrigé.

**Correspondance avec les filtres de la spec** (parcours financeur, « Découverte des communs ») :

| Filtre spec | Paramètre |
|---|---|
| nom | `name` + `textPath` |
| tag | `searchTags` + `tagsPath` |
| besoin | `filters` (pass-through) |
| déjà lu | `filters.views` |
| sélectionné | `filters.vote`, ou `filters.<path>.choose.<…>` |
| utilisable | candidat `filters.inproject` — **à confirmer** |

> ⚠️ **`filters.views` et `filters.vote` sont résolus côté serveur contre l'utilisateur de session.**
> Dès que l'un est actif, la réponse est **user-scopée** : la query key doit alors porter `userId`.
> C'est une nuance à la règle du §7 (`userId` absent des clés publiques) — elle ne vaut que pour un
> listing sans filtre user-scopé.

### 13.3 Résultats attendus

**Mode `newcounter`** — `{ "newCounter": int }`, et **rien d'autre** (`parsePropositionData` n'est pas
appelé). Vaut `0` si l'utilisateur n'est pas connecté.

**Mode `countonly`** — `{ "count": { "<searchType[0]>": int } }`, sans `results`. ⚠️ Les blocs latéraux
ci-dessous sont **tout de même présents** (vides) : `parsePropositionData` est appelé dans ce mode aussi.

**Mode normal** — `results`, `count` optionnel, et dix blocs latéraux batch-résolus :

| Clé | Forme | Contenu |
|---|---|---|
| `results` | map `answerId → answer` | les communs (champs ajoutés ci-dessous) |
| `count` | `{ "<searchType[0]>": int }` | présent si `count` était fourni |
| `users` | map | auteurs + contributeurs — `name`, `slug`, `profilImageUrl` (défaut injecté si vide), `collection` |
| `usersStatus` | map | auteurs des entrées `statusInfo` — `name`, `slug`, `collection` |
| `sousOrga` | map | forms des réponses — `parent` |
| `checkSeen` | map | documents de la collection `views` pour l'utilisateur courant |
| `allActions` | map | actions liées par `parentId` (projet) ou `answerId`, `parentType = projects` |
| `allImages` | map | documents `subKey = aapStep1.image`, extensions image |
| `allDocuments` | map | documents hors image, `doctype`\|`docType` = `file` |
| `elements` | map | entités de contexte — `name`, `slug`, `collection` |
| `inputs` | map | `forms.inputs` des formulaires concernés — `step`, `inputs` |
| `allNotSeenComments` | map `contextId → int` | nombre de commentaires non vus |

**Champs ajoutés par `parsePropositionData` sur chaque entrée de `results`** :

| Champ | Source | Note |
|---|---|---|
| `name` | `answers.aapStep1.titre` | `"(No title)"` si absent |
| `descriptionStr` | `answers.aapStep1.description` | |
| `tags` | `answers.aapStep1.tags` | ré-indexé (`array_values`) |
| `image` | vignette résolue (`getPropositionThumbnail`) | |
| `funds` | `answers.aapStep1.depense[]` | **agrégat de financement** : `{ price: int, financer: number[] }` — les dépenses `include === false` sont **exclues**, et `financer` est réduit aux seuls **montants** |
| `user_count` | `links.contributors` | cardinal |
| `interrest_count` | `vote` où `status === "love"` | cardinal |

> `funds` couvre le besoin « demandé / financé » de l'annuaire **sans agrégation côté client** :
> inutile de rapatrier les réponses entières pour sommer `depense[].financer[]`.

### 13.4 Deux avertissements

**a) Le pré-formatage suppose `aapStep1` / `aapStep2` en dur.** `parsePropositionData` part de
`answers.aapStep1` ; l'image est cherchée sur `subKey: "aapStep1.image"` ; le constructeur de requête
code de même `answers.aapStep2.choose`, `aapStep2.admissibility`, `aapStep1.interventionArea` et
`aapStep1.depense.financer.*`. Le `mapping` du form est bien construit avec une entrée
`answers.aapStep1.titre`, mais **elle n'est jamais lue** — `mappingData` ne sert qu'à l'adresse.

> ⚠️ Cela entre en collision avec la règle du **§4** (`depenseStepKey` est **résolu**, jamais supposé —
> « jamais de `aapStepN` en dur »). Sur un AAC dont la disposition diffère, `name` vaut `"(No title)"`
> et `tags` / `descriptionStr` / `funds` sont **vides — silencieusement, sans erreur**. Traiter les
> champs pré-formatés comme un **chemin rapide**, avec repli sur `answers.<stepKey résolue>.<clé>`.

**b) `results` est une map, pas un tableau.** Le `_transformData` du SDK la convertit en tableau en
injectant `id` — comportement désirable ici. En revanche **ne pas router la réponse dans
`_linkEntities`** : les answers ne portent pas de champ `collection` et seraient **silencieusement
jetées**.

### 13.5 Gates déjà appliqués par le backend

| Gate | Effet |
|---|---|
| `form.params.onlyAdminCanSeeList` | si actif et que l'utilisateur n'est ni admin (élément ou super-admin) ni porteur des rôles `aapStep2.canEdit` / `aapStep3.canEdit`, la requête est **restreinte à ses propres réponses** (`user = <userId>`) |
| `filters.formStandalone` | bypass du gate ci-dessus |

Rien à réimplémenter côté client pour ces deux-là.

> ⚠️ **Constat pour le GATE §10** — la clé réelle du flag « Publier sur l'annuaire des appels à
> communs » est **`isPublishedInAacOrg`**, portée par le **form**, en **opt-out** : `getAacElements()`
> et `aacQuery()` matchent `isPublishedInAacOrg === true` **ou champ absent** ⇒ publié par défaut.
> Elle gouverne l'annuaire **des AAC**, pas la lecture des communs. Le gate `annuaire` que lisait
> `resolveAacConfig` (`form.annuaire` / `params.annuaire`) n'avait aucune clé backend : il a été
> **retiré** (§6) — la lecture des communs suit `onlymemberaccess`, le listing suit
> `onlyAdminCanSeeList` ci-dessus.

### 13.6 Routes sœurs

Mêmes fondations, **hors périmètre du module** aujourd'hui :

- `POST /co2/aap/aac/method/aac_directory` — annuaire **des AAC** (`Aap::aacQuery` + `parseAacData`)
- `POST /co2/aap/aac/method/communs_directory` — communs **inter-AAC** (`Aap::communsQuery`)

---

## Voir aussi

- [Module CoForm](21-module-coform.md) — le moteur sur lequel l'AAC est posé (un commun = une Answer)
- [Module Cagnotte](18-module-cagnotte.md) — le contrat financier `depense[].financer[]`
- [Module Observatoire](27-module-observatoire.md) — dashboards déclaratifs
- [Permissions](10-permissions.md) · [i18n](13-i18n.md) · [Sections dynamiques](06-sections-dynamiques.md)
