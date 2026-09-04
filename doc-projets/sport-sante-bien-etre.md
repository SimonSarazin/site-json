[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Sport Santé Bien-être — La Réunion

> **Document de travail du projet de configuration.** Il consigne l'état réel de la config, le
> périmètre de données mesuré, l'avancement et les décisions **en attente**. Créé pour ne plus
> re-explorer la config à chaque session et pour porter les arbitrages de contenu qui restent à
> rendre. **À tenir à jour à chaque lot livré**, selon le formalisme du skill
> [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Search](../doc/07-module-search.md) ·
> [Module formEngine](../doc/28-module-formengine.md) · [Module Admin](../doc/30-module-admin.md) ·
> [Module Articles/Blog](../doc/32-module-articles-blog.md) ·
> [Module Profil](../doc/08-module-profil.md). Mémoire : `[[project-sport-sante-bien-etre]]`.

Dernière mise à jour : **2026-09-02** (branche `judi-ssbe` : les créneaux deviennent
contributifs et modérables, et le back-office gagne les documents ressources — cf. §9). Le lot précédent, du 03/08, portait les
réseaux sociaux au patron `fieldArray`, le retrait de `recepisseDeclaration` et le re-sondage
des périmètres.
**4 décisions de contenu sont en attente** — cf. §13.

---

## 1. Contexte du projet

Plateforme régionale de promotion du sport-santé à La Réunion : elle met en relation le **grand
public** (trouver un créneau, une structure, un équipement), les **professionnels** (labellisation,
formation, prescription) et la **communauté** des acteurs du réseau.

C'est, par le volume, la **deuxième config du parc** après parent62 : 19 pages, 61 sections,
6 formulaires costum, un back-office à 7 onglets.

### Identité

| | |
|---|---|
| Slug | `sportSanteBienetre` |
| Costum backend | `sportSanteBienetre` (collection `organizations` — « Sport Santé bien-être ») |
| Config | [`../config.prod.sport-sante-bien-etre.json`](../config.prod.sport-sante-bien-etre.json) |
| CSS | [`../src/index-sport-sante-bien-etre.css`](../src/index-sport-sante-bien-etre.css) — 75 variables, bloc `theme` **complet** en config |
| Langues | `fr` (défaut) + `en` |
| SDK | `@communecter/cocolight-api-client` **1.0.172** (publiée sur npm — `package.json` `^1.0.172`, commit `09e145a0` du 03/08) |
| Branche courante | `main` |
| Historique | **76 commits** touchant la config (`git log --follow`, 03/08) |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| — → 25/07 | Thomas | Construction de la config (19 pages), des 6 formulaires costum et du back-office ; travaux blog (fil, RSS, SEO, palette) partagés avec le moteur |
| 25/07 | Thomas | `b1104947` — « rezo-la-mer, SSBE, équipements sportifs : 41 constats levés » |
| 28/07 | Claude | Diagnostic complet, levée de 12 constats (cf. §9), création de ce dossier |
| 30/07 | Claude | `5ae354d2` — réseaux sociaux au patron `fieldArray` (3 formulaires SSBE + 1 cyber-reunion) ; `59a4b6ee` — retrait de `recepisseDeclaration`, disparu du costum (cf. §9) |
| 03/08 | Parc | Merge de `fix/institut-bleu-ui` (17 commits, `94251b7b`) dans `main` ; SDK **1.0.172 publiée** (`09e145a0`) — rien de spécifique SSBE, gates re-passés verts (cf. §9) |

---

## 2. Objectifs de la configuration

1. Servir **trois publics distincts** depuis une même base : grand public, professionnels, communauté.
2. Exposer les jeux de données du territoire : équipements sportifs, créneaux, structures, Maisons
   Sport-Santé, formations.
3. Permettre à une structure de **s'inscrire elle-même** et de faire labelliser son activité.
4. Donner au réseau un back-office autonome (6 types d'entités éditables).

---

## 3. Architecture générale

```
                 ┌───────────────────────────────────────────┐
   Visiteur ───► │  SiteForge (site-json)                    │
                 │   19 pages · 15 types de sections         │
                 │   header transparent-scroll · footer      │
                 │   contact-partners                        │
                 └──────────────┬────────────────────────────┘
                                │ searchCostum / coform
                 ┌──────────────▼────────────────────────────┐
                 │  Backend Cocolight — costum               │
                 │  sportSanteBienetre                       │
                 │  organizations · projects · events · poi  │
                 └───────────────────────────────────────────┘
```

**Deux voies de filtrage** coexistent dans le parc et se retrouvent ici : le HERO
(`searchHeader` avec `dropdownFilters`) et le PANNEAU (`gridLayout` + `filters`). SSBE emploie
massivement le premier — `searchHeader` est présent sur **14 des 19 pages**.

---

## 4. Cahier des charges (dérivé de la config)

Aucun CDC formel n'a été versé au dépôt. Le périmètre se lit dans la config elle-même.

### 4.1 Les 19 pages

| Page | Rôle | Sections |
|---|---|---|
| `/` | Accueil | 5 |
| `/public` | Entrée grand public | 6 |
| `/espace-professionnels` | Entrée professionnels | 7 |
| `/communaute` | Membres + organisations (onglets) | 2 |
| `/presentation` | Le dispositif | 7 |
| `/labellisation` | Faire labelliser une activité (timeline) | 7 |
| `/structure` · `/mss` | Structures · Maisons Sport-Santé | 2 · 4 |
| `/creneaux` · `/equipements-sportifs` · `/mapping` | Jeux de données du territoire | 2 chacune |
| `/formation` · `/listing-formations` · `/projets` | Formation et projets | 3 · 2 · 2 |
| `/blog` | Actualités (`articleFeed`) | 2 |
| `/contact` | Formulaire de contact | 3 |
| `/mentions-legales` · `/confidentialite` · `/accessibilite` | Socle légal | 1 chacune |

Le socle légal **existe** — c'est ce qui distingue nettement cette config de rezo-la-mer.

### 4.2 Les 6 formulaires costum

Comptages re-dérivés de la config le **2026-08-03** (`fields{}` déclarés vs référencés dans
`sections[].fields[]` + `sections[].groups[].fields[]`) — **169 déclarés, 115 placés** :

| Formulaire | Entité | Champs déclarés | dont **placés** |
|---|---|---|---|
| `sport-sante-bienetre-organizations` | organizations | 42 | 26 |
| `sport-sante-bienetre-mss` | organizations | 35 | 25 |
| `sport-sante-bienetre-recovery-center` | poi | 33 | 28 |
| `sport-sante-bienetre-formation` | projects | 26 | 16 |
| `sport-sante-bienetre-session-formation` | events | 22 | 14 |
| `sport-sante-bienetre-article` | poi | 11 | 6 |

`organizations` est passé de 45/27 à 42/26 le 30/07 : `facebook`/`instagram` retirés (peuplés par
pure coïncidence de nommage avec l'ancien widget `editSocial` — cf. §9) et `recepisseDeclaration`
retiré (disparu du costum, jamais porté par aucune donnée).

> ⚠️ **L'écart « déclarés vs placés » n'est pas anodin.** Le moteur rend en parcourant
> `sections → groups → fields[]` ([`shared.tsx:47`](../src/modules/formEngine/layouts/shared.tsx),
> [`GenericForm.tsx:107`](../src/modules/formEngine/components/GenericForm.tsx)) : **un champ
> déclaré mais placé dans aucune section n'est jamais rendu.** Une partie de l'écart est
> légitime (sous-champs de widgets composites : `streetAddress`/`postalCode` sous `address`,
> `mobile` sous `telephone`) ; le reste est du vestige de conversion. 10 vestiges ont été
> supprimés le 28/07, puis `facebook`/`instagram` et `recepisseDeclaration` le 30/07 (cf. §9).
> Vestiges encore visibles au 03/08 sur `organizations` : `youtube`, `linkedin` (hors des neuf
> clés de l'ancien widget, jamais peuplés), `autreDescription`, `affiliate`/`affiliateTo`… —
> cf. §13, question 4.

### 4.3 Back-office (`config.admin`, 7 onglets)

`Tableau de bord` · `Membres` · `Organisations` (2 formulaires) · `Lieux & actualités` (2) ·
`Formations` (2) · `Import / Export` · `Référencement`.

**Les 6 formulaires costum n'étaient exposés QUE là.** Rien, côté public, n'ouvrait de formulaire
avant le 28/07.

---

## 5. Modèle de données réel (re-sondé le 2026-08-03)

`config:probe` sur le costum `sportSanteBienetre` — **9 périmètres, 8 peuplés, 1 vide**
(entre parenthèses : la mesure du 28/07 — la base vit, les chiffres montent) :

| Page | Périmètre | Résultats |
|---|---|---|
| `/equipements-sportifs` | poi équipements | **3 061** (3 052) |
| `/creneaux` | créneaux | **300** (263) |
| `/structure` · `/mapping` | organisations du réseau | **180** (171) — les deux pages |
| `/mss` | Maisons Sport-Santé | 13 |
| `/formation` | formations | 4 |
| `/listing-formations` · `/projets` | offres · projets | 2 · 2 |
| `/communaute` → onglet « Organisations » | — | **0 ⛔** (inchangé) |

### Le périmètre vide

```jsonc
{ "notSourceKey": true,
  "defaultTypes": ["NGO","LocalBusiness","Group","GovernmentOrganization","Cooperative"],
  "defaultFilters": {
    "preferences.toBeValidated.sportSanteBienetre": { "$exists": false },
    "links.members.682b2ac5e05a1d45844340e7": { "$exists": true }   // ← id EN DUR
  } }
```

L'onglet filtre sur l'appartenance à une organisation dont **l'identifiant est codé en dur**.
Aucune organisation ne porte ce lien en base. Deux lectures possibles — id périmé, ou lien
jamais posé — **à trancher** (§13, question 5). L'onglet « Membres » voisin, lui, fonctionne.

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config | [`../config.prod.sport-sante-bien-etre.json`](../config.prod.sport-sante-bien-etre.json) |
| Thème | [`../src/index-sport-sante-bien-etre.css`](../src/index-sport-sante-bien-etre.css) |
| Déclaration | [`../sites.json`](../sites.json) → slug `sportSanteBienetre` |
| Boutons d'action | [`../src/types/action-button-schema.ts`](../src/types/action-button-schema.ts) · [`../src/modules/profil/components/ActionButtonGroup.tsx`](../src/modules/profil/components/ActionButtonGroup.tsx) |
| Modales d'ajout | [`../src/modules/profil/components/add/ModalRegistry.tsx`](../src/modules/profil/components/add/ModalRegistry.tsx) |
| **Créneaux — contribution & modération (02/09, `bc99eecc` + `43a93695`)** | config (section `/creneaux` : `addButton`, `preview.editButton`, `card.structureAction.audience` ; onglet admin `moderation`) · [`../src/modules/search/schema.ts`](../src/modules/search/schema.ts) (`structureAction.audience`, `kind` optionnel) · [`../src/modules/search/components/card/CardAnswer.tsx`](../src/modules/search/components/card/CardAnswer.tsx) (+ `CardAnswer.test.tsx`, `CardAnswer.ssr.test.tsx`) · [`../src/modules/search/lib/coformAnswer.ts`](../src/modules/search/lib/coformAnswer.ts) (`isCoformAnswerManager`, ex-`canEditCoformAnswer`) · [`../src/modules/admin/schema.ts`](../src/modules/admin/schema.ts) (`columns[].sortable`, + `schema.test.ts`) · [`../src/modules/admin/sections/AdminResourceTable.tsx`](../src/modules/admin/sections/AdminResourceTable.tsx) · docs [07](../doc/07-module-search.md) et [30](../doc/30-module-admin.md) |
| Rendu des formulaires | [`../src/modules/formEngine/layouts/shared.tsx`](../src/modules/formEngine/layouts/shared.tsx) · [`../src/modules/formEngine/components/GenericForm.tsx`](../src/modules/formEngine/components/GenericForm.tsx) |

---

## 7. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| Pas de `header.ctaButton` — le widget `utilities.auth` porte la connexion | Le CTA en était un doublon **et** pointait vers une page inexistante. Même patron qu'institut-bleu, qui n'en déclare aucun |
| « Inscrire ma structure » ouvre une **modale**, pas une page | Le formulaire existe déjà (`costumForms`) ; `ActionButtonSchema` accepte `modal`, rendu par `ActionButtonGroup:278`. Aucune page à créer, et le chemin bénéficie du garde d'authentification |
| Les champs morts sont **supprimés**, pas traduits | Traduire un champ jamais rendu serait figer du vestige — et, ici, une faute de frappe |
| `searchHeader` plutôt que le panneau `filters` | Cohérence : 14 pages sur 19 l'emploient déjà. Mélanger les deux voies produit des doublons de champ de recherche (piège rencontré sur cyber-reunion puis institut-bleu) |

---

## 8. Étapes de mise en place

```bash
# dev — un serveur par site, ports distincts
PORT=5243 VITE_SLUG=sportSanteBienetre \
  SITE_CONFIG_PATH=config.prod.sport-sante-bien-etre.json \
  SITE_CSS_PATH=src/index-sport-sante-bien-etre.css \
  node server/dev-server.js

# gates
npm run config:validate -- config.prod.sport-sante-bien-etre.json
npm run audit:config    -- --file config.prod.sport-sante-bien-etre.json
npx tsx scripts/config-probe.ts config.prod.sport-sante-bien-etre.json
npm run typecheck && npm run lint && npm run test:unit
```

### Variables d'environnement de déploiement

Depuis le merge de `fix/institut-bleu-ui` (03/08), le déploiement pose **`VITE_SITE_PUBLIC_URL`** :
l'URL publique du site-json lui-même (canonical, `og:url`/`og:image`, `sitemap.xml`, flux RSS),
lue par `getSitePublicUrl()` ([`../src/lib/constant/common.ts`](../src/lib/constant/common.ts)) et
`server/lib/sitemap.js`. `npm run deploy:env` la dérive de `sites.json` (`aliases[0]` prioritaire,
sinon `domain`) — pour SSBE, pas d'`aliases`, `domain: ssbe.00.re` → **`https://ssbe.00.re`**.
Repli `getServerUrl()` si absente (comportement historique). **Ne pas confondre** avec
`VITE_SERVER_URL` (= serveur communecter : images `/upload`, embed co2, cagnotte), qui garde sa
valeur parc.

---

## 9. Impacts des modifications

### Lot du 28/07 — 16 constats d'audit → 4

**1. Le bouton de connexion ne connectait pas.** `header.ctaButton` portait « Se connecter » vers
`/activites`, page inexistante, alors que `utilities.auth` était **déjà à `true`**. Doublon **et**
lien mort. Retiré.

**2. « Inscrire ma structure » n'ouvrait rien.** Le bouton du `searchHeader` de `/communaute`
pointait vers `/inscrire-organisation`, page jamais créée. Le formulaire, lui, existait depuis le
début dans `costumForms` — exposé uniquement dans `/admin`. Remplacé par
`modal: "add-sport-sante-bienetre-organizations"`.

> Effet de bord favorable : ce chemin passe par `DynamicModalButton`, donc par le garde
> d'authentification ajouté le 28/07 (`f24a6531`). Un visiteur non connecté reçoit une invitation à
> se connecter au lieu d'un formulaire qui échouerait à l'envoi.

**3. Dix champs morts supprimés.** L'audit les signalait comme « traduction `en` manquante ». Le
diagnostic a montré autre chose : ces champs ne sont **placés dans aucune section**, chaque clé
n'apparaît **qu'une fois** dans tout le formulaire (sa propre définition), et le moteur ne rend que
ce qui est placé. Ils n'étaient donc ni affichés, ni sérialisés.

Leurs libellés étaient des noms techniques jamais rédigés — « Status file », « Status primaire »,
« Responsable civile pro » — et **« Sextion info »**, faute de frappe pour « Section », répétée
5 fois sur deux formulaires. Invisible en pratique, mais du code mort à retirer plutôt qu'à traduire.

| Formulaire | Champs supprimés |
|---|---|
| `…-organizations` | `sextionInfo`, `sextionInfoRepresentant`, `sextionInfoResponsable`, `statusFile`, `statusPrimaire`, `statusSecondaire`, `statusCommunale`, `responsableCivilePro` |
| `…-mss` | `sextionInfoRepresentant`, `sextionInfoResponsable` |

Chaque retrait a été précédé d'une assertion vérifiant que le champ n'était placé dans aucune section.

### Gates au 28/07

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 19 pages / 61 sections |
| `audit:config` | 🟡 **4 constats** (4 liens morts — décisions en attente, §13) |
| `config:probe` | 🟡 9 périmètres — **8 OK, 1 vide** (§5) |
| `test:preflight` | ✅ 274 tests |
| `typecheck` · `lint` | ✅ propre · 0 erreur |

### Lot du 30/07 — hygiène des formulaires costum (2 commits)

**1. Les réseaux sociaux passent au patron `fieldArray`** (`5ae354d2`). Trois formulaires SSBE
(`organizations`, `mss`, `formation`) — plus `cyber-reunion-organization` — déclaraient
`socialNetwork` avec le widget `editSocial`. C'est l'ancre du **profil citoyen** : ses neuf saisies
écrivent sous `github`/`facebook`/`instagram`/… et jamais sous `socialNetwork` ; aucune de ces neuf
clés n'étant déclarée dans les descripteurs, **l'utilisateur saisissait dans neuf champs reliés à
rien**. Exception déroutante : `organizations` déclarait `facebook` et `instagram` (non placés) —
deux réseaux sur neuf s'enregistraient par pure coïncidence de nommage. Patron adopté : celui de
`tiers-lieux`, lu depuis sa config — `fieldArray` + `social:read`/`social:write` +
`path: socialNetwork` ; le champ d'UI se nomme `socialLinks`, la clé serveur reste `socialNetwork`.
`facebook`/`instagram` sont retirés (le `fieldArray` les couvre, même destination serveur).

> ⚠️ Piège consigné dans le commit : les sections existent sous **deux formes**
> (`sections[].fields[]` ET `sections[].groups[].fields[]`) — un renommage qui ne traite que l'une
> laisse des références orphelines **qu'aucun gate ne détecte** (ni `config:validate`, ni le
> préflight). Vérifié ici par un audit des 266 références de champ de toutes les configs.

**2. `recepisseDeclaration` retiré** (`59a4b6ee`). Le champ était déclaré dans
`…-organizations` alors que le costum ne le déclare **plus** (disparu de la base entre le 27 et le
30/07, révélé par la régénération de l'artefact costum), et **aucun document** ne le porte dans
aucune collection. Son groupe (`juridique.groups[1]`), qui ne contenait que lui, est supprimé aussi.
Critère de recette : `config:costum-drift` à **0 fantôme** sur SSBE. Réserve du commit : si le
retrait côté costum était accidentel, la bonne correction serait de le remettre **en base**.

Gates du lot (30/07) : config:validate ✅, préflight 337/337 ✅, typecheck ✅, `config:costum-drift`
0 fantôme SSBE ✅.

### État au 03/08 (après merge de `fix/institut-bleu-ui` dans `main` + SDK 1.0.172)

Aucun commit spécifique SSBE dans le merge ; gates re-passés ce jour :

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 19 pages / 61 sections |
| `audit:config` | 🟡 **4 constats** (les 4 mêmes liens morts, §13) |
| `config:probe` | 🟡 9 périmètres — **8 OK, 1 vide** (§5, re-sondé) |
| `config:costum-drift` | ✅ **0 fantôme SSBE** (12 « non exposés » informatifs : 10 sur `organizations`, 2 sur `mss` — champs du costum backend volontairement non exposés en config) |
| `test:preflight` | ✅ 412 tests / 22 fichiers |
| `typecheck` | ✅ (`tsc -b`) |

### Lot du 02/09 — les créneaux deviennent contributifs et modérables (branche `judi-ssbe`)

> Commits : `bc99eecc` (carte de créneau) · `43a93695` (modération admin).

**Alignement sur Ekilib.re, sauf là où la donnée dit le contraire.** Le site frère
[Maison Sport Santé du Tampon](maison-sport-sante-la-tampon.md) portait déjà les boutons de
contribution et l'onglet de modération — **le gate `audience` (point 2) est neuf, et Ekilib.re
ne l'a pas encore**. Le reste est transposé sur le form SSBE `6928096adf5caf0d230e7f26` (section
`sportSanteBienetre2172025_854_0`). Fait vérifié en base : la duplication de formulaire **préserve
les ids d'inputs**, donc les 5 suffixes utilisés par la config sont identiques sur les deux sites —
la transposition est mécanique, seul le préfixe de section change.

**1. Ajouter et modifier un créneau depuis `/creneaux`** — `addButton` (avec `adminOnly: false` :
la contribution est publique, un visiteur non connecté est envoyé au login) et
`preview.editButton: true` (bouton « Modifier » dans le détail, réservé aux gestionnaires).

**2. Le bouton « Fiche structure » réservé aux gestionnaires** — nouvelle clé
`card.structureAction.audience` (`"all"` par défaut, donc **parc inchangé** ; `"managers"` sur SSBE).
Il était jusqu'ici visible par **tout le monde**, alors que la fiche structure est un outil de
gestion (affiliation, représentant légal, documents) sans intérêt pour qui compare des créneaux.
Le gate réutilise le prédicat du bouton « Modifier », **renommé** `canEditCoformAnswer` →
`isCoformAnswerManager` : il gouverne désormais une écriture **et** un affichage, et sous l'ancien
nom un futur resserrement du droit d'édition aurait resserré la fiche en silence.
⚠️ **Pertinence d'affichage, pas une frontière de sécurité** : `/profil/:slug` et `/structure`
restent des routes publiques, et l'e-mail de la structure est de toute façon affiché sur la carte.

**Le piège traité : l'hydratation.** `/creneaux` est prérendue côté serveur, où `me` vaut toujours
`null`, alors que le 1er render client d'un gestionnaire a déjà son `me`. Sans garde, HTML serveur ≠
1er render client → mismatch. Le gate passe donc par `useHydrated` : bouton absent des deux, puis
affiché après hydratation chez les seuls ayants droit. Épinglé par `CardAnswer.ssr.test.tsx`, qui
rend en SSR avec le **vrai** hook (le test de câblage, lui, le mocke — il ne prouverait rien ici).

**3. Onglet admin « Modération »** (`siteAdmin`, en dernier, sans icône : conforme aux 7 onglets
existants) — table `resource` en mode `statusField` sur les answers du form. États **verbatim de la
base** : `En attente` · `En cours` · `Validé` · `Réfusé` (la faute est la valeur stockée, lue par le
filtre serveur et écrite par `updatepathvalue` ; seul l'affichage la corrige en « Refusé »).
Volumétrie mesurée le 02/09 : **57 en attente**, 225 validés, 3 sans statut — l'onglet a un vrai
backlog. Effet de bord souhaitable : le tableau de bord admin dérive automatiquement une tuile de
comptage par section `resource` visible.

**Deux écarts assumés vs Ekilib.re, tranchés sur la donnée mesurée :**

| Écart | Pourquoi |
|---|---|
| `notSourceKey: true` au lieu de `sourceKey: ["sportSanteBienetre"]` | Sur les 285 réponses du form, **une** porte `source.keys: associationEkilibre` (import mal étiqueté). Avec `sourceKey` elle resterait **publiée sur `/creneaux` sans être modérable** : le périmètre modéré doit égaler le périmètre publié. Le champ reste borné par `defaultFilters.form`, donc rien d'indésirable n'entre |
| `columns[].sortable` (nouveau, défaut `true`) posé à `false` sur 4 colonnes | Chaque en-tête est un tri **serveur** qui écrase `defaultSortBy`. Or `name`, `structure.name`, le Type à plat et `address.postalCode` n'existent dans **aucun** document : ils sont fabriqués par le hook costum PHP **après** la requête Mongo. Trier dessus ordonnait au hasard — à l'identique en asc et desc — tout en perdant l'ordre par défaut, et déstabilisait le skip/limit du scroll infini. Seul « Déclaré le » (vrai champ Mongo) reste triable. **Ekilib.re porte le même défaut en production** : un `sortable: false` l'y corrigerait aussi |

**Gates du lot (02/09)** : `config:validate` ✅ 19 pages / 61 sections · `audit:config` 🟡 **4
constats, les 4 mêmes qu'au 03/08** (liens morts §13, inchangés) et `strip: 0` · `test:preflight`
✅ 532 · unitaires admin ✅ 128 · `tsc -b` ✅ · lint ✅ 0 erreur · snapshot
`tests/preflight/__effective__/sport-sante-bien-etre.json` régénéré (diff limité à la seule entrée
`moderation/answers`).

⚠️ **Deux gates n'ont PAS pu tourner** : `config:render` et `config:probe` — le backend local
`communecter74-dev` a cessé de répondre en fin de session (HTTP 000, `timeout of 30000ms exceeded`
à la résolution du slug). Cause probable : une sonde `globalautocomplete` en `fieldShow=allFields`
sur les 285 réponses, qui a vraisemblablement saturé PHP-FPM. **À rejouer** une fois le backend
relancé, avec la recette navigateur (§10, ligne 16).

### Lot du 02/09 (2) — documents ressources dans le back-office

> Commits : `a469da78` (site) · dépôt costum `bf66a550f` (déclaration en base).

Transposition du module ressources d'[Ekilib.re](maison-sport-sante-la-tampon.md), **0 code
front** : `formEngine` (widgets `file`/`urlList`/`select`) et la table admin en mode
`statusField` sont réutilisés tels quels. Une ressource = un **POI** scopé
`source.keys: sportSanteBienetre`, avec `thematique` et `status` (Visible / **Brouillon** par
défaut — pas de publication accidentelle). Trois morceaux de config :
`costumForms["sport-sante-bienetre-ressource"]` · onglet admin **« Ressources »** (`siteAdmin` :
listing, création, édition, suppression) · route `edit-sport-sante-bienetre-ressource` dans
`profiles.poi.editModals`, **bornée au costum** (`sourceKeys contains sportSanteBienetre` —
le snapshot effectif le prouve : un POI étranger retombe sur `edit-profile`).

**Le sous-type est DÉDIÉ, et c'est le point qui distingue SSBE d'Ekilib.re.** Ekilib.re porte ses
ressources sur `recoveryCenter` ; ici ce sous-type est **déjà pris** par « Équipements Sportifs »
(déclaré dans `costum.typeObj`, avec son onglet admin « lieux » et son propre formulaire d'ajout).
Les y mêler aurait pollué les deux listings. D'où un sous-type **`ressource`**, déclaré à part.

**Thématiques** (7 valeurs fournies par le porteur) : `mss` · `rapports` · `has` · `guides` ·
`outils` · `communication` · `financements`. Le champ stocke la **clé**, pas le libellé : le site
est bilingue fr/en, un libellé français en base rendrait la version anglaise fausse et imposerait
une migration de données à chaque retouche de formulation. ⚠️ **Conséquence assumée** : la colonne
« Thématique » du listing admin affiche la clé brute (`formatCell` ne résout aucune énumération) ;
si l'affichage du libellé est souhaité, c'est une évolution du schéma des colonnes admin (§13).
Le nom de champ évite `thematic`, déjà une taxonomie du costum SSBE (Sport, Santé/prévention…).

⚠️ **Prérequis dur, à rejouer en PROD** : `costum.typeObj.ressource` doit être déclaré en base,
sinon le SDK écarte `thematique`/`status` **en silence** à la création et les rejette à l'édition
(`[DraftProxy] Le champ … n'est pas autorisé`). Action URL dédiée :
`http://<host>/costum/ssbeMigration/declareRessourceType` (dry run) puis `/apply/1`.

**Gates (02/09, backend revenu)** : `config:validate` ✅ 19 pages / 61 sections · `audit:config`
🟡 4 constats préexistants, `strip: 0` · `test:preflight` ✅ **553** · `tsc -b` ✅ · lint ✅
0 erreur · snapshot régénéré (2 ajouts : la route d'édition et `ressources/poi`) ·
**`config:render` ✅ 19/19 pages, 61/61 sections** · **`config:probe` 9 périmètres — 7 OK,
2 vides** (pages 4 et 11, **antérieurs à ce lot** ; la doc en notait 1 au 03/08, un second a dérivé
depuis). `/creneaux` remonte bien ses **285** réponses, ce qui valide au passage le `notSourceKey`
du lot précédent.

---

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Slug + CSS dans `sites.json` | ✅ | `sportSanteBienetre` → config + `index-sport-sante-bien-etre` |
| 2 | Thème | ✅ | Bloc `theme` complet en config + 75 variables CSS |
| 3 | Socle légal | ✅ | `/mentions-legales`, `/confidentialite`, `/accessibilite` existent |
| 4 | Jeux de données du territoire | ✅ | Équipements (3 061), créneaux (300), structures (180), MSS (13) — sondés le 03/08 |
| 5 | Communauté | 🟡 | Onglet « Membres » OK ; onglet « Organisations » **vide** (id en dur, §5) |
| 6 | Formulaires costum | 🟡 | 6 déclarés et exposés dans `/admin` ; **1 seul** ouvert côté public depuis le 28/07 |
| 7 | Inscription d'une structure | ✅ | Modale branchée sur `/communaute`, gardée par l'authentification |
| 8 | Connexion | ✅ | Widget `utilities.auth` ; le CTA cassé du header est retiré |
| 9 | Back-office | ✅ | **8 onglets** depuis le 02/09 (ajout de « Modération », cf. ligne 18) — **essai UI connecté à faire** |
| 10 | Blog | ✅ | `articleFeed` + RSS + SEO + palette (travaux du 25/07) |
| 11 | Palette ⌘K | ✅ | `entitySearch` + `articleSearch` |
| 12 | Grille « professionnels » | ❌ | 3 tuiles sur 6 mènent à des pages inexistantes (§13) |
| 13 | Hero `/public` | ❌ | 1 CTA mort, 1 CTA qui renvoie à l'accueil depuis une sous-page (§13) |
| 14 | Rendu navigateur | ❌ | **Jamais vérifié** — aucune capture de ce site à ce jour |
| 15 | Mode sombre | ❌ | Jamais vérifié |
| 16 | Créneaux — ajouter / modifier depuis `/creneaux` | ✅ config | `addButton` (`adminOnly: false`) + `preview.editButton` (02/09, §9) — **recette navigateur à faire** (backend indisponible en fin de session) |
| 17 | Créneaux — « Fiche structure » réservée aux gestionnaires | ✅ | `card.structureAction.audience: "managers"` + gate `isCoformAnswerManager` sous `useHydrated` (02/09, §9) ; 12 tests dont 2 de parité SSR |
| 18 | Créneaux — modération dans le back-office | ✅ config | Onglet `moderation` en mode `statusField`, 57 en attente à traiter (02/09, §9) — **recette à faire** : passer un « En attente » à « Validé » et vérifier qu'il apparaît sur `/creneaux` |
| 19 | Ressources — listing et ajout côté admin | ✅ config | Onglet « Ressources » + `costumForms` dédié (02/09, §9) — **bloqué tant que `declareRessourceType` n'est pas joué en base** ; page publique `/ressources` **non faite** (hors demande, cf. §13) |

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

Aucune demande en cours. La config n'emploie que des méthodes publiques déjà disponibles
(`searchCostum`, `coformAnswersSearch`).

Version installée : **1.0.172, publiée sur npm** (`package.json` `^1.0.172`, commit `09e145a0` du
03/08 — fini le `npm pack` local). La 1.0.172 fiabilise notamment la pose du scope costum côté
admin (`setCostumScope`, cf. [`../src/modules/admin/lib/ensureCostumScope.ts`](../src/modules/admin/lib/ensureCostumScope.ts)) —
pertinent ici : SSBE a un back-office `/admin` à 7 onglets (§4.3).

---

## 12. Points d'attention / limitations

- **Écart « champs déclarés vs placés »** dans les 6 formulaires (cf. §4.2). Avant de traduire ou de
  renommer un champ, vérifier qu'il est **placé dans une section** — sinon il n'existe pas à l'écran.
- **Les sections de formulaire ont deux formes** — `sections[].fields[]` ET
  `sections[].groups[].fields[]` (piège rencontré le 30/07, `5ae354d2`) : un renommage/retrait de
  champ doit traiter **les deux**, et aucun gate ne détecte une référence de section orpheline
  (ni `config:validate`, ni le préflight).
- **Id d'organisation codé en dur** dans le filtre de `/communaute` (§5). Le même piège que le
  `localityId` figé de commune-transparente : une valeur d'instance dans une config.
- Config JSON **jamais parsée par Zod au runtime** : toute clé doit être écrite explicitement, et une
  clé déclarée au schéma mais non lue par le composant est invisible (ni typecheck, ni audit).
- **`notSourceKey: true`** est employé sur plusieurs périmètres. À chaque fois, vérifier que les
  `defaultFilters` restreignent réellement — sans quoi la page sert la base entière.
- Ce site n'a **jamais été regardé en navigateur** dans le cadre de ce dossier. Tous les constats
  ci-dessus sont dérivés de la config, du code et du sondage — pas d'un rendu observé.

---

## 13. Évolutions à prévoir & questions en attente

| # | Question | Responsable |
|---|---|---|
| 1 | **Grille « Le réseau Sport Santé »** (`/espace-professionnels`, `features-glass`, 6 tuiles) : 3 tuiles mènent à des pages inexistantes — « Aide à la prescription » (`/prescription`), « Stratégie régionale Sport Santé » (`/strategie`), « Rapports & Publications » (`/ressources`). **Créer les 3 pages, repointer, ou retirer les tuiles ?** Rapprochements possibles mais non équivalents : `/presentation` pour la stratégie, `/blog` pour les publications. **Depuis le 02/09, `/ressources` est à portée** : le module ressources existe côté admin, seule la page publique manque (question 7) | Thomas |
| 2 | **Hero de `/public`** : le CTA « Sport et santé pour tous » pointe vers `/rejoindre` (inexistant), et le second, « Sport et santé sur ordonnance », vers `/` — un lien vers l'accueil depuis une sous-page. Les deux libellés sont des **slogans, pas des actions** : le hero est à repenser plutôt qu'à rafistoler | Thomas |
| 3 | Les 5 autres formulaires costum (`mss`, `formation`, `session-formation`, `recovery-center`, `article`) doivent-ils être ouverts au public comme l'a été `organizations`, ou rester réservés au back-office ? | Thomas |
| 4 | Les 6 formulaires déclarent **169 champs dont 115 placés** (re-dérivé le 03/08 ; trois vestiges purgés le 30/07 : `facebook`, `instagram`, `recepisseDeclaration`). Faut-il purger les vestiges restants — dont `youtube`/`linkedin`/`autreDescription` sur `organizations` —, ou certains sont-ils attendus par le backend en écriture ? | Thomas |
| 5 | `/communaute` → onglet « Organisations » : l'id `682b2ac5e05a1d45844340e7` est-il périmé, ou aucune organisation n'a-t-elle jamais été rattachée ? | Thomas |
| 6 | Rendu navigateur et mode sombre : à parcourir sur les 19 pages | Thomas |
| 7 | **Page publique `/ressources`** : le lot du 02/09 (§9) livre le dépôt et le listing **admin** seuls — c'était le périmètre demandé. Or la tuile morte « Rapports & Publications » de la question 1 pointe précisément vers `/ressources` : publier l'annuaire (une page, deux sections — `searchHeader` à filtre thématique + `searchProStatic` en presenter `resource`, filtré `status: "Visible"`) **fermerait cette question du même geste**. À arbitrer avec la question 1 | Thomas |
| 8 | **Thématique affichée en clé** dans le listing admin (`mss`, `has`…) : `formatCell` ne résout aucune énumération, et seul le mode `statusField` sait mapper une valeur vers un libellé. Vit-on avec (compact, sans ambiguïté pour un usage interne), ou ajoute-t-on au schéma des colonnes admin une table de libellés — utile bien au-delà de ce site ? | Thomas |
