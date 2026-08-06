[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet RéseauSanté — Rézo Santé Réunion

> **Document de travail du projet de configuration.** Il consigne l'état réel de la config au jour
> de sa création, et surtout **ce que le produit ne sait pas faire** parmi ce qui a été demandé.
> **À tenir à jour à chaque lot livré**, selon le formalisme du skill
> [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Search](../doc/07-module-search.md) ·
> [Module Profil](../doc/08-module-profil.md) · [Module Agenda](../doc/29-module-agenda.md) ·
> [Module Admin](../doc/30-module-admin.md) · [Module formEngine](../doc/28-module-formengine.md).
> Mémoire : `[[project-rezo-sante-reunion]]`.

Dernière mise à jour : **2026-08-03** (lot 3 §9 — feuille CSS propre, Fraunces, essai carrousel ; synchronisation SDK 1.0.172 + `VITE_SITE_PUBLIC_URL`).

---

## 1. Contexte du projet

**RéseauSanté** (« Rézo Santé », domaine visé `rezoSanté.re`) est un réseau réunionnais de **santé
globale** : il rassemble citoyens, associations et professionnels autour de la nutrition, de
l'activité physique, du sommeil, des addictions et du bien-être mental.

Le besoin exprimé tient en quatre briques : un **annuaire** d'acteurs, la possibilité de **créer des
fiches** et d'en **importer** en masse, une vitrine des **projets** portés par le réseau, et des
**ressources** (outils, projets) mises à disposition par les organisations.

### Portage — le fait nouveau (échange Thomas / Tibor, 29/07)

Le projet **avait manqué d'un porteur ; il en a un désormais**. C'est ce qui débloque le chantier de
données.

| Acteur | Rôle |
|---|---|
| **PSR — Promotion Santé Réunion** | **porteur**. Dispose d'un peu de financement. Maintiendra et **animera** l'annuaire de tous les praticiens de La Réunion. Valorisera les projets et ressources des acteurs, **en commençant par les siens**. |
| **PSM — Promotion Santé Mayotte** | **cible de réplication**. PSR accompagne son déploiement ; cet annuaire **préfigure l'outillage** de PSM. |
| Partenaires pressentis pour une plateforme méta | **CPTS**, **Maisons Sport Santé**, **Thésis**, **ARS** |
| Interlocuteurs à consulter | @Pierre, @duvardfrancois, @SebastienPSR |

Deux conséquences de conception, à ne pas perdre de vue :

1. **La réplicabilité est une exigence, pas un bonus.** Ce qui est fait ici sera rejoué pour Mayotte.
   Cela plaide pour tout garder pilotable par la config (CSS partagé, thème dans `config.theme`,
   zéro composant sur mesure) — ce qui est le cas aujourd'hui.
2. **La cible est une plateforme méta multi-sources** (CPTS, MSS, Thésis, ARS), pas un annuaire
   mono-costum. `baseParams.sourceKey` accepte un **tableau** de clés : l'archétype de ce motif est
   `navigatorDesTierslieux` (portail réseau multi-sources), et l'exemple canonique
   `config:example -- agenda-multi-sources` en montre la forme. La config actuelle est mono-source ;
   le passage au multi-source est une extension, pas une reprise.

### Identité

| | |
|---|---|
| Slug de site | `rezoSanteReunion` |
| Entité Cocolight | `rezoSanteReunion` — collection `organizations`, type `NGO`, « Rézo Santé Réunion » |
| Costum backend | **CRÉÉ le 30/07** — config minimale posée sur l'org porteuse (motif *costum-in-org*) : `costum = { slug: "costumize", language: "fr" }`. `slug` désigne le **moteur**, pas le site : le slug de site reste `rezoSanteReunion`, celui de l'org, déjà présent dans la collection `slugs`. Cf. §6bis |
| Config | [`../config.prod.rezo-sante-reunion.json`](../config.prod.rezo-sante-reunion.json) |
| CSS | [`../src/index-rezo-sante-reunion.css`](../src/index-rezo-sante-reunion.css) — **feuille propre** depuis le 30/07 (commit `82669e97`, fin de l'héritage d'`index-parent62.css`) ; couleurs et typographie vivent dans `config.theme` |
| Langues | `fr` (défaut) + `en` |
| Header / Footer | `transparent-scroll` / `contact-partners` |
| Archétype de départ | `parent62` (portail complet) |
| Backend de référence | `https://www.communecter.org` (le backend local `:5080` était éteint) |
| SDK | `@communecter/cocolight-api-client` **1.0.172 publiée** (`package.json` `^1.0.172`, commit `09e145a0` du 03/08 — fini le `npm pack` local) |
| Branche | `main` |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| 2026-07-29 | Claude | Lot 1 — scan de faisabilité, thème, 14 pages, blocs modules, portes qualité. Création de ce dossier. |
| 2026-07-29 | Claude | Lot 1b — migration du périmètre vers le paramètre natif `sourceKey` + `costumSlug` (9 `baseParams`), suite à l'enquête §5.5-5.7. |
| 2026-07-29 | Claude | Lot 1c — onglet « Validation » (section `moderation`), suite à l'annonce de formulaires costum. |
| 2026-07-29 | Claude | Lot 1d — intégration des 5 visuels fournis, passage des 5 pages thématiques en `hero-tinted-overlay`, réharmonisation de `chart1..5`. |
| 2026-07-30 | Claude | Lot 2 — **création du costum backend** : config minimale sur l'org porteuse. `getcostumjson` passe de HTTP 500 à 200 côté legacy, et la réponse est byte-identique au backend Node. Le périmètre reste vide (§6bis). |
| 2026-07-30 | Claude | Lot 3 — identité propre : feuille de style dédiée `index-rezo-sante-reunion.css` (fin de l'héritage parent62, `82669e97`), **Fraunces** en titres à la place du Baloo 2 hérité (`306380c8`), et `hero-carousel` en tête de `/thematiques` — **placement d'ESSAI** (`f0e0893f`). Mergé dans `main` le **02/08** via `36430caa`. |
| 2026-08-03 | Claude | Synchronisation transverse : merge `fix/institut-bleu-ui` (`94251b7b`) → SDK **1.0.172 publiée**, `VITE_SITE_PUBLIC_URL` (§8). Gates rejoués : typecheck ✅, préflight **412/412 (22 fichiers)** ✅. Mise à jour de ce dossier. |

---

## 2. Objectifs de la configuration

1. Un **annuaire** des acteurs de santé de La Réunion, filtrable et cartographiable.
2. Une page **projets** du réseau.
3. Une page **ressources** mêlant outils et projets dans une même grille.
4. Cinq **pages thématiques** (nutrition · activité physique · sommeil · addictions · bien-être
   mental) plus un hub.
5. Un **agenda** des rendez-vous du réseau.
6. La **création de fiches** depuis le site et l'**import en masse** par le back-office.
7. *(demandé, non livrable en config — cf. §5.2)* des **actions d'engagement** sur les projets et un
   **partenariat inter-organisations**.

---

## 3. Architecture générale

```
Communecter (backend)                    SiteForge (ce dépôt)
─────────────────────                    ────────────────────
entité  rezoSanteReunion  ──── slug ───▶ sites.json → config.prod.rezo-sante-reunion.json
  └─ costum  ✔ posé (30/07, §6bis)          ├─ theme  « Lumière du matin » (light + dark)
                                            ├─ header transparent-scroll · footer contact-partners
données scopées par                         ├─ 14 pages / 41 sections / 16 types (03/08)
  source.key      ┐                         ├─ profiles (6 types)
  source.keys     ├─ sourceKey[] ───────▶   ├─ commandPalette (⌘K)
  reference.costum┘   (union native)        └─ admin (9 onglets : validation, import/export, référencement…)
  + porte native applyValidationGate (2 flags, $exists:false)
```

**Une seule voie de filtrage** : le périmètre par **costum**, via le **paramètre natif**
`sourceKey: ["rezoSanteReunion"]` posé sur les 9 `baseParams`, accompagné de
`costumSlug: "rezoSanteReunion"` qui arme la porte de validation côté client.

Ce choix se justifie sur trois plans (mesures en §5.5 à §5.7) :

1. **Modération** — le périmètre par tag imposerait `notSourceKey: true`, qui **coupe**
   `applyValidationGate` ([`buildSearchPayload.ts:102`](../src/modules/search/lib/buildSearchPayload.ts)).
2. **Extensibilité** — `sourceKey` est un **tableau** et le backend en fait l'**union exacte
   dédupliquée** : la plateforme méta (CPTS, MSS, Thésis, ARS) se fera en **ajoutant des clés**, sans
   réécriture.
3. **Couverture** — `sourceKey` matche `source.key` ∪ `source.keys` ∪ `reference.costum`, donc il
   capte **le référencement** : seule voie pour afficher des fiches qu'on ne possède pas.

---

## 4. Cahier des charges (intégré)

### 4.1 Ce qui est livré en configuration

| Domaine | Exigence | État |
|---|---|---|
| Annuaire | acteurs filtrables, carte | ✅ `/annuaire` — `searchProStatic`, presenter `profile` |
| Projets | liste des projets du réseau | ✅ `/projets` |
| Ressources | outils **et** projets dans une grille | ✅ `/ressources` — presenter `resource` + `list.itemRules` |
| Thématiques | 5 axes + hub | ✅ 6 pages, filtrées par tags |
| Agenda | rendez-vous du réseau | ✅ `/agenda` |
| Création de fiches | depuis le site | 🟡 **prévue** — formulaires costum liés à `rezoSanteReunion` annoncés par le client (29/07). Non activée tant que les `costumForms` ne sont pas écrits : un `modal` sans document rend `null` en silence. File de validation en place (onglet « Validation »). |
| Import de masse | CSV → entités | ✅ onglet `import-export` du back-office |
| Validation des dépôts | file de modération | ✅ onglet « Validation » — section `moderation` (lot 1c) |
| Éditorial | à propos, socle légal | ✅ `/a-propos`, `/mentions-legales`, `/confidentialite` |

### 4.2 Ce qui a été demandé et **n'existe pas dans le produit**

Cinq boutons d'action sur les projets — **like · partenaire · on soutien · intéressé · réutilise** —
et le **partenariat inter-organisations**. Aucun n'est activable par configuration. Constat établi
par lecture du code, pas par supposition :

| Demande | Réalité vérifiée | Preuve |
|---|---|---|
| `like` | n'existe pas sur une entité ; le seul `like` est une réaction de **fil d'actu**, verrouillée par le SDK sur `collection: "comments" \| "news"` | `AddVoteData.collection` (SDK) |
| `partenaire` | aucune action ; seul un **affichage en lecture seule** « Organisations partenaires » existe, qui montre en réalité les orgas dont on est **membre** | `useRelatedEntities.tsx:49-126` |
| `on soutien` | deux homonymes trompeurs : la réaction news `support`, et le bouton « Soutenir le projet » du module **cagnotte** (tunnel de paiement) | — |
| `intéressé` | équivalent fonctionnel = `follow` (« Suivre »), renommable en i18n | `ENTITY_ACTION_CONFIG` |
| `réutilise` | **aucune occurrence** dans le dépôt | — |
| projets « likés » par une orga | impossible : `BaseEntity.follow()` code en dur `childType: "citoyens"` — c'est toujours un **citoyen** qui suit, jamais une organisation | SDK |
| partenariat orga↔orga | ni modèle, ni verbe, ni écran ; l'invitation de membres est verrouillée `searchMode: "personOnly"` | `useSearchUsers.ts:26` |

Le registre d'actions est une **constante TypeScript fermée**
([`../src/modules/profil/actions/config/entity-actions.ts`](../src/modules/profil/actions/config/entity-actions.ts)) :
la configuration ne peut qu'allumer ou éteindre le bloc entier (`showEntityActions`).

### 4.3 Chiffrage du développement (décision client du 29/07 : « chiffrer »)

Trois couches, dans cet ordre — **aucune ne peut être sautée**.

| # | Couche | Travail | Risque |
|---|---|---|---|
| 1 | **Backend Communecter** | créer un stockage pour des **liens typés** entre une entité et une autre. Le mécanisme générique existant (`CONNECT`, `connectType ∈ {admin, member, contributor, attendee, friend, connect}`) est **déjà porteur d'une autre sémantique** : le réutiliser polluerait les écrans existants. Il faut donc un nouveau type de lien, et l'émetteur doit pouvoir être une **organisation**, pas seulement un citoyen. | **Élevé** — c'est le vrai point dur : le modèle actuel ne sait pas exprimer « une orga aime un projet » |
| 2 | **SDK** (`cocolight-api-client`) | une mutation par verbe + la lecture des compteurs. `LinkMeta.linkType` n'a que 4 valeurs aujourd'hui ; `_buildLinkFilters` restreint à `memberOf \| projects \| events`. | Moyen — dépend entièrement de la forme retenue en 1 |
| 3 | **Front SiteForge** | étendre `EntityAction["type"]` et `ENTITY_ACTION_CONFIG`, un hook de mutation par verbe, l'état on/off du bouton, le compteur, **et l'exposition en config JSON** (sinon chaque site rejouera le problème) | Faible une fois 1 et 2 posés |

**Prérequis de cadrage avant de chiffrer en jours** — trois questions à trancher avec le client :

1. Qui émet l'action : le **citoyen connecté** ou l'**organisation** qu'il représente ? (le second
   cas est ce qui coûte cher)
2. Les cinq verbes sont-ils cinq liens distincts, ou **un lien à valeur** (`type: "like" | "partenaire" | …`) ?
3. Le partenariat est-il **symétrique** (demande → acceptation, comme une amitié) ou une simple
   déclaration unilatérale ? Une acceptation bilatérale ajoute un état, des notifications et un écran.

**Contournement sans développement**, si le client veut capter l'intention tout de suite : un CoForm
par intention (« je soutiens », « je réutilise ») ouvert depuis la fiche. Chaque clic devient une
réponse de formulaire. Limites assumées : pas de bouton d'état on/off, pas de compteur natif, pas de
liste « qui a soutenu » sans écran dédié, et une modale là où l'utilisateur attend un clic.

---

## 4bis. Questions de Thomas — réponses établies

| Question | Réponse |
|---|---|
| « L'annuaire, c'est des orgas ? » | **Oui**, `defaultTypes: ["organizations"]` sur `/annuaire`. Les projets ont leur page (`defaultTypes: ["projects"]`), les ressources mêlent `poi` + `projects`. |
| « Les champs du dynform des fiches ? » | **Aucun champ spécifique pour l'instant** (position de Tibor). Piste unique évoquée : une **liste des sujets pratiqués**. Le formulaire costum n'est donc **pas écrit**, et le bouton de création **pas activé** (un `modal` sans `costumForms` rend `null` en silence — cf. §11). |
| « C'est lié à un source key ? » | **Oui — et c'est le bon choix.** Le périmètre runtime est le costum (`source.key` / `source.keys` / `reference.costum`), avec la garde de modération. |
| « Ou c'est un annuaire méta ? » | **À terme oui** (CPTS, MSS, Thésis, ARS) — via `sourceKey` en tableau. Pas aujourd'hui : aucun partenariat n'est signé. |
| « Si lié à un tag seulement c'est pas fou » | **Confirmé par la mesure.** Le tag seul est un mauvais périmètre runtime : il impose `notSourceKey` sans garde `toBeValidated` (publication immédiate, sans modération) et rend le référencement admin inopérant. |

**La synthèse qui réconcilie Thomas et Tibor** — les deux positions ne s'opposent pas, elles
décrivent **deux moments** :

> le tag `#santé` est la **source d'amorçage** (ce qu'on importe / référence),
> le costum est le **périmètre de service** (ce qu'on interroge à l'exécution).

