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
| **Financer** | `depense.financer[]` | `{ line, amount, date, user, id, name, type, status, finkey, payment{…} }` — format **canonique**, écrit par le serveur (cf. encadré). |
| **Milestone** | `project.oceco.milestones[]` | Lien **1:1** avec la dépense via `depense.milestone === milestone.milestoneId`. Le montant reste porté par la **dépense** (jamais dupliqué). |
| **Action** | `milestone.actions[]` | Contrainte **Σ(actions.montant) ≤ depense.montant**. |
| **Campagne** | déclarée sur l'`aapConfig` (`campagne.<id>`) | `{ type: simple\|doublonnage, dates{début, fin, débutCofinancement, ouverturePaiement}, montantDisponibleDoublonnage, porteur, provider }`. |

> ### ⚠️ `financer` : les axes à NE PAS confondre
> - **`type`** = la **collection** de l'entité financeuse (`citoyens` \| `organizations` \|
>   `projects`), au pluriel — c'est le nom de collection que le serveur écrit.
> - **`status`** = statut de l'**engagement** (`pending` à la création).
> - **`payment.status`** = statut du **paiement** (`unpaid` \| `partial` \| **`payed`**, sic).
>   Rien à voir avec `status` : une promesse `pending` peut être `payed`.
> - **`fundingType`** = LEGACY, lecture seule. `prepaid` était le marqueur binaire de « payé »
>   avant le bloc `payment` ; il n'est **plus jamais écrit**.
>
> Le **porteur / doublonnage est un `fundingType`**, PAS un type d'entité. Un doublonnage =
> une **2ᵉ entrée `financer` SÉPARÉE** (500 € financeur + 100 € porteur = **600 €**, jamais
> fusionnés).

### Le bloc `payment` — le serveur en est l'unique auteur

```jsonc
"payment": {
  "logs": [{ "invoiceId", "financerId", "financerName", "finkey", "amount",
             "type": "manual|stripe|helloasso", "date", "confirmation": "pending|validated",
             "paidBy", "validatedAt", "validatedBy" }],
  "paidAmount": 500,      // Σ des logs `validated` — le seul montant ACQUIS
  "pendingAmount": 0,     // Σ des logs en attente de validation du porteur
  "status": "partial"
}
```

`finkey` (`a-` + 12 caractères) est la **clé stable de la ligne** : c'est par elle qu'on vise un
versement, jamais par la position dans `financer[]`, qu'une insertion concurrente décale.

