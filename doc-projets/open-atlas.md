[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Open Atlas — site de la communauté et des projets

> **Document de travail du projet de configuration.** Il porte le contexte, le modèle de données
> réel, les choix et l'avancement du site **`openAtlas`**. **À tenir à jour à chaque lot livré**,
> selon le formalisme du skill [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module AAC](../doc/34-module-aac.md) · [Module Search](../doc/07-module-search.md) ·
> [Module Profil](../doc/08-module-profil.md) · dossier voisin [Fédération des CAE](federation-des-cae.md)
> (même gabarit, AAC en service). Mémoire : `[[project-open-atlas]]`.

Dernière mise à jour : **2026-10-09** (lot 6 : page **`/outils`** d'après la maquette « Nos outils » —
11 outils en 4 familles avec leurs volets « En savoir plus », méthode COEUR, usages ; lot 5 : accueil « Nuit », thème **sombre par défaut**,
chiffres du réseau en direct. Le formulaire de contact n'a toujours **pas de destinataire** tant que
`costum.contactMail` n'est pas renseigné, cf. §13).

---

## 1. Contexte du projet

**Open Atlas** développe des outils sociaux et territoriaux libres (Communecter, Oceco, CoForm,
Cocolight…). Le site doit présenter la **communauté** d'Open Atlas, ses **projets** portés par un
**Appel à Communs (AAC)**, puis des pages statiques pour **décrire et faire découvrir chacun des
outils**, dont le contenu reste à produire (éventuellement généré par IA).

Demande de départ : un site-json « sur un template rezo », avec dans un premier temps la
communauté, les projets par AAC, et plus tard les pages d'outils.

### Identité

| | |
|---|---|
| Slug (`sites.json`) | `openAtlas` |
| Config | [`../config.prod.open-atlas.json`](../config.prod.open-atlas.json) |
| Feuille CSS | [`index-open-atlas`](../src/index-open-atlas.css) — **propre au site** depuis le 09/10 (base reprise d'`index-rezo-la-mer`, sans sa couche océan) ; couleurs dans `config.theme`, jetons `--oa-*` et blocs `oa-*` des sections `html` dans la feuille |
| Images | `public/images/openAtlas/` — 8 fichiers dérivés du logo fourni (§8) |
| Entité Cocolight | `organizations` / `555eba56c655675cdd65bf19` — « Open Atlas » (`type: LocalBusiness`), **identique en DEV et en PROD** |
| Costum backend | embarqué sur l'entité : `costum.slug: "OpenAtlas"` (O majuscule), hôte `www.open-atlas.org`, **aucun SSO**. `COSTUM_RESOLVED("openAtlas")` → `sourceKey: ["openAtlas"]`, `typeObj` : projects, events, proposals, crowdfunding, donation, organization |
| Formulaire des projets | `618b7b4abc572b35b4505da3` — « OCECO : GOUVERNANCE & PROJET » (`type: aap`, **sans `aapType`**), config OCECO partagé `618b7afe0ee16538e8282a21` ; fourni par Francki le 01/10 (§6) |
| Backends | DEV `http://communecter74-dev` · PROD `https://www.communecter.org` |
| Langues | `fr` (défaut) + `en` |
| Header / Footer | `transparent-scroll` (logo complet) / `sidebar-columns` (gabarit Rézo la mer) |
| Mode par défaut | **sombre** depuis le lot 5 (clair au lot 1) — bascule clair/sombre conservée |
| SDK | `@communecter/cocolight-api-client` **1.0.191** |
| Branche | `openatlas` (créée depuis `fdev` le 01/10, poussée) — `465ed7e8` module AAC (`choose` optionnel), `371cdd73` le site, `8d60acf1` lot 4 (commit de Francki), puis lot 5 en deux commits (moteur `stats`, puis accueil « Nuit ») — non poussés |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| 30/09 | Francki + Claude | Sondage backend (entité, costum, formulaires, périmètres), création de la config, lot 1 (accueil, communauté, pages légales), création de ce dossier |
| 01/10 | Francki + Claude | Lot 2 : bloc `aac` sur le formulaire OCECO, page `/projets`, bande et aperçu sur l'accueil ; sondage de la visibilité publique (§6, §13) |
| 01/10 | Francki + Claude | Lot 3 (moteur) : `choose` n'est plus deviné par le module AAC — un AAP n'en a pas ; retiré de cette config. Revue `revue-fonctionnalite` : 1 majeur (étape d'évaluation rouverte à l'auteur) et 7 mineurs, tous corrigés (§10) |
| 02/10 | Francki + Claude | Lot 4 : accueil recomposé d'après une maquette HTML reçue d'un ami de Francki (structure et textes repris, palette rouge du logo conservée, police Sora) ; pages `/accompagnement` et `/contact` ; nav et footer refaits (§10) |
| 02/10 | Claude | Trois directions d'accueil proposées sur un canvas de design (A fidèle, B nuit, C éditorial) |
| 05/10 | Francki | Commit du lot 4 (`8d60acf1`) ; direction **B — Nuit** retenue et retouchée par Simon (export HTML) |
| 09/10 | Francki + Claude | Lot 6 : page `/outils` d'après une maquette reçue en capture (pas de HTML source) — sections `html` + feuille `oa-*`, accents cyan et vert ajoutés ; nav « Nos outils » (§10) |
| 06/10 | Francki + Claude | Lot 5 : intégration de la maquette B — thème sombre par défaut, accueil en sections `html` stylées par `customCSS`, tuiles de chiffres vivantes (moteur : `stats` `design: "tiles"`, source `aacCommuns`) (§10) |

---

## 2. Objectifs de la configuration

1. Présenter Open Atlas et sa mission (accueil).
2. Offrir l'**annuaire de la communauté** : les personnes et les organisations membres.
3. **Projets** : annuaire, fiche d'un projet (paliers, financement, cofinanceurs, galerie) via le
   module AAC. Branché et public : 144 projets titrés (PROD, 01/10).
4. **Pages d'outils** : une page par outil (description, découverte) — **lot ultérieur**, contenu à
   produire.

---

## 3. Architecture générale

```
config.prod.open-atlas.json
   ├── bloc `aac`          → module AAC (doc/34) — formId 618b7b4a… (OCECO)
   ├── page /              → hero-parallax · cta-card-grid · content · categories-grid · aac-highlight
   │                          · aac-directory (aperçu) · content · action-tiles · cta
   ├── page /projets       → aac-directory (complet, sans bouton de dépôt)
   ├── page /communaute    → searchHeader · tabs
   │                             ├── Membres       searchProStatic (citoyens)
   │                             └── Organisations searchProStatic (NGO, LocalBusiness, Group, …)
   │                          périmètre = links.memberOf.<openAtlas>, hors invitations — PAS sourceKey
   ├── page /accompagnement → content · features-glass · content · cta
   ├── page /contact       → content · contactForm (CONTACT_SEND → costum.contactMail)
   ├── pages /mentions-legales · /confidentialite → html (socle légal, à compléter)
   ├── /aac · /aac/commun/:answerId → module AAC (annuaire nu, fiche d'un projet)
   ├── /profil/:slug       → module profil (fiche « À propos » = /profil/openAtlas)
   └── /login · /register  → module auth
```

Deux chaînes de données indépendantes :

- **communauté** : les **liens** de l'entité (`notSourceKey: true` + `defaultFilters`), parce que le
  périmètre `sourceKey` est quasi vide (§6) ;
- **projets** : l'endpoint `directoryproposal` du formulaire OCECO. Formulaire **AAP**, sans étape de
  sélection : la config ne déclare pas `choose`, donc **aucune restriction** de visibilité — toute
  réponse titrée est publique, sans badge « En attente » ni bouton « Ajouter à l'annuaire ».

---

## 4. Ce que la config met en œuvre

| Page | Sections | Détail |
|---|---|---|
| `/outils` | 10 | Maquette « Nos outils » (lot 6), toutes en `html` : `#nos-outils` héro (retour, surtitre, « Nos outils. », accroche tricolore, ancre → `#familles`, symbole atténué, 3 atouts) · `#familles` (titre, 4 ancres de familles) · `#creer` / `#recolter` / `#decider` / `#cooperer` (01-04 : COstum, COcity, COevent · COForm, Observatoire · Appel à projets, OCECO, Smarterre · Communecter, Cocolight, COTOOLS — icône, accroche, texte, 3 points, volet repliable « En savoir plus sur … ») · `#relie` (données reliées, carte Communecter → communecter.org) · `#methode-coeur` (5 étapes) · `#usages` (4 terrains) · `#accompagner` (→ `/accompagnement`) |
| `/` | 9 | Maquette « B — Nuit » (lot 5). `html` `#accueil` héro scindé : surtitre, titre à moitié rouge, boutons « Découvrir Communecter » (→ `#outils`) et « Nous écrire » (→ `/contact`), grand symbole du logo · `html` `#outils` « Un logiciel, une instance centrale » (2 cartes, 6 étiquettes, → dépôt Git et communecter.org) · `html` `#reseau` « Les projets et la communauté » (→ `/projets`, `/communaute`) · `stats` `#chiffres` en `design: "tiles"` : projets publiés (`aacCommuns`, tuile rouge), membres et organisations (`searchCount` sur le périmètre de la communauté) — **comptés en direct** · `aac-directory` `preview` 3 projets · `html` `#approche` 4 principes numérotés · `html` `#reseaux` schéma « Communecter.org au cœur » (SVG + 4 liens) · `html` `#accompagnement` (encart prestataires, 5 étapes) · `html` `#rejoindre` (3 boutons → `/contact`, `/communaute`) |
| `/projets` | 1 | `aac-directory` `full` — recherche, tags, tri ; **pas** de filtres usage/maturité (champs absents du formulaire), **pas** de bouton de dépôt (formulaire fermé) |
| `/accompagnement` | 4 | `content` (présentation) · `features-glass` « Ce que nous proposons » (5 services) · `content` « Un réseau, pas un guichet » (OPTEOS, CoRD en tags) · `cta` → `/contact` |
| `/contact` | 2 | `content` (intro) · `contactForm` : nom, e-mail, sujet (Adhérer · Discuter d'un projet · Contribuer au logiciel · Autre), message, consentement — **envoi sans destinataire configuré**, cf. §13 |
| `/communaute` | 2 (+2 listes imbriquées) | `searchHeader` · `tabs` Membres / Organisations, cartes `profile`, aperçu en tiroir, recherche par liste |
| `/mentions-legales` | 1 | `html` — LCEN, faits établis seulement, le reste en `[à compléter]` |
| `/confidentialite` | 1 | `html` — RGPD, même règle, ancre `#cookies` |

Bloc `aac` :

| Clé | Valeur | Pourquoi |
|---|---|---|
| `formId` | `618b7b4abc572b35b4505da3` | formulaire fourni par Francki |
| `directory.fields` | `title` `answers.aapStep1.titre` · `description` `…description` · `tags` `…tags` · `depense` `…depense` — **pas de `choose`** | clés OCECO standards — les mêmes que `parsePropositionData` lit côté serveur ; explicites pour ne pas dépendre de l'heuristique (`form.mapping` est absent sur ce formulaire). `choose` omis : un AAP n'a pas d'étape de sélection (son `aapStep2` ne porte qu'un `decide`) |
| `detail.gallery` | `aapStep1.image` | sous-clé des images d'un projet |

Blocs racine : `version`, `meta`, `theme`, `header`, `footer`, `profiles` (`default` + `projects`),
`aac`, `pages`. **Absents** : `auth`, `admin`, `commandPalette`, `costumForms`, `blog`,
`cagnotteModuleConfig`.

Header : logo complet (`logo.png` en clair, `logo-dark.png` en sombre, `logoClass` en hauteur
seule), nav Nos outils (`/outils`, depuis le lot 6 — remplace l'entrée externe Communecter.org) ·
Projets · Communauté · Accompagnement, bouton
« Nous écrire » → `/contact` ; utilitaires `themeSwitch`, `langSwitch`, `auth`, `notifications`.
`piggyBank`/`pledge` **coupés**.

Footer (`sidebar-columns`) :

| Colonne | Liens |
|---|---|
| Outils | Nos outils (`/outils`) · Communecter (logiciel) → dépôt Git · Communecter.org (instance) |
| Association | Accompagnement · Projets · Communauté · Nous contacter (`/contact`) |
| Références | tiers-lieux.org · parent62.00.re · lescommuns.tiers-lieux.org · equipements-sportifs-974.00.re |
| Développeurs | Dépôt Git · Documentation API · Code du client · Docker du serveur · Soutien NLnet |
| *bas de page* | `legalLinks` : Mentions légales · Confidentialité — `bottomLinks` : Se connecter / Créer un compte **(anonyme)** · Mon profil **(connecté)** |

---

## 5. Cahier des charges (intégré)

Pas de CDC formel : la demande tient en trois points (communauté, projets par AAC, pages d'outils).
Arbitrages avec Francki :

| Date | Question | Décision |
|---|---|---|
| 30/09 | Thème | **Clair par défaut**, mode sombre disponible |
| 30/09 | Langues | **FR + EN** |
| 30/09 | Pages d'outils | **Pas dans le lot 1** — à faire quand le contenu existe |
| 30/09 | Projets sans formulaire AAC | Pas de page Projets avant d'avoir un formulaire |
| 01/10 | Formulaire des projets | **Le formulaire OCECO `618b7b4a…`** (« basé sur aap, un peu le même que l'AAC ») plutôt qu'un AAC neuf |
| 01/10 | Sélection des projets | « Un AAP n'a pas cette partie de `choose` » : `choose` **optionnel**, et sans valeur, ni statut « en attente » ni restriction ⇒ les projets titrés sont publics |
| 02/10 | Maquette d'accueil (reçue d'un ami) | **Palette rouge du logo conservée** (pas le teal/jaune de la maquette) ; structure, textes et police Sora repris |
| 02/10 | Cible de « Nous écrire », « Adhérer », « Discuter d'un projet » | **`contactForm`** (page `/contact`, un champ « Sujet ») |
| 02/10 | « Ils nous font confiance » | **Pas encore de logos** ⇒ section non posée (`logoCloud` exige des logos ; afficher des institutions demande aussi leur accord) |

---

## 6. Modèle de données réel

Sondé en lecture seule, sans authentification, sur les deux backends (30/09 et 01/10).

### Périmètre costum (`sourceKey: ["openAtlas"]`)

Les éléments créés sous le costum portent `source: {key: "openAtlas", keys: ["openAtlas"],
insertOrign: "costum"}`. La clé est le slug de l'entité, **pas** `costum.slug` (`"OpenAtlas"` →
0 résultat partout). Aucun élément ne porte `reference.costum: "openAtlas"`.

| Type | DEV | PROD |
|---|---|---|
| Organisations | **0** | **0** |
| Citoyens | 14 | 26 |
| Projets | 1 (`as2`) | 1 |
| Événements / POI | 1 / 1 | 1 / 1 |

⇒ inutilisable pour un annuaire. La communauté se lit par les **liens** de l'entité.

### Liens de l'entité (périmètre de la communauté)

| Périmètre | DEV | PROD |
|---|---|---|
| `links.memberOf.555eba…` — citoyens | 97 | 96 |
| … hors invitations en attente (**liste Membres**) | **92** | **91** |
| … organisations (**liste Organisations**) | **18** | **18** |
| Projets `parent.555eba…` | 220 | 222 |
| Projets `links.contributors.555eba…` | 230 | 232 |

Filtre des invitations **prouvé par A/B** (`config:probe`, 30/09) : `links.memberOf.<id>.isInviting:
{$exists:false}` retire 5 invitations (97 → 92 en DEV, 96 → 91 en PROD). `toBeValidated` est honoré
(contrôle `zzzBogus` → 0) mais ne concerne personne aujourd'hui ; il est gardé pour l'avenir.

### Formulaire des projets — `618b7b4abc572b35b4505da3`

« OCECO : GOUVERNANCE & PROJET », `type: aap` **sans `aapType`**, parent Open Atlas, étapes
`aapStep1`→`aapStep4`, config OCECO partagé `618b7afe…` (rattaché à une autre organisation).

| Mesure (`directoryproposal`, anonyme) | DEV | PROD |
|---|---|---|
| Réponses | 343 | 345 |
| … avec un titre (ce que l'annuaire garde) | 142 | **144** |
| … sélectionnées par Open Atlas (sans objet depuis le lot 3 : pas de `choose`) | 0 | 0 |
| Contrôle (`zzzBogus`) | 0 | 0 |

Réglages du formulaire (PROD, 01/10) :

| Réglage | Valeur | Effet sur le site |
|---|---|---|
| `access.formStatus` / `access.canAnswer` | `closed` / `false` (`reason: form_closed`) | dépôt refusé au save ⇒ bouton de dépôt **masqué** |
| `params.onlymemberaccess` | `true` | **ignoré** par le module, qui lit `onlymemberaccess` à la **racine** du form (§13) |
| `params.adminabsoluteaccess` | `true` | — |
| `coremu` (racine) | absent | sans effet : la fiche montre le financement dès qu'une étape de financement existe (`hasFundingStep`) |
| `mapping` | absent | d'où les `directory.fields` explicites |

Contenu : clés `aapStep1` = `titre`, `description`, `tags`, `depense` (avec `financer[]` et `payment`),
`image`, parfois `urgency`. Ce sont des projets **internes et clients** d'Open Atlas (Corner Dev,
costum parent62, Equipements Sportifs 974 Costum, MSS Tampon, COForm, ocecoMobi…), avec **budgets et
versements nominatifs** (ex. un palier de 3 000 € financé par un client), des **doublons** (« MSS
Tampon », « Corner Dev » ×2) et beaucoup de fiches sans description ni image.

---

## 7. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config | [`../config.prod.open-atlas.json`](../config.prod.open-atlas.json) |
| Déclaration du site | [`../sites.json`](../sites.json) — entrée `openAtlas` (sans `coolifyApp`/`domain` pour l'instant) |
| Assets | `../public/images/openAtlas/` : `logo.png`, `logo-dark.png`, `logo-symbol.png`, `logo-symbol-dark.png`, `logo-symbol-neutral.png`, `favicon.png`, `logo-symbol-lg.png` + `logo-symbol-dark-lg.png` (lot 5 : symbole du héro, 380 px recadrés du logo complet à sa résolution native) |
| CSS | [`../src/index-open-atlas.css`](../src/index-open-atlas.css) — jetons `--oa-*`, encre `.text-primary` en sombre, blocs `oa-*` de l'accueil et de `/outils`, icônes en masque. Avant le 09/10 : `index-rezo-la-mer` partagée + `theme.customCSS` |
| Code moteur (lot 5) | [`../src/components/sections/StatsSection.tsx`](../src/components/sections/StatsSection.tsx) (design `tiles`, chiffres comptés) · [`../src/components/sections/useStatDynamicValue.ts`](../src/components/sections/useStatDynamicValue.ts) (source `aacCommuns`, état `unavailable`) · `../src/types/site-schema.ts` · tests `StatsSection.test.tsx`, `useStatDynamicValue.test.ts` · registre `../scripts/lib/prop-descriptions.ts` · story `../.design-sync/previews/StatsSection.tsx` · `../doc/34-module-aac.md` |
| Tests | `../tests/preflight/__effective__/open-atlas.json` (instantané du préflight — ne projette pas le bloc `aac`) |

---

## 8. Choix techniques et justifications

| Choix | Pourquoi |
|---|---|
| Config écrite à la main, pas `config:init` | `config:init` ne part que d'un archétype du manifest ; ni Rézo la mer ni la Fédération des CAE n'en sont. Chrome repris de Rézo la mer, bouts AAC/annuaire de la Fédération |
| Header `transparent-scroll` + footer `sidebar-columns` | Le « template rezo » demandé. Lot 5 : le header porte le **logo complet** (comme la maquette) via `logoClass` (hauteur seule, largeur libre) ; le footer garde le symbole + titre (son logo est un carré de 32 px) |
| Sombre par défaut (lot 5) | La maquette retenue est la direction « Nuit » : le logo blanc et rouge est dessiné pour un fond sombre. Palette `dark` = valeurs exactes de la maquette (fond `#0F121A`, bandes `#161B24`, cartes `#1B212C`, texte `#EEF0F4` / `#A3A9B5`, boutons `#CC2443`) ; la palette claire du lot 1 reste pour la bascule |
| `.text-primary` repeint en sombre (`customCSS`) | Le rouge des boutons `#CC2443` tient 5,4:1 sous du blanc mais seulement **3,5:1 en texte** sur la nuit. Les aplats gardent `primary` ; tout texte `text-primary` passe au rouge clair de la maquette `#F75B6B` (5,9:1) |
| Accueil en sections `html` + `customCSS` | Aucune section du catalogue ne rend le héro scindé, les colonnes numérotées, le schéma réseau ou l'accompagnement en deux colonnes de la maquette. Le HTML ne porte que des classes `oa-*` ; la feuille n'utilise **que des tokens** (`var(--primary)`…), d'où un mode clair correct sans rien de plus. Précédent : julie-pot-vin (21 sections `html`) |
| Chiffres en tuiles **comptés**, pas écrits (moteur) | Une rangée « Le réseau en direct » avec des nombres écrits serait fausse en quelques semaines. `stats` gagne `design: "tiles"` et `items[].source` (même contrat que `cta-card-grid`) ; nouvelle source `aacCommuns` = le décompte du médaillon d'`aac-highlight`. Squelette en SSR, tiret si le compte échoue |
| `#outils` en lien d'ancre natif (lot 5) | Dans une section `html`, le lien est un `<a>` natif : le navigateur défile (mesuré : `#outils` arrive à 88 px du haut, `scroll-margin-top` sous le header collant). Le défaut relevé au lot 4 ne touche que les liens `<Link>` du routeur |
| `/outils` en sections `html` (lot 6) | Même raison que l'accueil : aucune section du catalogue ne rend ces cartes à liseré par famille, la frise COEUR ou la grille d'usages. Une section par bloc, pour que chaque famille soit une ancre (`#creer`…) |
| Accents cyan et vert (lot 6) | Couleurs de la maquette (`#3BC7E5`, `#A2CC56`) en sombre ; en clair, assombries à `#0A6F86` / `#47720E` pour tenir 5:1 sur blanc. Tokens `--oa-cyan` / `--oa-lime` ; le rouge reste `--oa-ink` (le `#FF6A7E` de la maquette en est à un cheveu) |
| Icônes en masque CSS (lot 6) | La config entière est **embarquée dans chaque page** : en SVG inline, les 19 icônes Lucide répétées (74 coches) coûtaient 35 Ko de plus sur TOUTES les pages. Tracés définis une fois dans la feuille (`.oa-i-<nom>`), `<i class="oa-ico oa-i-check">` dans le HTML : config 148 → 126 Ko |
| Volets en `<details>` natif (09/10) | S'ouvre sans JavaScript (servi tel quel par le SSR), au clavier et annoncé par les lecteurs d'écran sans ARIA à écrire. Fermées, les cartes d'une rangée gardent la même hauteur (volet calé en bas) ; dès qu'un volet s'ouvre (`:has([open])`), chaque carte reprend sa hauteur au lieu d'étirer ses voisines d'un vide |
| Pas de `page.customCSS` | ⚠️ `page.customCSS` existe dans le schéma mais **aucun code ne l'applique** (seul `theme.customCSS` est injecté, `SiteTheme.tsx`) : une page qui s'y fierait perdrait ses styles en silence |
| Symbole du héro recadré à 380 px | `logo-symbol-dark.png` (256 px) aurait été agrandi à 380 px ; recadré depuis `logo-dark.png` à sa résolution native |
| 6 variantes du logo | Le logo fourni a le mot « Open Atlas » **en blanc** : invisible sur fond clair. `logo-symbol.png` (encre bleu nuit) en clair, `logo-symbol-dark.png` (blanc d'origine) via `header.logoDark`. Le footer n'a **pas** de `logoDark` : `logo-symbol-neutral.png` (encre gris-bleu) reste lisible sur les deux fonds |
| `primary` = `oklch(0.57 0.21 18)` | Rouge du logo (`#E2334E` ≈ `oklch(0.60 0.209 18)`) assombri pour tenir **4,99:1** avec le blanc ; en sombre `oklch(0.66 0.20 18)` avec encre bleu nuit (5,66:1). Toutes les paires porteuses ≥ 4,5:1 |
| Encre `oklch(0.22 0.017 264)` | Bleu nuit du logo, neutre froid de toute la palette |
| Police Sora (lot 4) | Celle de la maquette d'accueil ; remplace Urbanist |
| Feuille propre `index-open-atlas.css` (09/10) | Le site vivait sur la feuille PARTAGÉE de Rézo la mer, repeinte en rouge par 27 Ko de `theme.customCSS` : la config étant sérialisée dans chaque page, ces 27 Ko étaient payés partout, et `:root:root` servait à battre les turquoises de Rézo. La feuille propre ne garde de Rézo que la base générique et les utilitaires réellement employés par des composants (`animate-in`, `fade-in`, `slide-in-from-bottom-4`, `.prose`…), redéfinit seulement `--gradient-section` (bandeau des `searchHeader`), et porte les blocs `oa-*` hors `@layer` pour battre les utilitaires comme avant. Config 126 → 99 Ko, chaque page ≈ −75 Ko de HTML ; rendu identique au pixel sur les 8 pages, clair et sombre |
| Halo des titres de héro coupé en clair par `:root:not(.dark) .text-shadow-glow` (lot 4 — **retiré au lot 5**, plus de `hero-parallax`) | ⚠️ La surcharge de `--text-shadow-glow` posée au lot 1 n'a **jamais agi** : la variable est déclarée en `@theme`, Tailwind fige sa valeur dans la classe au build (mesuré le 02/10 : variable à `none`, halo toujours rendu). Seule une règle sur la classe l'éteint. Gardé en sombre |
| ~~Principes en `categories-grid`~~ (lot 4, remplacé au lot 5) | `features-glass` plafonne à 3 colonnes et `cards` coupe les textes ; le lot 5 les rend en `html` |
| ~~Bouton « Découvrir Communecter » → communecter.org~~ (lot 4) | Un `<Link>` vers `#outils` ne fait pas défiler la page ; au lot 5 le bouton est un `<a>` natif qui défile |
| Liens externes en `cta-card-grid` / `action-tiles` | Ces sections passent par `<Link>` : les URL `https://` partent en navigation classique, **dans le même onglet** |
| Communauté par `links.memberOf` + `notSourceKey` | Le périmètre `sourceKey` compte 0 organisation (§6) |
| Deux onglets plutôt qu'une liste | Recette `page-communaute-onglets` : une carte de personne et une carte d'organisation n'ont pas le même contrat |
| Page `/projets` plutôt que `/aac/communs` | Le vocabulaire du site est « projets » ; la route de module `/aac` reste montée |
| `showDepositButton: false` | Le formulaire est **fermé** : le bouton s'afficherait (le module ne garde que `form.active`) et le dépôt échouerait au save |
| Filtres `usage` et `maturity` coupés | Pas de catalogue d'usages ni de champ de maturité sur ce formulaire |
| ~~`aac-highlight` en ton `muted`~~ (lot 2, retiré de l'accueil au lot 5) | En ton `primary`, la feuille Rézo force `text-foreground` sur `h2`/`p` (§13) ; le chiffre vit désormais dans la tuile `aacCommuns` |
| `choose` réservé à la config (moteur) | Le module devinait `aapStep2.choose` sur tout formulaire : sur un AAP, chaque projet était « en attente » et l'annuaire public, restreint aux sélectionnés, sortait vide. Un AAC le déclare désormais (Fédération des CAE déjà ; `config.dev.acc.json` ajouté) |
| `piggyBank`/`pledge` coupés, pas de `cagnotteModuleConfig` | Le financement reste visible sur la fiche d'un projet ; on n'ajoute pas d'entrée de cagnotte au header tant que la publication n'est pas décidée |

---

## 9. Étapes de mise en place

1. **Local** : `VITE_SLUG=openAtlas npm run dev` (le `.env` peut rester sur un autre site : le slug
   de `sites.json` apporte config et CSS). Pour les projets, préférer le backend **PROD**
   (`VITE_BASE_URL_BACKEND=https://www.communecter.org`) : en DEV, `getformbyid` sur l'`aapConfig`
   répond 500 (§12).
2. **Publication des projets** : plus d'étape manuelle — sans `choose`, tout projet titré du
   formulaire est public. Pour retirer un projet du site, il faut aujourd'hui agir sur la réponse
   elle-même (titre, suppression) : le site n'a pas de filtre de publication propre à un AAP.
3. **Déploiement** : entrée Coolify (`coolifyApp`, `domain`) à ajouter dans `sites.json` ; nom de
   domaine à décider (le costum legacy occupe `www.open-atlas.org`).

---

## 10. Impacts des modifications

### 30/09 — création (lot 1)

- **Ajouts seuls** : nouvelle config, nouvelle entrée `sites.json`, nouveau dossier d'images. Aucun
  fichier de code ni aucune autre config touchés ; la feuille partagée n'est **pas** modifiée.
- Gates : `config:validate` ✅ · `audit:config` ✅ RAS · `config:render` ✅ 4/4 · `config:probe` ✅ 2/2
  (92 · 18) · `test:preflight` 🟡 2 échecs antérieurs et locaux (`config.dev.json` du `.env`,
  dossier `public/images/franckiOrga`).

### 01/10 — projets (lot 2)

- **Config seule** : bloc `aac`, page `/projets`, 2 sections sur l'accueil, liens nav + footer,
  mention des projets dans les deux pages légales. Aucun code touché.
- **Gates** (01/10) :

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 5 pages, 10 sections |
| `audit:config` | ✅ RAS |
| `config:render` | ✅ 5/5 pages, 10/10 sections avec contenu SSR |
| `test:preflight` | 🟡 780 ✅ · 1 ❌ **antérieur et local** : dossier `public/images/franckiOrga` non déclaré |
| Rendu navigateur, anonyme, DEV **et** PROD | ✅ rend — mais **« 0 résultat »** et médaillon à 0 : aucun projet sélectionné (§13) |
| Contrôle positif (local) | ✅ en retirant, dans le navigateur de test seulement, la restriction « sélectionnés » de la requête : **144 résultats** sur PROD, cartes et fiche détail (paliers, financement, cofinanceurs) rendues. Ce qu'un admin verra |

### 01/10 — `choose` optionnel (lot 3, moteur)

- **Code** : `src/modules/aac/lib/resolveAacCardFields.ts` (`choose` résolu par la config SEULEMENT —
  ni `form.mapping`, ni scan, ni défaut ; un chemin sans `answers.` est refusé) ;
  `pages/AacCommunDetailPage.tsx` (l'étape masquée au non-admin à l'édition suit l'étape
  d'**évaluation**, plus `choose`) ; JSDoc de `schema.ts`, commentaires de `aacQueryParams.ts`,
  `useAacDirectoryContext.ts`, `queryKeys.ts`, `useAacFacets.ts`. Doc `doc/34` §3.1, skill
  `config-assistant`.
- **Configs** : `config.prod.open-atlas.json` perd `choose` ; `config.dev.acc.json` (AAC tiers-lieux,
  `aapStep2.choose` = `chooseProposal` réel) le **déclare** pour garder son comportement ;
  `config.prod.federationDesCae.json` le déclarait déjà — inchangée.
- **Régression évitée** (revue, majeur) : la première version liait le masquage de l'étape
  d'évaluation à `choose` ; sur le form OCECO, l'auteur non admin aurait vu l'étape « Bilan » et pu
  voter sur sa propre proposition. Corrigé, avec test.
- **Gates** :

| Gate | Résultat |
|---|---|
| `vitest src/modules/aac` | ✅ 54 fichiers, 556 tests (+4 : `choose` jamais deviné, ni par `mapping`, chemin mal formé refusé, étape d'évaluation masquée sur un AAP) |
| `typecheck` | 🟡 3 erreurs **antérieures** dans `cagnotte/hooks/useSaveCagnotteContribution.ts` (SDK 1.0.191 sans `addFinancer`/`payFinancer`) |
| `eslint` (fichiers touchés) | ✅ |
| `test:preflight` | 🟡 780 ✅ · 1 ❌ **antérieur** (`public/images/franckiOrga`) |
| `config:validate` | ✅ open-atlas, federationDesCae, dev.acc |
| Rendu anonyme PROD (revue) | ✅ Open Atlas : `/projets` 144 résultats, 0 « En attente », fiche sans statut ni bouton, médaillon 144 · Fédération des CAE : 7 résultats, filtre `$or` toujours envoyé, fiche « Sélectionné » — **inchangé** · aucune erreur d'hydratation |

### 02/10 — accueil d'après la maquette (lot 4, config seule)

- **Config** : accueil recomposé (9 sections), pages `/accompagnement` et `/contact`, nav, bouton
  « Nous écrire », footer à 4 colonnes + liens légaux et de compte en bas, meta, police Sora, règle CSS
  du halo ; la politique de confidentialité déclare le formulaire de contact (données, finalité).
- **Gates** (02/10, backend PROD — le backend DEV renvoie une erreur sur la résolution du slug ce jour-là) :

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 7 pages, 20 sections |
| `audit:config` | ✅ RAS (icônes connues, ancres et liens résolus, i18n fr/en complète) |
| `config:render` | ✅ 7/7 pages, 20/20 sections avec contenu SSR |
| `test:preflight` | 🟡 780 ✅ · 1 ❌ **antérieur** (`public/images/franckiOrga`) |
| Rendu navigateur | ✅ clair, sombre, mobile 375 px (aucun débordement horizontal), `/accompagnement`, `/contact` ; aucune erreur console ni d'hydratation ; halo du titre `none` en clair |

### 09/10 — page « Nos outils » (lot 6, config seule)

- **Config** : page `/outils` (10 sections `html`), bloc « Nos outils » ajouté à `theme.customCSS`
  (+ 19 règles d'icônes en masque), nav « Nos outils » en tête, lien « Nos outils » en tête de la
  colonne Outils du pied de page, carte Communecter de l'accueil → « Voir le détail des
  fonctionnalités → » `/outils` (le texte de la maquette Nuit). Traductions anglaises écrites par
  Claude — à relire.
- **Feuille propre** (même jour) : `theme.customCSS` retiré de la config ; `src/index-open-atlas.css`
  créée et déclarée dans `sites.json` (`css`). Vérifié par comparaison au pixel avant/après des 8
  pages en clair et en sombre : identiques (écart max 2/255 dans le dégradé du bandeau de
  `/communaute`).
- **Écarts assumés avec la maquette** : en-tête et pied de page du site gardés (la maquette avait les
  siens : « Accueil · Nos outils · Être accompagné », « 1 + 1 = 3 — L'intelligence collective au
  service du citoyen »).
- **Volets « En savoir plus sur … »** (même jour, 2e capture qui les montre ouverts) : un `<details>`
  natif en pied de chaque carte (classe `oa-tool__more`, chevron en masque `oa-i-chevron-down`),
  fermé par défaut ; textes FR repris de la capture, anglais écrit par Claude — à relire. +10 Ko de
  config (§13).
- **Gates** (09/10, backend PROD) :

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 8 pages, 30 sections |
| `audit:config` | ✅ RAS (ancres `#familles`, `#creer`… résolues) |
| Feuille propre | ✅ 16 captures avant/après identiques au pixel ; `config:render` 8/8 ; config 99 Ko |
| Volets « En savoir plus » | ✅ 11 volets FR et EN ; ouverture au clavier (Entrée) ; sombre et clair 1440 px, mobile 390 px sans débordement, 0 erreur console ; audit RAS ; `config:render` 8/8 ; config 109 Ko |
| `config:render` | ✅ 8/8 pages, 29/30 sections avec contenu SSR (`aac-directory` de l'accueil : client, comme avant) |
| `test:preflight` | 🟡 779 ✅ · 2 ❌ **hors lot** : `franckiOrga` (antérieur) et snapshot `header-transparent-scroll` — l'exemple a été modifié dans l'arbre de travail en dehors de ce lot |
| Rendu navigateur | ✅ sombre et clair 1440 px, mobile 375 px sans débordement, 0 erreur console ; icônes peintes ; ancre `#decider` à 88 px sous le header |

### 06/10 — accueil « Nuit » (lot 5, config + moteur)

- **Config** : thème sombre par défaut et palette `dark` de la maquette ; header au logo complet, nav
  réordonnée ; footer à 4 colonnes de la maquette (Outils, Association, Références, Développeurs) ;
  accueil réécrit (7 sections `html`, 1 `stats`, 1 `aac-directory` à 3 projets sans titre ni lien
  « voir tout » — les boutons de l'en-tête de bande y mènent) ; `customCSS` : feuille `oa-*`, encre
  `text-primary` en sombre, teintes océan sombres alignées sur la palette ; règles du héro du lot 4
  retirées. Deux images ajoutées (symbole 380 px).
- **Moteur** : section `stats` — `design: "tiles"`, `items[].source` (compte vivant), `items[].highlight`,
  `value` devenu optionnel (refine `value` ou `source`) ; `StatDynamicSource` + `aacCommuns`. Le
  chiffre passe par un composant partagé `StatValue` (`stats` **et** `cta-card-grid`), aiguillé par
  type de source : compte → chiffre écrit → squelette (attente, et toujours en SSR) / tiret (absence,
  tranchée **après hydratation**). Garde AAC partagée avec le médaillon (`useAacCommunsCountState`).
- **Correctifs issus de la revue** (06/10 — 4 majeurs, 6 mineurs, tous traités) :
  1. tuiles de recherche à « 0 » en SSR et pour toujours après un échec — `useSearchAllResults.total`
     valait le 0 d'attente de `totalCount` : il vaut désormais `null` tant que le `count` n'est pas
     arrivé (corrige aussi `cta-card-grid` de SSBE et maison-sport-santé, préexistant) ;
  2. erreur d'hydratation quand le serveur n'a pas résolu l'entité (tiret côté serveur, squelette
     côté client) — le tiret attend l'hydratation ;
  3. `aacCommuns` en `cta-card-grid` : squelette perpétuel — même `StatValue` partout ;
  4. `membersCount` : « 0 » inventé sur échec — `hasCount` exposé par `useInfiniteEntityQuery` ;
  5-10. garde AAC dédoublonnée, hooks montés par source seulement, tiret/squelette nommés pour les
     lecteurs d'écran (clés fr/en), HTML valide, tests une couche plus bas (SSR compris), docs
     (`doc/05`, `doc/34`, registre), diff parasite retiré.
- **Contre-revue** (06/10 — 0 majeur, 4 mineurs) : entité nulle ⇒ tiret (le client résout la sienne
  avant son 1er rendu), un refetch en échec ne masque plus un nombre de membres connu, tuile AAC en
  chunk `lazy` (build prod : 0 chunk AAC préchargé sur SSBE, contre 3), doc `cta-card-grid` alignée.
  Reste : le fichier `useStatDynamicValue.ts` ne contient plus de `useStatDynamicValue` (renommage
  `git mv` à décider) ; `aac-highlight` tranche encore son médaillon dès le SSR sur un serveur sans
  entité (préexistant, hors périmètre).
- **Gates** (06/10, backend PROD) :

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 7 pages, 20 sections |
| `audit:config` | ✅ RAS |
| `config:render` | ✅ 7/7 pages, 19/20 sections avec contenu SSR — `aac-directory` de l'accueil rendu côté client (comme au lot 4) |
| `config:probe` | ✅ 4/4 périmètres — tuiles membres 91 · organisations 18 (= onglets de `/communaute`) |
| `vitest` unitaires | ✅ 5232 (nouveaux : `StatValue.test.tsx`, `useAacCommunsCountState.test.ts`, `useStatDynamicValue.test.ts` réécrit, `StatsSection.test.tsx`) · 1 ❌ **antérieur** (`franckiOrga`) |
| `typecheck` | 🟡 3 erreurs **antérieures** (`cagnotte/hooks/useSaveCagnotteContribution.ts`) |
| `eslint` (fichiers touchés) | ✅ |
| `test:preflight` | 🟡 780 ✅ · 1 ❌ **antérieur** (`public/images/franckiOrga`) |
| Rendu navigateur | ✅ sombre et clair 1440 px, mobile 375 px sans débordement ; tuiles 144 · 91 · 18 ; aucune erreur console ; `#outils` défile |
| SSR des tuiles | ✅ 3 squelettes, aucun « 0 » ni tiret — y compris serveur à backend injoignable (navigateur sain : 144 · 91 · 18, aucune erreur d'hydratation) |
| Build prod (copie temporaire, sans `tsc` bloqué par les 3 erreurs antérieures) | ✅ Open Atlas `144 · 91 · 18`, 0 erreur ; SSBE : 4 squelettes en SSR (au lieu de 4 × « 0 »), 0 chunk AAC préchargé |
| Revue `revue-fonctionnalite` (partie moteur) | 4 majeurs + 6 mineurs → corrigés ; contre-revue 0 majeur, 4 mineurs → 3 corrigés, 1 en attente de décision (nommage) |

---

## 11. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Accueil | ✅ | maquette « B — Nuit » (lot 5), chiffres vivants ; « Ils nous font confiance » en attente de logos |
| 1b | Accompagnement | ✅ | page dédiée |
| 1c | Contact | 🟡 | formulaire posé ; **aucun destinataire** tant que `costum.contactMail` est vide (§13) |
| 2 | Communauté — membres | ✅ | 92 (DEV) / 91 (PROD) |
| 3 | Communauté — organisations | ✅ | 18 |
| 4 | Pages légales | 🟡 | structure posée, mentions `[à compléter]` |
| 5 | Thème clair/sombre + logo | ✅ | sombre par défaut depuis le lot 5 |
| 6 | Projets — branchement | ✅ | formulaire OCECO, annuaire, fiche |
| 7 | Projets — publication | ✅ | 144 projets titrés publics (pas de sélection sur un AAP) |
| 8 | Projets — dépôt | ❌ | formulaire fermé |
| 9 | Pages d'outils | 🟡 | page `/outils` (lot 6) avec ses volets « En savoir plus » ; anglais à relire, date de création à trancher (§14) |
| 10 | Déploiement | ❌ | entrée Coolify et domaine à décider |
| 11 | Commit | 🟡 | lots 1-6 commités sur `openatlas` (lot 5 le 07/10, feuille propre `7ac0fc6c` et lot 6 le 12/10, **non poussés**) ; merge et déploiement à faire |

---

## 12. Dépendances SDK ↔ cocolight-api-client

| Sujet | État |
|---|---|
| `GET_COFORM_BY_ID` ne renvoie jamais `aapType` (même sur le form de la Fédération) | constaté le 30/09 ; sans effet bloquant |
| `getformbyid` sur un `aapConfig` → **500 en DEV**, OK en PROD | correctif legacy (doc/34 §3) **non déployé en DEV** ; l'annuaire rend quand même (`useAacConfig` best-effort), erreur visible en console |
| Poids SSR de `/communaute` | voir §13 |

---

## 13. Points d'attention / limitations

- **Tout projet titré du formulaire est public** (144 en PROD au 01/10), fiches détail comprises.
  ⚠️ **Contenu sensible** : budgets et versements nominatifs de projets clients (ex. un palier de
  3 000 € financé par un client), doublons, fiches sans description ni image. Décision de
  publication prise par Francki le 01/10 (« un AAP n'a pas de `choose` »). L'API `directoryproposal`
  servait déjà toutes ces réponses à un appel anonyme sans filtre : le site rend visible une
  exposition qui existait au niveau du backend.
- **`onlymemberaccess` ignoré** : il est rangé dans `params` sur ce formulaire, le module le lit à la
  racine (`resolveAacConfig`). Sans effet visible ici (lecture publique voulue), mais un formulaire
  réservé aux membres serait traité comme public. À vérifier côté legacy (`Form.php:1869`).
- **Bug moteur `aac-highlight` + feuille Rézo** : en ton `primary`, la section pose
  `text-primary-foreground` sur son conteneur, mais `index-rezo-la-mer.css` force `text-foreground`
  sur `h1`–`h6` et `p` ⇒ texte sombre sur fond de marque. Touche aussi la Fédération des CAE (même
  feuille, même ton). Contourné ici par le ton `muted`.
- La doc du module (doc/34 §6) dit le financement gardé par `coremu` ; le code le montre dès qu'une
  étape de financement existe (`hasFundingStep`). Le code fait foi — doc à resynchroniser.
- **`/communaute` pèse 3,3 Mo de HTML**, dont 3,2 Mo d'état React Query : chaque carte embarque
  `parent`, une copie sérialisée de l'entité Open Atlas (~43 Ko), soit ~1,8 Mo répétés sur 42 cartes.
  Problème **moteur/SDK**, pas de config.
- `costum.slug` vaut `"OpenAtlas"` alors que la clé de source est `"openAtlas"` : ne jamais écrire
  `sourceKey: ["OpenAtlas"]` (0 résultat).
- **Vitrine des projets de l'accueil** (lot 5) : l'aperçu montre les 3 premiers projets du
  formulaire tels quels — au 06/10 « MSS Tampon » (deux fois) et « SPORTS PEI », sans description ni
  image. C'est la donnée, pas le rendu : à nettoyer côté réponses, ou à trier autrement.
- **Liens internes des sections `html`** (`/projets`, `/contact`…) : `<a>` natifs, donc rechargement
  complet de la page (SSR) au lieu d'une navigation SPA. Fonctionnel, plus lent.
- **Tuiles comptées côté client** : le HTML serveur porte un squelette à leur place (pas de
  préchargement SSR des comptes).
- **Poids de la config dans chaque page** : la config entière est sérialisée dans le HTML de chaque
  page ; les sections `html` bilingues s'y paient partout (109 Ko de config au 09/10 après sortie des
  styles, dont ~44 Ko pour `/outils` avec ses volets). Problème moteur — une config par page ou un
  chargement paresseux des sections `html` le réglerait.
- **`/communaute` : erreur SSR `COSTUM_RESOLVED - Request validation failed`** à chaque rendu serveur
  (6/6 le 09/10), visible aussi en console navigateur ; la page rend quand même. Reproduite sur le
  commit `b4f7f9f8` (4/4) : **antérieure** à la feuille propre et à `/outils`, à instruire.

---

## 14. Évolutions à prévoir & questions en attente

| Question | Responsable |
|---|---|
| Faut-il **écarter** certains projets du site public (projets clients, budgets nominatifs, doublons) ? Aujourd'hui, pas de filtre de publication sur un AAP : nettoyer les réponses, ou définir une règle (tag, statut) à porter en config | Francki / admins Open Atlas |
| Rouvrir le formulaire pour permettre le dépôt depuis le site ? (aujourd'hui `closed`) | Francki |
| Liste des outils à décrire et mode de production du contenu des pages d'outils | Francki |
| Mentions légales : forme juridique, immatriculation, siège, directeur de publication, hébergeur, contact. Candidats **à confirmer** lus sur la fiche de l'entité : 56 rue Andy, 97460 Saint-Paul ; `contact@communecter.org` | Open Atlas |
| **Renseigner `costum.contactMail`** du costum `openAtlas` en base (sondé le 02/10 en PROD : ni `contactMail` ni `admin.email`) — sans lui, le formulaire `/contact` n'atteint personne | admin Open Atlas |
| Confirmer les affirmations de la maquette : « Association loi 1901 » (badge du héro, footer) alors que la base porte « Constitution du capital social de la SCIC Open Atlas » et `scicOpenAtlas` ; « 14 ans », « 10 ans autour des tiers-lieux » ; OPTEOS et CoRD comme prestataires | Francki |
| Logos (et accord) des structures « Ils nous font confiance » : ANCT, France Tiers-Lieux, Réseau Français des FabLabs, CEDTM, Ville de Saint-Denis, CRESS Réunion, Technopole de la Réunion, ministère de la Transition écologique | Francki |
| « Depuis 2008 » (`/outils`) contre « depuis maintenant 14 ans », soit 2012 (accueil) : quelle date retenir ? | Francki |
| Domaine et entrée Coolify | Francki |
| Liens d'ancre de page (`#id`) qui ne font pas défiler ; tokens `@theme` de `shared.css` (`--text-shadow-glow`, sans doute `--shadow-glow`) figés au build, donc non surchargeables par thème ; bug `aac-highlight` ton `primary` sur feuille Rézo ; `onlymemberaccess` lu à la racine ; poids SSR des listes ; `<title>` SSR d'une fiche = nom du FORMULAIRE (corrigé à l'hydratation) ; compteur « 0 RÉSULTAT » pendant le chargement de l'annuaire (relevés par la revue du 01/10, antérieurs) | moteur |