Le chemin est donc : reprendre les **1 088 fiches** taguées `#santé` → les trier et nettoyer avec PSR
→ les **référencer** sous `reference.costum: "rezoSanteReunion"` → le site les sert par le costum,
avec modération. Aucune ligne de la config actuelle n'est à jeter pour cela.

---

## 5. Modèle de données réel

Sondé le **29/07** sur `https://www.communecter.org`.

| Fait | Valeur |
|---|---|
| Entité | `rezoSanteReunion` — `organizations`, type `NGO`, « Rézo Santé Réunion » |
| Costum | **`null`** |
| Liens | `members(2)` — rien d'autre |
| Tags portés par l'entité | `Santé` · `Ecran` · `Addiction` · `Alimentation` · `Activité physique` · `Competences psycho social` · `Sommeil` · `sédentarité` · `Santé Sexuelle` |
| Périmètres sondés | **9 · tous VIDES** (`config:probe`) |

**Conséquence directe** : le site rend parfaitement (14/14 pages, 40/40 sections au sondage — 41
depuis le 30/07) mais **toutes ses pages de recherche seront désertes en production** tant qu'aucune
fiche n'est rattachée au costum (créé depuis, le 30/07 — §6bis). Ce n'est pas un défaut de
configuration : c'est l'état de la donnée.