**Ne jamais écrire ce bloc côté client** : `finkey`, `invoiceId` et les agrégats sont générés
par `Aap::addFinancerEngagement` / `payFinancerEngagement` / `recomputeFinancerPayment`. Le
front passe par `/co2/aap/coremuoperation/` ; les versements Stripe et HelloAsso, eux, sont écrits
par le serveur après vérification du paiement (`fundingEnvelope`, cf.
[Module Cagnotte](18-module-cagnotte.md#services-de-paiement)). **En lecture**, tout passe par
[`readFinancerPaymentState`](../src/modules/cagnotte/utils/financerPayment.ts) — une seule
fonction, qui gère les trois formes en base (canonique, engagement neuf `{logs:[]}`, et legacy
sans `payment`) et traduit `payed` → `paid` pour l'affichage. Aucune migration n'étant prévue,
ce repli est permanent.

**Champs RÉSERVÉS** (déclarés dans `types.ts`, **absents des données actuelles** — à confirmer
au GATE §9) : `financer.campaign`, `depense.paiements[]`, `depense.historique[]`, et les entités
net-new `Campagne`, `Panier`, `AacLog`.

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

**Les deux sections** — aucune ne porte de `formId` : toutes lisent `config.aac.formId`
(`useSite().config.aac`). Props dans [`schema.ts`](../src/modules/aac/schema.ts) :

| `type` | rôle | props |
|---|---|---|
| `aac-directory` | **l'annuaire des communs** : filtres (recherche, usages, tags, maturité, commune, tri), grille ou liste, défilement infini, bouton « Je dépose un commun » | `title`, `description`, `className`, `display` (`grid` \| `list`, mode initial), `columns` (1-4), `pageSize` (1-100), `filters{search,usage,tags,maturity,commune,sort}`, `emptyText`, `showDepositButton`, `depositButtonLabel`, `variant` (`full` \| `preview`), `moreLink{href,label}` |
| `aac-highlight` | bande d'appel à l'action avec médaillon chiffré — le nombre de communs est **compté** (mode `countonly`), jamais saisi | `title` (requis), `description`, `className`, `tone` (`primary` \| `muted`), `cta{label,href}`, `count{source:"communs",label}` |

`variant: "preview"` rend les mêmes cartes, bornées à `pageSize`, sans filtre ni compteur ni
défilement, suivies de `moreLink` : c'est l'aperçu d'une page d'accueil. Sans `moreLink`, l'aperçu
est un cul-de-sac. Un filtre activé dont la question n'a pas pu être résolue est **masqué**, jamais
rendu inerte.

(La section `aac` d'origine — aperçu de debug de la config résolue, `AacConfigStub` — a été retirée
avec `AacCommunList` : review MR 53, M25/H11/H13.)

**Chargement et erreurs** — ce que l'auteur d'un config verra pendant que ça charge, ou quand ça
échoue :

- **annuaire** : le SSR rend `AacDirectorySkeleton` (place réservée aux cartes), et son docblock dit
  vrai. Une erreur **ne remplace jamais des communs déjà chargés** : panneau bloquant seulement
  quand la liste est à 0 commun, sinon **bandeau de reprise** sous la liste (`directory.loadMoreError`
  + `directory.retry`, props `onRetry` / `isRetrying` d'`AacDirectoryResults`), la sentinelle du
  défilement infini étant retirée tant que l'erreur tient — sans quoi elle relancerait la page en
  échec en boucle ;
- **médaillon d'`aac-highlight`** (`count.source: "communs"`) : **présent dès le SSR** sous forme de
  squelette, à sa taille définitive (`w-40 md:w-48`) — la bande ne se réagence donc pas à
  l'hydratation. Il ne disparaît que sur **échec réel** du décompte, et n'est pas rendu du tout si
  `config.aac.formId` est absent (le nombre ne sera jamais connu : mieux vaut pas de médaillon
  qu'un médaillon vide).
- **le même chiffre en tuile** : `stats.props.items[].source` ou `cta-card-grid.props.stats[].source`
  = `{"type": "aacCommuns"}` — même décompte et même garde de joignabilité
  (`useAacCommunsCountState`, partagé avec le médaillon). Compté côté client : squelette en SSR ;
  AAC absent ou irrésoluble ⇒ tiret, tranché après hydratation — jamais un squelette perpétuel.
  Usage réel : accueil d'Open Atlas (`stats` en `design: "tiles"`).

⚠️ Les `.default()` Zod de ces props sont **documentaires** : la config n'est pas parsée par Zod à
l'exécution, chaque composant applique ses propres défauts.

**Les deux routes** ([`routes.tsx`](../src/modules/aac/routes.tsx), chargées en `lazy`) :

| route | page | rôle |
|---|---|---|
| `/aac` | `AacPage` | l'annuaire complet (`aac-directory` en `full`) — **sans paramètre**, un seul AAC par site |
| `/aac/commun/:answerId` | `AacCommunDetailPage` | la fiche d'un commun (une `Answer`) : héros, financement (si `coremu`, §6), paliers et actions, contributeurs, blocs de prose §3.2, galerie |

Les routes ne sont **montées que si `config.aac` existe** (`routes.tsx` rend `[]` sinon) : sur un site
sans AAC, l'URL tombe sur le catch-all du site. Une page de module rend **son propre chrome**
(`SiteHeader` / `SiteFooter`, cf. §5).

**Prérequis backend** : le form + son `aapConfig` doivent exister. Sans `config.aac.formId`,
les sections affichent un message explicite (pas de crash), et les routes ne sont pas montées.

⚠️ **Prérequis de déploiement** : le SDK lit le form et son `aapConfig` via
`POST /survey/coform/getformbyid`, qui répondait **500** (page HTML) sur un form de type
`aapConfig`. C'est un bug legacy, **corrigé** côté PHP — le correctif doit être **déployé sur le
legacy avant la mise en production du module** : sans lui, `campagne` et tout `config.*` restent
invisibles côté front (`useAacConfig` est best-effort et avale l'erreur, `resolveAacConfig` voit
`undefined`). Cf. review MR 53 §9.3 bis et §9.7.
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
      // question adresse (`tpls.forms.cplx.address`) : allume le filtre « Commune »
      "adresse":     "answers.aapStep1.aapStep1mud6k0tblptwdgxwd5a",
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
  disponible serait l'étape du RÔLE (`depenseStepKey`) — juste
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

Les 10 rôles, et ce que chacun pilote **au-delà de la carte** :

| rôle | carte | ailleurs |
|---|---|---|
| `title` | titre | `textPath` de la recherche, tri alphabétique, **et** le filtre anti-brouillons `{path:{$exists:true}}` |
| `description` | texte | — |
| `tags` | chips | `tagsPath` envoyé au serveur quand une facette tag est cochée |
| `maturity` | — | filtre « maturité » (ses OPTIONS viennent de la question) ; **aucun repli backend** : non résolu ⇒ `null` et filtre masqué |
| `image` | visuel | **c'est lui qui pilote la vignette** — cf. l'ordre de lecture ci-dessous |
| `depense` | jauge de financement | repli quand `funds` n'est pas pré-calculé, **avec le même filtre `include !== false`** que le backend (§13.3) |
| `choose` | badge « en attente » / « sélectionné » | **résolu par la config SEULEMENT, jamais deviné** : un AAC a une étape de sélection, un AAP non (le form OCECO d'Open Atlas n'a qu'un `decide`). Déclaré ⇒ badge, bouton « Ajouter à l'annuaire » et **annuaire public restreint aux sélectionnés** ; absent ⇒ ni statut, ni bouton, ni restriction : toute proposition titrée est publique. L'étape masquée au non-admin à l'édition suit l'étape d'**évaluation** (`choose` déclaré, sinon `roles.evalStepKeyFound`) : un AAP garde ses votes hors de portée de l'auteur. Seule une étape **trouvée** par scan (question `choose`/`decide`/de vote) est masquée — `roles.evalStepKey`, qui retombe sur une POSITION (2ᵉ ou 3ᵉ étape), désignerait sur un AAP sans vote une étape ordinaire de l'auteur. Un chemin sans préfixe `answers.` est refusé par `config:validate` (le runtime l'ignore). La clé de contexte est la **1ʳᵉ entrée de `form.parent`** (`firstParent`), pas l'entité du slug du site |
| `adresse` | la COMMUNE (interface `editorial` seulement) | filtre « Commune » ; **strictement opt-in** — cf. ci-dessous |
| `users` | nombre de membres | **le seul rôle qui ne parle pas du formulaire** — cf. ci-dessous |
| `keywords` | mots-clés en badges (interface `editorial` seulement) | — ; distinct de `tags` (filtre « Thème »), **strictement opt-in** : ni scan ni défaut, non renseigné ⇒ aucun mot-clé (projets.re : `answers.aapStep1.tags`) |

**`image` : la QUESTION d'abord, la vignette backend en repli.** L'ordre est
`question résolue` (override de config → scan du premier `uploader` → défaut canonique `image`)
**puis** le champ pré-calculé `image` du backend. Dans ce sens, parce que
`getPropositionThumbnail` cherche `aapStep1.image` **en dur** : dès que l'étape de dépôt n'est
pas la première, la vignette est vide alors que la réponse porte bien un visuel. Deux règles de
lecture (`firstImagePath`, `parseAacAnswer`) :

- **seuls les chemins à extension d'image comptent** — `jpg`/`jpeg`/`png`/`gif`/`webp`/`svg`/`bmp`,
  le même filtre que le legacy (`allImages`) : un `uploader` porte aussi des PDF ;
- la forme legacy `{updateDate, files}` **sans `files`** ne fournit rien : les documents ne sont
  pas dans la réponse (ils vivent dans la collection `documents`), et c'est précisément la
  vignette pré-calculée qui les connaît — d'où le repli.

**La jauge s'affiche dès qu'une demande est OUVERTE.** `hasFundingRequest` vaut
« demandé > 0 **OU** collecté > 0 », jamais « collecté > 0 » seul : une collecte qui vient
d'ouvrir (8 400 € demandés, rien de versé) est le commun à mettre en avant, et la carte affiche
donc « Collecté sur cofinancement en cours » avec **« 0 € »** plutôt que « pas de demande de
cofinancement en cours ». Le collecté entre aussi dans la condition parce que 275 lignes en base
portent un `price` booléen ou `null` (⇒ 0) : masquer ce qu'elles ont déjà collecté serait une
régression.

**`adresse` : une valeur COMPOSITE, et aucune devinette.** La question visée est presque
toujours un `tpls.forms.cplx.address`, dont la valeur stockée est
`{formLocality[], address, geo, geoPosition}` — pas une chaîne. `lib/communAddress.ts` la lit
en réutilisant `parseStoredToEntries` (`coform/utils/coformLocality`), qui absorbe déjà les
quatre formes coexistant en base, retient l'adresse marquée `center` et rend
`{locality, postalCode, streetAddress, country, localityId, label}`. Une question **texte**
est tolérée : elle devient le `label`, sans commune.

Ce rôle est le seul à n'avoir **ni scan, ni défaut canonique, ni repli backend** — pas même le
scan facile qu'il pourrait avoir (une question adresse se reconnaît à son `componentType`
`location`, comme l'uploader de `image`). La raison : il pilote le **filtre « Commune »**. Le
deviner ferait surgir ce filtre sur tout site dont le formulaire porte une adresse, alors que
personne ne l'a demandé. Non renseigné ⇒ pas d'adresse sur les communs, aucune option de
facette, donc filtre masqué. Un test le verrouille (`resolveAacCardFields.test.ts`).

⚠️ La facette groupe les communes par leur **nom**, pas par `localityId` : deux communes
homonymes de départements différents comptent pour une seule option. Et le filtre reste
**client** (créneau `$or` unique, regex non ancrées côté serveur — cf. `aacQueryParams`) :
il impose donc le balayage borné à `AAC_SCAN_SIZE`, comme `usage` et `maturity`.

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
(`titre`/`description`/`tags`/`image`/`depense` ; ni `maturity`, ni `adresse`, ni `users`, ni `keywords` n'en ont
un) → `null`. **Sauf `choose`** : `config` → `null`, rien d'autre — le deviner fabriquait
`aapStep2.choose` sur tout formulaire, et un AAP voyait chaque proposition « en attente » et son
annuaire public vide. Un site AAC **doit** donc déclarer `"choose": "answers.<étape>.choose"`.
Les oublis ne passent plus en silence : `config:validate` refuse un chemin sans `answers.` ;
`config:probe` lit le formulaire réel (`diagnoseAacChoose`) et échoue (code 1) sur un `choose` qui ne
désigne aucune question, avertit quand le formulaire porte une question `choose` que la config ne
déclare pas ; en développement, l'annuaire dit les mêmes constats dans la console. Le signal est la
QUESTION `choose`, pas `aapType` : le formulaire de la Fédération des CAE, un AAC, n'en a pas.

Le résultat porte un champ **`source`** (`"config" | "mapping" | "scan" | "default" | "none"`)
qui dit lequel a répondu : c'est par lui qu'on diagnostique une carte vide.

⚠️ Deux échecs **silencieux** à connaître :

- un chemin désignant une question ABSENTE du formulaire est quand même honoré (référence
  « nue », `options: []`) — rien ne casse, mais le filtre correspondant ne ramène rien. Rien
  ne vérifie l'existence des ids : c'est à la charge de l'auteur du config ;
- seul un chemin `answers.*` d'une autre profondeur que trois segments (`answers.q_x`,
  `answers.a.b.c`) est rejeté : `parseFieldPath` rend `null` et la chaîne continue sur
  `form.mapping`, puis le scan ;
- **toute autre forme est acceptée telle quelle comme chemin RACINE** — y compris un
  `aapStep1.q_x` (préfixe `answers.` oublié : la forme est naturelle, c'est celle qu'affiche
  `data.inputs.<étape>.inputs`). Le rôle est alors figé sur un chemin qui n'existe pas à la racine
  du document (la donnée vit sous `answers.aapStep1.…`), `source` affiche `"config"` comme pour
  un succès, la carte reste vide — et `aacQueryParams.serverPath` refusant un `stepKey` nul,
  recherche et tri repassent en balayage client. Comme la config n'est jamais parsée par Zod au
  runtime, rien ne le signale : relire le chemin.

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
      { "id": "modele",      "title": { "fr": "Modèle économique" },  "icon": "layers",
        "field": "answers.aapStep1.aapStep1lpvinn7ld70wbk7w339" },
      { "id": "gouvernance", "title": { "fr": "Mode de gouvernance" }, "icon": "users-round",
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

> Les icônes s'écrivent en **kebab-case** (`users-round`, jamais `UsersRound`) : `DynamicIcon`
> indexe son catalogue ainsi, et le préflight `aac-detail-icons` refuse toute autre forme.

**La barre d'actions de la fiche** ([`CommunActionBar`](../src/modules/aac/components/pageDetail/CommunActionBar.tsx),
arbitrage du 01/10) suit quatre règles :

- **l'état se lit, pour tous** — « En attente » / « Sélectionné » et « Phase proposition » à gauche,
  admin compris : une action ne remplace plus une pastille ;
- **un seul bouton plein**, la décision encore ouverte : « Ajouter à l'annuaire » (admin, commun non
  sélectionné), en dernier avant « ⋯ » ;
- **« ⋯ »** porte le passage en projet (« Générer le projet », « Associer un projet existant »), puis
  « Retirer de l'annuaire », puis, à l'écart et en rouge, « Supprimer le commun ». Sous `sm`,
  « Éditeurs » y passe aussi ; « Ouvrir le projet » reste un bouton, visible de tous ;
- chaque action garde **son** gate et **sa** confirmation : trois hooks
  (`useCommunSelectionAction`, `useCommunProjectActions`, `useCommunDeleteAction`) portent écriture,
  dialogue et état ; la barre ne place que les déclencheurs.

Deux pièges : les dialogues sont rendus **hors** du menu (son contenu est démonté à la fermeture), et
le menu est **non modal** — modal, il laissait `pointer-events: none` sur `<body>` à la fermeture de
la recherche de projets montée depuis une de ses entrées (page figée). Le passage en projet n'existe
que si le commun peut encore en recevoir un (`canLink`) : un dialogue ouvert disparaît si un projet
arrive entre-temps, sinon « Associer » écraserait le lien existant.

Toutes les interfaces de la fiche (§3.4 Variantes d'interface) rendent cette barre telle quelle, avec
les props du contrôleur : `<CommunActionBar {...vm.actions} />`.

### 3.3 La fiche — financement, paliers, cofinanceurs, SEO

Les blocs structurels de `/aac/commun/:answerId` ne se déclarent pas ; ce qui suit décrit ce
qu'ils font, parce que plusieurs de leurs règles sont contre-intuitives.

**L'étape est celle qui a été RÉSOLUE.** Les trois blocs de financement — la carte
(`CommunFinancingCard`), « Besoins financiers » (`CommunFinancingSection`) et la table des
cofinanceurs (`CommunCofinancersTable`) — lisent `answers.<config.roles.depenseStepKey>.depense`,
et le contrôleur des paliers (`useCommunObjectivesController`) reçoit la même `depenseStepKey`.
La règle du §4 (« jamais de `aapStepN` en dur ») est donc tenue **côté lecture** : sur un AAC dont
l'étape de dépôt n'est pas la première, les paliers s'affichent quand même.

**Hors connexion, on ouvre la modale, on ne grise pas.** « Financer ce commun » et les CTA de
réaction appellent `useAuthModal().openLogin()` et **rejouent l'intention** une fois la connexion
faite (patron décrit dans [`doc/23`](23-module-auth.md)) — pas de bouton grisé ni de `toast.error`.

**Paliers clos.** « Besoins financiers » **liste** les paliers clôturés, avec un badge « Clos »
(`detail.objectives.closedBadge` / `…Hint`) et la restauration possible ; ils sont **exclus des
totaux** de la carte et des cofinanceurs comptés. Les deux cartes de palier (« Besoins financiers »
et « Suivi des actions ») affichent leur barre de gestion dès qu'**UN** des trois droits est acquis
— édition, suppression ou restauration — et passent `canRestore = canRestoreMilestone(status)` :
un palier **clos ET financé** reste donc restaurable, alors qu'il n'est plus supprimable.

**Cofinanceurs : une seule agrégation.** `lib/cofinancers.ts` (`aggregateCofinancers`) agrège les
lignes `allFunding` des paliers **ouverts** par `id` → à défaut par `nom` → à défaut en ligne
anonyme. Le compteur de la carte est la **longueur de ce résultat** : les deux chiffres coïncident
par construction. Conséquence voulue : une entrée `financer` **sans `id`** — le doublonnage porteur
du §2 — est **listée** et comptée, là où deux agrégations séparées annonçaient « 600 € ·
2 cofinanceurs » sur la carte et une seule ligne à 500 € dans la table.

**Contributeurs et projet lié.** Le bouton « Ajouter des contributeur·rices » est **désactivé avec
sa raison affichée** (`detail.contributorsSection.addUnavailable`) tant que le projet lié n'est pas
résolu — il n'est pas seulement masqué au visiteur sans droit. L'échec de résolution de l'aperçu
« Ouvrir le projet » remonte un toast `detail.project.toasts.openError`, le bouton restant
réessayable.

**SEO.** `AacSeo` est posé sur les deux routes : `/aac` (le **nom** et la **description de l'appel**,
lus sur la même entrée de cache que le reste du module — aucune requête de plus ; repli
`page.directoryTitle`) et `/aac/commun/:answerId`. Le titre du commun vient de la référence résolue `directory.fields.title`,
à défaut du `titre` de l'étape de dépense, à défaut des champs pré-calculés du backend (`name`,
`descriptionStr`, `image` — qui ne sont pas un contrat, cf. §13.4) ; le résumé est le texte brut
borné à 160 caractères ; l'image est absolutisée ; le `canonical` est bâti sur
`VITE_SITE_PUBLIC_URL`.

**Invalidations.** Après un paiement (`onFunded`) **et** après la création d'un palier, la fiche
invalide `[aac-milestone-list-depenses, answerId]` (cf. §7) et relit la réponse : sans quoi la
carte et la modale de dépôt affichaient encore l'état d'avant.

### 3.4 Variantes d'interface — mêmes fonctionnalités, autre interface

Un site peut habiller l'annuaire et la fiche autrement **sans toucher à une seule règle métier**.
Toute la logique vit dans deux **contrôleurs** — `useAacDirectoryController`,
`useCommunDetailController` — qui rendent un **view-model** ; une interface n'en est qu'une
**vue** : ni requête, ni mutation, ni navigation. C'est la seule garantie *structurelle* de
« mêmes fonctionnalités » : une vue ne peut pas régresser une commande qu'elle n'a pas le droit
d'implémenter. RFC : [doc/36](36-rfc-variantes-interface-aac.md).

```jsonc
"aac": {
  "directory": {
    "defaultCardVariant": "editorial",   // cartes, lignes ET squelettes de toutes les sections aac-directory
    "defaultShellVariant": "editorial"   // la disposition : en-tête, filtres, compteur, bascule
  },
  "detail": { "pageVariant": "editorial" } // la fiche /aac/commun/:answerId
}
// par section : aac-directory.props.cardVariant / shellVariant, qui priment sur les défauts
```

| Clé | Registre | Résolution |
|---|---|---|
| `detail.pageVariant` | `AAC_DETAIL_VARIANTS` — `components/pageDetail/variants/registry.ts` | config → `default` (une route : aucune surcharge possible) |
| `props.cardVariant` ?? `directory.defaultCardVariant` | `AAC_DIRECTORY_CARD/ROW/SKELETON_VARIANTS` — `components/directory/variants/items.ts` | prop → config → `default` |
| `props.shellVariant` ?? `directory.defaultShellVariant` | `AAC_DIRECTORY_SHELL_VARIANTS` — `components/directory/variants/shells.ts` | prop → config → `default` |

Interfaces : **`default`** (celle d'origine) et **`editorial`** (maquette projets.re : fiche à
onglets, barre de filtres au-dessus des résultats, titres en police d'affichage — slot `serif`
de `config.theme`). La clé voyage par `useAacDirectoryContext().variants`, avec le reste de
`config.aac` ; une clé inconnue retombe sur `default`, **en silence** — d'où le préflight.

**Règles** — chacune tient à un piège rencontré :

- **Nommer par DESIGN, jamais par site** (`editorial`, pas `projetsre`) : le deuxième site qui
  voudrait l'interface hériterait d'un nom qui n'est pas le sien. Préflight `aac-variants` : toute
  clé posée existe dans son registre, aucune ne porte un slug de `sites.json`.
- **`variant` n'est PAS une interface.** Sur `aac-directory`, `variant: "full" | "preview"` choisit
  un MODE fonctionnel (annuaire complet ou vitrine) ; il se combine avec `shellVariant`. D'où
  `pageVariant` et non `detail.variant`.
- **Le `default` est embarqué** (`staticVariant`, `@/lib/variants`) : ni chunk ni frontière
  `Suspense` de plus — un site sans interface choisie rend le même HTML qu'avant (mesuré : diff SSR
  de federationDesCae vide, hors ordre des `modulepreload` et ids `useId`).
- **Une interface code-splittée se déclare dans `variants/lazyVariants.ts`, jamais dans son
  registre.** Ce module est chargé par `routes.tsx`, donc par le chunk d'entrée. Écrit dans le
  registre — qui vit dans le chunk de la page —, l'`import()` laisse Rollup présumer la page chargée
  avant la variante : il remonte leurs dépendances communes dans le chunk de la page, qui perd sa
  façade, donc sa clé de manifest, donc ses `modulepreload` SSR — pour tous les sites (mesuré :
  75 → 48 préchargements sur la fiche). Préflight `lazy-entry-facades` (build requis).
- **Ce qu'une vue ne porte pas** : les overlays sans position — dialogues des paliers, modale
  d'édition (coquille de la page), dialogue de suppression (section). Une vue ne peut pas les perdre.
- **Carte et ligne vont par paire** (la bascule grille/liste est un choix du visiteur) ; le
  **squelette** est obligatoire dès qu'une interface change les dimensions d'un commun : c'est lui
  que rend le SSR, et le repli `Suspense` tant que la carte se charge.
- **Le sommaire est opt-in** (`useCommunToc`, appelé par la vue) : une vue à onglets n'en a pas, et
  un `IntersectionObserver` y suivrait des ancres que Radix ne rend pas.
- **Les gestes de filtrage sont partagés** (`lib/directoryFilterActions.ts`) : une disposition choisit
  comment PRÉSENTER un filtre, pas ce que produit un clic — en particulier la règle des
  sous-catégories d'usage.

**Ajouter une interface** : une vue `export default` recevant `{ vm }` (et `{ id, vm }` pour une
coquille) ; sa déclaration `lazy(() => import("…"))` dans `variants/lazyVariants.ts` ; une entrée
par registre concerné. Les tests de conformité la prennent **d'office** (paramétrés sur `keys()`) :
`detail.conformance.test.tsx` — les quatre commandes reçoivent les props du contrôleur, financement
ssi `funding !== null`, paliers et contributeurs ssi phase `project` (actualités et agenda aussi,
pour une interface qui les rend), chaque bloc atteignable (ancre ou onglet), aucun contenu de
démonstration sans `demoBlocks` ; `directory.conformance.test.tsx` — lien vers la fiche, badge « en attente »,
suppression par item, et **un contrôle marqué `data-aac-filter="<nom>"` par filtre activé**.

**Contenu de démonstration** (`variants/editorial/demo/`). Ce que la maquette montre et que l'AAC
ne sait pas faire (maturation, coopérations, avis, soutiens, indicateurs d'impact, appels à
projets) est rendu avec des données **figées, identiques sur tous les communs**, chaque bloc
portant le bandeau « Exemple » et ses commandes désactivées. Quand une fonctionnalité arrive, son
bloc lit le view-model et `demoContent.ts` rétrécit — il disparaît quand il est vide. Ces blocs ne
sont rendus que si **`config.aac.detail.demoBlocks: true`** (faux par défaut, `vm.demoBlocks`) ;
coupés, les onglets Maturation et Coopérations disparaissent aussi. **À couper avant la mise en
ligne d'un site réel** : un visiteur y lirait des dons et des chiffres qui n'existent pas.

**Jalons et actions** (onglet « Passage à l'action » de l'interface `editorial`). Deux colonnes à
partir de `lg`, sur le même contrôleur et les mêmes droits que `CommunActionsSection` (interface par
défaut) : `CommunMilestonesList` (frise des paliers, gestion au survol, « Ajouter un palier ») et
`CommunActionsFeed` (toutes les actions à plat, commandes en ligne), dans
`components/pageDetail/CommunActionsLists.tsx`. Les dialogues d'action (`CommunActionDialogs`) sont
montés une fois par la page (`AacCommunDetailPage`), à côté de `CommunMilestoneDialogs`, pour toutes
les interfaces : une vue ne les monte pas. La liste ne montre chaque action qu'une fois
(`uniqueActionRows`, `lib/objectiveHelpers.ts`). Un clic sur un palier filtre la liste des actions sur
ce palier, un second clic ou « Toutes les actions » retire le filtre. L'état vit dans l'interface
(`selectedMilestoneId`/`onSelectMilestone`, `milestoneFilter`/`onClearMilestoneFilter`) ; sans ces
props, les deux listes restent sans filtre. Les actions terminées sont masquées par défaut :
l'interrupteur « Masquer les terminées (n) », état local de `CommunActionsFeed`, les réaffiche.

**Actualités et agenda** (onglet « Actus et agenda » de l'interface `editorial`). Ils sont ceux du
**projet lié** au commun, donc rendus en phase `project` seulement (`vm.objectives.news` /
`.agenda`, `{ projectId }`) :
- `CommunNewsSection` monte le fil du module news (`NewsFeed`) sur l'entité projet
  (`useCommunProjectEntityQuery`) — publication, réactions et commentaires selon les droits du
  visiteur sur le projet ;
- `CommunAgendaSection` liste les événements dont le projet est organisateur ou participant
  (`project.getEvents`, `useCommunProjectEvents`), en deux flux bornés côté serveur : à venir
  (`from` = maintenant, `asc`) et passés (`to` = maintenant, `desc`, sans récurrents), paginés par
  « Voir plus ».

---

### 3.4 Contributeurs à l'édition

Parité du bouton legacy « Add contributors » de la fiche (`campDetail.php`,
`add_form_contributor`) : l'auteur ou un admin désigne des **citoyens** qui peuvent **modifier**
le commun.

| | |
|---|---|
| Stockage | `answers.<id>.links.canEdit = { <userId>: { name, type } }` — le legacy y range parfois une vignette (`profilThumbImageUrl`), reprise à la réécriture en chemin **relatif** (la lecture SDK la rend absolue, cf. pièges) |
| Bouton | « Éditeurs », dans la barre de la fiche à côté de « Modifier » (dans « ⋯ » sous `sm`), dialogue `CommunEditorsDialog` ; gardé par `canManageEditors` (auteur ou admin) |
| Recherche | `FinderSearchModal`, citoyens, recherche globale (`notSourceKey`) — le `initType: ['citoyens']` du legacy |
| Droit donné | modifier le commun (`canEditCommun`), pas le supprimer — et, quand la question « Référent » est reliée, changer la liste par elle (ci-dessous) |
| Écriture | `useSaveCommunEditors` : `updateField("links.canEdit", …)` puis la question liée, chacune seulement si elle change ; une liste vide s'écrit `null` (`$unset`) |

**Le lien avec la question « Référent du commun »** passe par la config du finder, comme dans le
legacy : `params.finder<clé>.addToLinks = { value: true, links: "canEdit" }`. Rien n'est codé en
dur — sans ce réglage, la liste vit seule. Au 29/09, **aucun formulaire de la base** ne le portait
(il n'a été posé depuis que sur le formulaire des communs CAE de la base de développement, pour la
vérification) : le lien était inactif partout, et les deux listes divergeaient déjà. D'où deux
règles :

- la fiche présente l'**union** des deux sources, et « Enregistrer » les réaligne — le bouton reste
  actif sans modification à l'écran quand elles divergent (`editorsWrites`) ;
- l'enregistrement du formulaire synchronise **par différence**
  ([`coform/utils/addToLinks.ts`](../src/modules/coform/utils/addToLinks.ts)) : un référent ajouté
  entre dans `links.canEdit`, un référent retiré en sort, un contributeur qui n'est pas référent
  n'en sort jamais. Le calcul vit dans `useCoFormFinalMutation`, sur la réponse relue à l'instant :
  c'est le seul point que traversent **tous** les chemins d'enregistrement.

C'est un lien **supplémentaire** : le lien par type d'élément que tout finder écrit
(`links.<type>`) n'est pas touché.

**Qui peut changer la liste — parité legacy, assumée le 30/09.** Le bouton de la fiche est réservé
à l'auteur et aux admins (`canManageEditors`). Mais la question « Référent » reliée à la liste fait
partie du commun : **quiconque peut le modifier**, contributeurs à l'édition compris, change la
liste par elle — comme dans le legacy, où le finder écrit `links.canEdit` pour tout éditeur. Le
backend ne s'y oppose pas davantage : `SaveAnswerAction` remplace tout type de lien reçu d'un
éditeur. `canManageEditors` est donc une garde d'**affichage**, pas une frontière de droit ; en
faire une demanderait de masquer la question aux non-gestionnaires **et** de filtrer
`links.canEdit` côté backend.

**Dépendances backend** (non commitées au 30/09) :

- `citizenToolKit` — `Coform::canAdminAnswer` accepte `links.canEdit.<userId>`. Sans cela,
  l'enregistrement refusait ces personnes (`unauthorized_update`) alors qu'`Authorisation::canEdit`
  leur affichait déjà les boutons d'édition. Cette garde ne couvre que l'enregistrement, les fichiers
  et l'historique ; `GetAnswerFilesAction` charge désormais `links` pour l'appliquer.
- `citizenToolKit` — `SaveAnswerAction` (et la création, `Coform::saveAnswer`) : un type de lien
  reçu **vide** est retiré au lieu d'être stocké en `[]`. PHP décode l'objet `{}` du client en
  tableau vide, et un `links.canEdit` tableau fait échouer tout `$set links.canEdit.<id>` ultérieur :
  l'ajout par le finder legacy échouait sans bruit. Cas réel : vider la question « Référent » dans le
  formulaire.
- `survey` — l'écran de config du finder (`views/tpls/forms/cplx/finder.php`) expose `addToLinks`
  (une case, et le lien, limité à `canEdit`). Il n'y figurait pas, et ré-enregistrer la config de
  l'input l'effaçait.

⚠️ Pièges :

- `addToLinks` se lit dans les params du **formulaire de l'appel courant**, celui qui fait autorité
  sur la fiche, sous la clé de stockage `finder<clé d'input>` — la même que dans `answers.<étape>`.
  `answered` n'est jamais un lien alimentable : c'est le tableau des contributeurs que tient le
  backend.
- **La lecture SDK n'est pas la forme stockée.** `ApiClient._normalizeRecursively` rend absolus les
  champs image (`profilThumbImageUrl`…) partout dans le document relu. Toute écriture qui reprend
  une entrée existante passe par `withRelativeImageUrls` (`coform/utils/toRelativeImageUrl.ts`) —
  sinon l'URL absolue du backend part en base, et le legacy, qui préfixe lui-même
  (`baseUrl + profilThumbImageUrl`), affiche une image cassée (constaté le 29/09). Un test qui
  remplace `callEndpoint` court-circuite cette normalisation : lui faire passer l'état serveur par
  `client._transformData`.
- **La mutation affecte toujours `answer.data.links`**, même vide. Le brouillon d'une réponse relue
  reprend ses `links` normalisés, et `save()` les renvoyait tous : vignettes absolues, et
  `links.answered` remplacé par sa copie relue — le modifieur n'y entrait jamais. Un objet vide
  n'est pas transmis : la base garde ses liens.
- Le multi-étapes de `SmartCoForm` ne transmet pas à la mutation les `links` que calcule
  `CoFormProvider` (antérieur, hors de ce lot) : c'est pourquoi la synchronisation n'est pas
  calculée côté formulaire.
- **Annuaire** (décision du 30/09) : un non-admin y voit les communs sélectionnés, les siens, **et
  ceux dont il est contributeur à l'édition** — un commun pas encore sélectionné est justement celui
  qu'on demande à ses contributeurs de reprendre. C'est la 3ᵉ branche du `$or` de visibilité
  (`splitAacFilters`, `links.canEdit.<id>` en `$exists`) ; le décompte et les facettes suivent, par
  construction. Critère : la **liste** `links.canEdit`, celle qui donne le droit — un référent
  présent seulement dans la question (données antérieures à la synchronisation) n'y figure qu'une
  fois la liste réalignée. ⚠️ Sur un formulaire `onlyAdminCanSeeList` (§13.5), le backend réduit un
  non-admin à ses propres réponses : les contributeurs n'y voient pas les communs d'autrui.

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
| **`typeCoFinancer` à la RACINE du form** | Nature des organisations cofinanceuses : `"tiersLieux"` (le défaut legacy FTL) ou un **TAG d'organisation** (`"cae"`…, `Organization::get_cofinancer_bytags`). Clé racine du form parent, comme les gates — `financer.php:835` lit `costum.mainFormData.typeCoFinancer` puis `parentForm.typeCoFinancer`, `AnswerAction.php:268` teste `$params["parentForm"]["typeCoFinancer"]` : **ni `params`, ni l'aapConfig**. Absent ⇒ `null` ; le repli appartient à l'**affichage**, pas au résolveur. Périmètre de « J'utilise » (`useAacPlaceSourceKeys`), par priorité : `aac.detail.placeSourceKeys`, `aac.detail.placeKind`, ce `typeCoFinancer` (`"cae"` sans casse ⇒ CAE, toute autre valeur ⇒ tiers-lieux), puis tiers-lieux. |

Sortie (`AacResolvedConfig`) : `steps[]`, `roles{depenseStepKey, evalStepKey, evalStepKeyFound,
financementStepKey, suiviStepKey}`, `criteria[]`, `criteriaSource`, `gates`, `campaigns[]`,
`typeCoFinancer`. `evalStepKeyFound` = l'étape d'évaluation TROUVÉE par scan (`choose`, `decide`,
sélection, vote ou grille `tpls.forms.aap.evaluation`), `null` quand `evalStepKey` n'est qu'une
position (dispatch 4 vs 5) — seule elle est masquée à l'auteur. Le scan ÉCARTE l'étape de dépôt
(`depenseStepKey`) : une grille de critères posée à côté de la proposition la désignerait, et
l'auteur perdrait sa propre étape à l'édition.

> **Nommage — ne pas confondre :**
> - **`AacConfig`** (`schema.ts`) = le bloc **DÉCLARÉ** dans `config.aac` (juste `{ formId }`).
> - **`AacResolvedConfig`** (`types.ts`) = la config **RÉSOLUE** (sortie du résolveur).

---

## 5. Architecture du module

```
src/modules/aac/
  module.config.ts          # { name:"aac", type:"core", enabled:true } → auto-découvert
  index.ts                  # side-effects i18n + permissions/register EN PREMIER, puis exports
  routes.tsx                # /aac + /aac/commun/:answerId (pas de param de form — un seul AAC par site ; [] sans config.aac)
  schema.ts                 # AacConfigSchema (bloc site) + AacDirectorySectionSchema / AacHighlightSectionSchema (sections)
  types.ts                  # CONTRAT : Commun/Depense/Financer + Campagne/Panier/Log RÉSERVÉS
  lib/resolveAacConfig.ts   # résolveur PUR (+ .test.ts)
  lib/formParent.ts         # firstParent(form) → le CONTEXTE porteur d'un appel (+ .test.ts)
  lib/objectiveHelpers.ts   # dont resolveCommunOwnerIds : qui gère les paliers d'un commun
  lib/cofinancers.ts        # aggregateCofinancers : UNE agrégation pour la carte ET la table (§3.3)
  lib/communSeo.ts          # resolveCommunSeo : titre / résumé / image de la fiche (§3.3)
  lib/filterCommuns.ts      # filtrage + tri CLIENT du chemin balayage (usageSubKey / parseUsageSubKey)
  lib/associateExistingProject.ts # rattacher un commun à un projet DÉJÀ existant (§9 piège n°11)
  lib/communDeletion.ts     # resolveCommunDeletionPlan : ce qu'une suppression emporterait, et
                            #   quand elle est INTERDITE (dès qu'un versement existe, §6)
  hooks/useAacConfig.ts     # résolveur câblé (api.form ×2, 0 nouvel endpoint)
  hooks/useCommunFundingContext.ts # où vit un commun : l'appel où il a été DÉPOSÉ
  hooks/useCommunFundingHost.ts    # l'entité de ce contexte — celle qui détient l'enveloppe
  hooks/useCommunProjectEntity.ts  # le Project lié : droits + oceco.milestones
  hooks/useCommunRawDepenses.ts    # depense[] : ...RawDepenses pour l'affichage,
                                   #   ...RawDepensesDocument (brut) pour l'écriture
  hooks/useDeleteCommun.ts  # cascade EXPLICITE commun → actions → projet : le backend n'en fait
                            #   AUCUNE (`Element::deleteSimple` laisse les actions orphelines)
  hooks/useAacPermissions.ts
  hooks/useCommunDetailController.ts # TOUTE la logique de la fiche → view-model (§3.4)
  hooks/useAacDirectoryController.ts # idem pour l'annuaire
  hooks/useCommunToc.ts     # sommaire à ancres + section active — OPT-IN, appelé par la vue
  lib/communDetailContent.tsx    # iconFor / proseOf / extractGalleryImages (purs)
  lib/directoryFilterActions.ts  # gestes de filtrage, partagés par toutes les dispositions
  lib/communPath.ts         # LE chemin de la fiche d'un commun
  components/pageDetail/variants/  # registry.ts (AAC_DETAIL_VARIANTS), CommunDetailDefault, conformité
  components/directory/variants/   # items.ts (cartes/lignes/squelettes), shells.ts, coquille par défaut, conformité
  variants/lazyVariants.ts  # les interfaces CODE-SPLITTÉES — chargé par routes.tsx (chunk d'entrée, §3.4)
  variants/editorial/       # interface « editorial » (maquette projets.re) ; demo/ = contenu de démonstration
  permissions/              # types, defaults, calculators/aac.ts, register, index
  constants/queryKeys.ts    # AAC_QUERY_KEYS
  sections/AacDirectorySection.tsx, AacHighlightSection.tsx  # sections (export default, `import "../i18n"` en 1re ligne)
  pages/AacPage.tsx, AacCommunDetailPage.tsx  # pages des routes (la fiche n'est qu'une COQUILLE :
                                              #   gardes, chrome, SEO, overlays — §3.4)
  i18n.ts + i18n/{fr,en}.json
```

**Enregistrements hors module** (à connaître si vous ajoutez une section) :
`src/types/site-schema.ts` (union + `config.aac`), `src/components/sections/SectionRenderer.tsx`
(`LazySections`, `lazy` de **vite-preload**, cible en **export default**),
`src/lib/queryKeys.ts` (barrel), `src/components/admin/section-meta.ts`,
`.claude/skills/config-assistant/SKILL.md` (table Modules — **testée**, y compris le CONTENU de la
ligne : `skill-integrity.test.ts` vérifie que les **sections** citées en colonne « surface » sont
enregistrées dans `SectionRenderer` et que les **routes** citées sont bien déclarées par un
`src/modules/*/routes.tsx`, pas seulement que le nom du module figure dans la table).
Rien à enregistrer en revanche dans `scripts/audit-config.ts` : ses `KNOWN_ROUTE_PREFIXES` sont
**dérivés** du code par `moduleRoutePrefixes()` (lecture des `path:` de premier niveau des
`routes.tsx`), précisément pour qu'une nouvelle route de module ne produise pas de faux
`lien-mort`.

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
  `limitTypes`) n'est pas porté aujourd'hui — et ⚠️ `financerLimitRoles` / `limitTypes` ne sont
  **pas contrôlés à l'écriture** par le backend (retour legacy du 9/09, review MR 53 §9.7) : ce
  niveau, quand il sera porté, est un **niveau d'affichage seulement**, pas une sécurité.
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
- **Contributeurs à l'édition** (`links.canEdit`, §3.4) : `canEditCommun` les accepte, connectés.
  Le bouton de gestion (`canManageEditors`) est réservé à l'auteur et aux admins — ni
  `anyOnewithLinkCanAnswer` ni la liste n'y ouvrent —, mais ce n'est **pas** une frontière de
  droit : la question « Référent » reliée à la liste reste modifiable par tout éditeur (parité
  legacy).
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

⚠️ **Des règles voisines mais DISTINCTES**, à ne pas réunifier :

| Action | Qui | Où |
|---|---|---|
| Sélectionner / valider un commun | admin de l'appel | `aac` (`canSelectCommun`) |
| **Générer / Associer un projet** | admin de l'appel **ou** déposant | `project.canManage` de `CommunActionBar` (entrées de « ⋯ ») |
| **Ajouter / éditer palier et action** | admin du **projet lié** **ou** déposant | `cagnotte` + `ownerIds` |
| **Supprimer DÉFINITIVEMENT un commun** | auteur **ou** admin | `aac` (`canDeleteCommun`) |
| **Gérer les contributeurs à l'édition** | bouton : auteur **ou** admin ; par la question « Référent » reliée : tout éditeur (parité legacy) | `aac` (`canManageEditors`) |

Porter l'appel autorise à instruire et à **promouvoir** un commun, pas à écrire dans le plan de
financement d'autrui. L'admin de l'appel retrouve les paliers dès qu'il administre le projet lié —
ce qui est le cas courant quand c'est lui qui l'a généré.

**`canDeleteCommun` est une FONCTION**, seule du namespace : le droit dépend du commun visé,
puisqu'il s'ouvre à son auteur. Volontairement distinct de `canEditCommun`, qui porte
`anyOnewithLinkCanAnswer` — « avoir le lien suffit pour répondre » ouvre l'édition à tout
**connecté**, et un geste irréversible n'hérite pas d'un gate pensé pour la saisie. Le backend ne
l'hérite pas non plus : les branches d'`Answer::canEdit` (`survey/models/Answer.php:143`) sont admin
d'interface, auteur, admin `parentSlug`, admin `context`, `Form::canAdmin`, hook costum.

Deux garde-fous s'ajoutent au droit, côté front :

- **L'argent bloque.** `resolveCommunDeletionPlan` ([`lib/communDeletion.ts`](../src/modules/aac/lib/communDeletion.ts))
  refuse la suppression dès qu'un versement existe — compté sur `items[].allFunding`, **jamais** sur
  `resourceFinancedAmount`, qui ne somme que les paliers OUVERTS : un commun financé puis clôturé
  afficherait 0 € et redeviendrait supprimable. Le retrait de l'annuaire
  (« Retirer de l'annuaire », `useCommunSelectionAction`) reste la voie non destructive.
- **La cascade est EXPLICITE et sur demande** : le backend n'en fait aucune (`Element::deleteSimple`
  retire le document, ses commentaires et ses fichiers, mais ni les actions d'un projet ni les liens
  croisés). `useDeleteCommun` supprime le commun d'abord — seul échec qui fait échouer le geste —
  puis, si l'utilisateur l'a demandé, les actions **avant** le projet, en best-effort compté.
  Au succès, il retire du cache le document supprimé (tous lecteurs) et le projet supprimé, appelle
  `onDeleted`, puis invalide listes et enveloppes.

Depuis l'annuaire, le plan vient de `useCommunDeletionPlan` : document réponse, hôte de son contexte
(`useCommunFundingHost`), enveloppe, repli sur le document. Au repos, ni le commun ni son enveloppe ne
sont lus ; le dialogue reste en attente tant que le plan n'est pas résolu.

⚠️ Gate d'**affichage** uniquement, comme les autres : le backend reste la source de vérité
(`Authorisation::canDeleteElement`).

## 7. Query keys

`AAC_QUERY_KEYS` ([`constants/queryKeys.ts`](../src/modules/aac/constants/queryKeys.ts)) suit la
convention du repo, **plus une spécificité AAC** :

- **`campaignId`** entre dans les clés des données scopées campagne (**isolation stricte**).
- **`userId` en DERNIER segment** sur les données user-scopées (mes votes/éval/financements/« vu »),
  et **absent** des données publiques (config, listing) pour préserver la mutualisation du cache.
  ⚠️ Depuis la bascule sur `directoryproposal`, `COMMUNS` / `COUNT` / `FACETS` **sont** user-scopées :
  un visiteur non administrateur ne reçoit que les communs sélectionnés, les siens et ceux dont il
  est contributeur à l'édition (§3.4, §13.5).

**Le balayage de l'annuaire est MÉMORISÉ.** Le chemin « filtre client » (`usage`, `usageSub`,
`maturity`, `commune`, et `q`/`tags` tant que la question n'est pas résolue — cf. §3.1) balaie jusqu'à
`AAC_SCAN_SIZE = 300` documents. Ce balayage vit désormais dans le cache sous sa propre clé :

```ts
AAC_QUERY_KEYS.COMMUNS_SCAN(formId, campaignId, serverParams, userId)
// ["aac-communs", formId, campaignId, "scan", serverParams, userId]
```

- **une seule requête `directoryproposal`** (`indexStep: 300`) par requête serveur et par fenêtre de
  fraîcheur (60 s, la MÊME que celle du listing — un balayage plus frais serait refait pour rien,
  un balayage plus vieux servirait des documents périmés à un listing qu'on vient de refetcher) ;
- **partagée par toutes les pages** du défilement infini (la page n'entre pas dans la requête) **et
  par tous les états de filtres client** qui envoient les mêmes paramètres serveur : cocher une
  catégorie d'usage ne refait pas le balayage ;
- placée **sous le préfixe `aac-communs`** à dessein : toute invalidation du listing l'emporte, sans
  qu'un écrivain ait une clé de plus à connaître. `serverParams` est un objet — React Query le hache
  à clés triées, deux requêtes identiques donnent la même entrée ;
- **produite sans observateur**, par `queryClient.fetchQuery` depuis `useAacCommuns`. Le contrat
  `AacCommunsQuery` porte pour cela un champ **optionnel** `memoizeScan` : omis, le transport
  retrouve son comportement d'avant (`useAacFacets` ne le passe pas).

> ⚠️ **`COMMUN_PROJECT` a DEUX écrivains.** Le producteur est `useCommunProjectEntity`, mais le flux
> « Ajouter / éditer une action » (`useCommunObjectivesController`) **écrit** dans cette entrée
> l'entité `Project` qu'il résout à l'ouverture de la modale. Sans cette écriture, la modale
> s'ouvrirait sur le `null` que le hook a mis en cache après un échec (2 min) et la mutation
> lèverait `projectMissing` une fois la saisie faite. Le commentaire de `queryKeys.ts` ne cite
> aujourd'hui que le producteur.

**Invalider après un dépôt ou une sélection** : `AacDepositButton` comme `useCommunSelectionAction`
invalident les **TROIS** préfixes `COMMUNS_PREFIX()` / `COUNT_PREFIX()` / `FACETS_PREFIX()`. Les trois,
parce qu'ils sont volontairement disjoints : le décompte ignore les filtres de l'annuaire (il doit
survivre à leur changement sans refetch) et les facettes se calculent sur le jeu NON filtré (sinon
cocher une option ferait disparaître les autres). Un dépôt qui n'invaliderait que le listing laisserait
un médaillon périmé (M10).

**Hors module** : la clé du cache brut `depense[]` d'une réponse
(`[aac-milestone-list-depenses, answerId, step]`) vit **côté cagnotte** —
`CAGNOTTE_QUERY_KEYS.COMMUN_RAW_DEPENSES(answerId, step)` / `COMMUN_RAW_DEPENSES_PREFIX(answerId)`,
ré-exportée par `useCommunRawDepenses` — parce que c'est cagnotte qui l'invalide : `aac` dépend de
`cagnotte`, jamais l'inverse. La « première dépendance cagnotte → aac » qu'on redoutait n'existe
donc pas.

---

## 8. Ce qu'on RÉUTILISE (ne rien réécrire)

| Besoin | Réutiliser | Où |
|---|---|---|
| Rendu + persistance d'un commun | `SmartCoForm` → `answer.save()` / `processUploads()` | `modules/coform` |
| Financement (`depense[].financer[]`) | `useFundingEnvelope`, `useSaveCagnotteContribution`, types `Funding*` (dont `FundingMilestone` qui porte déjà `answerDepenseIndex`/`projectMilestoneIndex`) | `modules/cagnotte` |
| Dashboards | `dashboard.ts` + `dimensions.ts` (**array-aware**, lit `answers.<form>.serverData.answers.<section>.<field>`) | `modules/observatoire` |
| Listing / filtres / cartes | `useSearchQuery` (`searchType:['answers']`), `CardAnswer`, `parseCoformAnswer`, `FiltersSection` | `modules/search` |
| Évaluation | `useMultiEvalData` + `MultiEvalRadarTabs`/`Dialog` (radar **prêt**), `EvaluationField`/`EvaluationVoteCell` | `modules/coform` |
| Parsing de données non typées | `utils/dataTransform.ts` (`asRecord`, `toArrayOrValues`, `getServerData`, `toSafeInt`, `normalizeActionStatus`, `resolveActionAuthorId`…) | `modules/cagnotte` |
| Réparation des dépenses orphelines | `useOrphanDepenseRepair({ resource, repairs, enabled })` — l'écriture ; `useCagnotteAdapter` ne rend plus que les `pendingMilestoneRepairs` | `modules/cagnotte` |

⚠️ **`useAacFundingResource` ne charge les projets de l'organisation qu'en cagnotte « standard ».**
`useOrganizationProjectsWithAnswers` (`searchCostum` borné à 10 000 projets **plus** un `api.answer`
par projet retourné) n'est lu par l'adaptateur que dans la branche `selectorType: "project"`. Sur un
site AAC (`cagnotteModuleConfig.defaultType: "aac"` ⇒ `proposition`), les ressources viennent de
l'enveloppe seule : ces requêtes **ne partent plus du tout**, ni à l'ouverture de la fiche ni à celle
de la modale de dépôt (`MilestoneListField`). Toute séquence réseau documentée ailleurs qui les
mentionne pour ces deux surfaces est périmée.

---

## 9. ⚠️ Pièges à connaître AVANT de coder

1. **`unknown` = perte de donnée SILENCIEUSE.** Un type d'input AAP non mappé rend une boîte rouge
   **et droppe sa valeur au save**. **Ne déposez pas de vrai commun via un form non mappé.**
   Types encore non mappés : `suiviFromBudget`, `generateprojectbtn`.
   *(Déjà mappés — `mapCoFormTypeToComponentType`, `coform/utils/formParser.ts` : `finder`,
   `checkboxNew`, `radioNew`, `categorizedCheckbox` (`CategorizedCheckboxField`),
   `evaluation.evaluation`, `titleSeparator` (`TitleSeparatorField`, plus d'alias vers
   `sectionTitle`), `tags` (`TagsField`), `ocecoform.newDepenseList` → `milestoneList`
   (`MilestoneListField`), `aap.selection` (`SelectionField`), `aap.chooseProposal`
   (`ChooseProposalField`). `multiDecide` n'est pas un type : c'est une indirection résolue par
   `resolveMultiDecide` vers le type désigné par `inputConfig.multiDecide` — sans config, l'input
   ne se rend pas du tout.)*
2. **Pollution `{}` ↔ `[]` (MongoDB).** Un champ **array** (`depense[]`) **DOIT** déclarer
   `getFieldShape = 'array'` **+ un default**, sinon un `[]` legacy arrive en `{}` et casse le
   resolver Zod au submit. Types aujourd'hui coercés en tableau par `getFieldShape`
   (`coform/utils/formParser.ts`) : `checkbox`, `multiCheckboxPlus`, `simpleTable`, `tags`,
   `timeSlots`, `dynamicFields` et **`milestoneList`** — pour ce dernier, un `depense = {}`
   refusé par le `z.array` rendait l'étape **insoumettable** alors que le champ s'affichait vide
   et correct.
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
   sélectionné (`answers.aapStep2.choose.<contextId>`, où `<contextId>` est la **1ʳᵉ entrée de
   `form.parent`** — `firstParent` —, ni le costum courant ni l'entité du slug du site : c'est la
   clé qu'emploie le backend AAP et celle sur laquelle l'annuaire filtre). Sa **fiche** est rendue avec le formulaire
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

   L'hôte ne suffit pas : il peut porter plusieurs appels (Open Atlas en a trois), et
   `getFormData` lit par défaut le premier, le plus récent. Les lecteurs de la fiche passent donc
   `form: { id: useCommunFundingContext().formId, answerId }` à `useFundingEnvelope`
   (`openContext.envelopeForm` pour `CagnotteDialog`) ; le champ coform `MilestoneListField` passe
   le formulaire qu'il rend (`formId`). L'enveloppe ne lit alors que la réponse du commun, et une
   réponse illisible ailleurs dans le formulaire ne la fait plus échouer. Le contrôleur des paliers
   n'interroge l'enveloppe qu'une fois l'id de la réponse connu : sans lui, `getFormData` lirait tout
   le formulaire.
10. **Les `.default()` des schémas de section ne jouent PAS à l'exécution** (la config n'est jamais
   parsée par Zod au runtime — cf. `doc/05`, encadré d'en-tête). Un sous-objet de la config arrive
   donc **tel quel**, et un défaut de destructuration (`filters = {…}`) ne joue que s'il est
   **absent** : `"filters": { "search": false }` sur `aac-directory` éteignait les quatre autres
   filtres. Fusionner **clé par clé** (`resolveDirectoryFilters`, `lib/directoryFilters.ts`), dont le
   défaut est tenu aligné sur le schéma par un test — et faire de même pour tout nouveau sous-objet
   à défauts.
11. **Associer un projet EXISTANT : deux gardes, deux pièges d'API.**
    `assertProjectAssociable` (`lib/associateExistingProject.ts`) vérifie deux sources indépendantes
    qu'un projet n'est pas déjà celui d'un autre commun — la back-ref `project.serverData.answer`,
    puis la collection `answers` (`coformAnswersSearch`, scopé au costum). Deux détails **non
    négociables** :
    - la projection de cette recherche **doit** porter `collection` **et** `id` : sans `collection`,
      `_linkEntities` du SDK **jette silencieusement** chaque ligne et la page revient vide — le
      contrôle ne bloque alors plus jamais rien ;
    - la réparation d'une dépense sans palier appelle `answer.generateMilestoneFromDepense(<clé>)`
      avec la **CLÉ du sous-document** (`"3"`), pas une position densifiée : `depense` arrive parfois
      en objet à clés creuses (`{"0":…, "3":…}`), et densifier réparerait `"1"`, qui n'existe pas.

    Les échecs métier sont typés : `AacProjectLinkError` porte une **clé i18n** du namespace
    `modules/aac` (le message technique reste en anglais, pour les logs) et
    `ProjectAlreadyLinkedError` l'étend en ajoutant l'answer en conflit et la source de la détection.
    La **traduction se fait dans le hook** `useAssociateExistingAacProject`, jamais dans la lib —
    clés `detail.project.toasts.alreadyLinked` / `.projectWithoutId` / `.incompleteContext`.
12. **Les filtres d'usage se lisent par clé QUALIFIÉE.** Un identifiant de sous-catégorie
    (`2_site-vitrine`) n'est unique que **dans** sa catégorie : le filtre `usageSub` emploie donc des
    clés `<catégorie>/<sous-catégorie>` (`usageSubKey` / `parseUsageSubKey`, `lib/filterCommuns.ts`),
    lues dans `usage.bySub` — jamais dans `usage.subs`, l'aplat qui confond les homonymes, que le
    filtre ne consulte plus du tout. Une clé **nue** reste tolérée (l'état historique) et se lit sous
    les catégories retenues, toutes si aucune ne l'est : l'union qui en résulte est la limite de
    cette forme, pas un choix.
13. **Le projet d'un commun se lit sur `answer.project.id`, jamais sur `project.answer`.** C'est le
    lien qu'écrivent Oceco, `generateproject` et l'association, et celui que lit le legacy (qui
    retrouve la réponse d'un projet en interrogeant `answers` sur `project.id`). Le renvoi
    `project.answer` n'est posé par `generateproject` que depuis septembre 2026 : il manque sur les
    liens anciens. Les deux lectures doivent donc RECEVOIR `project` :
    - **fiche** : `findanswered` (`api.answer`) le projette par défaut (`FindAnsweredByIdAction`).
      Sans lui, le repli `buildResourceFromAnswer` est aveugle, et un commun absent de l'enveloppe
      (visiteur anonyme, ou enveloppe lue sur un autre formulaire de l'hôte) n'a plus de projet ;
    - **annuaire** : chaque ligne porte `project`, et le bloc `projects` (§13.3) donne nom et slug.
      `parseAacAnswer` en fait `card.project`, affiché par `AacCommunProjectLink` : « Projet : nom »
      vers `/profil/<slug>`, ou « En projet » sans lien quand le projet n'est pas résolu.

---

## 10. 🚧 GATE — à confirmer sur données réelles

Plusieurs mappings du résolveur sont **best-effort** et marqués `⚠️ GATE` dans le code. **À valider
avant de construire le financement** (base `pixelhumain1` ; AAC de référence : form FTL
`6438366673d20a0de1533c77`, 87 communs réels) :

- la **clé de référence CAMPAGNE portée par l'answer** — **introuvable dans le code** ; sans elle
  **tout le scope financement est indéfini** (bloquant) ;
- ~~la forme réelle de `depense[].financer[]` sur un **answer déjà financé**~~ — **TRANCHÉ** :
  c'est le format canonique décrit au §2 (`line`, `status`, `finkey`, `payment{…}`), celui
  qu'écrivent `Aap::addFinancerEngagement` et `payFinancerEngagement`. Reste ouvert sur cette
  ligne : le rattachement d'une `campaign` et le porteur (doublonnage) ;
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

**Interfaces (§3.4)** : `detail.conformance.test.tsx` et `directory.conformance.test.tsx`
(paramétrés sur les registres) ; `useCommunDetailController.test.tsx` grave l'ORDRE des cinq gardes ;
préflights `aac-variants` (clés posées ⇔ registres, jamais un slug) et `lazy-entry-facades`
(chaque module `lazy` garde sa façade dans le manifest — **build requis** : relancer
`npm run test:preflight` après `npm run build`). Non-régression d'un site existant : diff du HTML
SSR avant/après, normalisé (état React Query déshydraté, hashes, ids `useId`, ordre des préchargements).

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

**Mode normal** — `results`, `count` optionnel, et onze blocs latéraux batch-résolus :

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
| `projects` | map | projets liés aux réponses (par `project.id`) — `name`, `slug`, `profilThumbImageUrl` ; un projet supprimé en est absent |
| `inputs` | map | `forms.inputs` des formulaires concernés — `step`, `inputs` |
| `allNotSeenComments` | map `contextId → int` | nombre de commentaires non vus |

**Champs ajoutés par `parsePropositionData` sur chaque entrée de `results`** :

| Champ | Source | Note |
|---|---|---|
| `name` | `answers.aapStep1.titre` | `"(No title)"` si absent |
| `descriptionStr` | `answers.aapStep1.description` | |
| `tags` | `answers.aapStep1.tags` | ré-indexé (`array_values`) |
| `image` | vignette résolue (`getPropositionThumbnail`) | |
| `funds` | `answers.aapStep1.depense[]` | **agrégat de financement** : `{ price: int, financer: number[] }` — les dépenses `include === false` sont **exclues**, et `financer` est réduit aux seuls **montants**. Le repli client (`parseAacAnswer` sur `answers.<étape résolue>.depense[]`, quand `funds` est vide) applique **le même filtre** : sans lui, un palier clôturé restait compté dans la demande dès que le backend n'avait rien pré-calculé (projection étroite, étape de dépôt ≠ `aapStep1`), et les deux chemins n'affichaient pas le même montant |
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
