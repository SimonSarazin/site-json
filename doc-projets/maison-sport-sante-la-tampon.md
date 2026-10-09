[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Ekilib.re — Maison Sport Santé du Tampon

> **Document de travail du projet de configuration.** Il intègre le contexte, le modèle de données,
> l'architecture, l'état d'avancement, les impacts et les dépendances. Objectif : ne plus re-explorer
> le dépôt ni la base à chaque session, et offrir une base partagée entre les intervenants
> (Francki / Nicolas / Peterson). **À tenir à jour à chaque lot livré**, selon le formalisme du skill
> [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Search](../doc/07-module-search.md) · [Module CoForm](../doc/21-module-coform.md) ·
> [Assistant Config](../doc/26-assistant-config.md) · projet frère
> [Sport Santé Bien-être](sport-sante-bien-etre.md) (mêmes composants et `styles/shared.css`, **CSS de
> site séparé depuis le 23/09**, §9.19). Docs workspace :
> [`FONCTIONNALITES-EKILIBRE.md`](../../FONCTIONNALITES-EKILIBRE.md) (analyse fonctionnelle + endpoints,
> 06/07) · [`ENDPOINT.md`](../../ENDPOINT.md) (fiches d'endpoints SDK à créer). Mémoire :
> `[[project-maison-sport-sante-la-tampon]]`.

Dernière mise à jour : **2026-10-08** (§9.25 : corrections de la **review de la MR 84** — `answerCopy.preview`
en lecture seule forcée, lecteur audio et sélection de texte n'ouvrent plus le détail, plus de requête
en double ni de refetch aveugle, `createDefaults` refusé avec `create.coform`, abréviation du type lue
dans le suffixe du libellé ; §9.24 : `/creneaux` trié **plus récent en premier** — `defaultSortBy: {created: -1}`,
le tri `updated` imposé par le backend reléguait une réponse neuve en dernier ; §9.23 : modération des créneaux — bouton « Créer » (CoForm) et
détail au clic sur une ligne, deux options moteur `create:{coform}` / `preview` ; §9.22 : 3ᵉ type de créneau
« Sport santé sans label - SSsL » — abréviation, filtre et cartes en **vert** ; 29/09 : merge de `main` : §9.21, reprise des créneaux SSBE du Tampon

Même jour, lot Nicolas (`8cc2a9ef`, `678527cf`, `6bbf3f8e`) — §9.27, commit `8cc2a9ef` : le parcours « Prescrire un
créneau » de `/espace-pro` passe en **timeline** ; les étapes d'inscription de `/s-informer` en
vertical, sans barre de progression — l'orientation, posée hors de `props` dans le commit, est
corrigée par `11377a04` ; filtre « Type de Sport Santé » en tête de
`/creneaux` ; **cloche de notifications** activée ; Facebook et LinkedIn passent de la rangée
d'icônes du pied de page aux lignes de contact — table d'icônes partagée avec `SocialLinks` depuis
la review de la MR 86 (§9.27). §9.26 : bouton « Ajouter une structure » **rétabli
dans l'onglet admin Structures** — `create: "add-structure"`, commité `678527cf` ; le bouton public
reste retiré ; merge de
`main` : §9.21, reprise des créneaux SSBE du Tampon
depuis l'admin — section `answerCopy`, copie serveur idempotente ; §9.20 : corrections de la review
de la MR `n-dev` → `main` ; §9.19, commit `beef21d9` : le site quitte le CSS partagé SSBE
pour un **CSS propre** et passe à la **charte Ekilib.re** — bleu #1B4F72 / jaune #F0B429 / vert
#1A7A55 — avec fermeture de l'auto-inscription des structures, cartes d'actualités en `poster`,
adresse postale et réseaux sociaux au pied de page ; §9.18 : vivier de l'onglet admin Référencement
réellement restreint à la provenance `sportSanteBienetre` — cause backend trouvée ; §9.17/§9.17 bis :
formulaire `structure` aligné sur la refonte dynForm-legacy de sport-sante-bienetre-organizations —
SSBE, 09/09 — puis recette navigateur et correctif d'un bug d'édition des pièces jointes dans
`PreviewStructure.tsx` (partagé SSBE)).

**Chiffres clés de la home passés en partie au dynamique** (§9.15, Nicolas, `21f0d53f`, 08/09) : le
schéma `cta-card-grid.props.stats[]` accepte désormais un `source` optionnel (`searchCount` /
`membersCount`) qui résout la valeur réelle **côté client**, sans dépendance au module `admin` —
`value` devient alors optionnel (skeleton pendant la résolution), jamais de chiffre inventé. Un seul
des 4 items de « Ekilib.re en chiffres » est branché à ce stade : **« Créneaux disponibles »**, sur
les mêmes `baseParams` que le KPI admin « Créneaux actifs » (§9.6). Les 3 autres (Activités
proposées, Participants actifs, Partenaires) restent codés en dur, faute de source backend
confirmée pour chacun (§13) — c'était le constat A.6 de la checklist depuis le 31/07.

<details><summary>Session 6 (20-24/08) — bascule <code>associationEkilibre</code> auto-porteuse, refonte /creneaux, corrections de production</summary>

**Le site est devenu auto-porteur.** Le costum `associationEkilibre` porte désormais ses propres
déclarations en base, et les **six** périmètres de recherche du site — `/creneaux`, `/structure`, le
KPI « Créneaux actifs », et les tables admin Actualités / Structures / Modération — visent tous
`sourceKey: ["associationEkilibre"]` et rien d'autre. Le contournement `notSourceKey` a disparu de la
config (0 occurrence). Modèle acté avec l'utilisateur : **la propriété porte les fonctionnalités, le
référencement ne porte que la visibilité** — pas de transfert du stock régional, mais une curation
fiche par fiche (14 organisations du Tampon référencées le 20/08, onglet admin dédié). Détail
§9.9 à §9.11.

**Conséquence produit lourde et assumée** : mesuré en production, 44 des 45 réponses au formulaire
créneaux appartiennent à `sportSanteBienetre`. `/creneaux`, qui en affichait 43 dont 42 qui ne
relevaient pas du Tampon, n'en montre plus qu'un. La page est juste ; c'est le stock qui reste à
saisir (§13).

**`/creneaux` a changé de montage** (§9.12) : `[searchHeader, gridLayout]` au lieu du bandeau à
dropdowns, avec **six** groupes de filtres en colonne de gauche — les 4 statiques, plus deux facettes
**tirées du CoForm lui-même** (ALD, maladies chroniques), dont les options ne sont pas recopiées en
config. Les 8 cartes « Je cherche une activité pour… » de l'accueil portent enfin chacune leur
deep-link filtré : la promesse de leur sous-titre est tenue. Il a fallu deux correctifs moteur pour
y arriver — les valeurs de filtre contenant une virgule ne survivaient pas à l'URL, et les facettes
« par réponses » filtraient par identifiant d'organisation sur une liste qui porte les réponses
elles-mêmes (nouvelle clé de config `filterTarget`, que MSS est le seul site du parc à poser).

**Trois pannes silencieuses refermées** (§9.13) : le thème était amputé de `spacing`/`borderRadius`/
`shadows` — tout le site rendait à angles vifs et sans ombre pendant qu'`audit:config` annonçait
« theme:complet » ; la projection de `/structure` passait 25 champs là où le formulaire en écrit 55,
ce qui **détruisait en base** les champs non projetés à chaque édition (`payloadEmitEmptyOnEdit`) ;
et les liens `tel:`/`mailto:` — le seul canal de contact réellement joignable du site — renvoyaient
sur l'accueil en HTTP 200.

**Le formulaire de contact fonctionne enfin** (§9.13) : il ne poste plus sur `/api/contact`, route qui
n'a jamais existé, mais sur l'endpoint `CONTACT_SEND` du SDK. Un dernier maillon reste **hors
`site-json`** : le destinataire est résolu côté serveur depuis le costum, **`costum.contactMail`
d'abord et `costum.admin.email` seulement en repli**. Tant qu'aucune des deux n'est renseignée, le
legacy retombe sur `replyTo` et **renvoie le message à son auteur** (le backend Node, lui, refuse
explicitement).

**`/espace-pro` ne fuit plus.** Jusqu'au 21/08, la page était servie **intégralement** en HTTP 200 à
tout visiteur anonyme, listée au `sitemap.xml`, sans balise `robots` — le contenu réservé restait
visible environ une seconde avant l'expulsion vers `/login`. Aujourd'hui, mesuré sur la config MSS :
aucune de ses 8 sections n'est rendue (516 caractères de texte visible), `robots: noindex,follow`, et
11 URLs au sitemap pour 12 pages. Le parcours a changé **sans qu'un octet de la config MSS ne bouge** :
on reste sur `/espace-pro` et la modale de connexion s'ouvre par-dessus. Deux limites à connaître
(§12) : la garde protège l'**expérience**, pas la **donnée** — le texte de `/espace-pro` voyage
toujours dans le `window.__CONFIG__` de chaque page — et c'est une garde de **session** : tout compte
connecté entre, aucun contrôle « professionnel de santé ».

**Le site a une cible de déploiement** : application Coolify `site-json-ekilibre`, domaine d'amorce
`ekilibre.00.re`, et `VITE_COSTUM_FORCE_LIVE: "true"`. Mais **trois écritures Mongo doivent être
rejouées sur la base de prod avant tout déploiement** — sans elles la whitelist costum est vide et
les champs métier sont rabotés au save, en silence. Runbook en §9.11.

> **Journal récupéré.** Six commits `docs(mss)` (20-21/08) avaient écrit dans
> `doc-projets/mss-la-tampon-plan-corrections.md`, **supprimé du dépôt** par `53febb6e` sans que son
> contenu soit reversé ici. Les chantiers A à G qu'il portait sont réintégrés en §9.9 à §9.11.

</details>

<details><summary>Session 5 (18-19/08) — form créneaux dédié &amp; chantier Actualités</summary>

**Peterson** — le form créneaux dédié est désormais porté par l'orga `associationEkilibre`
elle-même** — « Formulaire de créneau du Tampon » `6a85af345d898a57cb49f029`, id humain
`associationEkilibre1`, section `associationEkilibre19082026_1327_0`. Plus AUCUN lien form/créneaux
avec SSBE, filtres CP retirés, résolution front par **ids d'inputs stables**, et **modèle costum
unique `AssociationEkilibre.php`** (l'étape intermédiaire MaisonSportSanteLeTampon + relais est
SUPPRIMÉE — « pas obligé de passer par MSS Tampon »). Déclaration `class.function` posée en base par
Peterson : **pipeline PROUVÉ de bout en bout** (recherche anonyme → « Basket collectif » Validé
aplati + structure jointe). Détail §9.8. Le 18/08 : **modération des créneaux par statut**
(`statusField`) — §9.6 bis, avec correctif « colonnes vides » (shape aplatie par le hook costum) ;
**pull `origin/ekilibre` intégré** (merge `main` `b8045fc6` : SDK **1.0.184**, `formatCell`
multivalué, fixes coform commonTable).

**Nicolas (session 5, 18-19/08)** — le chantier « Actualités » (costumForm `actualite` POI, onglet
admin CRUD, sections home « à la une + grille », fiche `/espace-pro`, mise en avant exclusive depuis
le tableau admin — §9.7) : REFONDÉ post-review MR 44 (2026-08-21) sur le **module Articles/Blog**
(articleFeed `featured:"flag"` + reader `/blog/:slug` + RSS) — le montage searchProStatic décrit
plus bas est PÉRIMÉ. La création exige le nœud `typeObj.article` du costum eki (posé en dev,
script `add-article-node.mjs` ; À REJOUER EN PROD avant déploiement). État antérieur revendiqué (**
photo comprise** (§9.7 ter). Après un réalignement sur la config réelle du costum backend (§9.7 bis),
le blocage de création venait de l'organisation porteuse `associationEkilibre` : pas de `costum.slug`
sur son propre document — sans lui, le backend ne résout jamais son costum et rejette toute création
avec un message trompeur. Diagnostiqué avec accès direct au backend PHP (`communecter-php74`),
corrigé en base par l'utilisateur (§9.7 ter, hors `site-json`). Deux écarts mineurs restants corrigés
dans la foulée : `link` ajouté côté backend, bloc `image` ajouté côté costumForm `actualite` (photo).
**Piste ouverte, non vérifiée** : le même oubli pourrait aussi expliquer la perte de champs de
`structure` en édition (§11/§12) — à retester. **2 constats de gates pré-existants, sans lien avec ce
lot**, toujours d'actualité (§12) : une route d'édition `structure` non bornée par costum, et le
dossier `public/images/associationEkilibre/` non déclaré dans `sites.json`.

</details>

<details><summary>Session 3 (06/08, deux intervenants — dates corrigées)</summary>

La précédente version de ce document datait par erreur toute la session 3 du 31/07 ; les commits
`348237e5`→`a524cf33` sont réellement du **06/08** : merge `main` → `ekilibre` résolu (`348237e5`,
Cael, 12:41) ; **renommage du costumForm `structure-ekilibre` → `structure`** + fiche détail dédiée
`PreviewStructure` (`253dec37`, Nicolas, 13:07 — §9.5 bis) ; **back-office `/admin` + tableau de
bord KPIs** CDC §4.2 (`2bf0007d`/`a524cf33`, Cael, 14:42 — §9.6) ; **nouveau chantier annoncé**
(non codé) : remplacement du flux **News** de la home par un **CRUD d'actualités porté en POI**
(§2, §4, §10 Lot E, §13). SDK **1.0.173** requis par `package.json` committé, mais **1.0.171
réinstallé sur ce poste** en fin de session (§12).

</details>

<details><summary>Historique des sessions précédentes (31/07, sessions 1–2)</summary>

Session 1 : création ; collecte git/config/gates ; revue « bonnes pratiques » + correctifs §9.2 bis ;
inputs coform §9.2 ter ; **lots commités** : `20fc3529` + `2bf81496` + doc `86a6f023` — **poussés sur
`origin/ekilibre`**.

Session 2 (31/07 PM) : auto-inscription structure — costumForm `structure-ekilibre` créé et
**commité par Nicolas** (`9fbe7c02` « add structure with step », 15:43) — la version antérieure de ce
document, rédigée avant ce commit, le décrivait à tort comme resté en working tree.

</details>

---

## 1. Contexte du projet

La **Maison Sport Santé du Tampon (Ekilib.re)** oriente les habitants du Tampon (bourg + Plaine
des Cafres) — territoire = **Le Tampon seul** (décision produit 2026-08-20 : Saint-Joseph retiré,
CP 97430/97418)
(La Réunion) vers des **créneaux d'activité physique adaptée** labellisés sport santé. Le projet
publie un site vitrine + annuaire de créneaux sur SiteForge. Il a longtemps été un **sous-site
territorial** du costum régional `sportSanteBienetre` (réseau Sport Santé Bien-être de La Réunion) ;
depuis la **bascule du 20/08 (§9.9)**, le costum `associationEkilibre` est **auto-porteur** et tous
les périmètres de recherche du site visent `sourceKey: ["associationEkilibre"]` seul. Les **créneaux**
vivent dans le **form dédié Tampon** `6a85af345d898a57cb49f029` (§9.8) ; les **structures** sont
soit possédées par le site, soit **référencées** fiche par fiche depuis le stock régional (§9.10),
et restreintes aux codes postaux **97430 / 97418**.

| | |
|---|---|
| **Site SiteForge** | slug `associationEkilibre` → [`config.prod.maison-sport-sante-la-tampon.json`](../config.prod.maison-sport-sante-la-tampon.json), CSS **`index-maison-sport-sante-la-tampon`** (**propre au site depuis le 23/09**, §9.19 — auparavant `index-sport-sante-bien-etre` partagé avec SSBE, cf. [`sites.json`](../sites.json)) |
| **Costum / scope de données** | **`associationEkilibre`** — auto-porteur depuis le 20/08 (§9.9). Les 6 périmètres de recherche du site déclarent `sourceKey: ["associationEkilibre"]`, que le serveur traduit en « possédée (`source.key`) **OU** référencée (`reference.costum`) ». `notSourceKey` : **0 occurrence** dans la config. Le préfixe des clés de champs answers reste celui du form dédié |
| **CoForm « créneau »** | **`6a85af345d898a57cb49f029`** « Créneau - tampon » (dédié, §9.8) — section `associationEkilibre19082026_1327_0` ; **1 créneau = 1 answer** ; ex-form SSBE partagé `6928096adf5caf0d230e7f26` jusqu'au 19/08 |
| **Orga porteuse** | slug `associationEkilibre`, `_id 692817af564b0621d52ebbc6`, type `organizations` (résolu au boot via `GET_ELEMENTS_KEY`) |
| **Backend (dev)** | environnement de dev local (configuration hors de ce document) ; backend de prod **à définir** |
| **SDK** | `@communecter/cocolight-api-client` — lecture seule. Requis **`^1.0.196`**, **installé 1.0.196** (mesuré le 08/10) : requis et installé coïncident, la désynchronisation récurrente de ce poste (§12) n'est plus d'actualité |
| **Branche site-json** | **`n-dev`** depuis la mi-septembre (lots §9.17 → §9.23, merges réguliers de `main` — derniers le 29/09 `9ed869ba` et le 07/10 `b5286b57`) ; dernier commit du site : `8cc2a9ef` (08/10). Avant : les lots `ekilibre` ont été mergés et le travail des 20-23/08 commité directement sur `main` (`c378525b`, 23/08) |
| **Intervenants (git)** | Francki (init 02/07) · Nicolas (config 20/07, 28/07 ; lot structure 31/07 + 06/08) · Peterson (lot créneaux 06/07) · Cael (merge + doc 06/08, back-office/KPIs 06/08) ; chef de projet **à confirmer** |

### Historique des chantiers

- **02/07 — init** (`9ee0024a`, Francki) : `feat: init ekilib.re` — config 10 pages (accueil,
  `/creneaux`, s'informer, rejoindre/soutenir, partenaires, espace pro, contact, 3 pages légales),
  header `transparent-scroll`, footer `contact-partners`, thème teal/orange (oklch), fr/en.
- **06/07 — analyse + lot « créneaux » (Peterson ; commité le 31/07, `2bf81496`)** : analyse fonctionnelle complète
  ([`FONCTIONNALITES-EKILIBRE.md`](../../FONCTIONNALITES-EKILIBRE.md)) + inventaire endpoints ; puis
  implémentation **création/modification de créneau** : `addButton.coform` (bouton « Ajouter un
  créneau », admins) + `preview.editButton` (bouton « Modifier » sur le détail), `CoFormModal` lazy,
  helper pur `getAnswerRef` (+ 9 tests), invalidations search, i18n fr/en. 3 fiches d'endpoints
  manquants déposées dans [`ENDPOINT.md`](../../ENDPOINT.md). Détail au §9.2.
- **20/07** (`63fe84f0`, Nicolas) : images du site (`public/images/maisonSportSanteLaTampon/` :
  hero2/hero3, logo MSS, pictogramme) + **filtre implicite `state = "Validé"`** sur `/creneaux`
  (modération par champ : seuls les créneaux validés sont listés).
- **28/07** (`ba93f7a0`, Nicolas) : **page `/structure`** (« Structure référentes ») — annuaire des
  organizations du costum SSBE (CP 97430/97418), cartes `contact-card` + drawer, 2 dropdowns :
  code postal (97430/97418) et **domaine d'intervention** (11 valeurs sur `tags`). Entrée nav ajoutée.
- **30/07 — merge `main` → `ekilibre`** (`6f4e83bf`) : rattrapage de ~304 commits de `main` —
  modules `blog`/`admin`, migration carte **Leaflet → MapLibre**, SDK requis `^1.0.169`, nouveaux
  scripts (`config:init/probe/render/fix`, `verify:build`, `admin:scaffold`), capacités search
  `itemRules`/`itemAction`/`colorBy`.
- **31/07 (session 2, Nicolas) — auto-inscription structure** (commité `9fbe7c02`, 15:43) : bouton
  public « Ajouter ma structure » sur `/structure` (`buttons` du `searchHeader`, contrat générique
  `ActionButtonSchema` + `<ActionButtonGroup>`/`DynamicModalButton`, **modules/profil** — zéro
  code nouveau pour le bouton) ouvrant le **premier costumForm du site** :
  `costumForms["structure-ekilibre"]` (moteur **formEngine**, cf. [doc/28](../doc/28-module-formengine.md)),
  wizard 5 étapes (structure · contact · légal · représentant · responsable). Seule clé de code
  ajoutée : `src/modules/profil/forms/costum/structure-ekilibre/fns.ts` (transform pur
  `thematic` → `tags`). Détail au §9.5.
- **06/08 (session 3, Cael, `348237e5` 12:41) — merge `main` → `ekilibre`** : résout 3 conflits
  (`doc-projets/README.md`, `modules/coform/components/CoFormReadOnly.tsx`, `modules/coform/types.ts`)
  et embarque le rattrapage de `main` (dont `institut-bleu`, `rezo-sante-reunion`, config-assistant).
- **06/08 (session 3, Nicolas, `253dec37` 13:07) — renommage `structure-ekilibre` → `structure` +
  fiche détail** : le costumForm et son dossier de code sont renommés (`structure-ekilibre/fns.ts` →
  `structure/fns.ts`, `structure-ekilibre.configDriven.test.ts` → `structure.configDriven.test.ts`),
  `modal: "add-structure-ekilibre"` → `"add-structure"` ; nouveau `preview.type: "structure"`
  (`PreviewStructure.tsx`, fiche détail complète : hero, affiliation, adresse+carte, représentant/
  responsable, documents) sur `/structure` (`detailsMode` passe de `drawer` à `dialog`) ; fix
  `CardContact` (téléphone objet `{mobile,fixe}` du costum SSBE) ; `defaultFields` posé sur la
  recherche structures (25 champs, pour que le preview et l'édition disposent des données) ;
  `responsableSameAsRepresent` passe de `select` (Oui/Non) à `switch` (+ `visibleIf op:"falsy"`) ;
  nouveau transform `number:fromDigits` (contournement typage costum, cf. §9.5 bis). Détail §9.5 bis.
- **06/08 (session 3, Cael, `2bf0007d`+`a524cf33` 14:42) — back-office `/admin` + KPIs (CDC §4.2)** :
  bloc `config.admin` (dashboard/membres/modération) + extension opt-in du moteur admin
  (`AdminDashboardKpiSchema`). Détail §9.6.
- **23/09 (Nicolas, `beef21d9`) — charte Ekilib.re & CSS propre au site** : `sites.json` bascule
  `associationEkilibre` sur `index-maison-sport-sante-la-tampon` (nouveau fichier, 290 lignes) ; le
  thème de la config passe du teal/corail hérité de SSBE au **bleu #1B4F72 / jaune #F0B429 / vert
  #1A7A55** du cahier des charges, en clair comme en sombre ; fermeture de l'auto-inscription
  (entrée de nav « Structure référentes » et bouton « Ajouter ma structure » retirés, `create: false`
  côté admin) ; cartes d'actualités en `cardVariant: "poster"` ; adresse postale complète, réseaux
  sociaux et copyright corrigés au pied de page ; liens `ssbe.re` en `www` + ancre. Détail §9.19.
- **07/10 (Nicolas, `678527cf`) — création de structure rouverte côté admin** : onglet admin
  Structures `create: false` → `create: "add-structure"` (costumForm `structure`). Le bouton public
  et l'entrée de nav restent retirés. Détail §9.22.
- **08/10 (Nicolas, `8cc2a9ef`) — timeline, notifications et réseaux sociaux** : parcours de
  prescription de `/espace-pro` en `timeline`, étapes d'inscription de `/s-informer` sans barre de
  progression, filtre « Type de Sport Santé » en tête de `/creneaux`, cloche de notifications,
  Facebook/LinkedIn dans les lignes de contact du pied de page (+ 2 icônes dans
  `FooterContactPartners.tsx`, puis table partagée `footer/socialIcons.ts` après la review de la
  MR 86). Orientation des étapes corrigée par `11377a04`. Détail §9.23.
- **06/08 (session 3, décision Nicolas, non codée) — chantier « Actualités » requalifié en POI** :
  le CDC (« Section Actualités » de la home + CRUD back-office titre/catégorie/date/contenu/lien/
  statut/mise en avant) sera implémenté via un **costumForm POI** dédié plutôt que via le module
  **News** existant (qui n'a ni catégorie fermée, ni statut brouillon/publié/archivé, ni mise en
  avant unique, ni date de publication planifiable — cf. §2, §4, §10 Lot E, §13).

---

## 2. Objectifs de la configuration

1. **Un site vitrine** (nav **6 entrées**, relevées le 23/09 : Trouver une activité · S'informer ·
   Actualités · Ressources · Partenaires · Contact, CTA « Espace Pro ») présentant la MSS, le parcours
   sport santé et ses partenaires. ⚠️ **`/structure` est sortie de la nav le 23/09** (§9.19) : la page
   existe toujours mais n'est atteignable que par le bouton « Structure référentes » du bandeau de
   `/creneaux`.
2. **L'annuaire des créneaux** (`/creneaux`) : recherche texte + **6 groupes de filtres en colonne
   de gauche** (type de sport santé — en tête depuis le 08/10, §9.23 —, type d'activité, type de
   public, bénéficiaires — puis **ALD** et
   **maladies chroniques**, tirés du CoForm lui-même), **vue carte**, détail en dialog — restreint
   aux créneaux **validés** du form dédié Tampon, périmètre `sourceKey: ["associationEkilibre"]`
   (§9.9, §9.12).
3. **La gestion des créneaux par les admins** : créer et modifier un créneau (= une answer du CoForm
   dédié `6a85af345d898a57cb49f029` depuis §9.8) **sans quitter le site** (CoFormModal) — commité le 31/07.
4. **L'annuaire des structures référentes** (`/structure`) : organizations SSBE du territoire,
   filtres CP + domaine d'intervention, **fiche détail dédiée** (`PreviewStructure`), grille
   **3 colonnes** et carte **50-50** depuis le 23/09. ~~**+ auto-inscription** : toute structure peut
   se référencer elle-même via un formulaire public~~ **FERMÉE le 23/09** (§9.19) : plus de bouton
   public — le costumForm `structure` sert l'**édition** (fiche `/structure`, onglet admin
   Structures) et, **depuis le 07/10, la création par un admin du site** depuis l'onglet Structures
   (§9.22). L'alimentation principale reste le **référencement** fiche par fiche (§9.10).
5. ~~Le flux d'actualités de l'association (home, lecture seule)~~ **remplacé** : section « Actualités »
   (une actualité à la une + grille, + fiche `/espace-pro`) pilotée en CRUD complet par l'admin
   (catégorie, date de publication, contenu riche, lien, statut, mise en avant unique) — porté en
   **POI** plutôt qu'en **News**, costumForm `actualite`, **codé le 10/08** (§9.7), **recette
   bloquée** tant que le costum backend `associationEkilibre` n'existe pas (§11).
6. **L'accès pro** : `/espace-pro` est **gardée** (`auth.required`). Depuis le 21/08, un anonyme n'est
   plus expulsé vers `/login` — il **reste sur la page**, ses sections cèdent la place à une invitation
   et la modale de connexion s'ouvre par-dessus (§9.13). Garde de **session** : tout compte connecté
   entre, il n'y a pas de contrôle « professionnel de santé » (§12).
7. **Le pilotage admin** : back-office `/admin` à **sept onglets** (Tableau de bord, Membres,
   Actualités, **Ressources**, Structures, Référencement, Modération), niveau `siteAdmin`, et
   4 KPIs du CDC §4.2 (§9.6, §9.10, §9.14).
8. **Un formulaire de contact** opérationnel — **câblé sur l'endpoint `CONTACT_SEND` du SDK depuis le
   23/08** (§9.13) ; reste à renseigner **`costum.contactMail`** en base pour que le message atteigne
   la MSS (§13).

---

## 3. Architecture générale

```
            Communecter (backend) / costum associationEkilibre (auto-porteur, §9.9)
     answers du CoForm 6a85af345d898a57cb49f029 (créneaux) · organizations (structures) · POI type:"article"
                  ▲ GLOBAL_AUTOCOMPLETE_COSTUM · SAVE_COFORM_ANSWER · CONTACT_SEND
                  │   périmètre unique : sourceKey ["associationEkilibre"]
                  │   → traduit serveur en  $or[ source.keys , reference.costum ]
                  │
   ┌────────────── SiteForge (site-json, branche main) ───────────────────┐
   │  config.prod.maison-sport-sante-la-tampon.json → SiteRenderer        │
   │   /creneaux : searchHeader (titre + 2 CTA, plus de dropdowns)        │
   │     + gridLayout [ filters (6 groupes) | searchProStatic ]           │
   │     defaultFilters = { form, state:"Validé" } + sourceKey            │
   │     4 groupes statiques  ·  2 facettes CoForm (ALD, maladies)        │
   │       filterTarget:"answers" → prédicat $exists sur le chemin        │
   │     addButton.coform → CoFormModal (création)                        │
   │     card.structureAction:"preview" → fiche structure EN MODALE       │
   │   /structure (HORS NAV depuis 23/09) : searchHeader (2 dropdowns)    │
   │     + searchProStatic (grille 3 col. · carte 50-50)                  │
   │     sourceKey ["associationEkilibre"] + statusActor:"Validé" + CP    │
   │     defaultFields : 55 champs (projection complète, §9.13)           │
   │     plus de bouton "Ajouter ma structure" (§9.19) — édition seule    │
   │   /admin : 7 onglets — dashboard · membres · actualités ·            │
   │     ressources · structures (add-structure, restrictActionsToOwned) ·│
   │     référencement · modération                                       │
   │   / · /espace-pro · /blog : articleFeed (module blog)                │
   │     featured:"flag" (une résolue par micro-requête serveur)          │
   │     cardVariant:"poster" sur / et /blog (affiches, §9.19)            │
   │     /blog : searchHeader + facette Catégorie · reader /blog/:slug    │
   │   /espace-pro : GARDÉE (auth.required, mode prompt) — §9.13          │
   └──────────────────────────────────────────────────────────────────────┘
          dev : variables d'environnement locales (.env) → :5173
          prod : Coolify `site-json-ekilibre` · ekilibre.00.re · VITE_COSTUM_FORCE_LIVE
```

**Deux voies de filtrage** (toutes config-driven, cf. [doc/07](../doc/07-module-search.md)) :
- **figée** : `baseParams` — sur `/creneaux` : `sourceKey: ["associationEkilibre"]`, `form` (dédié
  Tampon) et le champ d'état `"Validé"` ; sur `/structure` : `sourceKey: ["associationEkilibre"]`,
  `statusActor: "Validé"` et `postalCode.$in [97430, 97418]`. Le `source.key.$in` à deux provenances
  du 31/07 est **renversé** depuis la bascule (§9.9).
- **interactive** : depuis le 22/08, `/creneaux` passe par la **section `filters`** du `gridLayout` —
  4 groupes `filterGroups` à `field` (→ `{ field: { $in: [...] } }`) et 2 groupes `filtersByAnswers`
  portant `filterTarget: "answers"` (→ prédicat `$exists` sur le chemin de la réponse, cf.
  [doc/07](../doc/07-module-search.md)). `/structure` garde ses 2 `dropdownFilters` de `searchHeader`.

> ⚠️ **Deux grammaires, deux pièges distincts.** Un `filterGroups`/`dropdownFilters` recopie ses
> options **en config** : elles se désynchronisent en silence du CoForm (c'est ce qui rendait deux
> valeurs de « Bénéficiaires » inertes, §9.12). Un `filtersByAnswers` lit les siennes **du formulaire**
> et ne peut pas mentir — mais s'il oublie `filterTarget: "answers"` sur une liste d'`answers`, il
> s'affiche normalement et **vide la liste au clic** (§9.12).

**Cycle de vie d'un créneau** (lot 06/07) : pas d'endpoint « create » — `form.answer()` (draft
local) → `answer.save()` → `SAVE_COFORM_ANSWER` (sans `answerId` = création, avec = édition).
L'édition **re-fetch l'answer fraîche** (`useCoFormAnswerQuery`) avant d'ouvrir la modale : les
résultats de recherche peuvent être tronqués et le save renvoie le payload **complet** — pré-remplir
depuis l'item de recherche effacerait des champs. Après save : invalidation
`SEARCH_QUERY_KEYS.RESULTS_PREFIX` (liste + carte) + `COFORM_QUERY_KEYS.FORM_ANSWER`.

> ⚠️ Le mapping rôle→champ du créneau (titre, type, état, horaires, adresse…) vit dans
> **`DEFAULT_COFORM_FIELDS`** ([`lib/coformAnswer.ts`](../src/modules/search/lib/coformAnswer.ts)),
> surchargeable par `preview.fields` en config. Les suffixes (`…mdegc9sgox76p87n27` = titre,
> `…mdn1jcq445i0mb9bap7` = état, `…mdr0xcsmmpnr6ez17q` = adresse…) sont ceux du form SSBE.

---

## 4. Cahier des charges (intégré)

**Aucun CDC formel n'est disponible dans le dépôt** — le périmètre ci-dessous est reconstitué de la
config et des échanges (à faire valider). Budget/phasage : **à confirmer**.

| Domaine | Exigence (reconstituée) | Réalisation |
|---|---|---|
| Vitrine | présentation MSS, parcours d'inscription, idées reçues, bénéfices APA | pages `/`, `/s-informer` (statiques) |
| Créneaux | annuaire filtrable + carte, réservé au territoire (Le Tampon), créneaux validés seulement | `/creneaux` (searchProStatic answers) |
| Gestion créneaux | ajout + modification par les admins, depuis le site | lot 06/07 (`addButton.coform`, `editButton`) |
| Structures | annuaire des structures référentes + domaines d'intervention | `/structure` (28/07) |
| Engagement | bénévolat, comité des usagers, don (HelloAsso en lien externe) | `/rejoindre-soutenir` (hors nav, liée depuis la home) |
| Pros de santé | ressources, prescription, PandaLab, connexion | `/espace-pro` (CTA header) + auth |
| Contact | formulaire (RGPD) | `/contact` — **6 champs** (name, email, phone, subject, message, rgpd) ; **opérationnel depuis le 23/08** via `CONTACT_SEND` (§9.13). Reste **`costum.contactMail`** à renseigner en base (§13) |
| Légal | mentions, confidentialité, accessibilité | 3 pages `html` |
| Pilotage (CDC **4.2**) | tableau de bord admin : créneaux actifs (+ évolution mensuelle), usagers actifs (analytics RGPD), signalements en attente, pros inscrits en attente de validation | back-office `/admin` (§9.6, 06/08) — 2 KPIs branchés sur données réelles, 1 dérivé (modération), 1 **à raccorder** (analytics) |
| Actualités (CDC, cité ci-dessous) | home : 1 actualité à la une + grille secondaire ; back-office : CRUD complet | ✅ **codé le 10/08, opérationnel le 19/08** — costumForm `actualite` (POI), onglet admin, home + `/espace-pro` (§9.7) ; création réelle confirmée en base, photo comprise (§9.7 ter) |

**Détail CDC — Actualités** (retranscrit tel que fourni par l'utilisateur le 06/08, à faire valider
avec la MSS) :

> Page d'accueil — Section Actualités : une actualité mise en avant (featured) + grille d'actualités
> secondaires. Règle de gestion : les actualités sont gérées depuis le back-office (titre, catégorie,
> date, contenu, statut Publié/Brouillon) par l'admin du site.

Gestion des actualités (CRUD complet, champs CDC) :

| Champ | Type / règle |
|---|---|
| Titre * | texte court |
| Catégorie * | énumération fermée : Nouveau créneau · Évènement · Information santé · Fermeture/modification · Autre |
| Date de publication * | date picker · **planification possible** (publication différée) |
| Contenu * | texte riche (éditeur WYSIWYG en production) |
| Lien associé | URL optionnelle |
| Statut | Publié · Brouillon · Archivé |
| Mise en avant | toggle « À la une » — **1 seule actualité à la fois** en featured |

Pourquoi POI plutôt que News (constat, à confirmer avec l'utilisateur) : le module **News**
(`doc/09-module-news.md`) gère déjà un CRUD (`AddNewsModal`/`EditNewsModal`), mais c'est un flux
social **text-first** (réactions, commentaires, mentions) sans catégorie fermée, sans statut
brouillon/publié/archivé, sans « mise en avant » unique ni date de publication planifiable. Le
moteur search sait déjà rendre des **POI** avec des champs custom pilotés par un `costumForm`
(même mécanisme que `structure` sur les organizations, cf. §9.5 bis) — pattern déjà éprouvé sur ce
site pour porter un contenu structuré sans code nouveau.

---

## 5. Modèle de données réel

> L'accès base directe n'est pas disponible sur ce poste — chiffres **à confirmer** (mes comptages
> via SDK/curl du 31/07 ont échoué sur la validation du payload `GLOBAL_AUTOCOMPLETE_COSTUM` ;
> relevé navigateur à faire). Ce qui est **prouvé** au 31/07 :

- **Entité porteuse** : slug `associationEkilibre` → `{contextId: 692817af564b0621d52ebbc6,
  contextType: organizations}` (répondu par `/co2/slug/getinfo` le 31/07) — le boot du site marche.
- **Créneaux** = answers du CoForm dédié `6a85af345d898a57cb49f029` (§9.8), champs sous
  `answers.associationEkilibre19082026_1327_0.<fieldKey>` ; le site n'affiche que
  `state="Validé"` → un créneau non validé est **invisible, sans erreur** (plus de condition CP :
  le form dédié est le périmètre).
- **Structures** = organizations du périmètre `sourceKey: ["associationEkilibre"]` — c'est-à-dire
  **possédées** (`source.key`) *ou* **référencées** (`reference.costum`) — filtrées par
  `statusActor: "Validé"` et CP ∈ {97430, 97418}. Le `source.key.$in` à deux provenances du 31/07 est
  **renversé** depuis le 20/08 (§9.9) : la coexistence avec le stock régional ne passe plus par un
  élargissement de provenance mais par une **curation fiche par fiche** (§9.10). 14 organisations du
  Tampon ont été référencées le 20/08 sur la base de DEV, **par l'action admin** et non par écriture
  Mongo directe. Domaine d'intervention = valeurs libres de `tags` (**11 options** littérales en
  config, cf. §9.5 bis).
- **Modération des structures** : champ `statusActor` à quatre états (« En attente », « En cours »,
  « Validé », « Refusé »), au patron `statusField`. Il **n'est pas un champ du formulaire** (44
  champs, aucun `statusActor`) : il est écrit à la création par l'inject (`"En cours"`) puis
  uniquement par le dropdown de l'onglet admin Structures. Une structure auto-inscrite **naît donc
  invisible** — la modération est le sas. ⚠️ **Depuis le 23/09 (§9.19) plus de bouton public** ;
  la création ne passe plus que par l'onglet admin Structures (fermée du 23/09 au 07/10, rouverte
  §9.22) — une structure créée là naît donc « En cours » et n'apparaît sur `/structure` qu'une fois
  passée à « Validé ». Le gros du stock se constitue par **référencement** (§9.10).
- **Actualités** = POI `type: "article"`, périmètre `associationEkilibre`, publiés par le **module
  blog** (`articleFeed`, reader `/blog/:slug`, RSS). Formulaire `actualite` à **9 champs** (name,
  image, category, publicationDate, shortDescription, description, tags, link, publicationStatus) —
  `featured` en a été **retiré** (§9.13). Statut `publicationStatus` à 3 états (Brouillon / Publié /
  Archivé), défaut **Brouillon**, au même patron `statusField`. **Des articles réels existent en
  base** depuis le 19/08.
- **Volumétrie** : nombre de créneaux/structures en base **à confirmer** (le SSR du 31/07 rend les
  pages 200 mais les listes en skeleton — prefetch non observé, cf. §10.3).

> ⚠️ **Valeurs littérales exactes.** Les options des dropdowns (`"Sports collectifs"`,
> `"Santé/prévention"`, `"Sport santé sur ordonnance - SSsO"`…) et le `state` (`"Validé"`, avec
> accent) doivent correspondre **au caractère près** aux valeurs saisies dans les answers/tags —
> un écart renvoie 0 résultat sans erreur. Copier-coller depuis le form/costum, ne jamais retaper.

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| **Config & CSS** | [`config.prod.maison-sport-sante-la-tampon.json`](../config.prod.maison-sport-sante-la-tampon.json) · **`src/index-maison-sport-sante-la-tampon.css`** (propre au site depuis le 23/09, §9.19 ; importe `styles/shared.css`, toujours commun avec SSBE) · [`sites.json`](../sites.json) |
| **Lot créneaux (06/07, commité le 31/07 — `2bf81496`)** | `src/modules/search/schema.ts` (`addButton.coform`, `preview.editButton`) · `SearchProStatic.tsx` (bouton + CoFormModal lazy + invalidation) · `components/preview/PreviewCoformAnswer.tsx` (bouton Modifier + re-fetch) · `components/Preview.tsx` (pass-through `preview`) · `lib/coformAnswer.ts` (`getAnswerRef`) + `lib/coformAnswer.test.ts` (nouveau) · `constants/queryKeys.ts` (préfixes partagés) · `i18n/fr.json`/`en.json` (`coformAnswer.edit`) · `modules/coform/components/CoFormModal.tsx` (export default) · `modules/coform/index.ts` (barrel `useCoFormAnswerQuery`) |
| **Droits d'édition (31/07)** | `lib/coformAnswer.ts` (`canEditCoformAnswer`, `getAnswerStructureId`) + `lib/coformAnswer.test.ts` · réutilise `modules/admin/lib/adminEntry.ts` (`resolveAdminAccessLevel`, non modifié) |
| **Rendu créneau (lecture)** | `components/card/CardAnswer.tsx` (intact — le remap de slug vit dans `parseCoformAnswer`) · `lib/coformAnswer.ts` (`DEFAULT_COFORM_FIELDS`, `parseCoformAnswer`) |
| **Auto-inscription structure (31/07 → 06/08, commité `9fbe7c02` + `253dec37`)** | `config.prod.maison-sport-sante-la-tampon.json` (`costumForms["structure"]`, `buttons` du `searchHeader` `/structure`, `defaultFilters.source.key.$in`, `defaultFields`) · `src/modules/profil/forms/costum/structure/fns.ts` (**seul fichier de code du formulaire**, transforms `structure:tagsFromThematic` + `number:fromDigits`) · `src/modules/profil/forms/registerSpecFns.ts` (barrel, +1 ligne) · `src/modules/profil/forms/costum/__fixtures__/configCostum.ts` (fixture test, +1 ligne) · `src/modules/profil/forms/structure.configDriven.test.ts` (renommé, 40 tests) — moteur réutilisé tel quel : `formEngine` (doc/28), `ActionButtonSchema`/`<ActionButtonGroup>`/`DynamicModalButton` (modules/profil, préexistants) |
| **Fiche détail structure (06/08, `253dec37`)** | `src/modules/search/components/preview/PreviewStructure.tsx` (nouveau, ~540 lignes) · `src/modules/search/components/Preview.tsx` (dispatch `preview.type: "structure"`) · `src/modules/search/components/card/CardContact.tsx` (fix téléphone objet `{mobile,fixe}`) · `src/modules/search/constants/queryKeys.ts` (`DOCUMENTS`) · `src/modules/search/schema.ts` (enum `PreviewConfSchema.type` + `"structure"`) · `src/modules/search/i18n/{fr,en}.json` (clés `PreviewStructure.*`) |
| **Back-office `/admin` + KPIs (06/08, `2bf0007d`)** | `config.prod.maison-sport-sante-la-tampon.json` (bloc `admin`) · `src/modules/admin/schema.ts` (`AdminDashboardKpiSchema`) · `src/modules/admin/sections/DashboardKpis.tsx` (nouveau) · `src/modules/admin/sections/DashboardSection.tsx` · `src/modules/admin/lib/kpiTrend.ts` + `.test.ts` (nouveaux) · `src/modules/admin/constants/queryKeys.ts` (`KPI_SEARCH_PREFIX`) · `src/modules/admin/i18n/{fr,en}.json` — détail §9.6 |
| **Actualités (10/08, codé — §9.7)** | `config.prod.maison-sport-sante-la-tampon.json` (`costumForms["actualite"]`, onglet admin, sections home + `/espace-pro`) · `src/modules/admin/schema.ts` (`rowActions:"setFeatured"`, `exclusiveField`) · `src/modules/admin/lib/exclusiveFlag.ts` (+ `.test.ts`, nouveau) · `src/modules/admin/hooks/useSetExclusiveFlag.ts` (nouveau) · `src/modules/admin/sections/AdminResourceTable.tsx` (bouton « Mettre à la une ») · `src/modules/admin/i18n/{fr,en}.json` · `src/modules/profil/forms/actualite.configDriven.test.ts` (nouveau, 8 tests) · `src/modules/profil/forms/costum/__fixtures__/configCostum.ts` (+1 ligne) — **2 correctifs moteur** : `src/modules/formEngine/config/schema.ts` (`WidgetKind` + `"markdown"`), `src/modules/profil/forms/costum/compileCostumSchema.ts` (`WIDGET_DEFAULTS` + `"markdown"`) — aucun nouveau composant de carte (réutilise `card.type/preview.type:"resource"`, existant) |
| **Ressources pro (24/08, `edb20de6` — §9.14)** | `config.prod.maison-sport-sante-la-tampon.json` (`costumForms["ekilibre-ressource"]`, page `/ressources`, entrée de nav, onglet admin `ressources`, route `profiles.poi.editModals`) — **0 code front** : réutilise `formEngine` (widgets `file`/`urlList`/`select`), presenters `card.type/preview.type:"resource"`, table admin `resource` en mode `statusField` · backend : `EkilibreMigrationController::declarePoiTypes` (costum repo `7ce80d9f0`) |
| **Reprise des créneaux SSBE — `answerCopy` (23/09, §9.21)** | `config.prod.maison-sport-sante-la-tampon.json` (onglet admin `creneaux-ssbe`) · `src/modules/admin/schema.ts` (`AdminAnswerCopySectionSchema`) · `src/modules/admin/lib/answerCopy.ts` (+ `.test.ts`) · `src/modules/admin/hooks/useCopyAnswer.ts` · `src/modules/admin/sections/AdminAnswerCopySection.tsx` (+ `.test.tsx`) · `AdminSectionRenderer.tsx`, `constants/queryKeys.ts`, `sections/resourceHelpers.ts` (`STATUS_TONE_CLASS` partagé), `i18n/{fr,en}.json` · [`doc/30-module-admin.md`](../doc/30-module-admin.md) · backend : `citizenToolKit/models/Coform.php` (`copyAnswer`, `resolveAnswerSource`), `survey/controllers/answer/NewanswerAction.php` (`action:copy`), `costum/models/AssociationEkilibre.php` (hook par suffixe), `costum/controllers/EkilibreMigrationController.php` (`copyAnswer` URL) · [`../../ENDPOINT.md`](../../ENDPOINT.md) (extension `GENERATE_ANSWER_FROM_FORM`) · `src/modules/admin/components/AdminTableShell.tsx` (nouveau, partagé avec `reference`) · `src/modules/search/hooks/{useSearchQuery,useSearchAllResults}.ts` (additif : `isFetching`, `isPending`, `cache`, `capped` exact) |
| **Compteurs stats dynamiques (08/09, `21f0d53f` — §9.15)** | `src/types/site-schema.ts` (`StatDynamicSourceSchema`, `source` sur `CtaCardGridSchema.props.stats[]`) · `src/components/sections/useStatDynamicValue.ts` (nouveau) + `.test.ts` (nouveau, 6 tests) · `src/components/sections/CtaCardGrid.tsx` (`StatTile`) · `config.prod.maison-sport-sante-la-tampon.json` (item « Créneaux disponibles ») — moteur générique, **aucun autre site impacté** (4 autres configs `cta-card-grid` toujours valides sans `source`) |
| **Charte Ekilib.re & CSS propre (23/09, `beef21d9` — §9.19)** | `src/index-maison-sport-sante-la-tampon.css` (nouveau, 290 lignes) · [`sites.json`](../sites.json) (`css` du slug) · `config.prod.maison-sport-sante-la-tampon.json` (`theme.colors` clair+sombre, `theme.customCSS`, nav, `/structure`, `articleFeed`, footer, liens `ssbe.re`) · `public/images/maisonSportSanteLaTampon/logo.svg` — **0 code applicatif** |
| **Assets** | `public/images/maisonSportSanteLaTampon/` (hero, hero2/3, logo, logo-mss, pictogramme) |
| **Docs workspace** | [`../../FONCTIONNALITES-EKILIBRE.md`](../../FONCTIONNALITES-EKILIBRE.md) · [`../../ENDPOINT.md`](../../ENDPOINT.md) |
| **Déploiement** | `server/prod-server.js` · variables d'environnement (`.env` local, non détaillées ici) — prod à définir |

---

## 7. Choix techniques et leur pourquoi

| Décision | Pourquoi |
|---|---|
| **Sous-site du costum `sportSanteBienetre`** (pas un costum dédié) | les structures existent déjà dans SSBE (vue territoriale CP 97430/97418). Évolution 19/08 (§9.8) : les **créneaux** sont sortis du form partagé → form dédié Tampon (le contexte costum reste SSBE : hooks backend communs) |
| ~~**CSS partagé `index-sport-sante-bien-etre`**~~ **CSS propre `index-maison-sport-sante-la-tampon`** (23/09, §9.19) | la DA a divergé : la charte Ekilib.re porte un accent **jaune** (clair), là où les recettes SSBE (« Lagon & Corail ») supposent un accent **corail** portant du texte clair. Sous la nouvelle palette, la carte `.access-card-public` dégradait l'accent vers `--destructive` : **2,55:1** avec le texte foncé de l'accent (mesuré). Séparer le fichier était moins risqué que de paramétrer les recettes SSBE pour deux chartes. `styles/shared.css` et tous les composants restent communs |
| **Accent clair ⇒ texte foncé** (23/09) | `--accent` (jaune #F0B429, L .80) ne peut pas porter `text-primary-foreground` (quasi-blanc en clair) : **1,81:1** mesuré. Deux réponses selon le composant : soit le texte passe en `--accent-foreground` (**7,34:1** sur le jaune plein), soit le jaune est **creusé** vers le noir (`color-mix … 62%/85%`) quand le composant partagé impose son texte clair (`CardAnswer`, en-têtes de carte, cartes SSsO) — et par **mode**, puisque `primary-foreground` s'inverse en sombre alors que l'accent reste clair |
| **Tokens du thème en config, recettes en CSS** (23/09) | le fichier de site ne redéfinit aucun token shadcn : `config.theme` les injecte au runtime (`SiteTheme.tsx`). Le CSS ne garde que le `@theme inline` (mapping vars→classes), les vars bespoke réellement consommées par des composants (`--card-header-gradient`, `--btn-structure`, `--gradient-hero/-pro/-section`) et les utilities — un seul point de vérité pour les couleurs, et la variante sombre suit toute seule |
| **1 créneau = 1 answer CoForm** (pas un POI/event) | le form créneau (SSBE puis Tampon `…2004_0`, mêmes 91 inputs) porte tous les champs métier (horaires, bénéficiaires, adresse) ; le moteur search sait lister des answers (`defaultTypes:["answers"]` + `filters.form`) |
| **`addButton.coform` / `preview.editButton` = opt-in config** | 2 autres sites utilisent `card-answer`/`coform-answer` (SSBE) — sans ces flags, **comportement strictement inchangé** ailleurs |
| **CoFormModal (pas la route `/coform/:formId`)** | l'admin reste sur `/creneaux`, et le save invalide la liste immédiatement (la route perdrait l'état des filtres) |
| **Re-fetch frais avant édition** (`useCoFormAnswerQuery`) | le save coform renvoie le payload **complet** ; pré-remplir depuis l'item de recherche (potentiellement tronqué) effacerait des champs |
| **Modération par champ `state="Validé"`** (filtre figé, 20/07) | pas de gate backend `toBeValidated` sur ce flux ; le champ état du form fait office de modération — simple mais **dépend de la saisie** (§12) |
| **Filtre CP figé dans `defaultFilters`** | périmètre territorial garanti côté requête (pas seulement à l'affichage) |
| **Auto-inscription = costumForm `formEngine` + `buttons` génériques** (aucun composant nouveau) | le contrat `ActionButtonSchema`/`<ActionButtonGroup>`/`DynamicModalButton` (modules/profil) et le moteur `formEngine` (doc/28) existaient déjà (merge du 30/07) ; Ekilibre n'ajoute que de la **config** + 1 transform pur (`thematic`→`tags`) |
| ~~**`requiresAdmin: false` sur le bouton « Ajouter ma structure »**~~ **DÉCISION RENVERSÉE le 23/09** (§9.19) | le bouton public est retiré et l'admin passe en `create: false` : plus aucune création de structure depuis le site. Le stock se constitue par **référencement** de fiches existantes (§9.10), cohérent avec « la propriété porte les fonctionnalités, le référencement porte la visibilité ». Le costumForm `structure` est conservé — il sert l'**édition** (fiche `/structure` + onglet admin). **Motif métier à confirmer avec la MSS** (§13). **Création admin rouverte le 07/10** (§9.22, `create: "add-structure"`) ; le bouton public reste retiré |
| **Cartes d'actualités en `cardVariant: "poster"`** (23/09) | les actualités de la MSS sont des **affiches/flyers** : le variant `poster` du module blog rend l'image entière (`object-contain`, cadre portrait 3/4) au lieu de la rogner. Choix par config, aucun composant nouveau — posé sur `/` et `/blog`, pas sur `/espace-pro` |
| ~~**`source.key` élargi en `$in` plutôt que remplacé**~~ **DÉCISION RENVERSÉE le 20/08** | la coexistence avec le stock régional ne passe plus par un élargissement de provenance mais par un **périmètre unique** `sourceKey: ["associationEkilibre"]`, que le serveur traduit en « possédée **OU** référencée ». Motif : un `$in` de provenances rend le site propriétaire de fiches qu'il ne gère pas, et rend impossible tout gating par appartenance (§9.9, §9.10) |
| **La propriété porte les fonctionnalités, le référencement ne porte que la visibilité** (20/08) | permet de montrer une fiche régionale sur `/structure` **sans** s'en attribuer l'édition. Une fiche seulement référencée est en lecture seule : `restrictActionsToOwned: true` masque Modifier / Valider / Supprimer et le dropdown de statut. Corollaires assumés : **pas** de `transfersource` du stock ssbe, **pas** de référencement automatique — une curation fiche par fiche via l'onglet admin Référencement |
| **`filterTarget: "answers"` sur les deux facettes pathologie** (22/08) | `/creneaux` liste les **réponses** ; sans cette clé, une facette « par réponses » filtre par `_id` d'organisation et **vide la liste au clic** en s'affichant normalement. MSS est le seul site du parc à la poser. La clé doit être écrite **explicitement** : la config n'est jamais parsée par Zod à l'exécution, le défaut `linkedElements` vit en dur dans le code |
| **Facettes tirées du CoForm plutôt que recopiées en config** (22/08) | les 4 groupes statiques recopient leurs options : elles se désynchronisent en silence du formulaire (deux valeurs de « Bénéficiaires » étaient inertes, §9.12). Les 2 groupes pathologie déclarent `forms` + `path` et lisent les options **du formulaire** — ils ne peuvent pas mentir, et un groupe sans option remontée est simplement invisible |
| **`featured` retiré du formulaire actualité** (21/08) | le save form-urlencodé du legacy stringifie les booléens : `featured` était stocké en **chaîne** `"true"`, que ni la micro-requête `{featured:true}` ni le test `=== true` du tableau admin ne reconnaissent. L'action admin « Mettre à la une » devient l'**unique écrivain** — même patron qu'un seul écrivain pour `statusActor` |
| **Renommage `structure-ekilibre` → `structure`** (06/08) | le préfixe `ekilibre` était redondant (le costumForm vit déjà dans la config du site Ekilibre) ; nom plus court, aligné sur `entityType: "organizations"` |
| **`number:fromDigits` (contournement, pas `coerce:number`)** | le costum SSBE déclare `siren`/`representativeTelephone`/`personInChargeTelephone` en `number` par artefact d'inférence (les données réelles sont des chaînes) ; `coerce:number` renverrait `undefined` sur tout séparateur/indicatif, perdant le champ. Le transform ne garde que les chiffres — pertes assumées (`+`, zéro initial) documentées dans le fichier ; correctif définitif attendu côté artefact costum (§11) |
| **Actualités portées en POI, pas en News** (décision 06/08) | le CDC exige catégorie fermée, statut brouillon/publié/archivé, mise en avant unique et date de publication planifiable — absents du module News (flux social lecture/commentaires/réactions) ; le pattern `costumForm` + `formEngine` déjà utilisé pour `structure` couvre ce besoin sans code nouveau |
| **Stats dynamiques de la home indépendantes du module `admin`** (08/09, §9.15) | le contrat calque celui des KPIs admin (`AdminDashboardKpiSchema`), mais la section publique ne doit dépendre que de hooks déjà publics (`useSearchAllResults`, `useEntityMembers`) — jamais du module `admin`, chargé à part et gardé `siteAdmin` |
| **`value` optionnel + skeleton plutôt qu'un chiffre imposé** (08/09, §9.15) | `value` reste le repli immédiat si fourni (anti-flash SSR) ; sans lui, un skeleton comble l'attente le temps du fetch client — dans les deux cas, jamais de chiffre inventé si la source échoue ou tarde |

---

## 8. Étapes de mise en place

1. **Config** : `config.prod.maison-sport-sante-la-tampon.json` + entrée `sites.json`
   (`associationEkilibre` → config + CSS **`index-maison-sport-sante-la-tampon`** depuis le 23/09). ✅
2. **Dev** : configurer les variables d'environnement locales (`.env`, non détaillées dans ce
   document), puis `nvm use` + `npm run dev` → :5173. ⚠️ Prérequis poste :
   `fs.inotify.max_user_watches=524288` (réglé le 06/07 sur le poste de Peterson).
3. **Après chaque merge de `main`** (30/07 puis 06/08) : `npm install`, puis re-passer les gates. 🟡
   refait le 06/08 (session 3, SDK 1.0.173) mais **désynchronisé de nouveau en fin de session** sur
   ce poste (1.0.171 installé, §12) — sans erreur observée à ce jour.
4. **Validation** (gates) : `npm run config:validate -- config.prod.maison-sport-sante-la-tampon.json`
   · `npm run audit:config -- --file …` · `npm run typecheck` · `npm run lint` · `npm run test:unit`
   · `npm run build` (+ `npm run verify:build` depuis le merge).
5. **Commit / MR des lots** (créneaux + structure + admin, tous commités et poussés sur
   `origin/ekilibre`) → **MR `ekilibre` → `main` restant à ouvrir**. 🟡
6. **Déploiement** : backend de prod + DNS **à définir** ; build mono-slug
   (`SITE_CONFIG_PATH=./config.prod.maison-sport-sante-la-tampon.json`, `SITE_PUBLIC_URL=<domaine>`,
   + variables d'environnement non détaillées ici). ❌

---

## 9. Impacts des modifications

### 9.1 Init + config Nicolas (02→28/07, commitées)

`9ee0024a` (10 pages) → `63fe84f0` (images + filtre `state="Validé"`) → `ba93f7a0` (page
`/structure` + 2 dropdowns). Config à 11 pages / 44 sections, nav 5 entrées + CTA Espace Pro.
Pages hors nav (liées depuis la home/footer) : `/rejoindre-soutenir`, `/espace-pro`, 3 légales.

### 9.2 Lot « créneaux » (06/07, Peterson — commité le 31/07, `2bf81496`)

**Moteur** (opt-in, sans effet sans config) : `AddButtonConfigSchema.coform` (le bouton « Ajouter »
existant — déjà gated `permissions.isAdmin` + login — ouvre un `CoFormModal` de création au lieu
d'une modale d'entité, chunk coform chargé **au 1er clic**) ; `PreviewConfSchema.editButton`
(bouton « Modifier » admin sur le détail `coform-answer`, re-fetch frais puis `CoFormModal`
d'édition) ; préfixes de queryKey `searchCostumStatic(MapAll)` extraits en constantes partagées ;
helper pur `getAnswerRef` + **9 tests** ; fix pass-through `preview` dans `Preview.tsx` ;
`export default CoFormModal` ; clé i18n `coformAnswer.edit` fr/en.

**Config** : `addButton {show, coform, label}` + `preview.editButton:true` sur `creneaux-list`.

**Gates au 06/07** (avant le merge du 30/07) : lint 0 erreur sur le lot · unit 1537 ✅ (dont les 9
nouveaux) · `config:validate` ✅ · parité i18n ✅ · typecheck : uniquement les 2 erreurs
pré-existantes SDK (`deleteFiles`, `inviteByEmail`) · intégration SSR : échecs **identiques sur
arbre propre** (cause : configuration locale du serveur de test — environnemental, prouvé par stash).

**Reste sur ce lot** : commit + MR ; recette navigateur connecté en admin (créer/modifier un vrai
créneau) ; la **suppression de fichiers uploadés à l'édition** dépend de `Answer.deleteFiles`
(SDK ≥ 1.0.158, cf. §11).

### 9.2 bis Revue « bonnes pratiques » du lot + correctifs (31/07, dans `2bf81496`)

Revue du lot contre [`bonnes-pratiques-code.md`](../../bonnes-pratiques-code.md). Nécessité : 8 des
11 fichiers justifiés tels quels, 2 discutables, 1 annulé. Corrections appliquées :

| Constat | Correctif |
|---|---|
| **Fonctionnalité inerte** : `Preview.tsx` ne passait pas `preview` au variant `coform-answer` → `preview.editButton` (et `preview.fields`) toujours `undefined`, bouton « Modifier » jamais rendu. Le pass-through du 06/07 avait disparu au merge du 30/07 | pass-through rétabli. **Aucun effet sur SSBE** : son bloc est `{"type":"coform-answer"}` sans `fields` ni `editButton` |
| **Perte de données possible** : sur erreur de fetch (ou answer vide), la modale s'ouvrait quand même avec `defaultValues` vide → le save (payload COMPLET) écrasait la réponse | garde `answerError`/`answerData` avant montage, alignée sur `CoFormAnswerPage` |
| **Droits d'édition faux** : le gate reposait sur `permissions.isAdmin` du site, puis (1ʳᵉ correction) sur `answer.canEdit` du backend. Or `canEdit` est calculé sur la seule **propriété** de la réponse (`AnswerEditDeniedReason = not_logged_in \| not_owner \| form_inactive \| form_closed`) → **un super-admin ou un admin de costum est refusé** parce qu'il n'est pas l'auteur | règle métier explicite en helper pur `canEditCoformAnswer` : **super-admin plateforme** (`isSuperAdmin`/`isAdminPlatform`) **OU admin du costum** (entité porteuse, via `resolveAdminAccessLevel` du module admin — réutilisé, pas redupliqué) **OU admin validé de la structure organisatrice** (`me.links.memberOf[structureId].isAdmin`, hors pending/invitation). `canEdit` n'est plus un verrou. **8 tests** |
| **§4** : `answerRef` recréé à chaque render → deps de `handleEdited` instables, `useCallback` inopérant | `useMemo(() => getAnswerRef(item), [item])` |
| **Hors lot** : `CardAnswer.tsx` figeait le slug sur `sportSanteBienetre` (redondant — `parseCoformAnswer` fait déjà le remap) et cassait tout futur site en `card-answer`, plus 2 lignes commentées | **annulé** (`git checkout`) |
| **Empreinte du lot** : la 1ʳᵉ passe de correctifs avait élargi la dédup des préfixes de queryKey à 4 fichiers hors périmètre (+ 1 helper + 1 test) — 18 fichiers au total | ramené à **11 fichiers (10 `M` + 1 test)**, soit **1 de moins qu'avant la revue**. La dédup hors périmètre est **annulée** et tracée en dette dans le JSDoc de `queryKeys.ts` ; le barrel `coform/index.ts` (export sans consommateur) est annulé lui aussi |

Id de la structure porteuse : lu sur `serverData.structure._id`, **vérifié sur le payload SSR réel** de
`/creneaux` (encodage `{_str}` ; le helper accepte aussi `$oid`/`$id`/string, les 3 autres encodages
possibles selon le chemin de sérialisation).

`CoFormModal|default` reste listé par knip : faux positif de classe connue (la baseline contient déjà
`SmartCoForm|default`, les 6 `ProfileHeader…` — tous convertis pour `lazy()`).

**Gates 31/07 après correctifs** (post-`npm install`, cf. §9.4) : `lint` ✅ 0 erreur ·
`test:unit` search ✅ **318/318** (dont **17** sur `coformAnswer`) · `typecheck` ✅ **1 seule erreur,
pré-existante et hors lot** (`HeaderTransparentScroll` : variable inutilisée) · `config:validate` ✅
Ekilibre 11/44 **et** SSBE 19/61.

### 9.2 ter Lot « inputs CoForm manquants » (31/07, commité — `20fc3529`)

Le form créneau (`6928096adf5caf0d230e7f26`, **91 inputs** relus depuis le backend le 31/07) utilisait
3 types **absents du moteur coform** de site-json — le formulaire d'édition affichait « type de champ
inconnu » à leur place :

| Type legacy | Occurrences dans le form | Portage |
|---|---|---|
| `date` (+ `time`, `datetime-local`) | 5 champs (naissance, validité ×2, validation…) | mappé sur `TextField` avec `inputType` natif — la valeur reste l'ISO stocké (`"1998-09-18"`, vérifié en base) |
| `tpls.forms.cplx.timeSlots` | **1 champ = le cœur du créneau** (jour + plage horaire) | `TimeSlotsField` (répéteur) + logique pure `utils/timeSlots.ts` ; sauvegarde au format legacy vérifié `[{day:"Monday", startHour:"08", …}]` ; données 12h legacy (AmPm) lues et résolues en 24h |
| `tpls.forms.cplx.dynamicFields` | 2 champs (lieu de pratique CP+adresse, partenaires) | `DynamicFieldsField` (répéteur de lignes piloté par `fieldsConfig` admin : text/select/textarea/date/…, min/maxRows, layout) ; format vérifié `[{postalCode:"97430", placeName:"…"}]` |

Références : templates legacy `communecter-php74/modules/survey/views/tpls/forms/cplx/`
(`timeSlots.php`, `dynamicFields.php` + leurs docs). Pipeline complet branché : mapping
(`formParser`), configs `params` (coercion des nombres stockés en string par le PHP), schémas Zod
(complétude + fin > début + required/min/maxLength des sous-champs), defaults, rendu édition
(`DynamicCoForm`), rendu lecture (`CoFormReadOnly`), coercion anti-pollution `{}`↔`[]`, i18n fr/en.

**Gates** : coform **323 tests** ✅ (dont 15 `timeSlots` purs, 10 composants, 6 zod) · lint 0 erreur ·
typecheck 1 erreur pré-existante hors lot · parité i18n 46/46 ✅. **Reste** : recette navigateur
connecté (création + édition d'un créneau réel de bout en bout).

**Complément (31/07)** — bouton « Ajouter un créneau » rendu **public par config** : nouveau flag
générique `addButton.adminOnly` (schéma search, défaut `true` = comportement historique réservé aux
admins). Ekilibre pose `adminOnly: false` → le bouton s'affiche pour tous à côté du bouton Carte
(un non-connecté qui clique passe par le login) ; la modération reste le filtre `state="Validé"` en
aval. Seul site utilisateur d'`addButton` → aucun autre site impacté (vérifié sur les 12 configs).
⚠️ Piège découvert (vérifié en SSR live) : `SearchProStatic` a DEUX headers exclusifs — le standard
et le rendu `customHeader` ; `creneaux-list` étant en `customHeader: true`, le header standard (où
vivait le bouton) ne se rend jamais. Le bouton est factorisé (`addButtonElement`) et rendu dans les
deux, contre le bouton Carte.

### 9.3 Merge `main` → `ekilibre` (30/07, `6f4e83bf`)

Rattrapage ~304 commits : modules `blog`/`admin`, **Leaflet → MapLibre** (la vue carte de
`/creneaux` passe sur `SearchMap` MapLibre), SDK `^1.0.169`, scripts `config:*`/`verify:build`,
capacités search `itemRules`/`itemAction`/`colorBy`/`searchTargets` (utilisables par Ekilibre mais
non configurées ici). **Régressions à revalider après `npm install`** : vue carte `/creneaux`
(MapLibre + clé MapTiler ?), rendu des cartes `card-answer` dans le nouveau `SearchListView`,
comportement du lot créneaux (aucun conflit git constaté — les fichiers du lot restent en `M`).

### 9.4 Gates — mesurés le 31/07

> ⚠️ **Revalidé le 31/07 en session 2** (poste courant) : la ligne « `npm install` fait le 31/07 »
> ci-dessous **ne tient plus** — `node_modules` est de nouveau désynchronisé sur ce poste (SDK
> **1.0.158** installé, ≠ `^1.0.169` requis ; **`maplibre-gl`, `react-map-gl`, `@maptiler/sdk`,
> `supercluster` absents** de `node_modules` bien que présents dans `package.json`). Ce n'est **pas
> une régression du code** — probablement un `node_modules` non réinstallé sur ce poste/session
> depuis le dernier `npm install` documenté. **Voir tableau à jour ci-dessous** (remplace l'ancien).

| Gate | Résultat (31/07, session 2) |
|---|---|
| `config:validate` | ✅ **11 pages, 44 sections** |
| `audit:config` (fichier ciblé) | ✅ **RAS** (0 constat : trad/liens/assets/strip/prereq/theme) |
| `typecheck` | ❌ **10 erreurs** — 9 causées par `node_modules` désynchronisé (modules MapLibre introuvables + `any` implicites dans `SearchMap.tsx`/`SearchMapMarkers.tsx`) + **1 pré-existante hors lot** (`HeaderTransparentScroll`, variable inutilisée). **0 causée par le lot auto-inscription** (§9.5) |
| `lint` (projet entier) | ❌ **1 erreur** (`react-hooks/preserve-manual-memoization` dans un composant `formEngine` préexistant, hors lot Ekilibre) + 32 warnings pré-existants · **0 erreur** sur les 4 fichiers du lot §9.5 |
| `test:unit` (suite complète) | 🟡 **2142 passés / 5 échecs / 6 skip** (166 fichiers) — tous les échecs sont **pré-existants et environnementaux**, aucun sur le périmètre Ekilibre : `environment.test.ts` (configuration locale de l'environnement — **corrigé depuis**, revérifié ✅ 9/9), `section-meta.test.ts` (`CLAUDE.md` introuvable à la racine de `site-json` — le fichier vit à la racine du workspace), `site-assets.test.ts`, `skill-integrity.test.ts` (pré-existants), `useEntityMutation.test.ts` (timeout 5s — contention du poste pendant l'exécution parallèle des gates, non reproduit en isolation : le fichier de test dédié au lot §9.5 passe **37/37** en ~9s) |
| Serveur dev | ✅ boote malgré les deps manquantes ; `/`, `/creneaux`, `/structure` → **200** ; listes en skeleton au SSR (prefetch non observé — à revoir après `npm install`) |
| `build` / e2e | non relancés en session 2 — **à passer après `npm install`** ; aucun spec e2e Ekilibre n'existe |

### 9.5 Auto-inscription structure — costumForm `structure-ekilibre` (31/07, session 2, **commité** `9fbe7c02`)

> Nom d'origine du costumForm à la création (`structure-ekilibre`) — **renommé `structure` le 06/08**,
> cf. §9.5 bis. Section conservée telle qu'écrite le 31/07 pour l'historique du contenu fonctionnel.

**Commité** dans `9fbe7c02` (« add structure with step », 31/07 15:43) : `config.prod.maison-sport-sante-la-tampon.json` (M),
`structure-ekilibre/fns.ts` (nouveau), `registerSpecFns.ts` + `configCostum.ts` (fixture test, M),
`structure-ekilibre.configDriven.test.ts` (nouveau).

**Fonctionnel** : bouton « Ajouter ma structure » (icône `plus`, variant `outline`, public —
`requiresAdmin:false`) à côté du champ de recherche sur `/structure`, ouvre un wizard 5 étapes
(`structure` → `contact` → `legal` → `representant` → `responsable`) : identité (SIREN/SIRET, nom,
sigle, affiliation réseau, **domaines d'intervention** `thematic` en cases à cocher, logo), adresse
(`widget: location`), coordonnées + réseaux sociaux, forme juridique (+ champs conditionnels
`visibleIf` selon collectivité/entreprise — statuts, documents), représentant légal, personne en
charge du dossier (recopie du représentant si `responsableSameAsRepresent = "Oui"`).

**Code strictement minimal** (conforme à la règle « dériver, ne pas réciter ») : tout le formulaire
vit en **données** dans `costumForms["structure-ekilibre"]` (moteur `formEngine`, doc/28 — 3 couches
déjà génériques : scope/carrier, defaults, payload, codecs `address:*`/`social:*`/`geo:*`). **Une
seule clé de code irréductible** : `fns.ts` → `registerTransform("structure:tagsFromThematic")`,
qui projette `thematic` (libellés longs saisis) vers `tags` (libellés courts, déjà indexés côté
backend et interrogés par le filtre « Domaine d'intervention » de `/structure`) — un transform de
champ ne reçoit pas de `params`, la table de correspondance ne peut donc pas vivre dans le JSON.
**Vérifié** : les 11 valeurs du filtre `domaine-structure` (config, ligne 1826) et les clés/valeurs
de `THEMATIC_TO_TAG` sont alignées au caractère près (accents et graphie legacy inclus —
`"Periscolaire 1er degré"` sans accent, `"2eme"` en toutes lettres, cf. commentaire du fichier).

**Pattern costum stamp** (§25 bonnes-pratiques) : `mutation.inject.extraFields = {type:"NGO",
role:"admin"}` posé **au create seulement** (`payloadEmitEmptyOnEdit: true` évite qu'une édition
réémette/écrase ces champs) ; `dropEmptyEmail:true` supprime la clé si vide plutôt que d'envoyer
une chaîne vide. Invalidation post-save générique (`invalidate:standard`, `searchKeys:
["searchCostumStatic"]`) → la liste `/structure` se rafraîchit sans reload.

**Gates mesurés le 31/07 (session 2, sur ce lot)** :

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 11 pages, 44 sections (inchangé — `costumForms` n'ajoute pas de page) |
| `audit:config` | ✅ RAS (0 constat) |
| `lint` (4 fichiers du lot) | ✅ 0 erreur |
| `test:unit` (fichier dédié) | ✅ **37/37** — compilation config→descripteur, round-trip payload, oracle réel « NOUT' SPORT ADAPTÉ », pattern costum-stamp, parité `visibleIf` avec l'ancien formulaire jQuery |

**Reste (mis à jour au 06/08)** : recette navigateur (wizard complet, upload logo, soumission
réelle) ; confirmer le libellé/l'ordre des étapes avec la MSS. ~~vérifier qu'aucun autre site ne
consomme `ActionButtonSchema.buttons` avec un `modal` id `add-structure-ekilibre`~~ **sans objet**
depuis le renommage (§9.5 bis) : le nouvel id `add-structure` a été revérifié vacant sur les 12
configs.

---

### 9.5 bis Renommage `structure-ekilibre` → `structure` + fiche détail (06/08, session 3, Nicolas — `253dec37`)

**Renommage** (config + code) : `costumForms["structure-ekilibre"]` → `costumForms["structure"]` ;
dossier `src/modules/profil/forms/costum/structure-ekilibre/` → `structure/` ; test
`structure-ekilibre.configDriven.test.ts` → `structure.configDriven.test.ts` (68 lignes touchées,
**40 tests** au 06/08, contre 37 le 31/07 — 3 tests ajoutés pour `number:fromDigits`) ; bouton
`modal: "add-structure-ekilibre"` → `"add-structure"`.

**Fiche détail `PreviewStructure`** (nouveau `preview.type: "structure"`, ~540 lignes) : reprend le
principe de la fiche legacy costum SSBE (`preview.php`) — hero (statut/type/logo/tags), bandeau
d'affiliation, adresse + carte (`ProfileMapLeaflet`), cartes représentant légal / personne en charge
du dossier (fusionnées si même personne), bloc infos (identifiant, catégorie, membre de, date de
création), documents (`org.getDocuments()`, filtrés hors images via `IMAGE_CONTENT_KEYS`, requiert
une session — masqué silencieusement pour un visiteur anonyme). Bouton **Éditer** conditionné à
`useProfilPermissions` + `DynamicEditModal`, avec un garde-fou : si l'item de recherche (tronqué par
`defaultFields`) ne porte aucun champ propre au formulaire `structure` (`siren`/`sigle`/`thematic`),
l'entité est **rechargée en entier** (`org.refresh()`) avant d'autoriser l'édition — même mécanisme
que `PreviewPoiAmenities` pour ses champs `equip_*`. `/structure` passe de `detailsMode: "drawer"` à
`"dialog"`.

**`CardContact`** : `telephone` peut être une chaîne (la plupart des entités) **ou** un objet
`{mobile: string[], fixe: string[]}` (organizations de certains costums SSBE) — React refusant un
objet comme enfant, la carte prenait `mobile[0]` ou `fixe[0]` en fallback plutôt que de crasher.

**`defaultFields`** (25 champs) posé sur `baseParams` de `/structure` : sans cette liste, les
résultats de recherche étaient tronqués et ni la fiche détail ni le garde-fou d'édition ci-dessus ne
disposaient des données du formulaire `structure`.

**Contournement de typage costum** : `responsableSameAsRepresent` passe de `widget: "select"`
(valeurs `"Oui"`/`"Non"`) à `widget: "switch"` (booléen), et les 6 `visibleIf` associés de
`op: "ne", value: "Oui"` à `op: "falsy"`. Nouveau transform pur `number:fromDigits` (`fns.ts`) posé
en `write` sur `siren`/`representativeTelephone`/`personInChargeTelephone` (`clear: null`) : le
costum SSBE les déclare en `number` par artefact d'inférence alors que les données réelles sont des
chaînes (téléphone international, SIREN saisi avec espaces) — `coerce:number` existant aurait rendu
`undefined` (perte silencieuse du champ) sur tout séparateur ; `number:fromDigits` ne garde que les
chiffres (pertes assumées : `+` d'un indicatif, zéro initial — documentées en commentaire dans
`fns.ts`).

**Gates mesurées le 06/08 (session 3, sur ce lot)** : `config:validate` ✅ 11 pages/44 sections ·
`audit:config` ✅ RAS · `lint` (8 fichiers du lot) ✅ 0 erreur · `test:unit`
(`structure.configDriven.test.ts`) ✅ **40/40** · `typecheck` (projet entier) ✅ **0 erreur**.

---

### 9.6 Back-office `/admin` + tableau de bord KPIs — CDC §4.2 (06/08, session 3, Cael)

> Date **corrigée** : la version précédente de ce document datait ce lot du 31/07 par erreur — les
> commits `2bf0007d`/`a524cf33` sont du **06/08, 14:42**.

**Demande** : activer le back-office admin et afficher les 4 KPIs du CDC §4.2. **Réalisation** :
bloc `config.admin` ajouté (onglets `dashboard` / `membres` / `moderation`) + extension **opt-in**
du moteur : `AdminDashboardKpiSchema` (`section.kpis[]`) — sans `kpis`, le dashboard reste 100 %
dérivé, **aucun impact sur les autres sites**.

| KPI (CDC §4.2) | Implémentation | Source de données | État |
|---|---|---|---|
| **Créneaux actifs** (+ évolution vs mois précédent) | `kpis[0]` `searchCount` + `trend:"monthly"` | mêmes `baseParams` que `/creneaux` (form + CP + `state="Validé"`) via `useSearchAllResults` ; tendance dérivée des `created` (`computeMonthlyTrend`, 6 tests) | ✅ réel |
| **Usagers actifs** (visites uniques mensuelles) | `kpis[1]` `analyticsVisitors` | **AUCUNE** — le moteur ne fait que du *tracking* sortant (`IntegrationsLoader`), aucune API de lecture d'audience. Tuile en état « à raccorder » explicite (jamais un chiffre inventé) | 🟡 à raccorder (§13) |
| **Signalements en attente** | tuile **dérivée** modération du dashboard (existant) via une section `moderation` | `me.getModerationQueue()` (news + commentaires signalés) — **superAdmin** (plancher backend) | ❌ **retirée le 19/08** : l'API répond 500 sur cette base — section supprimée de l'onglet (la tuile dérivée disparaît avec, `DashboardSection` désactive la query sans section) ; à re-poser quand le backend répondra |
| **Pros inscrits** (en attente de validation) | `kpis[2]` `membersPending` | `useEntityMembers(carrier, {toBeValidated: true})` — même source que l'onglet Membres | ✅ réel (définition « pro » = membre en attente, **à confirmer** §13) |

**Fichiers moteur** : `admin/schema.ts` (KPI schema + type), `admin/sections/DashboardKpis.tsx`
(tuiles, même anatomie Card que les tuiles dérivées), `admin/sections/DashboardSection.tsx`
(branchement + type guard), `admin/lib/kpiTrend.ts` (+ `.test.ts`, logique pure), `admin/constants/queryKeys.ts`
(`KPI_SEARCH_PREFIX`), i18n admin fr/en (`DashboardKpis.*`). **Config** : bloc `admin` inséré après
`auth` ; le KPI créneaux **réutilise par lecture** les `baseParams` de la page `/creneaux` (copie
générée depuis la config elle-même — à re-synchroniser si les filtres de la page changent, §12).

**Limites assumées** : la tendance mensuelle compare les **créations** (mois courant vs précédent) —
les suppressions ne sont pas historisées côté backend, un « total fin de mois dernier » exact est
impossible ; tendance calculée uniquement sur périmètre complet chargé. La tuile analytics reste
un état vide tant qu'aucun outil RGPD n'est raccordé (décision §13).

**Gates (06/08, session 3)** : `config:validate` ✅ 11 pages/44 sections · `audit:config` ✅ RAS
(strip 0 : le bloc admin est intégralement reconnu) · `typecheck` ✅ 0 erreur · lint ✅ (18 warnings
hérités de `main`) · `kpiTrend` 6/6 ✅ · préflight : reste **1 échec pré-existant** `skill-integrity`
(fichier `.claude/agents/siteforge-config-auditor.md` référencé par le skill mais jamais versionné —
échoue sur tout clone frais, **à remonter au mainteneur**). Au passage : ligne `structure` ajoutée à
la table Presenters du skill `config-assistant` (gate anti-dérive, suite aux commits `253dec37`) et
dossier d'images `maisonSportSanteLaTampon` déclaré dans `sites.json` (gate `site-assets` de main).
Revalidé indépendamment ce même jour (Nicolas, cf. §9.5 bis) : `config:validate`/`audit:config`/
`typecheck` toujours ✅ après `git pull --ff-only` de ces 2 commits.

---

### 9.6 bis Modération des créneaux dans l'admin — `status.mode: "statusField"` (18/08, Peterson)

**Demande** : lister les créneaux dans l'onglet Modération avec leur statut, et permettre aux
admins de les passer en Validé / Refusé / En attente (le statut du CoForm). **Réalisation** : câblage
du **contrat `statusField`** prévu de longue date dans le schéma admin (décision 2026-07-07 —
c'était un « contrat futur » jamais implémenté) + une section `resource` answers dans l'onglet
`moderation` de la config.

- **Vérité terrain** (form live) : le statut est le select **« Administration »** (`isAdminOnly`),
  options exactes `["En attente", "En cours", "Validé", "Réfusé"]` — l'orthographe legacy
  **« Réfusé »** est écrite VERBATIM en base ; la config l'écrit telle quelle et l'affiche « Refusé »
  (`states[].label`).
- **Moteur** (générique, tout site) : colonne badge toné (mêmes tokens `bg-badge-*` que les cartes
  `/creneaux`), filtre serveur par état, actions « Marquer : … » par-ligne → `entity.updateField`
  (UPDATE_PATH_VALUE, un `$set` ciblé — pas le save d'answer complet qui exigerait un re-fetch
  anti-effacement). Invalidation : tables/tuiles `admin-*` **et** listes publiques liste+carte
  (un créneau validé apparaît sur `/creneaux` sans F5). `cascade`/`notifyEmail` retirés du schéma
  comme acté.
- **Config** : onglet `moderation` passé **siteAdmin** (la modération des créneaux est le quotidien
  de la MSS) ; la section signalements news/commentaires (superAdmin) a été **retirée le 19/08**
  (API `getModerationQueue` en 500 sur cette base — à re-poser quand le backend répondra).
  Périmètre = celui de `/creneaux` **sans** le filtre d'état (on modère tout le territoire), tri
  `created` desc, colonnes Activité / Type / CP / Déclaré le. `create`/`edit: false` (l'édition
  de contenu se fait sur `/creneaux` via le bouton Modifier).
- **Correctif « colonnes vides » (même session)** : les premières colonnes visaient les chemins
  Mongo imbriqués (`answers.<formKey>.<clé>`) — or côté costum SSBE, le hook de recherche
  (`SportSanteBienetre::…`, legacy) **aplatit** les champs d'answer au top-level et **supprime
  `answers.*`**, en posant en bonus `name` (= titre), `structure` {name…} et `address` à la racine
  (vérifié par curl avec `costumSlug` : 48 clés plates). Correctif : colonnes réécrites sur la
  **shape aplatie** (`name` / `structure.name` / type à plat / `address.postalCode` / `created`) et
  lecture du statut via **`readStatusValue`** (resourceHelpers, 3 tests) — chemin complet d'abord,
  repli clé feuille à plat ; le chemin imbriqué reste LE bon pour le filtre serveur et l'écriture
  `UPDATE_PATH_VALUE`. Autre découverte du hook : **`Validé` est forcé pour les non-admins de
  costum** → un admin voit bien tous les états dans la modération, le public non (cohérent).
- **Gates** : typecheck ✅ 0 erreur · lint ✅ · `config:validate` ✅ · `audit:config` ✅ strip 0 ·
  unit **2324** ✅ (reste le pré-existant `skill-integrity`).
- **⚠ À recetter en priorité** : l'autorisation BACKEND d'`updatepathvalue` sur une answer par un
  admin de costum **non-auteur** — même famille de risque que le save d'answer (§12 droits) ; si le
  backend refuse, prévoir une fiche `ENDPOINT.md` (endpoint de modération dédié).

### 9.8 Migration : form créneaux dédié Tampon (19/08, session 5, Peterson)

Décision Peterson (annoncée le 18/08, exécutée le 19/08) : **plus aucun lien form/créneaux avec
SSBE**. Les créneaux du Tampon vivent dans le form dédié **« Créneau - tampon »**
`6a85af345d898a57cb49f029` (id humain `maisonSportSanteLeTampon1`, parent = orga
`6a463dd52d396945ff52e854`), **dupliqué du form SSBE le 12/08/2026**. Fait décisif vérifié en base
(getformbyid + answer de test `6a858ed219f28569b6456ff2`) : la duplication **préserve les ids
d'inputs** (queues aléatoires `mdegc9sgox76p87n27`…) — seuls changent l'id du form et le préfixe de
section (`sportSanteBienetre2172025_854_0` → `associationEkilibre19082026_1327_0`). Les
options du select « Administration » sont identiques (« Réfusé » verbatim compris) → le bloc
`states` de la modération reste valable tel quel.

- **Config** : swap intégral form id (4×) + préfixe de section (11×) — `/creneaux` (baseParams +
  4 filtres de page), `addButton.coform`, KPI « Créneaux actifs », resource modération (source,
  colonne type à plat, champ statut). **Filtres CP 97430/97418 RETIRÉS** des 3 sources answers
  (`/creneaux`, KPI, modération) : ils découpaient le form *partagé* par territoire — le form
  dédié EST le périmètre. (Le filtre CP de l'annuaire **structures** est conservé : les orgas
  restent des données SSBE partagées.)
- **Front — résolution par ids stables** (`coformAnswer.ts`) : `DEFAULT_COFORM_FIELDS` ne porte
  plus que les **queues aléatoires** et `parseCoformAnswer` résout par `endsWith` sur les lignes
  aplaties — le remap `associationEkilibre → sportSanteBienetre` (piège historique) **disparaît**,
  cartes/détail marchent pour les DEUX forms sans configuration ; un override `preview.fields`
  portant une clé complète historique reste valide (match par suffixe). +4 tests (SSBE, Tampon,
  override legacy, données sans champs).
- **Backend — modèle costum UNIQUE `AssociationEkilibre.php`** (état final 19/08 soir — « pas
  obligé de passer par MSS Tampon ») : le form créneau appartient à l'orga carrier elle-même
  (« Formulaire de créneau du Tampon », parent `6a7b4ba00f51f56995200928`), le front envoie
  `costumSlug=associationEkilibre` (aucun changement front), le loader résout `ucfirst(slug)` =
  `AssociationEkilibre` — plus aucun intermédiaire. Même **processus** que SSBE, section Ekilib.re
  seule : `searchAnswers` (strip géo, `Validé` forcé pour les non-admins, tri/pagination,
  aplatissement + `name` + adresse + jointure `structure`), `canEditAnswer`, `getAnswerByStructure`
  (sans rendu html), `getFormCrenaux` (id humain `associationEkilibre1`, repli `_id`).
  `SportSanteBienetre.php` INTACT. L'étape intermédiaire du matin (modèle
  `MaisonSportSanteLeTampon.php` + relais, form `6a7cd1d72e263e7c033ad1ea` porté par l'orga MSS
  `6a463dd52d396945ff52e854`) est **SUPPRIMÉE** — form MSS abandonné, ses copies orphelines se
  nettoient via `deleteTamponCopies` (ci-dessous).
- **Déclaration hooks POSÉE en base** (par Peterson) : costum embarqué
  `{slug:"costumize", class:{function:["searchAnswers","canEditAnswer"]}}` sur l'orga
  `6a7b4ba00f51f56995200928`. Effet de bord assumé : l'orga est « costumisée » côté plateforme
  legacy. Base vivante : `prod190826` (conteneur `mongo42`).
- **Pipeline PROUVÉ de bout en bout (anonyme, via le hook)** : recherche
  `costumSlug=associationEkilibre` + form `6a85af345d898a57cb49f029` + `notSourceKey` →
  **« Basket collectif » [Validé] APLATI** (name posé, statut à plat, `answers` supprimé,
  structure « MAIRIE DU TAMPON » jointe). Gate Validé actif : plus aucune réponse En attente
  visible du public. ~~NB : `notSourceKey` obligatoire (la config front le pose) — sans lui, le
  scoping `source.keys` exclut les réponses sans `source`.~~ **RENVERSÉ le 20/08** (§9.9) :
  `notSourceKey` n'était pas obligatoire mais un contournement, et c'est lui qui faisait remonter les
  42 créneaux du site jumeau. Il a été retiré partout au profit de `sourceKey: ["associationEkilibre"]`.
- **Contrôleur de migration par URL** (`EkilibreMigrationController`, convention
  co2/CoformMigrationController : gate super-admin, DRY RUN par défaut, `/apply/1` pour écrire,
  sortie RETOURNÉE — un `echo` volumineux déborde le buffer → HeadersAlreadySentException) :
  `copyCreneaux` (copie STRICTE des créneaux SSBE par CP — défaut 97418, `/cp/97430` possible —
  vers le form Ekilib.re : renommage de préfixe de section, champs racine recalés sur la
  convention native, idempotent via `copiedFrom` ; fichiers uploadés NON dupliqués) ·
  `deleteTamponCopies` (supprime les ~35 copies orphelines du form MSS abandonné — uniquement
  les answers marquées `copiedFrom`, jamais une saisie). Sur PROD : mêmes URLs, connecté super
  admin — aucun identifiant mongo à manipuler ; le form doit y être importé À L'IDENTIQUE
  (export/import mongo, pas de re-création UI).
- **Gates** : typecheck ✅ · lint ✅ · `config:validate` ✅ 11 p/44 s · préflight + search + admin
  **853 tests** ✅ · snapshot effective-config régénéré (diff = exactement la migration) ·
  `php -l` ✅ (`MaisonSportSanteLeTampon.php`).
- **⚠ Recette navigateur** (compte admin costum) : modération de « Basket » (En attente → Marquer
  Validé → apparition sur `/creneaux`), création d'un créneau via `addButton.coform` (nouveau
  form), édition. Les créneaux ANCIENS (form SSBE) ne sont **plus** listés sur le site Tampon —
  voulu (« pas de lien avec SSBE ») ; les re-saisir dans le nouveau form s'ils doivent y figurer.

---

### 9.7 Actualités — costumForm `actualite` (POI) + admin + home/espace-pro (10/08, session 4, Nicolas)

**Opérationnel de bout en bout depuis le 19/08** (§9.7 ter). Suit le patron `structure` : costumForm POI (formEngine)
+ rendu via le module `search` générique, **sans nouveau composant de carte/preview** — réutilise le
variant existant `card.type`/`preview.type: "resource"` (`ResourceConfSchema`, déjà pensé pour un POI
éditorial, badge catégorie inclus), repéré en veille le 10/08.

**Config** (`config.prod.maison-sport-sante-la-tampon.json`) :
- `costumForms["actualite"]` — `entityType`/`collection: "poi"`, `scope: {slugFrom:"carrier"}` (résout
  `associationEkilibre`, **pas** `sportSanteBienetre` — les actualités sont un contenu éditorial
  propre au site, pas une donnée régionale SSBE). Champs : `name`, `category` (select, 5 valeurs
  CDC), `publicationDate` (date), `description` (markdown), `link` (text), `publicationStatus`
  (select, Brouillon/Publié/Archivé), `featured` (switch). Costum-stamp
  `mutation.inject.extraFields.type:"article"`, create-only.
  **Réaligné le 18/08** (§9.7 bis) sur le costum backend réel `associationEkilibre` — `category`
  s'appelait `actualiteCategory` et le stamp `"actualite"` jusqu'au 10/08 (renommage prudentiel,
  motivé par une collision supposée avec le `category` équipements de `sportSanteBienetre.poi` ; sans
  objet, chaque costum a son propre registre de champs).
- Onglet admin `"actualites"` (entre `membres` et `moderation`) : section `resource` sur `poi`,
  colonnes titre/catégorie/date/statut/à la une, `rowActions:["edit","delete","setFeatured"]`,
  `exclusiveField:"featured"` (nouveau, §schéma admin ci-dessous), `create:"add-actualite"`.
- Home (`pages[path="/"]`) : la section `news` (id `actualites`) **remplacée** par deux blocs
  `searchProStatic` sans filtre/carte — `actualites-featured` (1 item, `featured:true`) et
  `actualites-grid` (grille, `featured:{"$ne":true}` — **non prouvé empiriquement**, aucun autre usage
  de `$ne` dans les configs actuelles ; repli si non supporté : la une réapparaît aussi dans la grille,
  limitation mineure acceptée).
- `/espace-pro` : la section préexistante `actualites-articles-list` (résidu de merge déjà signalé le
  10/08 — filtrait `type:"article"` + `source.key` tantôt `saintpaulSport1` tantôt déjà corrigé en
  `associationEkilibre` par une édition manuelle entre-temps) **adaptée** plutôt que dupliquée :
  `publicationStatus:"Publié"`, tri par `publicationDate`, mapping `resource` aligné (plus de
  `defaultFields`/`$or` obsolètes). Le filtre `type` était passé à `"actualite"` le 10/08 (pour
  matcher le costum-stamp de l'époque), puis **ramené à `"article"` le 18/08** (§9.7 bis) — ce qui le
  fait coïncider, par coïncidence et non par oubli, avec le résidu de merge d'origine.

**Mise en avant exclusive depuis le tableau admin** (décision utilisateur du 06/08, seule vraie
feature moteur du lot — pas juste de la config) :
- `src/modules/admin/schema.ts` : `rowActions` enum +`"setFeatured"` ; nouveau champ optionnel
  `exclusiveField?: string` sur `AdminResourceSectionSchema` — **opt-in strict**, zéro impact sur les
  sections `resource` existantes qui ne le déclarent pas.
- `src/modules/admin/lib/exclusiveFlag.ts` (nouveau, pur, testé 8/8) : `itemsToUnset(rows, field,
  targetId)` — sélectionne, parmi les lignes **chargées** dans le tableau (pas une recherche dédiée
  sur tout le périmètre — limitation documentée, volumétrie admin usuelle), celles à `true` hors la
  cible.
- `src/modules/admin/hooks/useSetExclusiveFlag.ts` (nouveau) : au clic sur « Mettre à la une »,
  repasse d'abord les autres lignes chargées à `false` (`item.updateField(field, false)` — patron
  `CardEventFeatured`/`CardDetailedDefault` pour leur toggle `isStarred`, simple PATCH `UPDATE_PATH_VALUE`,
  pas de `.save()`), puis la cible à `true` ; invalide `admin-*` **et** `searchCostumStatic` (rafraîchit
  home/espace-pro sans reload). Best-effort séquentiel (pas de transaction) — même limitation déjà
  acceptée que `bulkValidate`/`bulkDelete`.
- `src/modules/admin/sections/AdminResourceTable.tsx` : bouton étoile (rempli si déjà « à la une »)
  rendu quand `rowActions` contient `"setFeatured"` **et** `resource.exclusiveField` est renseigné.

**2 correctifs moteur découverts et posés en cours de route** (le costumForm `actualite` est le
premier de ce site à utiliser `widget:"markdown"` sur un champ dépourvu de `type` explicite en JSON —
`structure` n'en avait pas besoin) :
- `src/modules/formEngine/config/schema.ts` — `WidgetKind` (validation Zod `JsonFormConfigSchema`)
  omettait `"markdown"` alors que le moteur (`formEngine/types.ts`) le supporte et que 3 costumForms
  d'autres sites l'utilisent déjà (`parent62-article`, `institut-bleu-document`,
  `sport-sante-bienetre-financement`) — écart déjà repéré en veille le 10/08. Ajouté.
- `src/modules/profil/forms/costum/compileCostumSchema.ts` — `WIDGET_DEFAULTS` (table widget→`{type,
  read, default}` à la compilation du costumForm) omettait aussi `"markdown"` : sans ce correctif,
  tout champ `markdown` sans `type` JSON explicite compile avec un `type` **absent** du descripteur
  (`{type:"string", read:"coerce:string", default:""}` ajouté, même traitement que `textarea`) —
  **bug latent pré-existant, probablement présent depuis l'ajout du widget markdown**, affectant
  potentiellement aussi les 3 costumForms cités ci-dessus (non vérifié pour eux, hors périmètre de ce
  lot). Élargit strictement le validé (aucune régression possible sur l'existant).

**Tests** : `actualite.configDriven.test.ts` (8/8 — compile, round-trip, `scope`, costum-stamp, enums
catégorie/statut alignés au CDC, `featured` bien un switch) ; `exclusiveFlag.test.ts` (8/8, logique
pure). `structure.configDriven.test.ts` + toute la suite `formEngine`/`costum` revérifiées après les
2 correctifs moteur : **205/205** ✅ (zéro régression).

**Gates (10/08, revérifiées 18/08 après réalignement)** : `config:validate` ✅ 11 pages/46 sections ·
`audit:config` ✅ RAS · `typecheck` ✅ 0 erreur sur le lot (les erreurs `toolsCatalog` restantes sont le
désync `node_modules` déjà connu, sans lien) · `lint` ✅ 0 erreur/warning sur les fichiers du lot (20
warnings `react-hooks/preserve-manual-memoization` pré-existants ailleurs, stables) ·
`npm run test:unit` complet : **2467/2475** ✅ (snapshot `tests/preflight/__effective__/
maison-sport-sante-la-tampon.json` régénérée le 18/08 pour refléter `type:"article"`/`category`), **2
échecs pré-existants sans lien avec ce lot** (détail §12) : `edit-modal-scope.test.ts` (route
`structure` non bornée) et `site-assets.test.ts` (dossier `associationEkilibre` non déclaré).

**Reste** : recette navigateur — **✅ réussie le 19/08** (§9.7 ter), tous les champs custom
persistent ; vérifier empiriquement `featured:{"$ne":true}` ; recette visuelle du design
« médiathèque à bulles » (`resource`) sur un contenu éditorial pur.

---

### 9.7 bis Réalignement sur le costum backend réel (18/08, session 5, Nicolas)

La config réelle du costum `associationEkilibre` telle qu'elle existe en
base (`costum.typeObj.article`, mécanisme legacy `dynFormCostum` du back-office historique —
vraisemblablement ce que scanne `tools/parity/scripts/costum-fields.mjs` côté backend). Elle
confirme que `associationEkilibre` **est bien déclaré côté `poi`** (`sameAs`/`formParent: "poi"`),
contrairement à ce que l'artefact SDK vendoré laissait penser au 10/08 (probablement pas encore
régénéré depuis) — mais sous un contrat différent de ce qui avait été codé :

| | Codé le 10/08 | Déclaré par le backend (`typeObj.article`) |
|---|---|---|
| Stamp `type` | `"actualite"` | `"article"` (`presetValue.type`) |
| Champ catégorie | `actualiteCategory` | `category` |
| Champ `link` (URL, CDC) | présent | **absent** du `typeObj.article` |
| `publicationDate`/`description`/`publicationStatus`/`featured` | — | noms identiques ✅ |

Le renommage `category` → `actualiteCategory` du 06/08 était **prudentiel** (collision supposée avec
le `category` équipements de `sportSanteBienetre.poi`) — sans objet une fois le contrat réel connu :
chaque costum a son propre registre de champs, `associationEkilibre` et `sportSanteBienetre` ne se
mélangent pas. **Renommé le 18/08** : `mutation.inject.extraFields.type` → `"article"`,
`actualiteCategory` → `category`, répercuté dans le costumForm, les colonnes/filtres admin, les 2
sections home et `/espace-pro` — 7 + 5 occurrences, aucune collision avec un `"article"`/`"category"`
préexistant dans la config (vérifié). `link` reste tel quel côté formulaire (le CDC le demande) mais
n'étant pas déclaré côté backend pour ce type, il sera probablement perdu à la sauvegarde tant que le
backend ne l'ajoute pas à `typeObj.article.dynFormCostum.beforeBuild.properties` — **à signaler côté
backend**, même canal que la déclaration `organizations` toujours en attente.

Comme `VITE_COSTUM_FORCE_LIVE=true` est actif sur ce poste (résolution costum en direct, `getcostumjson`,
sans passer par l'artefact SDK vendoré — cf. §11), la recette (création réelle d'une actualité +
relecture des champs custom) est **testable sans attendre de republication SDK** — recette menée et
réussie le 19/08, cause du blocage initial et correctif détaillés en §9.7 ter. `structure`/
`organizations`, en revanche, n'a montré aucun signe équivalent dans ce que l'utilisateur a partagé :
ce costum reste non déclaré pour cette collection, le blocage déjà documenté pour `structure` en
édition (§11/§12) est inchangé.

`actualite.configDriven.test.ts` mis à jour en conséquence (8/8 verts) ; snapshot preflight
régénérée ; `config:validate`/`audit:config`/`typecheck`/`lint` revérifiés verts (détail ci-dessus).

---

### 9.7 ter ✅ Recette — actualité créée avec succès (19/08, Nicolas)

**Résultat** : création réelle d'une actualité confirmée en base (`_id 6a84df8be2bdf37fd592f438`),
tous les champs présents et corrects (`type:"article"`, `category`, `publicationDate`,
`publicationStatus`, `featured` — stocké en chaîne `"true"`, cohérent avec le stockage legacy des
toggles, pas un bug —, `link`, `parent` pointant l'organisation porteuse, `source.key`), **photo
comprise** après le rechargement navigateur. Gates revérifiés après le dernier changement (`image`) :
`typecheck` ✅ · `lint` ✅ 0 erreur (20 warnings `react-hooks/preserve-manual-memoization`
pré-existants, sans lien) · `config:validate` ✅ 11 pages/46 sections · `audit:config` ✅ RAS ·
`actualite.configDriven.test.ts` 9/9 · `test:unit` complet **2468/2476**, mêmes 2 échecs
pré-existants sans lien (`edit-modal-scope`, `site-assets`).

---

### 9.9 Bascule sur le costum `associationEkilibre` — chantiers A/B/F (20/08)

> Chantiers **récupérés** du journal `mss-la-tampon-plan-corrections.md`, supprimé du dépôt par
> `53febb6e` sans reversement. Commits : `1ee11397`, `9673a2aa`, `2aad6947`, `c01bebb4`, `7aeced66`,
> `8f4a621e`, `0dc5498b`.

Le site cherchait sous le costum régional. Il cherche désormais **sous le sien**.

**Ce qui a changé en base** (hors `site-json`) : le nœud `costum.typeObj.organizations` a été copié
depuis `sportSanteBienetre` vers `associationEkilibre`, et **amendé de trois propriétés que la
whitelist rabotait en silence au save** — `otherRepresentativeTitle`, `otherPersonInChargeTitle`,
`statusActor` — plus les deux seules listes dont le formulaire a besoin.

**Ce qui a changé en config** : les **six** périmètres de recherche du site (page `/creneaux`, page
`/structure`, KPI « Créneaux actifs », tables admin Actualités / Structures / Modération) déclarent
tous `sourceKey: ["associationEkilibre"]` et rien d'autre. Le serveur le traduit en
`$or[source.keys, reference.costum]` — d'où le modèle « possédée **ou** référencée ».

`notSourceKey` a **disparu** de la config (0 occurrence). Il avait été introduit comme contournement
et présenté en §9.8 comme « obligatoire » : c'était faux, et c'est lui qui faisait remonter le stock
du site jumeau.

**Territoire tranché** : Le Tampon **seul**, CP 97430 (bourg) et 97418 (Plaine des Cafres). L'ajout de
97480 (Saint-Joseph), fait puis **reverté** le 20/08 sur décision utilisateur, n'est plus dans la
config. Le filtre postal est posé à deux endroits : le listing public `/structure` et le vivier de
candidates de l'onglet Référencement.

**`costumSlug: "associationEkilibre"`** est posé sur les **deux** formulaires costum du site. La clé
porte trois mécanismes qu'un oubli casse en silence — le pin de schéma en édition, la découverte par
les tests e2e du parc, et la cohérence de la whitelist d'écriture. Une garde préflight l'exige
désormais ; le formulaire `structure` était le **seul du parc** à ne pas la porter (`7aeced66`).

---

### 9.10 Curation du stock plutôt que transfert — chantiers F/G (20/08)

> Commits : `659f3a21`, `ba1709ed`, `c1bb48e9`, `2aad6947`.

**Décision actée avec l'utilisateur** : **pas** de `transfersource` du stock régional, **pas** de
référencement automatique. La propriété porte les fonctionnalités, le référencement ne porte que la
visibilité.

Le back-office passe à **six onglets** — Tableau de bord, Membres, Actualités, **Structures**,
**Référencement**, Modération — tous au niveau `siteAdmin`. Les deux nouveaux viennent de ce chantier :

- **Structures** gère les fiches **du site**, avec `restrictActionsToOwned: true` : sur une ligne que
  le site ne possède pas (seulement référencée), Modifier / Valider / Supprimer et le dropdown de
  statut **disparaissent**, ne laissant que la lecture et le bouton de (dé)référencement. C'est un
  opt-in du moteur, sans effet sur les autres sites du parc.
- **Référencement** est l'outil de curation : il cherche des candidates parmi les organisations
  `source.keys: sportSanteBienetre` des deux codes postaux, avec la politique `openData: "optOut"`
  (tout sauf refus explicite). **Sans ce réglage la vue serait vide** — le garde-fou legacy par
  défaut exige `preferences.isOpenData: true`, que le stock ne porte pas.

> ⚠️ **Correction du 21/09 — jusqu'au correctif backend `7b19f871`, le ciblage `source.keys:
> sportSanteBienetre` décrit ci-dessus ne filtrait rien.** Le serveur ignorait le `$in` dès qu'un `$nin`
> de garde figurait sur la même clé (cf. §9.18) : le vivier remontait toutes les provenances. Le
> correctif est sur `master` de `citizenToolKit` et le ciblage `source.keys` est **conservé** (vérifié le
> 24/09 : vivier 100 % `sportSanteBienetre` en dev et en prod). Les 14 fiches référencées le 20/08 ne
> sont pas concernées (référencement fiche par fiche, pas par ce filtre).

**14 organisations du Tampon** ont été référencées le 20/08 sur la base de **DEV**, par le canal de
l'action admin et non par écriture Mongo directe.

**Une seule route d'édition d'organisation** est déclarée, bornée par
`when: or[sourceKeys ∋ associationEkilibre, reference.costum ∋ associationEkilibre]` et **sans**
`editModalMatch`. *(Ceci referme le constat « route d'édition non bornée par costum » ouvert le 10/08
en §12 — avec `associationEkilibre` et non `sportSanteBienetre` comme valeur testée.)*

> ⚠️ **Correction du 28/08 — la justification écrite ici le 23/08 était fausse.** Elle disait :
> « l'absence de match sur le type est délibérée, les 14 fiches référencées n'ont pas de champ `type` ».
> Le constat est exact, la cause ne l'est pas. La vraie raison est que le costumForm `structure` ne
> déclare **pas de `subType`** : rien n'est donc écrit dans `reference.costumTypes.associationEkilibre`
> au moment du référencement, et `editModalMatch` n'a effectivement rien à matcher. Ce n'est pas une
> propriété des fiches, c'est une pièce manquante de la chaîne de rattachement
> (cf. [doc/35](../doc/35-rattachement-et-referencement.md)) : institut-bleu, qui pose `identity` **et**
> `subType`, n'a pas ce problème. Le contournement reste défendable en l'état ; sa justification, non.

---

### 9.11 Modération `statusActor` et runbook de mise en PROD — chantiers C/D/E (20/08)

La modération des structures passe d'un hack (champ non déclaré, stamp `pathValue`) à un mécanisme
régulier : `statusActor` au patron `statusField`, **quatre** états tonés (« En attente », « En
cours », « Validé », « Refusé »). Le multi-états a été conservé **volontairement** contre le binaire
`toBeValidated` de la plateforme, parce que le stock hérité porte déjà ces valeurs.

> ⚠️ **Trois écritures Mongo à rejouer sur la base de PROD avant tout déploiement**, dans cet ordre
> et en dry-run avant `--apply` :
> 1. `copy-costum-decl.mjs` — nœud `organizations` + les 2 listes ;
> 2. `add-article-node.mjs` — nœud `article` ;
> 3. `reference-stock.mjs` — les 14 fiches (ou à la main via l'onglet Structures).
>
> **Sans ces écritures, le déploiement de la config actuelle produit une whitelist costum VIDE : les
> champs métier sont rabotés au save, en silence.** C'est le gate de déploiement de la bascule, et il
> vaut aussi bien pour `scope.constant` que pour `costumSlug`, tous deux basculés d'un bloc.
>
> **Après TOUTE écriture de `costum.*` en base, purger le cache costum du backend** (`CFileCache`) —
> il ne s'invalide pas seul (§12).
>
> Ces scripts **ne sont pas versionnés** (§13).

> ⚠️ **Quatrième écriture, ajoutée le 24/08 (§9.14) et JAMAIS jouée en PROD : la déclaration
> `costum.typeObj.recoveryCenter`.** Constat du 03/10 sur le dump de PROD du 30/09 (restauré sur la
> base partagée : dernières orgas créées le 30/09 à 16:27) : l'orga `associationEkilibre` porte
> `costum.typeObj = {organizations, article}` — **pas de `recoveryCenter`**, et 0 POI
> `type:"recoveryCenter"` scopé `associationEkilibre`. Les étapes 1 et 2 ont donc été jouées, pas
> `declarePoiTypes`.
>
> **La relance doit poser `recoveryCenter` SEUL.** L'action `costum/ekilibreMigration/declarePoiTypes`
> (`EkilibreMigrationController::actionDeclarePoiTypes`) fait un `$set` de **`costum.typeObj.article`
> ET `costum.typeObj.recoveryCenter`** : la rejouer telle quelle **remplacerait** le nœud `article`
> déjà en PROD (posé par `add-article-node.mjs`, qui n'est pas le même nœud — icône, libellés et
> propriétés diffèrent). Écrire donc uniquement `costum.typeObj.recoveryCenter` (le nœud de l'action,
> champs `category` + `status`), dry-run d'abord, puis purger le cache costum.
>
> **Tant que ce n'est pas fait, le formulaire « Ressources pro » d'ekilibre.00.re est cassé**, le site
> étant en `VITE_COSTUM_FORCE_LIVE` (costum résolu en live, pas depuis l'artefact) : sans le nœud, le
> SDK n'ouvre pas les champs costum du POI `recoveryCenter` — création amputée de `category`/`status`
> en silence, édition rejetée (`[DraftProxy] Le champ "status" n'est pas autorisé`, e2e live du 02/10
> sur `ekilibre-ressource` ; le mode bundle passe, l'artefact embarqué déclarant le type).

---

### 9.12 `/creneaux` : montage `gridLayout`, facettes CoForm et cartes pathologie (22/08)

> Commits : `b11285e5`, `5f8cfae4`, `719d2b05`, `91a4eef7`, `23267052`, `6e918f54`, `81364659`,
> `b5a8cc06`, `af231d37`, `8a1f2fbe`.

**Périmètre d'abord.** Mesuré en production : **44 des 45** réponses au formulaire
`6a85af345d898a57cb49f029` portent `source.key = sportSanteBienetre`, une seule
`associationEkilibre`. La page affichait 43 créneaux dont 42 qui ne relevaient pas du Tampon — y
compris dans la **table de modération admin**, où un administrateur du Tampon pouvait donc agir sur le
stock du site jumeau. Recentré aux trois endroits (`b11285e5`). Conséquence assumée : `/creneaux`
n'affiche plus qu'**un** créneau. *(Comptage porté par le message de commit, non revérifiable depuis
le dépôt — à reconfirmer en recette.)*

**Montage.** `[searchHeader, gridLayout]` au lieu de `[searchHeader, searchProStatic]`. Le
`gridLayout` (`creneaux-grid`, 1 colonne / 3 colonnes) porte à gauche une section `filters`
(`creneaux-filtres`), à droite le `searchProStatic`. Le `searchHeader` ne garde que son titre, son
chapô et deux boutons — plus de `showSearch`, plus de `dropdownFilters`. La recherche texte est celle
de la colonne, avec débounce à 400 ms et paramètre `?search=`. **`/structure` n'a pas été migrée**
(décision : seulement `/creneaux`).

**Six groupes de filtres** : 4 `filterGroups` statiques — Type d'activité (9 options), Type de Sport
Santé (**3** depuis le 08/10, §9.22), Type de public (2), Bénéficiaires (7) — et 2 `filtersByAnswers` : **ALD** et **Maladie
chronique**.

Les options de « Bénéficiaires » ont été **alignées sur le formulaire** : l'ancienne liste de 6 en
portait deux qui n'existent pas au CoForm — elles ne filtraient rien, en silence.

Les deux groupes pathologie ne recopient **aucune** option : ils déclarent `forms`, un `path` vers le
champ `multiCheckboxPlus` et un `finderPath`. Leurs libellés restent donc justes si le formulaire
change. Un groupe dont le backend ne renvoie aucune option est simplement **invisible** — la config
peut les déclarer sans risque d'accordéon vide, et ils apparaîtront le jour où les options remontent,
**sans redéploiement**.

**Les 8 cartes « Je cherche une activité pour… »** de l'accueil portent enfin chacune un deep-link
filtré (`91a4eef7`) : Problème cardiaque → 4 ALD · Diabète → 1 · Cancer → 4 · Problème respiratoire,
Surpoids/obésité, Douleurs chroniques, Stress/santé mentale, Perte d'autonomie → les valeurs
correspondantes. Elles passaient par un `<a href>` natif, donc **rechargeaient toute l'application**
sur le chemin de conversion principal de la home ; elles passent par `NavLink` (`6e918f54`).

> ⚠️ Les valeurs des deep-links sont écrites **doublement encodées** dans le JSON (`%2520` pour une
> espace) : c'est la forme canonique que le moteur produit. Toute réécriture manuelle doit la
> respecter, sinon le paramètre est ignoré en silence.

**Deux correctifs moteur ont été nécessaires** :

1. `23267052` — à l'écriture de l'URL, les valeurs étaient jointes par virgule **sans être encodées**,
   alors que la lecture découpe puis décode. Trois des libellés ALD de la carte « Problème cardiaque »
   contiennent une virgule : ils étaient redécoupés en morceaux inexistants.
2. `81364659` — les facettes « par réponses » filtraient par **`_id` d'organisation** sur une liste
   qui porte les réponses elles-mêmes. D'où la clé `filterTarget: "answers"` et le prédicat
   `$exists` sur le chemin de la réponse. **MSS est le seul site du parc à poser cette clé.**

> ⚠️ Un `multiCheckboxPlus` stocke ses libellés en **clés**, pas en valeurs : le moteur émet
> `{ "<chemin>.<libellé>": { $exists: true } }` et non un `$in`. Corollaire à surveiller : **un
> libellé contenant un point est inexprimable** et son filtre n'est pas émis (panne silencieuse,
> avertissement en dev seulement). Contrôle : `npm run config:answer-labels` — 819 libellés concernés
> sur 246 185 en base, **aucun** sur le formulaire Ekilib.re.

**Recherche texte** câblée par `searchBy` à trois endroits (`8a1f2fbe`) : `/creneaux` (3 chemins de
champs de réponse — titre, description, point de repère ; l'adresse est volontairement exclue),
`/structure` (`name`, `shortDescription`, `description`, `tags`) et la table admin de modération.

**« Fiche structure »** sur une carte de créneau ouvre désormais la fiche **en modale** au lieu de
naviguer vers `/profil/:slug` en faisant perdre liste, filtres et défilement. C'est un **choix de
site** : `card.structureAction: { "kind": "preview" }`, absent = comportement historique (`b5a8cc06`
puis `af231d37`).

**Garde de non-régression** : une projection `answerFacets` dans la fixture de préflight du site fige,
pour chaque groupe, la cible, l'entrée `searchByFields` produite et le filtre Mongo émis.

---

### 9.13 Thème, projections, contact et garde de page (21→23/08)

> Commits : `c5f2b39b`, `92a25be1`, `0242c033`, `25d11489`, `821694d8`, `00ae840b`, `52393d63`,
> `05f219bc`→`f86ebc20`, `131b24f4`, `4c45a065`, `c378525b`.

**Trois pannes silencieuses.**

- **Thème amputé** (`c5f2b39b`) : le bloc `theme` n'avait ni `spacing`, ni `borderRadius`, ni
  `shadows`, et la feuille CSS partagée avec SSBE ne fournit **aucun repli** — tout le site rendait à
  angles vifs et sans ombre, pendant qu'`audit:config` annonçait « theme:complet ».
- **Projection de `/structure`** (`c5f2b39b`) : 25 champs projetés là où le formulaire en écrit 55. Le
  site web des fiches ne pouvait pas s'afficher, le bouton « Modifier » ouvrait le mauvais
  formulaire, les vignettes étaient vides. Plus grave : avec `payloadEmitEmptyOnEdit: true`, une
  projection incomplète ne tronque pas seulement l'affichage — elle **détruit en base** les champs non
  projetés à chaque édition. *(Ceci corrige la formulation trop douce de §9.5 bis, « les résultats
  étaient tronqués ».)*
- **Liens `tel:` / `mailto:`** (`00ae840b`) : les sections `cards`/`cta` les traitaient comme des
  chemins internes — le seul canal de contact réellement joignable du site renvoyait sur l'accueil en
  HTTP 200. Réparé par un contrat de lien unique (`src/lib/linkKind.ts`).

**Éditorial.** `/blog` est la **12ᵉ page** du site : `searchHeader` avec recherche plein texte et
facette « Catégorie » à 5 valeurs reprises de l'enum du formulaire (`0242c033`), entrée de nav
« Actualités », commande `articleSearch` dans la palette ⌘K. La date affichée par les cartes, le
lecteur et le JSON-LD devient la **date de publication saisie par l'éditeur** (`publicationDate`) au
lieu de la date de saisie (`821694d8`). Deux clés de site sont **posées** dans la config —
`blog.publicFilters: {publicationStatus: "Publié"}` et `blog.publicSortBy: {publicationDate: -1}` —
qui bornent trois canaux publics jusqu'ici non filtrés : **palette ⌘K, flux RSS et bloc « Articles
liés » distribuaient les brouillons et les archives** que les fils excluaient déjà (`25d11489`).

`/structure` reste en vue **split** à l'arrivée (`52393d63`, arbitrage produit du 21/08).

**Garde de page** (`05f219bc` → `f86ebc20`). Jusqu'au 21/08, `/espace-pro` était servie
**intégralement** en HTTP 200 à tout anonyme, listée au `sitemap.xml`, sans balise `robots`.
Aujourd'hui, mesuré sur la config MSS :

| | avant | après |
|---|---|---|
| sections rendues à un anonyme | 8 / 8 | **0 / 8** (516 caractères : nav, footer, invitation) |
| balise `robots` | aucune | `noindex,follow` |
| URLs au `sitemap.xml` | 12 | **11** (sur 12 pages) |
| parcours de connexion | expulsion vers `/login` | **modale sur place**, sans navigation |

Le parcours a changé **sans qu'un octet de la config MSS ne bouge** : `/espace-pro` ne pose que
`auth: { required: true }`, et le mode `prompt` est le repli codé en dur du moteur.

**Contact** (`131b24f4`). Le formulaire ne poste plus sur `/api/contact` — route qui n'a jamais
existé, ni en dev ni en prod, ce qui rendait la page morte depuis le début. Il passe par l'endpoint
`CONTACT_SEND` du SDK, mappé sur la route legacy `/co2/mailmanagement/createandsend` ; les clés
`action`/`method` ont été retirées de la config. **Dernier maillon, hors `site-json`** : le
destinataire n'est jamais choisi par le site, le serveur le résout depuis le costum
`associationEkilibre`.

> ⚠️ **Ordre de résolution : `costum.contactMail` d'ABORD, `costum.admin.email` seulement en REPLI**
> — parité du bloc CMS legacy (`contactForm.php:606` : `costum.contactMail || costum.admin.email`),
> portée serveur dans `resolveContactRecipients` (`cocolight-backend`,
> `modules/mailmanagement/mailmanagement.routes.ts`). Ce n'est pas cosmétique : le site jumeau
> `sportSanteBienetre` déclare **deux** adresses en `contactMail` alors que son `admin.email` n'en
> porte qu'une — le second destinataire disparaîtrait —, et `cyberReunion` n'a **que** `contactMail`.
> Plusieurs adresses (tableau ou chaîne à virgules) = **un mail par destinataire**. L'overlay porté
> par l'élément l'emporte sur le document `costum` du moteur.
>
> **Si aucune des deux n'est renseignée** : le backend Node refuse explicitement (« Ce site n'a pas
> d'adresse de contact configurée ») ; le **legacy**, lui, retombe sur `replyTo` et **renvoie le
> message à son auteur** — panne silencieuse côté MSS, qui est le backend visé aujourd'hui.

**Déploiement** (`4c45a065`). `sites.json` déclare pour `associationEkilibre` une application Coolify
`site-json-ekilibre`, un sous-domaine d'amorce `ekilibre.00.re` et `VITE_COSTUM_FORCE_LIVE: "true"`.
Cette dernière est la conséquence d'une décision assumée : le schéma costum n'est **pas** embarqué
dans l'artefact de build. Le site est déployable par `npm run deploy -- associationEkilibre`, mais
sans domaine propre et vers le backend par défaut du parc — **à confirmer** (§13).

**Gates au 23/08** : `config:validate` **12 pages / 47 sections**, 0 constat · préflight **537/537**
(34 fichiers) · unitaires **2 793/2 793** (225 fichiers) · `tsc -b` 0 erreur · SDK requis `^1.0.189`,
**installé 1.0.189**.

---

### 9.14 Scoping des saisies front refermé + « Documents ressources pro » (24/08)

> Commits : site-json `edb20de6` · costum `a15bdaa47`, `7ce80d9f0` · citizenToolKit `b0a8d0ec`.

**Le `source.key` des saisies front, refermé à la racine.** Le passage au scoping `sourceKey` (§9.9)
avait un angle mort : le contrat SDK `SAVE_COFORM_ANSWER` (`additionalProperties:false`) ne transporte
pas `costumSlug`, donc `Coform::saveAnswer` créait les réponses front **sans `source`** — invisibles
du site (constaté sur un créneau ajouté le 24/08 au matin). Deux correctifs backend : un **repli
« orga porteuse »** dans `Coform::saveAnswer` (`b0a8d0ec` — si l'orga du form porte un costum
embarqué, la réponse est scopée sur son slug, comme une saisie faite sous le costum ; corrige le même
bug latent pour tout site SiteForge) et **`fixSourceKey` élargi** (`a15bdaa47`) à TOUTE réponse du
form hors scope — copies héritées de SSBE comme saisies directes. Appliqué en dev le 24/08 :
`config:probe` remonte **44 résultats** sur `/creneaux`.

**Documents ressources pro (CDC §4.5)** — réutilisation du module ressources de **parent62**
(`edb20de6`, **0 code front**) : une ressource = un **POI `type:"recoveryCenter"`** scopé
`source.keys:["associationEkilibre"]`, champs plats `category` (5 valeurs CDC : Recommandations /
Bonnes pratiques / Bilans & parcours / Formulaires de prescription / Autres) et `status`
(Visible / Brouillon, défaut **Brouillon** — même logique anti-publication accidentelle que les
actualités). Quatre morceaux de config : `costumForms["ekilibre-ressource"]` (nom*, catégorie*,
description, PDF via widget `file` `accept:"application/pdf"`, lien externe `urlList`, statut) ·
page publique **`/ressources`** (annuaire des **publiés seulement** — `defaultFilters
{status:"Visible"}` —, recherche nom/description, filtre catégorie, cartes `resource` à badge coloré
`chart-1…5`) · entrée de nav · onglet **admin `ressources`** (`siteAdmin`, table `resource` en mode
`statusField` Brouillon/Visible, création/édition/suppression) + route `edit-ekilibre-ressource`
dans `profiles.poi.editModals`, **bornée au costum** (`sourceKeys contains associationEkilibre`,
piège institutBleu).

**La découverte structurante — la déclaration `typeObj` en base est un prérequis dur.** Le SDK
n'accepte au save d'une entité sous scope costum que les champs déclarés dans le **costum résolu**
(`costum/co/resolved` → `typeObj`, résolution **live-first**) ; or le costum embarqué de l'orga n'en
avait **aucun**. Symptômes mesurés : au create les champs costum sont **écartés en silence** (« test
doc » créé sans `category`), à l'édition ils sont **rejetés**
(`[DraftProxy] Le champ "category" n'est pas autorisé.`). Correctif : action URL
**`costum/ekilibreMigration/declarePoiTypes`** (`7ce80d9f0`, dry-run + `/apply/1`) qui pose
`costum.typeObj.article` **et** `costum.typeObj.recoveryCenter` — la déclaration `article` referme au
passage une panne **latente** des actualités (champs `category`/`publicationDate`/`link`/
`publicationStatus`/`featured` jamais déclarés ; 0 article créé, le flux n'avait jamais été exercé).
Volontairement **sans enums en base** : le form du site reste seul juge des valeurs. **À rejouer en
PROD** — l'action rejoint le runbook §9.11.

> **Mise à jour du 03/10 — pas jouée en PROD.** Le dump de PROD du 30/09 montre
> `costum.typeObj = {organizations, article}` sur `associationEkilibre` : le nœud `article` y est (posé
> par `add-article-node.mjs`, étape 2 du runbook), `recoveryCenter` **non**. La relance doit poser
> **`recoveryCenter` SEUL** — l'action réécrit aussi `article` (`$set` des deux nœuds) et écraserait le
> nœud de PROD. D'ici là, le formulaire « Ressources pro » d'**ekilibre.00.re** (site en
> `VITE_COSTUM_FORCE_LIVE`) est **cassé** : création sans `category`/`status`, édition rejetée par le
> DraftProxy (e2e live du 02/10, `ekilibre-ressource`). Détail et procédure : runbook §9.11.

**Recette réelle du 24/08 (navigateur, base vérifiée)** : déclaration appliquée → « test doc » créé,
statut basculé Visible depuis la table admin, `category:"Bonnes pratiques"` posée à l'édition —
create / statut / edit verts de bout en bout.

**Écarts assumés** : la limite **10 Mo** et l'exigence **HTTPS** du CDC sont **informatives** côté
front (mentions sous les champs ; le serveur garde ses limites d'upload) — blocage strict = petite
évolution du widget `file` si exigée. Le **type PDF / lien** est dérivé du contenu (PDF si document
joint, lien si `urls`), pas un champ saisi.

**Gates au 24/08** : `config:validate` **13 pages / 49 sections** · `audit:config` RAS · préflight
**534/534** (snapshot effective à jour) · `config:render` **13/13 pages** · `config:probe` :
`/creneaux` 44 résultats, `/ressources` périmètre neuf (1 ressource après recette) · `tsc -b`
0 erreur · SDK requis `^1.0.189`, installé **1.0.189**.

---

### 9.15 Compteurs statistiques dynamiques sur la home — 1ᵉʳ lot (08/09, Nicolas, `21f0d53f`)

**Demande** : les 4 chiffres de la section « Ekilib.re en chiffres » (accueil, section
`cta-card-grid#chiffres-ekilibre`) sont codés en dur depuis l'init (constat A.6 de la checklist,
question en attente depuis le 31/07, §13) — les brancher sur des données réelles.

**Réalisation** : extension **opt-in** du schéma `CtaCardGridSchema.props.stats[]` — nouveau champ
`source` (`StatDynamicSourceSchema`, union `searchCount` / `membersCount`) résolu **côté client**
par un nouveau hook `useStatDynamicValue`. Sans `source`, un stat reste identique à avant (`value`
requis, statique). Volontairement **indépendant du module `admin`** bien que le contrat calque celui
des KPIs du dashboard (`AdminDashboardKpiSchema`, §9.6) : ces stats sont rendues sur une page
**publique**, elles ne doivent dépendre que de hooks déjà publics (`useSearchAllResults` — même
`searchCostum` que les sections search — et `useEntityMembers`), jamais du module `admin`.

| Item de `stats[]` | Branché ? | Source | Pourquoi |
|---|---|---|---|
| **Créneaux disponibles** | ✅ dynamique | `source.searchCount`, mêmes `baseParams` que le KPI admin « Créneaux actifs » (§9.6) : `sourceKey:["associationEkilibre"]`, `form:"6a85af345d898a57cb49f029"`, statut `"Validé"` | seul mapping sans ambiguïté — réutilise une définition déjà validée en admin |
| Activités proposées | 🟡 statique (`8`) | — | aucune entité identifiée en base pour ce compte |
| Participants actifs | 🟡 statique (`340+`) | — | **≠** le KPI admin « Usagers actifs », que l'admin lui-même déclare **non raccordé** (analytics RGPD, §9.6/§13) — le mapper sur `membersCount` produirait un chiffre faux (ordres de grandeur incompatibles avec « 0 pro en attente ») |
| Partenaires | 🟡 statique (`12`) | — | aucune notion SDK correspondante identifiée (pas des « membres », pas des réponses de formulaire) |

**Comportement `value` / `source`** : `value` devient optionnel — mais un `.refine()` Zod interdit un
stat sans **aucun** des deux. Avec `source` seul (cas actuel de « Créneaux disponibles », `value`
retiré de la config), un skeleton (`@/components/ui/skeleton`, déjà utilisé par le dashboard admin)
comble l'attente ; avec `value` **et** `source` tous les deux, `value` sert de repli immédiat (SSR,
anti-flash) tant que le fetch n'a pas résolu. Jamais de chiffre inventé dans les deux cas — le hook
renvoie `null` tant que la donnée n'est pas connue (`searchCount.total` nativement `null` avant la
1ʳᵉ page ; garde explicite `isLoading` côté `membersCount`, dont le `totalCount` vaut `0` par défaut
avant chargement).

**Fetch côté client uniquement** (comme le dashboard admin dont cette logique est le pendant
public) — pas de prefetch SSR pour ce lot ; amélioration possible en itération suivante si le flash
initial (le temps du fetch client) s'avère gênant en usage réel.

**Fichiers** : `src/types/site-schema.ts` (`StatDynamicSourceSchema` + `source` sur `stats[]`) ·
`src/components/sections/useStatDynamicValue.ts` (nouveau hook) ·
`src/components/sections/useStatDynamicValue.test.ts` (nouveau, 6 tests — anti-flash `isLoading`,
garde entité absente, désactivation propre des deux hooks sous-jacents) ·
`src/components/sections/CtaCardGrid.tsx` (sous-composant `StatTile`) ·
`config.prod.maison-sport-sante-la-tampon.json` (item « Créneaux disponibles »).

**Gates (08/09)** : `config:validate` ✅ **13 pages / 49 sections** (site cible) et les **4 autres**
sites utilisant `cta-card-grid` (`rezo-la-mer`, `cyber-reunion`, `sport-sante-bien-etre`,
`rezo-sante-reunion`) toujours ✅ — rétrocompatibilité vérifiée, `source` étant strictement
optionnel · `tsc -b` ✅ 0 erreur · lint ✅ 0 erreur sur les fichiers du lot · `useStatDynamicValue`
**6/6** ✅.

**Reste sur ce lot** : trancher la source (si une existe) des 3 stats encore statiques — cf. §13.

---


### 9.16 Ce que le site régional lui doit — et ce qu'il lui reste à reprendre (08/09)

Une analyse croisée avec [Sport Santé Bien-être](sport-sante-bien-etre.md) a établi, `git log` à
l'appui, que la page `/creneaux` d'Ekilib.re a été **copiée depuis SSBE** en août puis corrigée ici
en huit commits (20→23/08). SSBE a ensuite emprunté la contribution et la modération sans ces
corrections : c'est une dette de rétro-portage, pas une dérivation à sens unique.

**Ce qui reste à reprendre ICI**, mesuré côté SSBE et applicable au Tampon :

| Geste | Pourquoi |
|---|---|
| `sortable: false` sur les 4 colonnes fabriquées de la modération | Ces colonnes sont produites par le hook PHP **après** la requête Mongo : trier dessus ordonne au hasard et déstabilise le scroll infini. La doc SSBE le signale depuis le 02/09 |
| `enableMap: false` sur `/ressources` | Le correctif `eb4db0ab` n'a jamais été rapatrié : un annuaire de documents propose encore une bascule Carte. `showMap: false` ne suffit pas, le code lit `enableMap` |
| `structureAction.audience: "managers"` | Le bouton « Fiche structure » reste exposé à tout le monde ; le gate est neuf, créé pour SSBE |
| `badge.labels` et `badge.icons` sur `/ressources` | Les deux clés que la MR 51 a créées. Les valeurs stockées ici SONT les libellés, donc pas de clé brute affichée — mais la pastille reste **française en version anglaise**, alors que les traductions existent déjà dans ce fichier |
| `navigateOnSuccess: false` sur `costumForms.structure` | Créer une structure depuis `/admin` éjecte l'administrateur (2 formulaires sur 3 le portent, pas celui-là) |
| `searchBy` sur l'onglet admin `ressources` | Ici c'est SSBE qui a l'avantage : aucun `searchBy`, la recherche de la table ne fouille pas la description |
| `label` sur les états de statut | 12 des 13 états des tables admin s'affichent en français brut sur un back-office bilingue |
| Sections `html` en `LocalizedString` | Les 3 sections `html` sur 3 — dont les trois pages légales — portent une chaîne brute française sur un site déclaré bilingue |
| `members.filters` avec `isInviting` | L'onglet Membres perd la liste des invités en attente que SSBE affiche |

**Un défaut partagé, de donnée et non de config** : le filtre « Bénéficiaires » de `/creneaux`
s'appuie sur un `$in`, égalité exacte. Côté SSBE, 232 réponses stockent les cases cochées en une
chaîne collée et sont donc invisibles au filtre. Ekilib.re **n'a qu'une réponse**, correctement
stockée — il ne rencontre pas le défaut, il n'y est pas immunisé. Le script de normalisation
([`../tools/ssbe-creneaux/normalize-beneficiaires.mjs`](../tools/ssbe-creneaux/normalize-beneficiaires.mjs))
est paramétrable par formulaire et s'appliquerait ici à l'identique si le stock grossissait.

⚠ **Palette ⌘K** : `params.sourceKey` inclut `"sportSanteBienetre"` — un périmètre régional que
`/structure` prend soin d'exclure. Élargissement volontaire ou oubli, à trancher (§13). Et elle ne
filtre pas `statusActor`, contrairement à `/structure` : écart théorique ici (les 14 structures sont
validées), mais SSBE a dû poser la garde pour 32 fiches.

---

### 9.17 Formulaire `structure` aligné sur la refonte dynForm-legacy de SSBE (15/09, session en cours)

**Demande utilisateur** : « mettre le formulaire structure en marche comme celui du
sportSanteBienetre (champ, formulaire ainsi que `statusActor`) ». Point de départ vérifié avant tout
changement : `statusActor` était **déjà** fonctionnel côté Ekilib.re, à l'identique de SSBE — inject
create-only (`mutation.inject.extraFields.statusActor: "En cours"`) et blocage `statusField` dans
l'onglet admin Structures (mêmes 4 états/tons). Ce qui manquait réellement, c'est l'alignement du
**schéma** du formulaire lui-même : `costumForms.structure` était resté à la version du 06/08
(§9.5 bis, 44 champs) pendant que `sport-sante-bienetre-organizations` passait à 49 champs le 09/09
([Sport Santé Bien-être](sport-sante-bien-etre.md), §9 lot du 09/09).

**Vérification décisive avant d'implémenter** : le contrat live réel du costum `associationEkilibre`
(`tests/preflight/__contract__/costum-types.live.json`) a été inspecté pour trancher un doute sur le
téléphone — l'oracle de test existant défendait explicitement la forme objet `telephone:{mobile:[…]}`
comme correspondant à la donnée majoritaire du réseau SSBE (128/138 orgs), alors que SSBE avait basculé
sur un champ plat `mobile` le 09/09. Le contrat live tranche : `associationEkilibre` déclare **`mobile`**
et **`link`**, jamais `telephone` ni `url` — ces deux renommages n'étaient donc pas qu'un alignement
cosmétique sur le site frère, mais une correction d'un écart avec le contrat backend réel du costum
d'Ekilib.re lui-même. Le contrat confirme aussi la présence de `infoGeneral`/`similarLink`/
`formLocality`/`location`/`image`/`youtube`/`linkedin` — ce ne sont donc pas des vestiges propres au
costum `sportSanteBienetre`, contrairement à ce qu'on aurait pu supposer en les voyant seulement dans
la config SSBE.

**Changements appliqués à `costumForms.structure`** :

| Point | Avant (06/08) | Après (15/09) |
|---|---|---|
| Téléphone | `telephone` (widget `tel`, `group`) + `_telSlot`/`_telRest` cachés, `serializeGroups.telephone` → `{mobile:[…]}` | champ plat `mobile` (widget `tel`) |
| Site web | `url` | renommé `link` (le contrat live n'a jamais connu `url`) |
| `affiliate` | `select` "Oui"/"Non" | `switch` + `write:coerce:boolString` (`affiliateTo.visibleIf` passe de `eq:"Oui"` à `truthy`) |
| Titres représentant/responsable | `select` + champ « Autre... » séparé (`otherRepresentativeTitle`/`otherPersonInChargeTitle`, codec de groupe `enumOrOther`) | un seul champ `valueSelect` mono `creatable` — même clé serveur, saisie libre directe |
| `responsableSameAsRepresent` | `switch` sans coercion d'écriture | + `write:coerce:boolString` |
| Domaine d'intervention (`thematic`) | `checkboxGroup` (variante cartes) | `multiselect`, identique à SSBE — même widget, mêmes options, même clé serveur |
| Champs ajoutés | — | `description` (textarea) et 7 champs cachés non placés (`infoGeneral`, `similarLink`, `formLocality`, `location`, `image`, `youtube`, `linkedin`) pour la parité déclarative |

**Deux écarts volontairement NON alignés sur SSBE**, chacun avec une raison métier ou technique propre
à Ekilib.re, pas une simple préférence :

- **`_imageFile` conservé** (pas de renommage en `profil_avatar`) : c'est un pattern déjà en usage et
  testé ailleurs dans le parc (`equipements-sportifs`, `tiers-lieux`) ; aucun gain fonctionnel à le
  renommer, et cela aurait cassé des assertions de test qui verrouillent ce nom depuis le 06/08.
- **`statusCommunale` garde sa liste à 2 valeurs** (97418/97430) plutôt que les 36 communes de SSBE :
  c'est la décision produit du 20/08 (§9.9, « territoire = Le Tampon seul »), sans rapport avec
  l'alignement de formulaire — la reprendre aurait réintroduit tout le territoire régional dans un
  champ de ce site.

**Un « fantôme » de drift attendu, non bloquant.** Le nœud `costum.typeObj.organizations`
d'`associationEkilibre` a été amendé le 20/08 (§9.9) avec **trois propriétés que la whitelist rabotait
en silence** : `otherRepresentativeTitle`, `otherPersonInChargeTitle`, `statusActor` — précisément pour
que l'ancien formulaire (split en 2 champs) ne perde pas de données au save. En retirant ces deux
champs du formulaire, ils deviennent des clés déclarées côté backend mais plus jamais écrites — même
catégorie que les vestiges `youtube`/`linkedin` déjà tolérés côté SSBE (§4.2 de sa doc). Non bloquant,
mais à garder en tête si `config:costum-drift` les signale un jour côté `associationEkilibre`.

**Tests** : `structure.configDriven.test.ts` (oracle dédié, chargé via `loadCostumForm("structure")`
depuis ce même fichier de config) mis à jour en conséquence — `FILLED` et les assertions de payload
(`mobile` plat, `affiliate` en chaîne `"true"`/`"false"`), le describe « 15. enumOrOther » remplacé par
un describe équivalent pour le `valueSelect` mono, les cas `visibleIf` des champs « other* » disparus
retirés.

**Gates (15/09)** : `config:validate` ✅ **13 pages / 49 sections** · `audit:config` ✅ RAS (`strip:0`)
· `structure.configDriven.test.ts` ✅ **42/42** · suite `profil`+`formEngine`+`search`+`admin` ✅
**1118/1118** (zéro régression sur SSBE, qui partage `structure:tagsFromThematic`) · `test:unit` complet
✅ **4252/4254** — les 2 échecs restants sont **préexistants et sans lien** (`bundle-size` > 2 Mo,
`site-assets` dossier `associationEkilibre` non déclaré — déjà documentés au lot SSBE du 09/09 et en
§12 de ce document) · `typecheck` ✅ 0 erreur · `lint` ✅ 0 erreur.

**Reste sur ce lot** : commit — la recette navigateur a eu lieu dans la foulée (§9.17 bis) et a
directement validé le wizard modifié (`affiliate`, titres en saisie libre, champ téléphone renommé,
domaine d'intervention).

---

### 9.17 bis Recette navigateur du lot précédent — bug d'édition des pièces jointes trouvé et corrigé (15/09)

**Recette réelle en navigateur** (première recette de ce formulaire depuis le 06/08, cf. checklist
A.8) : création d'une structure réussie de bout en bout, `statusActor` posé à « En cours » comme
attendu. Deux trouvailles en cours de route, toutes deux réglées le jour même :

**1. `thematic` en `checkboxGroup` au lieu de `multiselect`.** Écart de widget par rapport à SSBE
laissé de côté lors du lot précédent en le jugeant purement cosmétique (même sortie serveur, tableau
`thematic`) — erreur de méthode : la demande portait explicitement sur une parité formulaire **et**
donnée avec SSBE, pas seulement sur la donnée. Corrigé : `thematic` passe en `multiselect`, identique
à SSBE (même widget, mêmes options, même clé). Aucun impact sur `structure:tagsFromThematic` ni sur
les tests (la forme des données ne change pas).

**2. Édition — les pièces jointes déjà uploadées ne réapparaissaient pas dans le formulaire, mais
uniquement depuis le bouton Modifier de la fiche `/structure`** (l'édition depuis l'onglet admin
Structures fonctionnait, elle). Testé comparativement sur SSBE (`/mss`) : le même bouton y fonctionne
partout. Cause identifiée dans le code partagé
[`PreviewStructure.tsx`](../src/modules/search/components/preview/PreviewStructure.tsx) : le
composant recharge bien la fiche complète avec `about.files` via `useEntityBySlugQuery` (`fullEntity`,
ligne ~290), mais seulement pour l'affichage de la section Documents — le bouton Modifier ouvrait
`DynamicEditModal` avec l'`item` de recherche original (tronqué, sans `about.files`), jamais remplacé
par `fullEntity`. Un garde-fou existant (`org.refresh()`) était censé recharger l'entité au besoin,
mais sa condition de déclenchement (`siren`/`sigle`/`thematic` absents) ne dit rien sur la présence
des DOCUMENTS, qu'aucune projection de recherche ne porte jamais — sur Ekilib.re, la projection
`/structure` complète (55 champs, §9.13) contient toujours ces trois champs, donc le refresh ne
partait jamais ; sur SSBE, ce n'était apparemment pas le cas, ce qui masquait le bug. **Correctif** :
`DynamicEditModal` reçoit désormais `fullEntity.data ?? item` — l'entité déjà rechargée avec
`about.files` dès qu'elle est disponible, repli sur `item` pendant le chargement. Bug préexistant dans
un composant **partagé** (Ekilib.re + SSBE), pas introduit par ce lot ; **recette confirmée par
l'utilisateur** après correctif, sur les deux chemins d'édition (`/structure` et l'onglet admin).

**Gates** : `config:validate`/`audit:config` ✅ RAS · `config:costum-drift` (`--json`, avec
`VITE_COSTUM_FORCE_LIVE=true` pour une résolution réellement live plutôt que l'artefact SDK bundlé) ✅
**0 fantôme** sur `structure` · `typecheck` ✅ 0 erreur · `lint` ✅ 0 erreur · suite `search` ✅
**462/462** (aucun test dédié à `PreviewStructure` dans le dépôt à ce jour — recette faite en
navigateur).

⚠️ **Leçon retenue pour la suite** : `config:costum-drift` doit toujours être lancé avec
`VITE_COSTUM_FORCE_LIVE=true` explicitement exporté — sans lui, la garde compare au bundle SDK figé et
peut signaler un faux « fantôme » (constaté sur ce lot, cause d'un aller-retour évitable).

### 9.18 Onglet admin « Référencement » : le vivier n'était pas restreint à `sportSanteBienetre` (21/09)

**Symptôme** (signalé par Nicolas, capture réseau à l'appui) : dans le sous-onglet « Rechercher &
référencer », des organisations de provenance `transiter`, `cocityPrez`, `LaReunionDesTiersLieux` — et
même **sans provenance** — remontaient, alors que la config cible `sportSanteBienetre`.

**Cause** : la requête partait bien avec `filters[source.keys][$in]=sportSanteBienetre` **et**
`filters[source.keys][$nin]=associationEkilibre` (la garde « déjà rattaché » du composant, fusionnée sur
la même clé — [`buildOpenSearchFilters`](../src/modules/admin/sections/AdminReferenceSection.tsx)). Mais
`SearchNew::searchFilters` (backend, `citizenToolKit/models/SearchNew.php`) est une chaîne de `else if` :
**un seul opérateur par clé**, et `$nin` est testé avant `$in`. Le `$in` était donc jeté en silence ; la
requête réelle se réduisait à « `source.keys` ne contient pas associationEkilibre » — ce qui accepte aussi
les documents où le champ est absent (d'où la provenance vide). Reproduit en isolant `searchFilters`
(script PHP + stubs Mongo) avant toute modification.

**Correctifs** (trois couches, non commités) :

| Couche | Changement |
|---|---|
| Config | `search.defaultFilters` de l'onglet Référencement : `"source.keys"` → **`"source.key"`** (provenance principale, scalaire, clé distincte de la garde). Fonctionne **avec ou sans** le correctif backend, et exclut aussi la provenance vide |
| Backend (`citizenToolKit`, branche locale `fix/search-filters-in-nin-combined`) | branche `$nin` de `searchFilters` : combine `$in` + `$nin` sur une même clé (y compris conversion `MongoId` pour `_id`). `$nin` seul et `$in` seul inchangés. Aucun appelant existant ne combinait les deux via ce chemin |
| site-json | commentaire de `buildOpenSearchFilters` (dépendance au correctif backend + repli `source.key`), test de non-régression sur `source.key`, [doc/30](../doc/30-module-admin.md) |

**Gates** : `config:validate` ✅ (13 pages / 49 sections) · `audit:config` ✅ RAS pour ce site ·
`typecheck` ✅ · test `buildOpenSearchFilters` ✅ 6/6 · lint : 0 erreur (1 warning préexistant,
`react-refresh/only-export-components`) · backend : `php -l` ✅ + 5 cas isolés ✅ (dont le cas du bug,
d'abord rouge). **Rendu navigateur non rejoué** : l'endpoint admin exige une session — à vérifier en
rechargeant l'onglet (le payload doit porter `filters[source.key]=sportSanteBienetre`, la colonne
Provenance ne doit contenir que cette valeur).

~~⚠️ **À confirmer** : les organisations dont `source.keys` contient `sportSanteBienetre` mais dont
`source.key` est vide ou autre seraient **exclues** du vivier par `source.key`.~~ Sans objet depuis la
décision du 24/09 (ci-dessous) de garder `source.keys` — et mesuré : aucune fiche dans ce cas sur les
deux codes postaux (même vivier avec les deux clés, en dev comme en prod).

⚠️ **Déploiement** : le correctif backend est **indépendant** de la config (la config seule suffit ici).
Il corrige le défaut pour tout autre appelant de `searchFilters` ; à livrer avec le prochain
déploiement de `citizenToolKit`.

**Décision du 24/09 (review de la MR `n-dev` → `main`) : on garde `source.keys`.** La couche Config du
tableau ci-dessus n'a finalement **pas** été appliquée (`6378660c` ne porte que la doc, le commentaire
et le test) : c'est le correctif backend, commité sur `origin/master` de `citizenToolKit` (`7b19f871`),
qui répare le filtre. Sondage en lecture seule du vivier (mêmes filtres via `buildOpenSearchFilters`,
recherche publique) : `source.keys` et `source.key` renvoient **le même vivier, 100 %
`sportSanteBienetre`** — 11 candidates en dev, 14 en prod. Conséquence : ce site **dépend** du correctif
backend ; sur un backend qui ne l'a pas, le vivier redevient non filtré (repli : `source.key`).

---

### 9.19 Charte Ekilib.re : CSS propre au site, thème bleu/jaune/vert et ajustements de contenu (23/09, Nicolas, `beef21d9`)

**Pourquoi un CSS dédié.** Le site partageait [`index-sport-sante-bien-etre.css`](../src/index-sport-sante-bien-etre.css)
avec son jumeau régional. Ce fichier cale ses **recettes de dégradé** sur l'identité SSBE (« Lagon &
Corail ») : l'accent y est un corail moyen qui porte du **texte clair**. La charte Ekilib.re fait de
l'accent un **jaune clair** (#F0B429) qui exige du **texte foncé** — même schéma que le couple
`warning`/`warning-foreground`. Sous cette bascule, les recettes SSBE devenaient illisibles :
`.access-card-public` dégradait l'accent vers `--destructive` (rouge), soit **2,55:1** avec le texte
foncé de l'accent (ratios WCAG recalculés depuis les tokens oklch de la config). Paramétrer les
recettes SSBE pour deux chartes aurait touché le site régional ; le fichier a donc été **séparé** —
`styles/shared.css` et tous les composants restent communs aux deux sites.

**Ce qui change** (config + CSS uniquement, **0 code applicatif**) :

| Domaine | Changement |
|---|---|
| `sites.json` | `associationEkilibre.css` : `index-sport-sante-bien-etre` → **`index-maison-sport-sante-la-tampon`** |
| Nouveau CSS (290 lignes) | `@theme inline` (mapping vars→classes Tailwind, dont les sémantiques `warning`/`success`/`info`/`error` consommées par les modules partagés), safelist `grid-cols`, vars bespoke (`--card-header-gradient`, `--card-border-left`, `--btn-activity`, `--btn-structure`, badges, `--gradient-hero/-pro/-section`), base/prose/scrollbar, `.access-card*`. **Aucun token shadcn redéfini** : ils viennent de `config.theme` via `SiteTheme.tsx` |
| `theme.colors` (clair + sombre) | palette repassée sur la charte : **primary `oklch(0.411 0.080 242)` = #1B4F72**, **accent `oklch(0.804 0.156 82.5)` = #F0B429**, **success `oklch(0.516 0.104 162)` = #1A7A55** (conversions vérifiées), plus les dérivés (secondary, muted, border, ring, sidebar, chart1-3) réalignés sur les teintes 242 / 82.5 / 162. Le teal #21B2AA de l'ancien site ekilib.re **n'appartient pas** à cette charte |
| `theme.customCSS` | en-tête des cartes **SSsO** : jaune **creusé** en mode clair (le titre est écrit en `text-primary-foreground`), plein en sombre via une règle `.dark` dédiée ; les règles SSpT et le liseré gauche sont inchangés |
| Nav | entrée « Structure référentes » **retirée** → nav à 6 entrées ; `/structure` reste atteignable par le bouton du bandeau de `/creneaux` |
| `/structure` | bouton public « Ajouter ma structure » **retiré** ; titre de section « Structures référencées » ajouté ; grille `1/1/1/1` → **`2/3/3/3`** ; carte en `splitRatio: "50-50"` |
| `/admin` → Structures | `create: false` (plus de création côté admin non plus) — **rouvert le 07/10**, §9.22 |
| Actualités | `cardVariant: "poster"` sur les `articleFeed` de `/` et `/blog` (affiches/flyers rendus entiers) — `/espace-pro` garde le variant par défaut |
| Liens `ssbe.re` | **6** liens passés en `https://www.ssbe.re/`, dont **3** vers l'ancre **`#maisons-sport-sante`** (l'ancienne page `/maison-sport-sante-mss/` n'est plus la cible) |
| Pied de page | adresse postale complète (**34 rue Hubert Delisle, 97430 Le Tampon**) au lieu de « Commune du Tampon » ; bloc **`socials`** ajouté (Facebook, LinkedIn, mail) — **retiré le 08/10**, ces liens passent dans les lignes de contact (§9.23) ; copyright « © 2026 **Association Ekilib.re** – Maison Sport Santé du Tampon » |
| Asset | `public/images/maisonSportSanteLaTampon/logo.svg` retravaillé (dans le même commit) |

**Contrastes mesurés** (WCAG, recalculés depuis les tokens oklch — ce sont eux qui motivent chaque
recette du fichier) :

| Couple | Ratio | Conséquence |
|---|---|---|
| jaune plein × `primary-foreground` (quasi-blanc) | **1,81:1** | interdit — d'où le creusement du jaune partout où le composant impose son texte clair |
| jaune plein × `accent-foreground` (foncé) | **7,34:1** | le couple natif de l'accent, utilisé tel quel (`.access-card-public` part de là) |
| jaune creusé 85% × `accent-foreground` | **4,76:1** | bas du dégradé de `.access-card-public` : AA tenu d'un bout à l'autre |
| jaune creusé 62% × `primary-foreground` | **5,92:1** | `--btn-structure` et les en-têtes de carte en mode clair |
| `destructive` × `accent-foreground` | **2,55:1** | la recette SSBE sous la nouvelle palette — le déclencheur de la séparation |
| primary × `primary-foreground` | **8,46:1** | le bleu tient les CTA sans retouche |
| success (vert) × `primary-foreground` | **5,16:1** | carte « pro » du héros (`--gradient-pro`) |

**Gates mesurés le 23/09** : `config:validate` ✅ **13 pages / 49 sections** · `audit:config` ✅ RAS
(`theme:complet`) · `typecheck` ✅ 0 erreur · `lint` ✅ 0 erreur (25 warnings préexistants) ·
préflight `sites-configs` + `site-assets` + `logo-assets` + `config-integrity` ✅ **251/251** ·
`vite build` (client, `VITE_SLUG=associationEkilibre`) ✅ — le CSS du site est bien compilé dans le
bundle (`.access-card-public` présent, avec le repli sans `color-mix`).

**Reste sur ce lot** : **recette navigateur non tracée** (à confirmer par Nicolas — la palette a été
itérée en navigateur les 22-23/09, mais aucun passage complet n'est consigné). À couvrir en priorité :
le **mode sombre**, seul endroit où `--btn-structure` et `--card-header-gradient` basculent, et les
en-têtes de cartes SSsO/SSpT. ~~⚠️ **Incohérence à trancher** : le lien social « mail » du pied de page pointe sur
`contact@cyber-reunion.fr` alors que **tout le reste du site** (contact, mentions légales,
confidentialité, accessibilité) affiche `contact@ekilib.re` (§13).~~ **Réglé** : le lien est passé à
`contact@ekilib.re` le 24/09 (`7cdc0fa8`), puis la rangée `socials` a été retirée le 08/10 (§9.23).
Les **mentions légales** portent encore « Commune du Tampon, La Réunion (97430) » et la page
**confidentialité** « Siège social : Commune du Tampon, La Réunion (974) », non alignées sur la
nouvelle adresse postale (vérifié le 08/10).

### 9.20 Corrections de la review de la MR `n-dev` → `main` touchant ce site (24/09)

Composants et clés **partagés avec SSBE** — le détail vit dans `sport-sante-bien-etre.md` (§12, §13 q.15) :

- **Fiche structure (`PreviewStructure`)** : les blocs **Informations** (identifiant, catégorie, membre
  de, créé le) et **Documents** ne sont plus affichés qu'aux **gestionnaires** (admin de la structure
  ou du costum, `canEditProfile`), en parité avec la fiche legacy SSBE (`$ssbeCanManage`). Validé par
  Nicolas pour le Tampon aussi. Côté backend, `Organization::getById` ne joint plus `files` qu'à ces
  mêmes gestionnaires (`citizenToolKit`, modifié en local, à committer et déployer).
- **Téléphone** : le champ `mobile` du formulaire `structure` est pré-rempli par
  `read: "structure:mobileRead"` (repli sur `telephone.mobile`/`fixe`) ; `PreviewStructure` et
  `CardContact` lisent `mobile` plat en priorité.
- **Site web** : le champ `link` du formulaire `structure` est pré-rempli par
  `read: "structure:linkRead"` (repli sur `url`) ; `PreviewStructure` lit `link` puis `url` et ajoute
  `https://` au lien affiché s'il manque. Utile surtout pour les fiches SSBE référencées, que ce site
  affiche. Le champ garde sa règle `url` (un `link` sans `https://` doit être complété avant
  d'enregistrer — cas de la seule fiche du périmètre en prod, COMMUNE DU TAMPON).
- **Badge « Affiliée »** (`PreviewStructure`) : testait `affiliate === "Oui"`, alors que le formulaire
  actuel écrit `"true"` (livré en booléen par l'API) — lu désormais par `coerceBool`. En dev, 3 des 4
  structures affiliées du périmètre n'avaient pas leur badge. En prod, aucun changement visible
  aujourd'hui : le périmètre ne compte qu'une fiche (COMMUNE DU TAMPON), affiliée mais sans
  `affiliateTo`, donc sans bandeau d'affiliation. Le correctif comptera quand des fiches SSBE seront
  référencées en prod (les 14 référencements du 20/08 sont sur le dev).
- **Contraste des cartes d'accès rapide de l'accueil** (« Trouver un créneau » / « Professionnels de
  santé ») : la règle de base `h1…h6, p { text-foreground }` de `index-maison-sport-sante-la-tampon.css`
  imposait le texte foncé du site au titre et à la description, au lieu de la couleur de la carte
  (2,14:1 sur le vert en clair, 1,53:1 sur le jaune en sombre), et l'`opacity-90` de `HeroQuickAccess`
  faisait tomber le petit texte sous 4,5:1. Règle ajoutée HORS `@layer` (`.access-card h3, p, span {
  color: inherit; opacity: 1 }`, vérifiée non-layered dans le CSS compilé) : 4,76 à 6,63:1, AA partout.
  Visible : le texte de la carte jaune en clair passe du bleu nuit au brun de `accent-foreground`.
- **Chiffre « 340+ » (section `#chiffres-ekilibre` de l'accueil)** : posé en `color: "accent"`, soit du
  jaune de la charte en TEXTE sur fond clair → 1,83:1 (sous le seuil AA de 3:1 du grand texte ; 10,77:1
  en sombre). Passé en `"primary"` comme les trois autres chiffres : 8,53:1 en clair, 7,21:1 en sombre.
  Le jaune reste une couleur de SURFACE sur ce site ; `chart-2`, l'autre option du composant, est aussi
  un jaune (2,21:1).
- **Pièces jointes à l'édition** : un document ancien sans `subKey` reste proposé dans chaque champ
  fichier (il disparaissait dès le premier nouvel upload).
- **Référencement** : le vivier reste ciblé sur `source.keys` (§9.18, décision du 24/09).
- **Création de structures fermée sur ce site** (décision du responsable MSS Tampon, rappelée par
  Nicolas le 24/09) : les fiches de `/structure` viennent **uniquement du référencement** de fiches
  SSBE. Vérifié : `create: false` sur les deux onglets admin structure, plus aucune référence à
  `add-structure` dans les pages. *(07/10 : la création admin est rouverte sur l'onglet Structures,
  §9.22.)* Conséquence : ce qu'affiche le site dépend des **données SSBE**
  (formulaire SSBE et legacy ssbe.re), pas du formulaire `structure` d'ici.
- **Filtre « Domaine d'intervention » de `/structure` RETIRÉ** (24/09, décision de Nicolas). Il
  filtrait `tags`, or en prod seules 25 fiches SSBE sur 148 portent des `tags` (144 portent
  `thematic`), et les valeurs de domaine sont mélangées : 87 valeurs **courtes** historiques
  (« Scolaire 1er degré » ×27, « Periscolaire 1er degré » ×23…) à côté des valeurs **longues** du
  formulaire actuel, plus 18 fiches dont `thematic` est une chaîne unique à virgules. Aucune valeur
  d'option ne pouvait tout couvrir. Seul reste le filtre code postal. Pour le remettre : cf. §13.

---

### 9.21 Reprise des créneaux SSBE du Tampon depuis l'admin — section `answerCopy` (23/09, Peterson)

*(Section venue de `main` — numérotée 9.17 là-bas ; renumérotée 9.21 au merge du 29/09, le 9.17 de ce dossier étant déjà l'alignement du formulaire `structure`.)*

**Constat de départ (23/09)** : 20 créneaux du Tampon ont été déposés sur le site régional SSBE (form
`6928096adf5caf0d230e7f26`) les 27–28/08, APRÈS la copie par CP du 19–20/08 (§9.8) ; en prod, 18
réponses homonymes existaient dans le form dédié (créées le 22/09) et 2 manquaient (« Gymnastique
Tao », « Sport Santé Seniors » Plaine des Cafres). Jusqu'ici la seule reprise était l'URL super-admin
`copyCreneaux` par CP — hors de portée de l'admin de la MSS. Demande : **une fonctionnalité d'admin**,
liste + bouton « Copier », avec déduplication.

**Ce qui est livré**

- **Backend — copie SERVEUR, idempotente.** `Coform::copyAnswer` (citizenToolKit) : renommage du
  préfixe de section (sections appariées par position, le form cible est un duplicata du source),
  `context`/`cterSlug`/`source` du site cible, provenance conservée quand elle existe (`user`,
  `links`, `created` — jamais inventée : 277 des 286 réponses SSBE n'ont pas de `user`), trace
  `copiedFrom` + `copiedAt` ; une source déjà copiée renvoie la copie existante (`alreadyCopied`),
  jamais un doublon ; un brouillon n'est pas copiable ; les inputs non déclarés dans la section cible
  sont copiés et remontés (`unknownInputs` — mesuré en base locale : le form SSBE a **1 input de
  plus** que le dédié, `…mtcqn5z1x1op08yg3ia`). Fichiers uploadés non dupliqués (comme la
  migration). Le `source` suit la règle de `saveAnswer`, désormais **extraite** en
  `Coform::resolveAnswerSource` (costum ambiant, sinon orga porteuse à costum) — une seule règle de
  scope pour dépôt et reprise.
- **Backend — exposition.** Pas de nouvel endpoint : l'action legacy `survey/answer/newanswer/form/<cible>`
  gagne une branche `action: "copy"` (+ `copyFrom`, `costumSlug`) ; le contrat SDK
  `GENERATE_ANSWER_FROM_FORM` tolère les clés supplémentaires → **utilisable avec la lib installée**.
  Extension documentée dans [`ENDPOINT.md`](../../ENDPOINT.md) pour déclaration. **Autorisation en
  deux temps** (revue adversariale du 23/09, 2 constats HIGH corrigés) : *qui* = super admin ou admin
  de l'élément porteur du form cible lu dans **ses liens** (`Coform::canCopyIntoForm` — le raccourci
  « admin du costum ambiant » d'`isInterfaceAdmin`/`isElementAdmin` était contournable par
  n'importe quel admin d'un autre costum postant son `costumSlug`) ; *quoi* = **liste blanche des
  forms sources** déclarée sur le form cible (`params.copySources`) — sans elle, une copie lisait et
  dupliquait n'importe quelle réponse de la base par son id. Déclaration par URL super-admin
  **`costum/ekilibreMigration/declareCopySources`** (dry run) · `/apply/1` — **écriture Mongo à
  rejouer en PROD** (runbook §9.11). Vérifié anonymement en dev : `{result:false, msg:"copie
  réservée aux administrateurs…"}`. URL de recette/dépannage super-admin :
  `costum/ekilibreMigration/copyAnswer/id/<idSSBE>` (dry run) · `/apply/1` — même routine.
- **Backend — hook `AssociationEkilibre::searchAnswers` généralisé** : aplatit la section **de la
  réponse** (résolution par SUFFIXE d'input, constantes `SUFFIX_*` ; `FIELD_*` inchangées) au lieu
  de la seule section Ekilibre → les réponses du form SSBE listées sous le costum Ekilibre ont les
  mêmes colonnes (`name`, `structure`, adresse, statut) ; `copiedFrom`/`copiedAt` projetés (la
  projection du hook est une **whitelist** : c'est pourquoi la prod montrait 0 `copiedFrom` sur 61
  alors qu'ils existent). Aplatissement des forms étrangers **borné à `params.copySources`** (revue :
  sans borne, un admin du costum lisait n'importe quel form par un filtre `form`). Garde « non-admin
  → Validé » inchangée sur LE champ Ekilibre : une réponse SSBE ne le porte pas, **0 ligne servie au
  public** (mesuré). Le listing public du form dédié est inchangé (mesuré, `copiedFrom` visible sur
  « Wing Chun »).
- **Front — section admin générique `answerCopy`** (moteur, réutilisable par tout site dont le form
  est un duplicata d'un autre) : schéma (`sourceForm`, `targetForm` ≠, `source` = même forme que
  `resource.source`, `columns` = `path` + `label`, `duplicateKeys`), `lib/answerCopy.ts` pur (id via
  `getEntityId`, empreinte normalisée et séparée, index `copiedFrom` + empreintes, 3 états — 12
  tests), `hooks/useCopyAnswer.ts` (façade `endpointApi.generateAnswerFromForm`, toasts succès /
  déjà copié / inputs inconnus / erreur, marquage local « Copié », invalidation `admin-*` +
  surfaces publiques), `AdminAnswerCopySection.tsx` (candidates en scroll infini `variant:"admin"` +
  `notSourceKey` d'office ; index cible chargé EN ENTIER à chaque montage, « Copier » désactivé
  tant qu'il charge, refetch ou erreur ; « Doublon probable » → confirmation ; lignes ordonnées
  par état, « À copier » en tête, et **« Copié » masquées** avec leur compte — demandes du 23/09
  après recette, `rankByCopyStatus` + sentinelle de scroll dédiée ; 12 tests de câblage).
  Dédup : `STATUS_TONE_CLASS` et `normalizeColumns` dans `resourceHelpers` (partagés avec
  resource/reference), `components/AdminTableShell.tsx` (partagé avec reference).
- **Config** : onglet `creneaux-ssbe` « Créneaux SSBE » (siteAdmin, icône `copy`) — source = form SSBE
  filtré CP 97430/97418 **dans l'adresse principale OU dans les lignes « lieu de pratique »**
  (`$or` — revue : **7 créneaux validés du Tampon** n'ont leur CP que dans les lieux, adresse
  principale `[]` : Multi activités, Remise en forme en salle équipée, Éveil sportif, Gym : yogging,
  Hatha yoga, Marche et remise en forme ×2 ; périmètre mesuré : 46 → **53** ; `copyCreneaux` aligné),
  tri `created` desc, page de 60 (le stock tient en une page → l'ordre par état est exact
  d'emblée), recherche sur l'intitulé ; colonnes Activité / Structure / CP / Statut SSBE /
  Déposé le. Placé avant « Modération » : copier, puis modérer. **Recette du 23/09 (Peterson)** :
  après `declareCopySources/apply/1`, le créneau « TEST BASKET » déposé sur SSBE apparaît dans
  l'onglet.
- **Revue adversariale** (workflow, 4 dimensions : PHP, bonnes pratiques, fonctionnel, contrat de bout
  en bout) → 29 constats, tous instruits : 2 HIGH (garde contournable, source non bornée — corrigés),
  4 MEDIUM (hook non borné, 7 créneaux invisibles, index en erreur pris pour vide, « Copié » figé
  30 min — corrigés), le reste LOW (dédup `normalizeColumns`/`AdminTableShell`/`getEntityId`,
  séparateur d'empreinte, homonymes « probables », brouillons refusés, auteur jamais inventé, clés
  `multiCheckboxPlus…` dans `unknownInputs`, plafond exact de `useSearchAllResults`, `isFetching`
  exposé par `useSearchQuery`) — corrigés, sauf 2 assumés : idempotence non atomique (pas d'index
  unique) et CP numérique (aucun en base). Les hooks partagés `useSearchQuery`/`useSearchAllResults`
  gagnent `isFetching`, `isPending`, un `cache` optionnel et un `capped` exact (additif).
- **Gates (après revue)** : vitest admin + search hooks **219/219** (dont 24 nouveaux) · eslint ✅ ·
  `tsc -b` ✅ sur le lot (12 erreurs **pré-existantes** `src/modules/aac` : SDK installé 1.0.189 <
  requis ^1.0.193, cf. §12) · `config:validate` ✅ 13 p/49 s · `audit:config` RAS · préflight
  effective-config/i18n/strip/integrity/prop-descriptions/section-meta ✅ · `php -l` ✅ ×4.

**Les 3 états, et ce qu'ils protègent** — « Copié » = trace `copiedFrom` (certain, ligne masquée) ;
« Doublon probable » = une réponse cible partage intitulé + structure + CP (copie faite par un autre
canal, saisie directe, ou **second dépôt homonyme côté SSBE** — ex. les deux « Pilates » de la Mairie
→ confirmation) ; « À copier ». Conséquence pour la prod : les 44 copies du 20/08 portent
`copiedFrom` (mesuré en dev sur leurs jumelles) → « Copié » ; les 18 du 22/09 apparaîtront « Copié »
si elles viennent de `copyCreneaux`, sinon « Doublon probable » — l'onglet le dira, sans rien écrire.

**Écarts assumés** : la copie hérite du **statut** de la source (une source « Validé » est publiée
d'emblée sur Ekilib.re — c'est le comportement de la migration du 19/08 ; si la MSS veut re-modérer,
poser le statut cible à « En attente » dans `copyAnswer` est un ajout de 2 lignes) ; aucune
notification costum à la copie ; l'empreinte est heuristique (deux créneaux distincts de même nom,
même structure, même CP seront signalés « probables » : la confirmation est là pour ça) ;
l'idempotence est un `findOne` puis `insert` sans index unique (deux POST strictement concurrents
pour la même source peuvent créer deux copies — le front désactive les boutons pendant l'appel).

**Déploiement** : PHP (survey + citizenToolKit + costum) **avant** le front ; **une écriture Mongo**
à rejouer en dev ET en prod : `costum/ekilibreMigration/declareCopySources/apply/1` (super admin —
sans elle : « Copier » refusé et lignes SSBE sans colonnes). Pas de hook `class.function` à déclarer.
Recette : onglet « Créneaux SSBE » connecté siteAdmin → ~27 lignes validées attendues en prod (20
déposées après le 19/08 + 7 « lieux seulement »), dont 18 « Copié »/« probable » et au moins 2 « À
copier » → copier « Gymnastique Tao » → ligne « Copié », toast, créneau visible dans Modération puis
`/creneaux`.

### 9.22 Troisième type de créneau « Sport santé sans label - SSsL » (08/10, Peterson)

**Constat.** Le form dédié (`6a85af345d898a57cb49f029`, `updated` = 07/10) propose désormais une
3ᵉ option au champ « Type de demandes » (`…mdn1cs8on3yru1p80lq`) : `"Sport santé sans label - SSsL"`,
à côté de SSsO et SSpT. Aucune réponse ne la porte encore en base locale (14 SSsO / 36 SSpT sur 50).
Côté front, le select CoForm lit ses options dans `params[input].options` → la 3ᵉ option **s'affiche
sans rien faire**, et l'affichage conditionnel (`useConditionalFields`) masque bien les 4 champs
« liaison médecin » réservés au SSsO (règles `show` sur SSsO seulement). Mais `normalizeTypeLabel` ne
connaissait que SSsO/SSpT : la carte aurait affiché le libellé long dans son badge et porté une classe
CSS inexploitable (`sport santé sans label - sssl-card` — l'abréviation SERT de classe), et le filtre
« Type de Sport Santé » ne proposait pas l'option.

**Ce qui change** :

| Domaine | Changement |
|---|---|
| [`coformAnswer.ts`](../src/modules/search/lib/coformAnswer.ts) | `normalizeTypeLabel` : `"Sport santé sans label - SSsL"` → `SSsL` (+ commentaire : l'abréviation est la classe CSS de la carte — tout type ajouté au form se déclare ici). **Remplacé le jour même (§9.25)** : l'abréviation est lue dans le suffixe du libellé, plus aucune liste à tenir |
| `coformAnswer.test.ts` | cas SSsL + **garde config ↔ code** : chaque option `name` du filtre `sportHealthType` de la config doit être abrégée (`/^SS[a-z][A-Z]$/`). **Retirée en §9.25** (un test du module search générique ne lit pas la config d'un site), devenue inutile avec la lecture du suffixe |
| Config — filtre `sportHealthType` | 3ᵉ option `sssl` (fr « Sport santé sans label » / en « Sport health without label »), `name` = valeur exacte du form |
| Config — `theme.customCSS` | `.sssl-card` : en-tête **vert** `--success` → `color-mix(--success 85%, black)` (même recette que `--gradient-pro`), liseré gauche `--success`, badge « Validé » **inversé** (fond `--card`, texte `--success`) |

**Pourquoi le vert.** La charte a trois couleurs (§9.19) : le jaune porte déjà SSsO, le bleu SSpT ;
le vert (`--success` = #1A7A55) est la seule couleur de charte restante, déjà celle de la carte
« Professionnels de santé » du héros. Contrastes recalculés depuis les tokens oklch de la config
(titre en `text-primary-foreground`) :

| Couple | Clair | Sombre |
|---|---|---|
| vert plein × titre | **5,16:1** | **7,55:1** |
| vert creusé 85 % × titre (fin de dégradé) | 7,25:1 | 4,98:1 |
| badge « Validé » (`--badge-valid` = `--success`) × en-tête vert | 1,00:1 → invisible | 1,00:1 |
| badge inversé : texte `--success` sur `--card` | 5,31:1 | 7,14:1 |

Une seule recette pour les deux modes (pas de règle `.dark`, contrairement au jaune) : le vert
sombre est plus clair (L .70) et le titre y devient foncé — AA tenu aux deux bouts du dégradé. Le badge
« Validé » étant du même vert que l'en-tête, il passe en pastille inversée dans `.sssl-card` seulement
(règle non layerée du `customCSS`, elle l'emporte sur l'utilitaire Tailwind sans `!important` ; le
`!important` ne reste nécessaire que contre le `style` inline de l'en-tête). Le badge de type
(`--badge-type` = `--muted-foreground`) est laissé tel quel : son texte blanc tient 5,8:1, et sa
pastille se fond déjà dans la fin de dégradé des cartes SSpT — même tolérance.

**À vérifier dans le form (backend, pas de code front)** : la règle `hide` sur « Si oui avec qui »
(`…mpy4pj6xuivg0k5asas`, position 19) ne vise que SSpT → pour un créneau SSsL ce champ reste visible,
comme pour SSsO. Si « sans label » doit se comporter comme SSpT, ajouter une règle `hide` pour
`"Sport santé sans label - SSsL"` (ou la remplacer par une règle `show` sur SSsO, comme les 4 autres
champs médecin) — dans l'éditeur de formulaire, sans écriture Mongo manuelle. Les textes FAQ /
« S'informer » ne décrivent que les deux labels : à compléter si la MSS veut expliquer le « sans label ».
Le backend (`AssociationEkilibre::FIELD_TYPE`) ne branche pas sur la valeur : rien à y faire.

**Gates (08/10)** : typecheck ✅ 0 erreur · lint ✅ (2 fichiers) · `coformAnswer.test.ts` ✅ 22 ·
preflight ✅ **793** (fixture `__effective__` inchangée) · `config:validate` ✅ 13 pages / 49 sections ·
`audit:config` ✅ RAS. **Recette navigateur à faire** : créer un créneau SSsL, vérifier la carte (clair +
sombre), le filtre, et la vue carte — ses pins restent `primary` pour les 3 types (option
`map.marker.colorBy` disponible si on veut les distinguer aussi).

### 9.24 `/creneaux` : le créneau ajouté s'affiche en premier (08/10, Peterson)

**Symptôme (recette du 08/10)** : un créneau SSsL créé depuis la modération apparaissait **en
dernier** sur l'annuaire. **Cause** : la liste publique n'envoyait aucun `sortBy` ; dans ce cas
`SearchNew::globalAutocomplete` (`citizenToolKit/models/SearchNew.php:123`) impose
**`{updated: -1}`** et le transmet au hook `AssociationEkilibre::searchAnswers`, dont le repli
`created: -1` ne joue donc jamais. Or une réponse **neuve n'a pas de champ `updated`** (seulement
`created` — vérifié en base locale : 51 réponses avec `created`, 48 avec `updated`) : Mongo classe
l'absent comme `null`, c'est-à-dire **dernier** en tri décroissant. Une réponse remontait en tête
seulement après sa première modification.

**Correctif (config seule)** : `baseParams.defaultSortBy: {"created": -1}` sur la section
`creneaux-list` de `/creneaux` — le front envoie alors `sortBy`, que `SearchNew` honore tel quel
(même mécanique que le tri de la table de modération, qui le posait déjà). Toutes les réponses du
form portent `created` (les copies SSBE comprises). Une **modification** ne fait pas remonter une
fiche : seul l'ordre de **création** compte, ce qui est le besoin exprimé. Sans effet sur la vue
carte (`searchCostumStaticMapAll`, ordre indifférent) ni sur le compteur de la home.

---

### 9.23 Modération des créneaux : créer depuis l'admin et vérifier une fiche au clic (08/10, Peterson)

**Besoin.** Depuis l'onglet « Créneaux — modération » de `/admin` : (1) **ajouter un créneau** sans
passer par `/creneaux` ; (2) **cliquer une ligne** pour ouvrir la même fiche que dans l'annuaire et
vérifier les informations avant de la marquer « Validé » — les colonnes de la table (activité,
structure, type, CP, date) n'en montrent qu'une tranche.

**Pourquoi deux options MOTEUR et pas une rustine Ekilib.re.** La section `resource` n'avait aucun
des deux leviers : `create` ne sait résoudre que des **modales d'entité** (standard ou costumForm),
or les réponses CoForm n'en ont pas (`resolveCreateModal` → `null`, donc pas de bouton) ; et une
ligne ne réagissait pas au clic. Les deux leviers sont posés dans le schéma admin, **opt-in**, zéro
changement pour les tables existantes :

| Option (`admin.tabs[].sections[]` de type `resource`) | Effet |
|---|---|
| `create: { "coform": "<formId>" }` | le bouton « Créer » ouvre le **`CoFormModal`** du form — la même modale que le bouton public « Ajouter un créneau » (`addButton.coform`), chunk coform chargé au premier clic. Après soumission : invalidation des tables/tuiles admin **et** des surfaces publiques (`/creneaux`, compteur de la home) ; rien à la fermeture (le refetch initial doublait la requête — §9.25) |
| `preview: { "type": "coform-answer", "editButton": true }` | **détail au clic sur la ligne** (curseur main) + action « Aperçu » dans le menu de ligne (accès **clavier**) : même coque `dialog` et même contenu que `/creneaux` (`SwitchDetailsMode` → `PreviewCoformAnswer`), **bouton « Modifier »** inclus (re-fetch frais puis CoFormModal, droit = super-admin / admin du costum / admin de la structure). Fermer sans éditer ne recharge rien ; une correction invalide tables admin et surfaces publiques (`onEdited`, §9.25) |

**Ce qui change** :

| Domaine | Fichier | Changement |
|---|---|---|
| Schéma admin | [`admin/schema.ts`](../src/modules/admin/schema.ts) | `AdminCreateRefSchema` (= `AdminFormRefSchema` ∪ `{coform: ObjectId}`) pour `create` ; `preview: PreviewConfSchema` (le bloc des listes publiques) |
| Helpers | [`resourceHelpers.ts`](../src/modules/admin/sections/resourceHelpers.ts) | `createCoformId(section)` ; `resolveCreateModal` rend `null` sur la forme objet — les deux sont exclusifs |
| Table | [`AdminResourceTable.tsx`](../src/modules/admin/sections/AdminResourceTable.tsx) | bouton « Créer » → `CoFormModal` lazy (`vite-preload`, Suspense local) ; ligne cliquable + « Aperçu » (icône `Eye`) ; `SwitchDetailsMode` en `dialog` ; cellules sélection/actions coupent la propagation (le menu portalé remonte jusqu'à la ligne) ; `invalidateAdminAndPublic` factorisé (statut métier + création) |
| i18n admin | `fr.json` / `en.json` | `AdminResourceTable.preview` = « Aperçu » / « Preview » |
| Tests | `resourceHelpers.test.ts`, `schema.test.ts` | `create:{coform}` → `createCoformId` / `resolveCreateModal` null ; schéma : ObjectId exigé, `preview` conservé, formes historiques intactes |
| Config | onglet Modération | `create: {coform: "6a85af345d898a57cb49f029"}`, `preview: {type: "coform-answer", editButton: true}` (`edit: false` inchangé : la correction passe par le bouton « Modifier » du détail) |
| Docs | `doc/30-module-admin.md`, skill `config-assistant/references/admin.md` | les deux options documentées |
| Onglet « Créneaux SSBE » (complément, même jour) | [`AdminAnswerCopySection.tsx`](../src/modules/admin/sections/AdminAnswerCopySection.tsx), schéma `answerCopy.preview` | même détail au clic sur une ligne + bouton « Aperçu » par ligne ; **lecture seule** (la réponse appartient au site régional — pas d'`editButton`, « Copier » n'ouvre pas le détail ; depuis §9.25 `editButton` est refusé par le schéma ET neutralisé au rendu) ; config `preview: {type: "coform-answer"}` ; 4 tests de rendu (clic ligne, Copier inerte, bouton, sans config) |

**Pourquoi ça fonctionne sur les lignes de la modération.** En mode `statusField` la table interroge
la route publique avec une projection explicite dont la racine `answers` fait partie (champ d'état) ;
le hook `AssociationEkilibre::searchAnswers` aplatit ensuite la section à la racine et joint
`structure` — ce sont exactement les lignes que `parseCoformAnswer` lit sur `/creneaux`.

**Gates (08/10)** : typecheck ✅ 0 erreur · lint ✅ (5 fichiers) · unit admin ✅ 166 · preflight ✅
(fixture `__effective__` inchangée : `create` y est résolu en modale d'entité, `null` avant comme
après) · `config:validate` ✅ 13 pages / 49 sections · `audit:config` ✅ RAS. **Recette navigateur à
faire** (compte siteAdmin) : créer un créneau depuis l'onglet, l'ouvrir au clic et au clavier
(menu → Aperçu), le modifier depuis le détail, vérifier le rafraîchissement de la table et de
`/creneaux`.

### 9.25 Corrections de la review de la MR 84 (`judi-ekilibre` → `main`, 08/10)

**Verdict de la review** : bloquant sur un point, quatre « à vérifier », quatre nettoyages — les
gates (lint, typecheck, preflight 795/795, 98 tests) étaient vertes sur l'arbre de la MR comme sur
l'arbre mergé avec `main`. Tous les points sont traités dans le code, sauf le titre de la MR (GitLab).

| # | Constat de la review | Correctif |
|---|---|---|
| 1 (bloquant) | `answerCopy.preview` acceptait `editButton: true` : recopier le bloc `preview` de l'onglet Modération (même forme) faisait apparaître « Modifier » sur une candidate, et l'enregistrement écrivait dans la réponse **du costum voisin** | schéma : `editButton` refusé (refine, `config:validate` échoue) ; rendu : la section passe `editButton: false` — la config n'est jamais parsée par Zod au runtime, le schéma seul ne protège pas |
| 2 | colonne audio + `preview` : lecture ou avance (lecteur compact) ouvraient aussi le détail, l'audio continuant dessous | la cellule audio garde ses clics (`stopRowClick`) quand elle porte un lecteur — vide (« — »), elle redevient une cellule ordinaire —, comme sélection et actions ; contrat commun aux deux tables dans [`sections/rowPreview.ts`](../src/modules/admin/sections/rowPreview.ts) |
| 3 | deux requêtes identiques après une création par CoForm : l'invalidation, puis `refetch()` à la fermeture | plus de `refetch()` à la fermeture : CoForm n'écrit **rien** avant la soumission finale (brouillon local, fichiers envoyés au submit), l'invalidation couvre la soumission |
| 4 | `refetch()` aveugle à la fermeture de l'aperçu (vérifier 20 fiches = 20 `searchCostum`), et une vraie édition laissait les tuiles admin périmées | prop optionnelle `onEdited`, de `PreviewCoformAnswer.handleEdited` jusqu'à `SwitchDetailsMode` (module search, relayée par les deux conteneurs et `Preview`) ; la table y invalide `admin-*` + surfaces publiques ; fermer = 0 requête |
| 5 | `createDefaults` ignoré en silence avec `create: {coform}` (le schéma acceptait les deux, la doc promettait le semis) | combinaison refusée par le schéma : les clés de `createDefaults` sont des champs de modale d'entité, rien ne les traduit en réponse rangée par étape |
| 6 | 3ᵉ `case` en dur pour un libellé d'un seul site, et test du module search générique lisant `config.prod.maison-sport-sante-la-tampon.json` sur disque | `normalizeTypeLabel` lit le **suffixe** du libellé (`/^SS[a-z][A-Z]$/`) : un type futur n'exige plus de code — restent, côté site, sa règle CSS et l'option du filtre `sportHealthType` ; test de config remplacé par des cas génériques |
| 7 | toute la ligne cliquable : glisser pour copier un e-mail ouvrait le détail et perdait la sélection | `rowPreviewProps` ignore le clic qui termine une sélection (`getSelection()`), sur les deux tables. Limite assumée : un double-clic ouvre le détail dès son premier clic (l'attendre retarderait chaque ouverture) — on copie au glisser |
| 8 | `config:schema admin` ignorait `create.coform` et `preview` | descriptions `create`, `createDefaults`, `preview` ; « 8 builtin » (answerCopy manquait) ; note des refinements ; plancher de couverture admin 25 → 27 |
| 9 | titre de la MR : annonce le type SSBE alors que 3 commits sur 5 livrent des fonctionnalités admin partagées | à renommer sur GitLab |

**Relecture des correctifs** (4 relecteurs indépendants — bonnes pratiques, justesse, docs, tests —,
chaque constat soumis à un sceptique : 23 sur 24 confirmés, aucun bloquant). Ce qu'elle a fait changer :

| Constat | Correctif |
|---|---|
| Retirer le refetch à la fermeture ôtait le filet des AUTRES détails qui écrivent sans signaler `onEdited` (`facets`, `structure`, `poi-amenities` : édition, suppression ; `news` ; `event` : participation) — latent (seul Ekilib.re pose `preview`, en `coform-answer`), mais réel | `resource.preview` et `answerCopy.preview` n'admettent que les détails qui n'écrivent rien ou qui le signalent (`ADMIN_PREVIEW_TYPES` : `default`, `resource`, `resource-directory`, `testimonial`, `coform-answer`) — même parti que pour `createDefaults` : refuser plutôt que laisser une table périmée ; commentaires « seul variant qui édite » corrigés |
| Les messages des nouveaux refines n'apparaissaient jamais dans `config:validate` (« Invalid input [invalid_union] ») | le refus du repli « section costum » devient **bloquant** (`abort`) : l'échec d'un refine builtin remonte tel quel ; `config:validate` **déplie** les unions restées opaques ([`scripts/lib/zod-issues.ts`](../scripts/lib/zod-issues.ts), la branche allée le plus loin) — vérifié sur une copie cassée de la config |
| `normalizeTypeLabel` découpe désormais le type : une valeur non-chaîne faisait planter le détail | `str()` au lieu du cast pour `type` et `state` |
| Exemption `coform-answer` périmée dans le preflight `presenter-options` (elle éteignait la garde de la transmission de `preview`) | exemption retirée + garde inverse (une exemption doit désigner une option encore morte) |
| La JSDoc de `resolveCreateModal` détachée de sa fonction par l'insertion de `createCoformId` (MR) ; « 7 builtin » restants ; commentaire du lecteur (« vitesse » absente du lecteur compact) ; liste des consommateurs de `CoFormModal` | recollée / corrigés |

**Tests** : `AdminResourceTable.test.tsx` **nouveau** (11 — la table n'en avait aucun : lecteur audio,
case et menu d'actions, « Aperçu » au clavier, « Supprimer » sans détail par-dessus, sans `preview`,
`editButton` transmis, sélection de texte, consultation sans requête, correction → invalidations,
création = une invalidation, fermeture sans soumettre), `SwitchDetailsMode.test.tsx` **nouveau** (3 —
la VRAIE chaîne `onEdited`, dialog et tiroir), `rowPreview.test.ts` (4), `zod-issues.test.ts` (4),
`AdminAnswerCopySection.test.tsx` (+2 ; « la fermeture le retire » vérifie désormais la fermeture,
qu'il annonçait sans la tester), `schema.test.ts` (+6), `resourceHelpers.test.ts` (+2, `audioSrc`),
`coformAnswer.test.ts` (test de config → cas génériques + non-chaîne), helpers de sélection partagés
(`tests/test-utils-ui.tsx`). Preuve qu'ils mordent : les 10 tests de rendu de la première passe
échouent contre le code de la MR, et 9 mutations des correctifs (relais `onEdited` ×3, `abort`,
coupures des cellules ×2, exemption, cast, ancres de la regex) font toutes échouer leur test.

**Docs** : [07-module-search](../doc/07-module-search.md) (`onEdited` et les contenus qui ne le relaient
pas, règle du suffixe), [30-module-admin](../doc/30-module-admin.md) (fermeture, création, types de
détail admis, lecture seule `answerCopy`, `createDefaults`, validation lisible), skill
`config-assistant/references/admin.md`, `config:schema admin` (descriptions + notes).

**Gates (08/10, arbre de la branche)** : typecheck ✅ · lint ✅ 0 erreur / 24 avertissements (inchangé
vs la MR) · test:unit ✅ 5 574 (460 fichiers) · preflight ✅ 794 · `config:validate` ✅ 13 pages /
49 sections · `audit:config` ✅ RAS. **Arbre fusionné avec `main`** (39 commits de retard) : fusion
sans conflit, test:unit ✅ 5 660, preflight ✅ 796 ; typecheck : 3 erreurs, toutes dans du code de
`main` qui exige le SDK ≥ 1.0.196 (`setRoles`, `agendaGetPdf`) alors que le `node_modules` local est
resté en 1.0.195 (`package.json` exige déjà `^1.0.196`) — un `npm install` les lève, sans rapport
avec ce lot. État à l'écriture : **commité** sur `judi-ekilibre`, pas encore poussé ; titre de la MR
à renommer ; recette navigateur (compte siteAdmin) toujours à faire.

### 9.26 Bouton « Ajouter une structure » rétabli dans l'admin (07/10, Nicolas — `678527cf`)

**Demande** : remettre le bouton d'ajout dans l'onglet admin **Structures**, retiré le 23/09 (§9.19).
Périmètre limité à l'admin : le bouton public de `/structure` et l'entrée de nav **restent retirés**.

| Fichier | Changement |
|---|---|
| `config.prod.maison-sport-sante-la-tampon.json` | onglet `structures`, section `resource` `organizations` : `"create": false` → **`"create": "add-structure"`** |
| `tests/preflight/__effective__/maison-sport-sante-la-tampon.json` | snapshot mis à jour : `create: null` → `"add-structure"` (seul écart) |

**Pourquoi une clé explicite plutôt que l'absence de `create`** (= `inherit`, l'état d'avant le
23/09) : les deux résolvent aujourd'hui vers `add-structure` (seul costumForm `organizations` du
site), mais la clé explicite ne bascule pas en silence vers la modale standard si un second form
`organizations` apparaît (`resolveCreateModal`, pas 3) — et c'est déjà la forme des onglets
Actualités (`add-actualite`) et Ressources (`add-ekilibre-ressource`).

**Comportement** : la modale est le wizard `structure` (§9.17), titre « Ajouter une structure ».
Le form injecte au create `type: "Cooperative"`, `role: "admin"` (l'admin qui crée devient admin de
la fiche) et **`statusActor: "En cours"`** ; le scope `associationEkilibre` rend la fiche **possédée**,
donc éditable/validable malgré `restrictActionsToOwned`. Elle n'apparaît sur `/structure` qu'une fois
passée à **« Validé »** depuis le dropdown de statut de l'onglet, et si son CP est 97430/97418.

**Gates** : `validate-config` ✅ (13 p / 49 s) · préflight + admin + `structure.configDriven` :
1000/1003 — les 3 échecs sont **hors lot** : `bundle-size` (dépend d'un `dist/` local) et snapshot
effective-config **SSBE** (page `/blog/agenda` absente du snapshot, préexistant, non touché).

**À confirmer** : la fermeture du 23/09 était une décision du responsable MSS Tampon (§9.20) — la
réouverture côté admin est à valider avec la MSS (§13).

### 9.27 Timeline sur l'espace pro, notifications et réseaux sociaux au pied de page (08/10, Nicolas — `8cc2a9ef`)

> Config + 2 lignes de code partagé (`FooterContactPartners.tsx`). Correctif de suivi de
> l'orientation des étapes : `11377a04`. Nettoyage de la table d'icônes après la review de la MR 86
> (fin de section).

| Endroit | Changement |
|---|---|
| `/espace-pro` | la section `steps` `#prescription-steps` (« Prescrire un créneau à un patient », 4 étapes) devient une **`timeline`** `#prescription-timeline` : `steps[]` → `events[]`, `description` → `text`. Les **icônes** des étapes sont **abandonnées** (`TimelineSection` n'en affiche pas) ; sur écran large les cartes alternent gauche/droite (`alternating`, défaut `true`). Aucune référence à l'ancien `id` dans la config ni dans le CSS du site |
| `/s-informer` | `steps` `#inscription-steps` : **`showProgress: false`** (la barre « 0/4 étapes » n'a pas de sens pour expliquer une démarche) et **`orientation: "vertical"`** — voir l'encadré ci-dessous |
| `/creneaux` | le groupe de filtres **« Type de Sport Santé »** (SSsO / SSpT) passe en **tête** (`order: 1`), devant le type d'activité (`order: 2`). Ordre actuel : type de sport santé · type d'activité · type de public · bénéficiaires |
| En-tête | `utilities.notifications: true` → **cloche de notifications**. `NotificationBell` ne s'affiche qu'après hydratation et pour un compte **connecté** : un visiteur anonyme ne voit rien |
| Pied de page | la rangée `socials` (icônes seules : Facebook, LinkedIn, mail) est **supprimée**. Facebook et LinkedIn deviennent des **lignes de contact avec libellé** ; l'e-mail `contact@ekilib.re` remonte **en tête** du bloc contact (avant téléphone, adresse, horaires). Les liens externes s'ouvrent dans un nouvel onglet (`NavLink` → `target="_blank" rel="noopener noreferrer"`) |
| `FooterContactPartners.tsx` (partagé) | icônes `facebook` et `linkedin` (lucide) ajoutées à `iconMap`. Avant, une icône inconnue retombait sur l'épingle `MapPin`. Ajout pur : aucun autre site en `contact-partners` n'utilisait ces deux clés |

> ⚠️ **`orientation` posée hors de `props` dans le commit.** `8cc2a9ef` écrit `"orientation":
> "vertical"` au niveau de la **section**, à côté de `props`. `StepsSection` ne lit que
> `props.orientation` : la clé était ignorée et les étapes restaient **horizontales**. Corrigé par
> Nicolas le 08/10 (clé déplacée dans `props`, commit `11377a04`).
> **`config:validate` ne détecte pas ce cas** : il a validé la config avec la clé mal placée comme
> sans elle (13 pages / 49 sections dans les deux cas).

**Gates (08/10, avec le correctif d'orientation)** : `config:validate` ✅ **13
pages / 49 sections** · `audit:config` ✅ RAS · `typecheck` ✅ · `eslint` sur
`FooterContactPartners.tsx` ✅ · préflight (`tests/preflight` + `src/components/layout/footer`)
**801/803** — les 2 échecs sont **hors lot** : snapshot `effective` de **SSBE** (lot SSBE du 07/10,
cf. [sa doc](sport-sante-bien-etre.md) §9) et `bundle-size` (`dist/` local du 28/09). Le snapshot
`effective` du Tampon passe sans changement.

**Recette navigateur à faire** : timeline de `/espace-pro` en clair et en sombre (fond
`bg-background` imposé par le composant), étapes verticales de `/s-informer`, cloche une fois
connecté, icônes Facebook/LinkedIn du pied de page.

**Review de la MR 86 (08/10) — nettoyage de la table d'icônes.** La review relevait deux cartes
plateforme→icône dans `footer/` : l'`iconMap` des lignes de contact (où `facebook`/`linkedin`
venaient d'être ajoutés) et `SOCIAL_ICONS` de `SocialLinks`. La table vit désormais dans
**`src/components/layout/footer/socialIcons.ts`** (fichier `.ts` séparé : exporter un objet depuis
`SocialLinks.tsx` déclencherait `react-refresh/only-export-components`) ; `SocialLinks` l'importe, et
`FooterContactPartners` cherche `SOCIAL_ICONS[clé] ?? iconMap[clé] ?? MapPin`. `facebook`/`linkedin`
sortent de l'`iconMap`. **Aucun changement de rendu** : la seule clé commune aux deux tables est
`mail` (→ `Mail` des deux côtés), et aucun autre site en `contact-partners` n'emploie de clé de
réseau dans ses lignes de contact. Un réseau ajouté à `SOCIAL_ICONS` (ex. Instagram) sert désormais
aux deux rendus. Gates : `eslint src/components/layout/footer/` ✅ · `typecheck` ✅.

---

## 10. Checklist d'avancement

### Lot A — Vitrine & annuaires (config)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| A.1 | Site vitrine (home, s'informer, rejoindre, partenaires, espace pro, légal, blog, ressources) | ✅ | **13 pages / 49 sections** validées (remesuré le 08/10) ; audit 0 constat. `/blog` est la 12ᵉ (§9.13), `/ressources` la 13ᵉ (§9.14). Nav à **6 entrées** depuis le 23/09, `/structure` hors nav (§9.19) |
| A.2 | Annuaire des créneaux `/creneaux` (**6** filtres en colonne + carte + détail dialog) | ✅ config | montage `gridLayout`, périmètre `sourceKey: ["associationEkilibre"]`, form dédié + état `"Validé"` (§9.9, §9.12). Les 2 facettes pathologie sont posées mais **n'afficheront leurs options qu'une fois des créneaux saisis** ; **vue carte à recetter** |
| A.3 | Annuaire structures `/structure` (CP + domaine d'intervention) | ✅ config | périmètre `associationEkilibre` + `statusActor:"Validé"` + CP ; projection **55 champs** (§9.13) ; **14 fiches référencées** en DEV le 20/08 (§9.10) — à rejouer en PROD. Remis en forme le 23/09 (§9.19) : titre de section, grille **3 colonnes**, carte **50-50** ; ⚠️ page **sortie de la nav**, seul point d'entrée = le bouton du bandeau `/creneaux` |
| A.4 | Flux d'actualités (home, lecture seule) | ✅ | **remplacé** par le module blog : `articleFeed` `featured:"flag"` sur `/`, `/espace-pro` et `/blog` (§9.13) — le flux `news` n'est plus utilisé |
| A.5 | Auth / Espace Pro | ✅ | CTA header → `/espace-pro`, **gardée** (`auth.required`). Depuis le 21/08 : plus de saut vers `/login`, la modale s'ouvre **sur place** (§9.13). ⚠️ garde de **session** : tout compte connecté entre (§12) |
| A.6 | Chiffres clés de la home | 🟡 | **1/4 dynamique** depuis le 08/09 (§9.15) : « Créneaux disponibles » compte réellement les réponses validées du form dédié. Les 3 autres (Activités proposées, Participants actifs, Partenaires) restent codés en dur — aucune source confirmée pour eux |
| A.7 | Formulaire de contact | 🟡 | **câblé le 23/08** sur `CONTACT_SEND` (SDK → `/co2/mailmanagement/createandsend`), clés `action`/`method` retirées (§9.13). Reste **hors `site-json`** : renseigner **`costum.contactMail`** sur le costum (`admin.email` n'est qu'un repli), sinon le legacy renvoie le message à son auteur |
| A.8 | ~~Auto-inscription structure (`/structure`, bouton public + wizard)~~ **Édition + création admin** | ⛔ **public fermé le 23/09** · ✅ admin rouvert le 07/10 | le bouton public et la création admin (`create: false`) sont retirés (§9.19) ; **la création admin est rétablie le 07/10** (`create: "add-structure"`, §9.26) — plus aucune création de structure depuis le site, l'alimentation passe par le **référencement** (§9.10). Le costumForm `structure` reste en config et sert l'**édition** : aligné le 15/09 sur la refonte dynForm-legacy de SSBE (§9.17), 42 tests config-driven ✅, recette navigateur du 15/09 (§9.17 bis — création réelle réussie à l'époque, bug d'édition des pièces jointes corrigé). **Motif de la fermeture à confirmer avec la MSS** (§13) |
| A.9 | Charte graphique Ekilib.re (CSS propre au site + thème bleu/jaune/vert) | ✅ config / 🟡 recette | §9.19 (`beef21d9`) : `index-maison-sport-sante-la-tampon.css` (290 lignes), palette #1B4F72 / #F0B429 / #1A7A55 en clair et en sombre, `customCSS` des cartes SSsO corrigé. Gates verts (build client compris) ; **recette navigateur à faire, mode sombre en priorité** |
| A.10 | Ajustements du 08/10 : timeline de prescription, étapes verticales, ordre des filtres, cloche de notifications, réseaux sociaux en lignes de contact | ✅ config (`8cc2a9ef`) / 🟡 | §9.27. Correctif d'orientation de `#inscription-steps` commité (`11377a04`, clé déplacée dans `props`) ; table d'icônes partagée après la review de la MR 86 ; **recette navigateur à faire** |

### Lot B — Gestion des créneaux (admins)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| B.1 | Bouton « Ajouter un créneau » (création) | 🟡 | **code fait, revu, commité (`2bf81496`)** ; **public depuis le 31/07** (`adminOnly: false`, à côté du bouton Carte) ; CoFormModal + invalidation liste **et** carte ; recette navigateur connecté à faire |
| B.2 | Bouton « Modifier » sur le détail | 🟡 | droits = super-admin / admin costum / admin structure (`canEditCoformAnswer`, §9.2 bis) ; re-fetch frais anti-perte de champs ; recette à faire |
| B.2b | Inputs CoForm `date` / `timeSlots` / `dynamicFields` | 🟡 | **portés le 31/07** (§9.2 ter) — le formulaire créneau est maintenant complet (91 inputs rendus) ; recette à faire |
| B.3 | Suppression de fichiers à l'édition | ✅ SDK | **résolu** : le SDK **1.0.169** (installé le 31/07) expose `Answer.deleteFiles(docIds[])` — l'erreur typecheck `file.ts:167` a disparu. La fiche `DELETE_COFORM_ANSWER_FILE` ([`ENDPOINT.md`](../../ENDPOINT.md)) est **satisfaite** ; reste à recetter la suppression réelle |
| B.4 | Suppression d'un créneau | ❌ | non câblé (SDK `Answer.delete()` existe ; hook front `useDeleteAnswer` à créer via `createCoFormMutation`) |
| B.6 | Reprise des créneaux déposés sur SSBE (liste + « Copier », dédup) | ✅ code | §9.21 — onglet admin `creneaux-ssbe` (section moteur `answerCopy`), copie serveur idempotente ; **détail au clic** depuis le 08/10 (§9.23, lecture seule) ; **recette connectée siteAdmin à faire** (20 lignes attendues en prod, 2 « À copier ») |
| B.7 | Modération : créer un créneau depuis l'admin + détail d'une ligne au clic (fiche de l'annuaire, bouton « Modifier ») | ✅ code | §9.23 — options moteur `create:{coform}` et `preview` de la section `resource` ; **recette siteAdmin à faire** |
| B.5 | Commit + MR du lot | 🟡 | **commité le 31/07** (`20fc3529` coform · `2bf81496` search+config · `e163b6d9` doc) ; reste **push + MR** vers `main` |

### Lot D — Back-office & pilotage (CDC §4.2)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| D.1 | Back-office `/admin` activé (`config.admin`, accès `siteAdmin`) | ✅ config | onglets dashboard / membres / modération (§9.6) ; **recette navigateur connectée à faire** |
| D.2 | KPI « Créneaux actifs » + évolution mensuelle | ✅ | données réelles (mêmes filtres que `/creneaux`) ; tendance = créations, suppressions non historisées |
| D.3 | KPI « Usagers actifs » (visites uniques) | 🟡 | tuile « à raccorder » — **choix d'un analytics RGPD en attente** (§13) |
| D.4 | KPI « Signalements en attente » | ❌ | section `moderation` (et sa tuile dérivée) **retirée le 19/08** — `getModerationQueue` répond 500 ; à re-poser quand l'API sera réparée |
| D.5 | KPI « Pros inscrits » (attente de validation) | ✅ | = membres du carrier `toBeValidated` ; **définition à confirmer** (§13) |
| D.6 | Recette du back-office (siteAdmin réel, uploads AdminPanel) | ❌ | à faire ; l'upload AdminPanel écrira dans `public/images/associationEkilibre/` (déclarer ce dossier dans `sites.json` **dès le premier fichier**, cf. §12) |
| D.7 | Modération des créneaux (liste + statuts Validé/Refusé/En attente/En cours) | ✅ code | §9.6 bis — `status.mode: "statusField"` câblé (moteur) + resource answers dans l'onglet moderation (siteAdmin) ; **recette backend à faire** (updatepathvalue par admin non-auteur) |

### Lot E — Actualités (CDC, remplace le flux News)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| E.1 | Décision d'architecture (POI vs News) | ✅ | tranché le 06/08 par Nicolas : porté en **POI** (costumForm dédié) — §4, §7 |
| E.2 | costumForm « actualité » (POI) : titre, catégorie, date de publication, contenu riche, lien, statut, mise en avant | ✅ | **codé le 10/08, opérationnel le 19/08** (§9.7/§9.7 bis/§9.7 ter) — `scope: carrier` (associationEkilibre), `type:"article"`/`category` ; création réelle confirmée en base (photo comprise) |
| E.3 | Home — section Actualités (1 à la une + grille secondaire) | ✅ | **refondu** sur le module blog : un unique `articleFeed` avec `featured: "flag"` (§9.13), en `cardVariant: "poster"` depuis le 23/09 (affiches rendues entières, §9.19). La une est résolue par une micro-requête serveur `{featured:true}` distincte — le montage à deux blocs `searchProStatic` et la réserve `featured:{"$ne":true}` sont **sans objet** |
| E.4 | Back-office — CRUD actualités par l'admin (dont statut Publié/Brouillon/Archivé et mise en avant exclusive) | ✅ | **codé le 10/08, opérationnel le 19/08** — onglet `resource` + bouton « Mettre à la une » dédié (exclusivité gérée depuis le tableau, décision utilisateur, §9.7) ; création confirmée en base (§9.7 ter) — reste la recette du bouton « Mettre à la une » lui-même en navigateur |
| E.5 | Éditeur de contenu riche (WYSIWYG, cf. CDC « en production ») | 🟡 | **substitué par décision utilisateur (06/08)** : widget `markdown` existant, pas de nouvelle dépendance — hors périmètre explicite, cf. §9.7/§13 |
| E.6 | Fiche Actualités sur `/espace-pro` | ✅ config | `articleFeed` (pageSize 12, sans une épinglée) — la section `actualites-articles-list` n'existe plus sous ce nom (§9.13) |

### Lot F — Documents ressources pro (CDC §4.5)

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| F.1 | Formulaire de dépôt (nom*, catégorie*, PDF ou lien, description, statut) | ✅ | `costumForms["ekilibre-ressource"]` (§9.14) — recette réelle le 24/08 (création + édition en base) |
| F.2 | Annuaire public `/ressources` (publiés seulement, recherche + filtre catégorie) | ✅ config | `config:render` vert ; audience publique **provisoire** — décision utilisateur du 24/08 (« on verra après »), restriction pros possible plus tard (`auth.required` / `visibleIf`) |
| F.3 | Back-office — CRUD + statut Visible/Brouillon | ✅ | onglet admin `resource` en mode `statusField` (§9.14) — statut basculé en réel le 24/08 |
| F.4 | Déclaration `costum.typeObj` en base (`declarePoiTypes`) | ❌ PROD | appliquée en dev le 24/08, **jamais jouée en PROD** : le dump du 30/09 porte `typeObj = {organizations, article}`, sans `recoveryCenter`. Relance = poser **`recoveryCenter` SEUL** (l'action réécrirait aussi `article`). Tant que ce n'est pas fait, le formulaire ressources d'ekilibre.00.re (`VITE_COSTUM_FORCE_LIVE`) est **cassé** — runbook §9.11 |
| F.5 | Limite 10 Mo + HTTPS stricts côté front | ❌ | informatifs seulement (écart assumé §9.14) — évolution du widget `file` si exigée |

### Lot C — Industrialisation & mise en ligne

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| C.1 | `npm install` post-merge + gates verts | ✅ | mesuré le 23/08 : SDK requis `^1.0.189` **et installé 1.0.189** (plus de désynchronisation) ; `config:validate` 12 pages/47 sections, préflight 537/537, unitaires 2 793/2 793, `tsc -b` 0 erreur |
| C.2 | Recette navigateur complète (dont carte MapLibre) | ❌ | jamais faite depuis le merge du 30/07 |
| C.3 | Spec e2e Ekilibre | ❌ | aucun `e2e/*.spec.ts` pour ce site (modèle : `parent62.spec.ts`, lecture seule, ciblé) |
| C.4 | Volumétrie réelle (créneaux/structures en base) | ❌ | à relever (navigateur ou base) — comptages SDK du 31/07 non concluants |
| C.5 | Déploiement (backend prod, DNS, build mono-slug) | 🟡 | cible **définie** (§9.13) : Coolify `site-json-ekilibre`, `ekilibre.00.re`, `VITE_COSTUM_FORCE_LIVE`. **Bloqué** par les 3 écritures Mongo du runbook §9.11 — sans elles la whitelist costum est vide et les champs sont rabotés au save. Domaine propre et backend de prod **à confirmer** |

---

## 11. Dépendances site-json ↔ cocolight-api-client

SDK en **lecture seule** — toute évolution passe par une fiche dans [`ENDPOINT.md`](../../ENDPOINT.md)
(racine du workspace). Fiches déposées le 06/07 :

> ⚠️ **Références introuvables (constat du 23/08).** `ENDPOINT.md`, `FONCTIONNALITES-EKILIBRE.md` et
> `bonnes-pratiques-code.md` sont cités 9 fois dans ce document comme vivant à la racine du workspace
> (`../../`), mais **aucun des trois n'existe** dans l'arborescence. Ces liens sont antérieurs à cette
> mise à jour ; ils sont conservés parce qu'ils portent l'intention (où les fiches d'endpoint étaient
> suivies), mais **ils ne mènent nulle part** — à retrouver ou à remplacer par le canal réellement
> utilisé aujourd'hui.

| Demande | Sévérité | État au 31/07 |
|---|---|---|
| **`DELETE_COFORM_ANSWER_FILE`** + `Answer.deleteFiles(docIds[])` (suppression batch answer-side, auth save/upload) | ✅ **livré** | **SDK 1.0.169 installé le 31/07 : `Answer.deleteFiles(docIds: readonly string[])` est présent**, l'erreur `file.ts:167` a disparu. Fiche `ENDPOINT.md` à clore après recette |
| **`CONTACT_SEND_URL`** (formulaire de contact) | ✅ **livré** | `contactSend`/`ContactSendData` sont dans le SDK ; le site les consomme depuis le 23/08 (`CONTACT_SEND` → `/co2/mailmanagement/createandsend`, §9.13). Fiche `ENDPOINT.md` à clore. **Reste hors SDK** : **`costum.contactMail`** à renseigner en base (`admin.email` = repli seulement) |
| Alias générique de `COFORM_ANSWERS_BY_FORMS` (hors controller `/costum/francetierslieux/*`) | 🟡 conditionnel | requis seulement si on liste/édite les créneaux **depuis la fiche d'une structure** (pattern tiers-lieux) |

Rappel : la création/modification d'un créneau ne demande **aucun nouvel endpoint**
(`SAVE_COFORM_ANSWER` couvre les deux, `GET_COFORM_BY_ID`/`COFORM_ANSWERS_BY_ID` pour le
chargement, `GLOBAL_AUTOCOMPLETE_COSTUM` pour la liste).

---

## 12. Points d'attention / limitations

- ~~Lot auto-inscription structure non commité~~ **résolu** : commité par Nicolas (`9fbe7c02` puis
  renommé/complété `253dec37`) et mergé (`849a4f07`).
- ~~**`node_modules` désynchronisé**~~ **PÉRIMÉ au 23/08** : requis `^1.0.189`, installé 1.0.189. Le
  conseil de fond reste valable — **revérifier `node_modules/@communecter/cocolight-api-client/package.json`
  en début de session**, le piège s'est reproduit quatre fois sur ce poste.
  <details><summary>Constat d'origine (06/08)</summary>
  `npm install` avait bien été refait après le merge `main` (SDK 1.0.173, typecheck 0 erreur), mais
  au moment d'écrire cette mise à jour le `package.json` local montre **1.0.171** installé, ≠
  `^1.0.173` committé. **Aucune erreur observée à ce jour** (`typecheck` repasse toujours ✅ 0 erreur
  avec cette version) mais le piège est **récurrent sur ce poste** (déjà vécu en session 1 et 2) —
  toujours revérifier en début de session, ne pas se fier au dernier `npm install` documenté.
  </details>
- **Dossier d'uploads `public/images/associationEkilibre/`** : créé **vide** à chaque boot du dev
  server (`imageUpload.js` le crée au montage pour le `VITE_SLUG`) → le gate `site-assets` (venu de
  `main`) le signale comme orphelin ; **vide, il ne doit PAS être déclaré** dans `sites.json` (un
  dossier déclaré vide fait échouer l'autre assert). Le supprimer avant commit ; **dès le premier
  upload réel AdminPanel, le déclarer** (`images: ["maisonSportSanteLaTampon", "associationEkilibre"]`).
  **Confirmé actif le 10/08** : `tests/preflight/site-assets.test.ts` échoue bien sur ce dossier en
  repassant la suite complète — pré-existant, sans lien avec le lot actualités du jour.
- ~~**Route d'édition `structure` non bornée par costum**~~ **RÉSOLU le 20/08** (§9.10) : le `when` est
  posé, sur `associationEkilibre` (et non `sportSanteBienetre` comme le proposait l'extrait ci-dessous),
  sans `editModalMatch` — faute de `subType` sur le costumForm, non par choix (justification corrigée
  le 28/08, cf. §9.10).
  <details><summary>Constat d'origine (10/08)</summary>
  `profiles.organizations.editModal = "edit-structure"` n'a pas de clause `when` — le préflight
  `tests/preflight/edit-modal-scope.test.ts` (nouveau, mergé depuis `main` le 06/08, jamais fait
  tourner sur ce site avant le 10/08) le signale : sans `when`, le formulaire `structure` pourrait en
  théorie s'ouvrir sur **toute** organisation du type, pas seulement celles de `sportSanteBienetre`/
  `associationEkilibre`. Correctif attendu (non fait, hors périmètre du lot actualités) :
  ```json
  "when": { "or": [
    { "field": "sourceKeys", "op": "contains", "value": "sportSanteBienetre" },
    { "field": "reference.costum", "op": "contains", "value": "sportSanteBienetre" }
  ] }
  ```
  sur `profiles.organizations`.
  </details>
- **Filtres du KPI « Créneaux actifs » = copie des `baseParams` de `/creneaux`** (générée depuis la
  config elle-même à l'insertion, mais **statique ensuite**) : si les filtres de la page changent
  (CP, état, form), re-synchroniser le bloc `admin.tabs[0]…kpis[0].source` — sinon le KPI compte un
  autre périmètre que la page, sans erreur.
- **Answers : chemins imbriqués pour FILTRER/ÉCRIRE, shape APLATIE pour LIRE.** Le hook costum SSBE
  de recherche aplatit les champs d'answer à la racine des lignes (supprime `answers.*`, pose
  `name`/`structure`/`address`) → des `columns` en `answers.<formKey>.<clé>` affichent des colonnes
  **vides sans erreur** (piège vécu §9.6 bis). Filtres serveur (`defaultFilters`, filtre d'état) et
  `UPDATE_PATH_VALUE` gardent, eux, le chemin Mongo imbriqué. Le badge statut est protégé par le
  repli `readStatusValue` ; les colonnes, non — viser la shape aplatie.
- **Convention `.env` locale** : une valeur entre guillemets fait échouer le préflight
  `environment` (piège déjà vécu le 06/07, corrigé depuis dans la configuration locale). Poste
  dev : limite inotify relevée à 524 288 (06/07).
- **Lots créneaux poussés** : `ekilibre` = `origin/ekilibre` (0 commit d'écart, vérifié 31/07
  session 2) — les 3 commits de la session 1 (`20fc3529`, `2bf81496`, `86a6f023`) sont bien sur le
  remote ; reste à ouvrir la **MR vers `main`**.
- **Modération = champ `state`** : un créneau dont l'état n'est pas exactement `"Validé"` est
  invisible sur `/creneaux` — vérifier que le form pose bien ce champ (et qui a le droit de le
  changer). (Le piège « CP hors zone → invisible » a disparu avec le form dédié, §9.8.)
- **Clés et valeurs dupliquées config ↔ form** : les clés de champs
  (`associationEkilibre19082026_1327_0…`) et les valeurs d'options (littéraux exacts, accents
  compris) apparaissent dans les `dropdownFilters` et les `defaultFilters` ; côté code,
  `DEFAULT_COFORM_FIELDS` ne porte plus que les **ids stables** d'inputs (§9.8 — insensibles à la
  duplication de form) — mais toute modification du CoForm casse silencieusement filtres et
  cartes. Même famille de piège sur `/structure` (valeurs de `tags`).
- **Droits d'édition : le front est volontairement plus large que le backend.** `answer.canEdit` est
  calculé sur la seule propriété (`not_owner`), donc il refuse un super-admin ou un admin de costum.
  Le front applique la règle métier (`canEditCoformAnswer`) ; **si le backend refuse le save pour la
  même raison, la saisie est perdue** → à vérifier en recette avec un compte super-admin et un compte
  admin de structure, et à arbitrer avec l'équipe backend si le `save` renvoie 403.
- **Chiffres clés de la home en dur** (24 créneaux, 8 activités…) — ils se désynchroniseront du réel.
  *(La seconde moitié de ce constat — « les 8 cartes pointent vers /creneaux sans filtre » — est
  **résolue** depuis le 22/08 : chaque carte porte son deep-link et deux facettes pathologie existent,
  §9.12.)*
- **Le détail d'un créneau ne re-fetch pas** (parse l'item de la recherche) : si le backend tronque
  des champs dans `globalautocomplete`, le dialog est incomplet. L'**édition**, elle, re-fetch (lot 06/07).
- **Don HelloAsso** = lien externe (le endpoint serveur `/api/helloasso/checkout-intent` existe mais
  n'est pas branché pour ce site).
- ~~**CSS partagé avec SSBE** : un changement de thème SSBE impacte Ekilibre (et réciproquement).~~
  **PÉRIMÉ au 23/09** (§9.19) : chaque site a son fichier. Ce qui reste **commun** : `styles/shared.css`
  (importé par les deux) et **tous les composants** — une classe utilitaire ou une var consommée par un
  composant partagé impacte donc toujours les deux sites. Corollaire inverse, nouveau : **un correctif de
  charte fait sur SSBE n'arrive plus ici tout seul** ; il faut le reporter.
- ⚠️ **L'accent Ekilib.re est CLAIR** (jaune #F0B429, L .80) : ne jamais poser
  `text-primary-foreground` (quasi-blanc en clair) sur `bg-accent` — **1,81:1** mesuré. Soit
  `--accent-foreground` (7,34:1), soit un jaune creusé vers le noir, **par mode** (en sombre le texte
  clair devient foncé, donc le jaune doit rester plein). C'est la règle qui explique chaque `color-mix`
  du fichier CSS et le bloc `.dark` du `customCSS` (§9.19) — à rejouer pour toute section ajoutée plus
  tard sur fond accent.
- ⚠️ **`/structure` n'a plus qu'un seul point d'entrée** depuis le 23/09 : le bouton « Structure
  référentes » du bandeau de `/creneaux`. Ni nav, ni pied de page (le footer `contact-partners` n'a pas
  de colonnes de liens). Si ce bouton disparaît, la page devient orpheline sans qu'aucun gate ne le
  signale.
- ~~⚠️ **Adresse e-mail incohérente au pied de page**~~ **réglé** : le lien social « mail » est passé
  de `contact@cyber-reunion.fr` à `contact@ekilib.re` le 24/09 (`7cdc0fa8`), et la rangée `socials` a
  disparu le 08/10 (§9.23) — l'e-mail est désormais la première ligne du bloc contact. **Reste** : les
  mentions légales (« Commune du Tampon, La Réunion (97430) ») et la page confidentialité (« Siège
  social : Commune du Tampon, La Réunion (974) ») ne sont pas alignées sur l'adresse postale ajoutée
  le 23/09 (§13).
- ⚠️ **Une clé de section mal placée passe tous les gates** (08/10, §9.23) : `"orientation"` écrite à
  côté de `props` au lieu de dedans est acceptée par `config:validate` et par `audit:config`, et le
  composant l'ignore sans avertissement. Seule la lecture du composant (`StepsSection` lit
  `props.orientation`) ou le rendu le montre. Réflexe : toute option de rendu d'une section va
  **dans** `props`.
- **Icônes du bloc contact (`footer.contact.items[].icon`)** : `FooterContactPartners` ne connaît
  qu'une liste fermée (`address`, `phone`/`tel`, `mail`/`email`/`contact`, `globe`/`website`,
  `building`, `clock`, `facebook`, `linkedin`). Une clé inconnue affiche **l'épingle `MapPin`**, sans
  erreur — c'est ce qui a imposé
  l'ajout de `facebook`/`linkedin` le 08/10. Pour un autre réseau (Instagram, YouTube…), ajouter
  l'icône à `iconMap` avant de l'utiliser en config.
- **Chantier Actualités** : **codé le 10/08, opérationnel le 19/08** (§9.7/§9.7 bis/§9.7 ter) —
  création réelle confirmée en base (photo comprise). Cause racine du blocage qui a occupé la majeure
  partie de la session : l'organisation porteuse `associationEkilibre` n'avait pas de `costum.slug`
  sur son propre document, empêchant le backend de résoudre son costum lors de la sauvegarde — corrigé
  en base (hors `site-json`). Le flux `news` a été **remplacé** sur la home et `/espace-pro` (pas de
  double affichage).
- **Cache serveur costum (`CFileCache`, backend PHP) ne s'invalide pas automatiquement** après une
  édition du document costum en base — constaté plusieurs fois pendant le diagnostic du 19/08 (un
  champ ajouté au `typeObj` n'apparaissait pas côté validation tant que le cache n'était pas vidé
  manuellement). À garder en tête pour toute future édition du costum `associationEkilibre` côté
  backend : sans invalidation (mécanisme métier dédié si un déclencheur existe, sinon vidage manuel du
  fichier de cache concerné), les changements ne sont pas pris en compte immédiatement.
- ~~**`mutation.payloadEmitEmptyOnEdit` absent du costumForm `actualite`**~~ **PÉRIMÉ** : la clé est
  posée sur les **deux** formulaires aujourd'hui.

- ⚠️ **`payloadEmitEmptyOnEdit` + projection incomplète = destruction de données.** Les deux
  formulaires portent cette clé : à l'édition, un champ absent du payload est **écrasé à vide en
  base**. Or le payload se construit à partir du document *projeté*. Une `defaultFields` incomplète ne
  tronque donc pas seulement l'affichage — elle **détruit** les champs non projetés. C'est ce qui
  s'est produit sur `/structure` (25 champs projetés pour 55 écrits, §9.13). **Toute modification d'un
  formulaire costum impose de revérifier la projection de la liste qui l'édite.**

- ⚠️ **Une facette « par réponses » sans `filterTarget: "answers"` vide la liste au clic**, en
  s'affichant tout à fait normalement avec ses options. La config n'étant jamais parsée par Zod à
  l'exécution, la clé doit être écrite **explicitement** ; le défaut historique vit en dur dans le
  code. Une garde préflight le vérifie désormais pour tout le parc (§9.12).

- ⚠️ **Libellé de `multiCheckboxPlus` contenant un point = filtre non émis.** Le prédicat est un
  `$exists` sur une clé dotée ; un point de plus devient un niveau de chemin qui ne matche jamais.
  Panne silencieuse (avertissement en dev seulement). Contrôle : `npm run config:answer-labels` —
  **aucun libellé concerné sur le formulaire Ekilib.re** à ce jour, mais à rejouer après toute
  modification du CoForm.

- ⚠️ **La garde de `/espace-pro` protège l'expérience, pas la donnée.** Le texte de la page voyage
  toujours dans le `window.__CONFIG__` injecté sur **chaque** page : il est mesurable dans le HTML de
  `/contact`. Si le besoin est « cette donnée ne doit pas atteindre un anonyme », `page.auth` ne
  suffit pas — il faut sortir la donnée de la config. Par ailleurs c'est une garde de **session** :
  `auth.required` sans `auth.access` laisse entrer **tout compte connecté**, il n'y a aucun contrôle
  « professionnel de santé ».

- **Le site jumeau `sport-sante-bien-etre` n'a reçu aucun de ces correctifs** : il garde 4 occurrences
  de `notSourceKey`, n'a pas de `searchBy` sur ses créneaux (barre de recherche cassée à l'identique
  de ce qu'était celle du Tampon) et ne pose pas `card.structureAction`. À traiter séparément si la
  MSS le demande.

---

## 13. Évolutions à prévoir & questions en attente

| Évolution / question | Pour qui |
|---|---|
| 🔴 **Rejouer les 3 écritures Mongo sur la base de PROD avant tout déploiement** (runbook §9.11 : `copy-costum-decl` → `add-article-node` → `reference-stock`, dry-run puis `--apply`, puis purge du cache costum). **Sans elles la whitelist costum est vide et les champs métier sont rabotés au save, en silence.** | Peterson / Thomas |
| 🔴 **Versionner les 3 scripts de bascule** — ils portent le gate de déploiement ci-dessus et ne sont dans aucun dépôt | Peterson |
| **Confirmer la fermeture de l'auto-inscription des structures** (23/09, §9.19) : le bouton public reste fermé ; **la création par un admin du site est rouverte le 07/10** (§9.22) — à valider avec la MSS, qui avait demandé la fermeture (§9.20). | **MSS** / Nicolas |
| ~~Trancher l'adresse e-mail du lien social~~ **réglé** (`contact@ekilib.re` le 24/09, rangée `socials` retirée le 08/10, §9.23). **Reste** : aligner les **mentions légales** et la page **confidentialité** sur l'adresse postale « 34 rue Hubert Delisle, 97430 Le Tampon » | MSS / Nicolas |
| **Committer le correctif d'orientation** de `#inscription-steps` (`/s-informer`, clé déplacée dans `props` le 08/10, §9.23) | Nicolas |
| **Recette navigateur de la charte** (§9.19) — **mode sombre en priorité** : en-têtes de cartes SSsO/SSpT, `--btn-structure` de `CardAnswer`, cartes d'accès rapide du héros, cartes d'actualités en `poster` | Nicolas / MSS |
| **Règle d'affichage « Si oui avec qui » pour SSsL** (§9.22) : la règle `hide` du form ne vise que SSpT → le champ reste visible pour un créneau sans label. À régler dans l'éditeur de formulaire si « sans label » doit se comporter comme SSpT | MSS / Peterson |
| **Recette navigateur des cartes SSsL** (clair + sombre, badge « Validé » inversé, filtre à 3 options) ; compléter la FAQ si le « sans label » doit être expliqué aux usagers ; distinguer ou non les pins de la carte par type (`colorBy`) | Nicolas / MSS |
| **Recette de la modération enrichie** (§9.23, compte siteAdmin) : création d'un créneau depuis l'onglet, détail au clic et via « Aperçu », modification depuis le détail, rafraîchissement table + `/creneaux` ; vérifier que le créneau créé est **en tête** de `/creneaux` (§9.24) ; détail au clic sur l'onglet « Créneaux SSBE » (lignes aplaties par le hook, même fiche) | Peterson / MSS |
| **Saisir les créneaux du Tampon** : le recentrage de périmètre est juste, mais 44 des 45 réponses appartiennent au site jumeau — `/creneaux` n'en affiche plus qu'un (§9.12). Les 2 facettes pathologie resteront invisibles tant qu'aucune option ne remonte | **MSS** |
| **Reconfirmer en recette le comptage 44/45** : il vient du message de commit `b11285e5` et n'est pas revérifiable depuis le dépôt | Peterson |
| **Rejouer le référencement des 14 fiches en PROD** — il a été fait sur la base de **DEV** le 20/08 (§9.10) | Peterson |
| **Site jumeau `sport-sante-bien-etre`** : lui appliquer ou non les correctifs du Tampon (`notSourceKey`, `searchBy`, `structureAction`) — sa barre de recherche des créneaux est cassée à l'identique (§12) | MSS / Thomas |
| **Ouvrir la MR `ekilibre` → `main`** (lots créneaux + structure + admin + actualités ; les merges `main` du 30/07, 06/08 et 10/08 sont déjà intégrés) | Peterson |
| ~~Ajouter le champ `link` au `typeObj.article` backend~~ + ~~`costum.slug` sur l'organisation `associationEkilibre`~~ **résolus le 19/08** (§9.7 ter) | — |
| **Retester `structure` en édition** maintenant que `costum.slug` est posé sur `associationEkilibre` (§9.7 ter) — la même cause racine pourrait expliquer la perte de champs déjà constatée (§11/§12), à confirmer avant de rouvrir une demande backend séparée | Nicolas / Peterson |
| **Recette navigateur complémentaire du lot actualités** : statut Brouillon bien invisible côté public, et rendu de `/blog` (recherche + facette Catégorie). *(Le bouton « Mettre à la une » a été vérifié en navigateur le 21/08, `85c0edb9` ; la carte `resource` et `featured:{"$ne":true}` sont sans objet depuis la refonte sur le module blog, §9.13.)* | Peterson / MSS |
| ~~Borner la route d'édition `structure`~~ **FAIT le 20/08** (§9.10) | — |
| ~~`node_modules` désynchronisé~~ **résolu au 23/08** (requis `^1.0.189` = installé) | — |
| **Choisir l'outil de mesure d'audience RGPD** pour le KPI « Usagers actifs » (Matomo auto-hébergé recommandé — le moteur n'a AUCUNE lecture d'audience aujourd'hui, `IntegrationsLoader` ne fait que du tracking ; il faudra une API de lecture + probablement une route Express proxy) | Thomas / MSS |
| **Définition « Pros inscrits »** : le KPI compte les **membres du carrier en attente de validation** — est-ce la bonne maille (vs un tag/rôle « professionnel de santé ») ? | MSS / Peterson |
| **Tuile « Signalements » visible superAdmin seulement** (plancher backend de `getModerationQueue`) : acceptable, ou faut-il un endpoint siteAdmin ? (fiche `ENDPOINT.md` si besoin) | Thomas |
| **Versionner `.claude/agents/siteforge-config-auditor.md`** (référencé par le skill `config-assistant`, jamais commité → gate `skill-integrity` rouge sur tout clone frais) | mainteneur (aboire ?) |
| **Recette back-office `/admin`** (compte siteAdmin réel : KPIs, membres, modération) | Peterson / MSS |
| **Recette modération créneaux** : `updatepathvalue` sur une answer par un admin **non-auteur** — le backend l'autorise-t-il ? (sinon fiche `ENDPOINT.md` endpoint de modération dédié) | Peterson → Thomas |
| ~~**Recette du wizard auto-inscription** (upload logo, soumission réelle, libellés/ordre des étapes)~~ **SANS OBJET en création** depuis le 23/09 (§9.19) — le wizard ne sert plus qu'à l'**édition**, recettée le 15/09 (§9.17 bis) | — |
| ~~SDK : `Answer.deleteFiles` ?~~ **résolu** — livré (présent depuis 1.0.169, SDK installé : **1.0.173**) ; reste la recette de suppression réelle | — |
| ~~Formulaire de contact : endpoint SDK ou route Express~~ **tranché** (endpoint SDK, §9.13). **Reste à faire** : renseigner **`costum.contactMail`** sur le costum `associationEkilibre` en base — c'est le champ lu en PREMIER ; `costum.admin.email` n'est qu'un repli. Sans ni l'un ni l'autre, le legacy renvoie le message à son auteur, en silence | MSS / Thomas |
| **Recette création/modification d'un créneau** en admin (navigateur, backend réel) | Peterson / MSS |
| **Volumétrie réelle** : combien de créneaux à saisir dans le form dédié Tampon (les anciens créneaux SSBE ne sont plus listés, §9.8) ? de structures ? | MSS / réseau SSBE |
| **Qui valide les créneaux** : le process est désormais **outillé** (onglet Modération de `/admin`, §9.6 bis) — reste à désigner qui l'opère à la MSS | MSS / réseau SSBE |
| 🔴 **Rejouer `declareCopySources/apply/1` en PROD** (form dédié : `params.copySources` = form SSBE) avant d'ouvrir l'onglet « Créneaux SSBE » — sans elle, « Copier » est refusé et les lignes SSBE n'ont pas de colonnes (§9.21) | Peterson |
| **Copie = statut hérité de la source** (§9.21) : une source « Validé » est publiée d'emblée sur Ekilib.re. Garder, ou forcer « En attente » à la copie pour re-modérer localement ? | MSS / Peterson |
| **Déclarer l'extension `action:"copy"` de `GENERATE_ANSWER_FROM_FORM` dans le SDK** (fiche `ENDPOINT.md`) — fonctionne déjà, mais le contrat ne la documente pas | mainteneur SDK |
| **Les 18 réponses créées en prod le 22/09** dans le form dédié : par `copyCreneaux` (→ « Copié ») ou autrement (→ « Doublon probable ») ? L'onglet « Créneaux SSBE » le montrera sans écrire | Peterson |
| **`useDeleteAnswer`** (suppression de créneau) — si le besoin est confirmé | Peterson |
| **Spec e2e Ekilibre** (lecture seule, modèle parent62) | Peterson |
| ~~**Chiffres clés dynamiques** sur la home~~ **1/4 fait le 08/09** (§9.15) : « Créneaux disponibles ». **Reste à trancher** : source (si une existe) des 3 autres — Activités proposées, Participants actifs, Partenaires | Peterson / MSS |
| ~~Filtres pathologies : pré-appliquer un filtre depuis les cartes ?~~ **FAIT** (§9.12). **Reste à valider** : les **regroupements médicaux** composés au passage — « Problème cardiaque » = 4 ALD, « Cancer » = 4 ALD, « Stress / santé mentale » à cheval sur les deux champs. Ce sont des choix de rédaction, pas des choix cliniques | **MSS** |
| **Backend de prod + domaine** : la cible existe (Coolify `site-json-ekilibre`, `ekilibre.00.re`, §9.13) mais le **domaine propre** et le **backend de prod** restent à trancher — `VITE_COSTUM_FORCE_LIVE` pointe aujourd'hui vers le backend par défaut du parc | MSS / Thomas |
| Chef de projet / budget / phasage du CDC | à confirmer |
| **Remettre le filtre « Domaine d'intervention » sur `/structure`** (retiré le 24/09, §9.20) : le filtrer sur `thematic` (pas `tags`), après avoir **harmonisé les données SSBE** — valeurs courtes historiques → libellés longs de l'`enum`, chaînes à virgules → tableaux (`thematic` et `tags`). Migration à jouer en base comme celle de `mss` ; ou, sans migration, un filtre qui interroge les deux graphies (demande un ajout au schéma du `dropdownFilter`) | Nicolas |