**Piège évité** — le vocabulaire de thématiques donné à l'oral ne correspond pas aux tags réels :

| Page | Tag demandé | Tag réel de l'entité | Filtre finalement écrit |
|---|---|---|---|
| `/theme/nutrition` | Nutrition | **Alimentation** | `["Alimentation","Nutrition","alimentation","nutrition"]` |
| `/theme/addictions` | Addictions | **Addiction** (singulier) | `["Addiction","Addictions","addiction","addictions"]` |
| `/theme/bien-etre-mental` | Bien-être mental | **Competences psycho social** | `["Competences psycho social","Santé mentale","Bien-être mental","bien-etre-mental"]` |
| `/theme/activite-physique` | Activité physique | ✔ + `sédentarité` | `["Activité physique","sédentarité","activite-physique","Activite physique"]` |
| `/theme/sommeil` | Sommeil | ✔ | `["Sommeil","sommeil"]` |

Sans ce réalignement, **trois pages sur cinq seraient restées vides en silence**, même une fois les
données présentes. Les filtres acceptent volontairement plusieurs graphies.

**Trois tags de l'entité ne sont couverts par aucune page** : `Ecran`, `Santé Sexuelle`, `Santé`
(générique). À arbitrer — cf. §11.

### 5.1 Volumétrie du gisement `#santé` — et la file RÉELLEMENT actionnable

⚠ **Correction du 29/07** : le chiffre de « 1 088 » annoncé en séance n'est **pas reproductible** tel
quel — il agrégeait trois collections avec une correspondance de tag *large*. Le nombre qui compte
n'est pas le gisement brut, c'est **ce que l'écran de référencement accepte de proposer** : il filtre
sur `preferences.isOpenData: true` (cf. §5.5).

| Collection | tag `santé` (brut) | **référençable** (`isOpenData: true`) |
|---|---|---|
| `organizations` | 952 | **711** |
| `projects` | 47 | **23** |
| `poi` | 89 | **0** |
| **Total** | 1 088 | **734** |

**La file de travail de PSR est donc de ~734 fiches**, et **89 POI santé sont hors d'atteinte** de cet
écran (sur toute la plateforme, seuls 3 POI portent `isOpenData: true`). Les reprendre exigerait une
autre voie que le référencement.

Autres mesures : le filtre de tag est **insensible à la casse** (`santé` = `Santé` = 1 088) ; les
costums `PromotionSanteLaReunion` / `promotionSanteLaReunion` renvoient **0** — PSR n'a pas de costum
non plus.

### 5.2 ⚠ Les tags thématiques ne peuvent PAS porter les pages thématiques

Mesure par tag, sur `organizations` + `projects` + `poi` :

| Tag | Résultats | Verdict |
|---|---|---|
| `Alimentation` | **1 348** | **plus que tout le corpus `#santé`** → tag générique de la plateforme (agriculture, alimentation durable…), pas un tag santé |
| `Sommeil` | 13 | trop peu |
| `Addiction` | 6 | trop peu |
| `Ecran` · `Santé Sexuelle` · `sédentarité` | 2 chacun | anecdotique |
| `Activité physique` | **1** | inexploitable |
| `Competences psycho social` | **1** | inexploitable |

**Conclusion** : les 9 tags de l'entité sont **l'auto-description de l'organisation**, pas une
classification du corpus. Une page « Activité physique » filtrée sur ce tag afficherait **1 fiche** ;
une page « Nutrition » filtrée sur `Alimentation` afficherait **1 348 fiches en majorité hors sujet**.

C'est précisément le « **peut-être une liste des sujets pratiqués** » évoqué par Tibor qui doit
combler ce trou : la classification thématique **n'existe pas encore** et doit être produite pendant
le travail de tri/nettoyage avec PSR. Les 5 pages thématiques sont donc **en attente de vocabulaire**
(cf. §11).

### 5.3 Sémantique des filtres de tags — piège vérifié

| Forme écrite | Comportement mesuré |
|---|---|
| `"tags": ["A"]` | correspondance **large** |
| `"tags": ["A","B"]` | **OU** (union), pas ET — mesuré : `["Alimentation","Sommeil"]` = 1 348 = `["Alimentation"]` seul |
| `"tags": {"$in": [...]}` | **plus strict** — `$in ["santé","Santé"]` = **683** contre 1 088 pour `["santé"]` |

`$in` n'est donc **pas** un simple « accepte plusieurs graphies » : il **restreint**. Les filtres
thématiques de la config utilisent aujourd'hui `$in` ; ils devront être revus en même temps que le
vocabulaire (§11).

### 5.5 `source.key` · `source.keys` · `reference.costum` · `sourceKey` — le fonctionnement établi

Question posée par Thomas, tranchée par mesure sur `www.communecter.org` le 29/07. **Trois champs de
document et un paramètre de requête**, qu'il ne faut pas confondre :

| Nom | Nature | Contenu |
|---|---|---|
| `source.key` | champ, **chaîne** | le costum **d'origine** (création / import) |
| `source.keys` | champ, **tableau** | tous les costums de **rattachement** |
| `reference.costum` | champ, **tableau** | les costums qui ont **référencé** la fiche sans en être la source |
| `sourceKey` | **paramètre** de requête (SDK + backend), **tableau** | ce qu'on interroge |

**Le multi-source natif existe et fonctionne**, sans développement :

- `sourceKey` est typé `string[]` de bout en bout (config → `buildSearchPayload` → SDK → backend) et
  sérialisé `sourceKey[]=a&sourceKey[]=b`.
- Le backend renvoie **l'union exacte et dédupliquée** : `[institutBleu, sportSanteBienetre]` = 320
  = 74 + 246 ; six clés = 10 549 = somme exacte. Une clé répétée ne double rien ; un slug inexistant
  renvoie 0 (pas de repli silencieux).
- `sourceKey` matche **les trois champs à la fois** — c'est donc le **seul** mécanisme qui capte le
  référencement, donc les structures qu'on affiche sans les posséder.
- Le modèle l'autorise nativement : **4 519** organisations ont ≥2 entrées dans `source.keys`,
  **4 280** en ont ≥2 dans `reference.costum`.

**Deux pièges mesurés** : `notSourceKey: true` **annule** `sourceKey` (bascule sur les 29 000+
organisations du réseau) — les deux ne cohabitent jamais ; et le `$or` doit être un **objet**, la
forme tableau canonique de MongoDB renvoie un **HTTP 500**.

### 5.6 Le référencement (`reference.costum`) — de bout en bout

**Geste** : `/admin` → section builtin `reference` → sous-onglet « Rechercher & référencer »
(recherche sur **tout** Communecter, hors costum) → bouton « Référencer » sur une ligne.
**Appel** : `carrier.addReference(type, id)` → `setSource({action:"add", set:"reference"}, …)` →
`POST /co2/admin/setsource/action/add/set/reference` (bearer).
**Écriture** : le slug du costum est poussé dans `reference.costum` du document distant — **et rien
d'autre**. `source.key` et `source.keys` restent au propriétaire d'origine.
**Effet** : la fiche entre dans le périmètre de toutes les sections de recherche du site.

Preuves sur données réelles : `openAtlas` → `reference.costum: ["transiter","institutBleu"]` sans
aucun bloc `source` ; `LA SOLID'EURE` → source `franceTierslieux`, référencée par 3 costums tiers.

**Quatre limites à connaître avant de planifier la reprise :**

1. **Une fiche à la fois.** Aucune action de masse dans l'écran de référencement.
2. **Le garde-fou `preferences.isOpenData: true`** exclut d'office les fiches non ouvertes — d'où les
   **0 POI référençables** (§5.1).
3. **Le backend ne déduplique pas** : re-référencer ajoute un doublon. Cas réel observé :
   `laRaffinerie3` porte 30 entrées, dont la paire `["franceTierslieux","tiersLieux"]` répétée 8 fois.
   L'UI compense en masquant le bouton, mais un appel direct dupliquerait.
4. **Référencer = publier immédiatement.** `addReference` ne porte aucun champ de validation.

### 5.7 Modération — verdict

**Reprendre des fiches d'autrui n'est pas modéré *a posteriori*, et ne peut pas l'être par ce
mécanisme.** Mais ce n'est pas un défaut : la modération est **a priori, par le geste** — aucune
fiche n'entre sans le clic d'un administrateur dans la file de référencement. C'est exactement ce
dont PSR a besoin pour trier.

Le flag `toBeValidated` sert **l'autre** cas : les fiches créées par des tiers **via le site**.

⚠ **Correction du 29/07 (précision du client)** : ce cas **existera**. Des formulaires costum liés au
costum `rezoSanteReunion` sont prévus. Trois conséquences, qui rendent la correction du lot 1b
d'autant plus nécessaire :

1. **La modération par flag devient la voie principale**, à côté du référencement. Deux flux
   distincts cohabiteront : *référencer* une fiche existante (publication immédiate, tri a priori
   par le geste) et *créer* une fiche via le site (dépôt en attente, tri a posteriori par le flag).
2. **La porte de validation doit être armée** — c'est fait : `sourceKey` + `costumSlug`, sans
   `notSourceKey`. Sans cela, les fiches en attente seraient **publiées immédiatement** sur le site.
3. **Il faut une file de validation**, sinon les fiches déposées sont invisibles ET invalidables.
   Ajoutée au lot 1c : onglet « Validation » → section builtin `moderation`.

⚠ Ne PAS configurer le bloc `status` d'une resource admin : le schéma prévient que ses sous-champs
**ne sont pas encore câblés** (`src/modules/admin/schema.ts:28-42`, « Ne PAS écrire de valeur
non-défaut d'ici là », décision du 2026-07-07). La section `moderation` seule suffit.

**Défaut corrigé le 29/07 dans cette config.** La porte de validation native
(`applyValidationGate`, [`buildSearchPayload.ts:95-109`](../src/modules/search/lib/buildSearchPayload.ts))
pose **deux** filtres — `preferences.toBeValidated.<slug>` **et** `source.toBeValidated.<slug>`, tous
deux en `$exists: false`. Elle sort prématurément dans deux cas : `notSourceKey` vrai (ligne 102) ou
`costumSlug` absent (ligne 101). La config livrée en première intention cumulait les deux défauts et
réimplémentait la garde à la main sur **un seul** champ avec `$ne: true` — un opérateur **plus
permissif**, démontré inopérant sur une fiche réelle (`vegetalitec`, en attente chez `cressReunion`,
passait le filtre). Correction appliquée : `notSourceKey` et le `$or` manuel supprimés,
`sourceKey: ["rezoSanteReunion"]` + `costumSlug: "rezoSanteReunion"` posés sur les **9** `baseParams`.
La garde native s'applique donc désormais, et le passage au multi-source se fera en ajoutant des clés
au tableau.

### 5.8 Qualité de données — cible de nettoyage déjà identifiée

**PSR existe en double** : `PromotionSanteLaReunion` (« PROMOTION SANTÉ RÉUNION ») et
`promotionSanteLaReunion` (« PROMOTION SANTE LA REUNION ») — deux entités ne différant que par la
casse et les accents. Illustration concrète du « trier, nettoyer les données » de Tibor, et premier
doublon à traiter puisqu'il concerne le porteur lui-même.

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config | [`../config.prod.rezo-sante-reunion.json`](../config.prod.rezo-sante-reunion.json) |
| Déclaration du site | [`../sites.json`](../sites.json) — `{slug, config, css, images}` (vérifié 03/08 ; **ni `domain` ni `coolifyApp`** : la cible de déploiement n'est pas déclarée, cf. §8) |
| Thème | `config.theme` (couleurs + typographie : `sans` Hanken Grotesk, `serif` **Fraunces**, `mono` Spline Sans Mono) + [`../src/index-rezo-sante-reunion.css`](../src/index-rezo-sante-reunion.css) (feuille propre depuis le 30/07) |
| Assets | **5 visuels** dans `public/images/rezoSanteReunion/` (fournis le 29/07, générés via Lovable) ; clé `images` déclarée dans `sites.json` |

---

## 6bis. Le costum backend — ce qui a été posé, et ce qui manque encore

**Posé le 30/07** sur l'org porteuse `Rézo Santé Réunion` (`6a4ccc3b9da32f33e85e4c43`, slug
`rezoSanteReunion`) :

```js
costum: { slug: "costumize", language: "fr" }
```

Trois choses à comprendre sur ces deux clés :

- **`slug` désigne le MOTEUR, pas le site.** C'est le motif *costum-in-org* : `costumize` est le
  moteur générique partagé, et le slug du SITE est celui de l'org porteuse. Même structure que
  `institutBleu`, `sportSanteBienetre` et `equipementsSportifs974`, qui portent tous
  `costum.slug = "costumize"`. C'est bien `rezoSanteReunion` que la config envoie en `costumSlug` et
  en `sourceKey`, et son entrée dans la collection `slugs` existait déjà.
- **`language`** est défaussé à `"fr"` par les deux backends s'il manque ; l'écrire évite de dépendre
  de ce défaut.
- **Volontairement absents** : `host` — le domaine `rezoSanté.re` est *visé*, pas en service, et
  l'inscrire activerait la résolution par hôte du legacy sur un domaine qui ne répond pas — ainsi que
  `app` et `htmlConstruct`, qui relèvent de la construction d'UI legacy dont site-json n'a pas besoin
  (il fait tout par config).

**Ce que ça débloque.** Avant, `POST /co2/cms/getcostumjson?slug=rezoSanteReunion` rendait une
**HTTP 500** sur le legacy : `GetCostumJsonAction.php:21` fait `$costum = $costum["costum"]` sans
garde, et l'index manquant lève un E_NOTICE que Yii convertit en exception. Le backend Node, lui,
tolérait et rendait `{language, id}` — c'est la sémantique de PROD (en `error_reporting(0)` PHP
auto-vivifie). Après, **les deux rendent 200 et la réponse est byte-identique** :
`{"result":true,"msg":"Success","data":{"slug":"costumize","language":"fr","id":"6a4ccc3b…"}}`.

**Ce que ça ne débloque PAS — et c'est le vrai reste à faire.** Le périmètre est toujours **vide** :
`sourceKey[]=rezoSanteReunion` renvoie **0 résultat** sur les deux serveurs, parce qu'aucune fiche ne
porte encore ce slug dans `source.key`, `source.keys` ou `reference.costum`. Créer le costum le rend
*résolvable* ; le peupler est un travail de donnée distinct — référencement à l'unité (§5.6, avec ses
quatre limites) ou import.

---

## 7. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| Archétype `parent62` | seul du parc à tenir **annuaire + ressources + projets** ensemble, et ses 8 pages `/theme/*` sont un gabarit directement transposable |
| Périmètre par **costum**, pas par tag `#santé` | le tag impose `notSourceKey` sans garde → publication immédiate sans modération, et référencement admin inopérant. Le costum est de toute façon requis par l'import |
| CSS **propre** `index-rezo-sante-reunion` (30/07 — revient sur le partage initial d'`index-parent62`) | la feuille parent62 embarquait ~60 lignes d'identité locale (10 couleurs de territoire `#territoire-*`, `.p62-*`) dont **aucun sélecteur ne pouvait correspondre ici** (vérifié : 0 occurrence dans la config). La nouvelle feuille (165 lignes à sa création, 168 depuis les commentaires Fraunces de `306380c8`) ne garde que le générique : mapping `@theme inline`, réglages document, mini-prose légale, scrollbar, `--gradient-section`. Rien ne change à l'écran — tokens et polices viennent de `config.theme`. Le partage reste légitime **à design identique** (communes, sites sport) ; ce n'en était pas un cas (`82669e97`) |
| Titres **Fraunces** (serif douce à taille optique), à la place du Baloo 2 hérité (30/07) | Baloo 2 venait de `config:init --from parent62`, pas d'un choix : le rond-jovial travaille contre les pages addictions / santé mentale et l'audience institutionnelle (ARS, CPTS, Thésis). Corps inchangé (Hanken Grotesk), mono conservée (Spline Sans Mono) ; repli passé de `sans-serif` à `serif`. Vérifié : Fraunces porte réellement les 4 graisses `400;500;600;700` que `buildGoogleFontURL` demande toujours — sinon le navigateur synthétise de faux gras (`306380c8`) |
| Thème « Lumière du matin » (vert feuille `oklch(0.52 0.13 145)` + or `oklch(0.78 0.13 80)`) | le parc est saturé de bleus (7 configs) ; les visuels de référence du client sont en lumière dorée et verts naturels ; le corail glissait vers le registre « urgence », inadapté à la prévention |
| 5 thématiques en `chart1..5` | une thématique = une teinte, réutilisée par les graphiques et l'observatoire si un jour il est activé |
| Header `transparent-scroll` **sans** `piggyBank` ni `urgenceButton` | standard de fait du parc (10/14) ; les deux autres champs auraient été du décor (pas de cagnotte, pas d'urgence) |
| `sportSanteBienetre` **écarté** malgré son nom | marqué `wip`, et 8 de ses 9 `baseParams` sont vides — le seul renseigné emprunte le `sourceKey` d'un autre site |
| Pas de section `articleFeed` | le module blog n'est pas activé sur ce site |

---

### 7.1 Direction visuelle — « Lumière du matin »

Direction arrêtée à partir d'une **maquette Lovable fournie par le client** (29/07), reprise en
**inspiration** et non en copie (consigne explicite : « n'applique pas tout »).

**Repris** : le registre chaud et lumineux (lumière dorée, verts naturels, ocre), la feuille comme
icône de marque (`logoIcon: "leaf"`), le mode clair, et le rythme de home — héro → vision →
écosystème des thématiques → passage à l'action → communauté → appel final.

**Écarté** : le compteur d'argent `piggyBank` (« 125 400 € ») et le bouton « Actions urgentes »
(`urgenceButton`) — aucune cagnotte sur ce site, ces champs auraient été du décor ; les chiffres-clés
inventés de la maquette (« 18K+ membres », « 450+ associations ») — **on n'affiche pas de statistique
fabriquée** ; et les pages de remplissage (Ambassadeurs, Presse, Recrutement, Charte…).

**Correction de palette apportée par la maquette** : dans ma première version, `chart1` (nutrition)
était un vert `130` — quasiment le `145` du `primary`. La thématique se serait fondue dans la couleur
de marque. La maquette traite la nutrition en **chaud** (pomme orangée) et réserve le vert à la
marque. Palette finale, cinq teintes franchement distinctes, aucune ne heurtant le primary :

| Thématique | token | teinte |
|---|---|---|
| Nutrition | `chart1` | ambre-orangé `65` |
| Activité physique | `chart2` | corail `25` |
| Sommeil | `chart3` | indigo `265` |
| Addictions | `chart4` | prune `320` |
| Bien-être mental | `chart5` | turquoise `195` |

**Visuels câblés** (lot 1d) : `mission-healthcare` en héro d'accueil (cercle intergénérationnel — la
plus « réseau » des cinq), et les quatre `hero-*` sur leurs pages thématiques, qui passent de `title`
à `hero-tinted-overlay`.

⚠ **`/theme/addictions` reste en `title`** — 4 pages sur 5 ont donc le héro. Faute d'image, un
`hero-tinted-overlay` y afficherait un bloc de 100 vh quasi vide : le composant ne rend NI l'image NI
le voile sans `backgroundImage` (`HeroTintedOverlay.tsx:26`), il retombe seulement sur l'encre du
thème. À unifier le jour où la thématique aura son visuel.

**Essai en cours (30/07, `f0e0893f`) — carrousel des héros.** Un `hero-carousel` de 4 diapositives,
**dérivées** des héros existants des pages `/theme/*` (titre, sous-titre, image, alt repris tels
quels + CTA vers la page), a été branché **en tête de `/thematiques`** (`sections[0]`,
`autoplay: false`). **C'est un placement d'ESSAI, pas une décision actée** — le message de commit le
dit. Le carrousel en home, comme sur la maquette Lovable, reste à arbitrer : il coûterait 4 sections,
4 ancres et 4 URL partageables ; `/theme/addictions` sans image donnerait une diapositive trouée ; et
la photo de home est en 16:9 quand les thématiques sont en 3:2 — le candidat LCP basculerait. Se
retire en enlevant un bloc. Cf. §13.

---

## 8. Étapes de mise en place

1. ☑ ~~**Créer le costum `rezoSanteReunion`** côté Communecter~~ — **fait le 30/07** (lot 2 :
   config minimale *costum-in-org* posée sur l'org porteuse, §6bis). Le costum **résout** ; il reste à le **peupler**.
2. ☐ **Amorcer depuis `#santé`** : extraire les **1 088** fiches taguées, les trier/nettoyer avec PSR
   (à commencer par le doublon PSR lui-même, §5.8), puis les **référencer** sous
   `reference.costum: "rezoSanteReunion"`.
3. ☐ **Arrêter le vocabulaire des « sujets pratiqués »** avec PSR, et le renseigner pendant le
   nettoyage — sans quoi les 5 pages thématiques restent inexploitables (§5.2).
4. ☐ Rejouer `npm run config:probe -- config.prod.rezo-sante-reunion.json` → viser 9/9 périmètres non vides.
5. ☑ ~~Déposer les visuels~~ — fait le 29/07 (5 fichiers, clé `images` restaurée). ☐ Reste : une image pour `/theme/addictions`, une pour la section communauté, et le **remplacement des visuels IA par de vraies photos**.
6. ☐ Compléter les marqueurs « à compléter » du socle légal (§11).
7. ☐ **Trancher l'essai `hero-carousel`** (§7.1) : le garder en tête de `/thematiques`, le porter en
   home, ou le retirer (un bloc à enlever).
8. ☐ Prévisualiser : `VITE_SLUG=rezoSanteReunion npm run dev`.
9. ☐ Build / déploiement (DNS `rezoSanté.re`). **Variables d'env à connaître depuis le 03/08**
   (merge `fix/institut-bleu-ui`) :
   - **`VITE_SITE_PUBLIC_URL`** — URL publique du site-json **lui-même** (canonical, `og:url`/`og:image`,
     `sitemap.xml`, flux RSS) ; lue par `getSitePublicUrl()`
     ([`../src/lib/constant/common.ts`](../src/lib/constant/common.ts)) et
     [`../server/lib/sitemap.js`](../server/lib/sitemap.js) ; dérivée par `deploy:env` depuis
     `sites.json` (`aliases[0]` prioritaire, sinon `domain`). ⚠ L'entrée `rezoSanteReunion` de
     `sites.json` ne déclare **ni `domain` ni `coolifyApp`** (vérifié 03/08) → repli `getServerUrl()`
     (comportement historique) tant que la cible de déploiement n'est pas déclarée.
   - **`VITE_SERVER_URL`** — à ne PAS confondre : c'est le serveur **communecter** (images `/upload`,
     embed co2, cagnotte), qui garde sa valeur parc.

---

## 9. Impacts des modifications

**Lot 1 — 29/07 — création de la config.** Aucun impact sur les autres sites : le CSS
`index-parent62` est **lu**, jamais modifié (les couleurs vivent dans `config.theme`).

**Lot 1b — 29/07 — correction du périmètre (suite à l'enquête §5.5-5.7).** Défaut introduit à la
composition initiale, corrigé le jour même :

| Avant | Après |
|---|---|
| `notSourceKey: true` sur 8 `baseParams` | **supprimé** (il coupait `applyValidationGate`) |
| `defaultFilters.$or` scalaire à 3 clés, écrit à la main | **supprimé** (redondant, mono-costum, non extensible) |
| `"preferences.toBeValidated.…": {"$ne": true}` | **supprimé** — opérateur inopérant, démontré sur `vegetalitec` |
| — | `sourceKey: ["rezoSanteReunion"]` sur **9** `baseParams` |
| — | `costumSlug: "rezoSanteReunion"` sur **9** `baseParams` (arme la porte native à 2 flags) |

Régressions à revalider : aucune constatée — validate ✅, audit **0 constat**, préflight **328/328**,
rendu **40/40**. Le périmètre reste vide (costum absent), donc le comportement de la porte de
validation **n'a pas pu être observé sur des données réelles** : à revérifier après le premier
référencement.

**Lot 1c — 29/07 — file de validation.** Le client précise que **des formulaires costum liés à
`rezoSanteReunion` sont prévus**. Conséquence immédiate : sans file de validation, une fiche déposée
via un formulaire serait masquée par la porte (armée au lot 1b) **et** impossible à valider. Ajout
d'un onglet « Validation » portant la section builtin `moderation` (placée avant `import-export`,
dans l'ordre du flux de travail). Le bloc `status` n'est **pas** configuré (sous-champs non câblés,
cf. §5.7). Gates : validate ✅, audit **0 constat**, préflight **328/328**, rendu **40/40**.

> **Quirk local à connaître** : lancer `npm run config:render` recrée `public/images/rezoSanteReunion/`
> (effet de bord du serveur SSR), ce qui fait échouer le préflight `site-assets` tant que le dossier
> n'est ni déclaré ni supprimé. Sans conséquence : **git ne suit pas les dossiers vides**, donc rien
> n'atteint un commit ni la CI. Un `rmdir` suffit, et le problème disparaîtra dès que de vrais
> visuels seront déposés et la clé `images` restaurée dans `sites.json`.
> **Résolu depuis** : visuels déposés et clé `images` restaurée le 29/07 (lot 1d).

**Lot 3 — 30/07 — identité propre + essai carrousel.** Trois commits, mergés dans `main` le 02/08
via `36430caa` (branche `feat/rezo-sante-et-correctifs-heros`). Aucun impact sur les autres sites — le
premier commit **retire** même le couplage à parent62 :

| Commit | Changement | Gates au commit |
|---|---|---|
| `82669e97` | **Feuille de style propre** `src/index-rezo-sante-reunion.css` (165 lignes) + repointage de `sites.json`. Fin de l'héritage d'`index-parent62.css` et de ses ~60 lignes d'identité parent62 sans sélecteur correspondant ici (§7). Rien ne change à l'écran. | préflight 331 · audit RAS · rendu 14 pages / 40 sections |
| `306380c8` | **Fraunces** en `serif` de `theme.typography`, à la place du Baloo 2 hérité ; repli `sans-serif` → `serif` ; corps (Hanken Grotesk) et mono (Spline Sans Mono) inchangés (§7). | audit RAS · préflight 331 · rendu 14 pages / 40 sections |
| `f0e0893f` | **`hero-carousel` en tête de `/thematiques`** — 4 diapositives dérivées des héros `/theme/*`, `autoplay: false`. **PLACEMENT D'ESSAI, à confirmer** — pas une décision de design actée (§7.1, §13). Les 4 pages thématiques restent en place (ancres et URL intactes). | audit RAS · rendu 14 pages / **41/41 sections** · preload LCP émis sur `/thematiques` pour la seule diapositive 0, `imagesrcset` identique au rendu |

**État au 03/08 — synchronisation transverse (merge `fix/institut-bleu-ui`, `94251b7b`).** Rien de
spécifique à ce site dans les 17 commits mergés, mais deux faits l'atteignent :

- **SDK 1.0.172 publiée** (commit `09e145a0` du 03/08) — fini le `npm pack` local. Règle notamment la
  pose du scope costum côté admin (`setCostumScope`,
  [`../src/modules/admin/lib/ensureCostumScope.ts`](../src/modules/admin/lib/ensureCostumScope.ts)) —
  concerne directement les 9 onglets du back-office de ce site.
- **`VITE_SITE_PUBLIC_URL`** au déploiement (§8) — sans effet tant que `sites.json` ne déclare pas de
  `domain` pour ce site (repli `getServerUrl()`).

Gates rejoués le 03/08 après merge : typecheck ✅ · préflight **412/412 (22 fichiers)** ✅ ·
`config:validate` ✅ 14 pages · 41 sections.

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 14 pages · **41 sections** (rejoué le 03/08) |
| `audit:config` | ✅ RAS (dernière mesure : 30/07, commit `f0e0893f`) |
| `test:preflight` | ✅ **412/412 (22 fichiers)** (rejoué le 03/08, après merge `fix/institut-bleu-ui`) |
| `config:render` | ✅ 14/14 pages · **41/41 sections** avec contenu SSR (30/07, commit `f0e0893f`) |
| `config:probe` | ⛔ **0/9 périmètres** — le costum RÉSOUT désormais (lot 2), mais le périmètre est vide : aucune fiche ne porte encore `source.key`/`source.keys`/`reference.costum` = `rezoSanteReunion` (§6bis) |

---

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Thème & identité | ✅ | light + dark en parité (40 tokens), 5 thématiques en `chart1..5` ; depuis le 30/07 : feuille propre `index-rezo-sante-reunion.css` + titres **Fraunces** (lot 3) |
| 2 | Chrome (header/footer) | 🟡 | nav regroupée en 4 entrées ; **coordonnées de contact « à compléter »**, aucun logo partenaire |
| 3 | Home | ✅ | 6 sections |
| 4 | Thématiques (hub + 5) | ❌ | rendent, mais **le vocabulaire de classification n'existe pas** : les tags mesurés donnent 1 à 13 fiches, ou 1 348 hors sujet (§5.2). En attente des « sujets pratiqués ». Hub : `hero-carousel` en tête depuis le 30/07 — **essai à confirmer** (§7.1) |
| 5 | Annuaire | 🟡 | rend ; périmètre vide |
| 6 | Projets | 🟡 | rend ; périmètre vide |
| 7 | Ressources | 🟡 | rend ; **convention de sous-type à arrêter** (§11) |
| 8 | Agenda | 🟡 | rend ; périmètre vide |
| 9 | À propos | ✅ | 6 sections, alternance des registres |
| 10 | Socle légal | 🟡 | 2 pages ; marqueurs « à compléter » à renseigner |
| 11 | Back-office + import | 🟡 | **9 onglets** (mesuré 03/08 : dashboard, membres, annuaire, projets, agenda, ressources, validation, import-export, référencement) ; le costum résout depuis le 30/07, le périmètre reste à peupler |
| 12 | Création de fiches | 🟡 | **prévue** : formulaires costum annoncés. Porte de validation armée et file « Validation » posée — il reste à écrire les `costumForms` et le `floatingActionButton` |
| 13 | Actions d'engagement | ❌ | **hors config** — chiffrage §4.3 |
| 14 | Partenariat inter-orga | ❌ | **hors config** — chiffrage §4.3 |

---

## 11. Points d'attention / limitations

- **Le costum est créé (30/07, §6bis) mais son périmètre est VIDE.** `sourceKey[]=rezoSanteReunion`
  renvoie 0 résultat sur les deux backends : aucune fiche ne porte encore
  `source.key`/`source.keys`/`reference.costum` = `rezoSanteReunion`. Le blocage n°1 est désormais le
  **peuplement** (référencement à l'unité §5.6, ou import).
- **Création de fiches : prévue, pas encore activée.** Des formulaires costum liés à `rezoSanteReunion` sont annoncés (29/07) ; le socle est prêt (porte de validation armée, file « Validation »). Reste le blocage de forme : le bouton flottant n'accepte **qu'un seul**
  `modal` : on ne peut pas proposer « créer un acteur » *et* « créer un projet » par ce biais. Et
  surtout, un `modal: "add-X"` sans document `costumForms.X` correspondant produit un bouton qui
  **rend `null` en silence** (constat d'audit `ref-morte`). Activer ce bouton exige d'abord d'écrire
  le formulaire costum.
- **Convention de sous-type des ressources à arrêter.** Il n'existe aucune collection « ressource » :
  dans le parc, c'est un POI sous-typé (parent62 utilise `type: "recoveryCenter"`). Le sous-type doit
  être décidé **avant** que les `itemRules` soient figées, puisqu'il est testé dans les prédicats.
- **CTA de la preview `resource` figé.** Les libellés d'action sont câblés sur quatre valeurs
  françaises (`lien`, `video`, `document`, `compte-rendu`). Des catégories nommées autrement
  (« Outil », « Guide », « Protocole ») ne produiront **aucun bouton d'action principal**, et aucune
  clé de config ne corrige cela — seules les icônes sont surchargeables.
- **Visuels : 5 fournis, 1 manquant.** `/theme/addictions` n'a **aucune image**, et reste donc en
  section `title` : la planche des 5 thématiques est visuellement dépareillée.
  Manque aussi l'image « communauté » (le `community-healthcare` de la maquette) qui porterait la
  section communauté de la home. Les visuels actuels sont **générés par IA** : à remplacer par de
  vraies photos du réseau avant mise en ligne (enjeu de crédibilité pour un annuaire d'acteurs).
- **Trois tags orphelins** : `Ecran`, `Santé Sexuelle`, `sédentarité` (ce dernier rattaché à
  l'activité physique). Faut-il des pages dédiées ?
- **Socle légal incomplet, volontairement.** Tous les champs d'identité sont marqués « à compléter » —
  aucune raison sociale, SIRET, adresse, hébergeur ni directeur de publication n'a été inventé. Le
  parc a un précédent fâcheux de gabarit légal dupliqué avec un placeholder parti en production.
- Les données de santé relèvent de l'**article 9 du RGPD**. La politique de confidentialité précise
  que l'annuaire ne recueille pas de données de santé individuelles — à faire relire.

---

## 12. Dépendances SDK ↔ cocolight-api-client

SDK installé : **1.0.172 publiée** (`package.json` `^1.0.172`, commit `09e145a0` du 03/08 — fini le
`npm pack` local).

| Demande | État | Preuve / substitut |
|---|---|---|
| Verbes d'engagement typés (`like`, `partenaire`, `soutien`, `intéressé`, `réutilise`) | ❌ absent | `ENTITY_ACTION_CONFIG` fermé ; `vote()` limité à `news`/`comments` |
| Émetteur = organisation | ❌ absent | `BaseEntity.follow()` code en dur `childType: "citoyens"` |
| Lien orga↔orga symétrique | ❌ absent | `_buildLinkFilters` : `linkType ∈ memberOf \| projects \| events` |
| Compteur d'engagement sur une entité | ❌ absent | `voteCount` n'existe que sur `news`/`comments` |
| Import de masse | ✅ présent | `entity.previewImport` (géocodage + warnings) puis `entity.importElements` (chunké) |
| Pose du scope costum côté admin (référencement, validation…) | ✅ réglé en **1.0.172** | `setCostumScope` — [`../src/modules/admin/lib/ensureCostumScope.ts`](../src/modules/admin/lib/ensureCostumScope.ts) ; concerne les 9 onglets du back-office de ce site |

---

## 13. Évolutions à prévoir & questions en attente

| Question | Responsable |
|---|---|
| ~~Créer le costum `rezoSanteReunion`~~ **fait le 30/07 (§6bis)** → reste le **peuplement** : qui référence/importe les premières fiches, et quand ? | PSR / admin Communecter |
| **Essai `hero-carousel`** (30/07) : confirmer ou non son maintien en tête de `/thematiques`, et arbitrer le portage en home voulu par la maquette Lovable (coûts mesurés : diapositive addictions sans image, ratio 16:9 vs 3:2 → bascule du candidat LCP) | Client + Thomas |
| **Vocabulaire des « sujets pratiqués »** : quelle liste, saisie où, renseignée quand ? Sans elle, les 5 pages thématiques n'ont rien à filtrer | Tibor + PSR (@Pierre, @duvardfrancois, @SebastienPSR) |
| Reprise des **1 088 fiches `#santé`** : qui trie, selon quels critères d'inclusion ? | PSR |
| **Doublon PSR** (`PromotionSanteLaReunion` / `promotionSanteLaReunion`) : lequel fait foi ? | PSR |
| Plateforme **méta multi-sources** : quels partenariats signés en premier (CPTS, MSS, Thésis, ARS) ? Déclenche le passage de `sourceKey` en tableau | Tibor |
| **Réplication Mayotte (PSM)** : config sœur ou même config multi-slug ? À trancher avant de spécialiser quoi que ce soit | Tibor + PSR |
| Qui émet une action d'engagement : le citoyen ou l'organisation ? | Client (cadrage §4.3) |
| Cinq liens distincts, ou un lien à valeur ? | Client + dev backend |
| Partenariat symétrique (avec acceptation) ou déclaration unilatérale ? | Client |
| Sous-type POI retenu pour les « ressources » | Client + intégrateur |
| Pages dédiées pour `Ecran` et `Santé Sexuelle` ? | Client |
| Visuels du site (photos réelles du réseau) | Client |
| Champs d'identité du socle légal | Client |
| Formulaires costum annoncés : quelles collections (acteur ? projet ? ressource ?), et quels champs — au-delà des « sujets pratiqués » ? | Tibor + PSR |
| Un seul bouton flottant est possible : quel formulaire y met-on, et comment atteint-on les autres ? | Client + intégrateur |
