[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Open Atlas — site de la communauté et des projets

> **Document de travail du projet de configuration.** Il porte le contexte, le modèle de données
> réel, les choix et l'avancement du site **`openAtlas`**. **À tenir à jour à chaque lot livré**,
> selon le formalisme du skill [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module AAC](../doc/34-module-aac.md) · [Module Search](../doc/07-module-search.md) ·
> [Module Profil](../doc/08-module-profil.md) · dossier voisin [Fédération des CAE](federation-des-cae.md)
> (même gabarit, AAC en service). Mémoire : `[[project-open-atlas]]`.

Dernière mise à jour : **2026-10-02** (lot 4 : accueil refait d'après la maquette d'un proche d'Open
Atlas, pages `/accompagnement` et `/contact` ; le formulaire de contact n'a **pas de destinataire** tant
que `costum.contactMail` n'est pas renseigné, cf. §13).

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
| Feuille CSS | `index-rezo-la-mer` (**partagée** : couleurs dans `config.theme`, teintes océan recolorées par `customCSS`) |
| Images | `public/images/openAtlas/` — 6 fichiers dérivés du logo fourni (§8) |
| Entité Cocolight | `organizations` / `555eba56c655675cdd65bf19` — « Open Atlas » (`type: LocalBusiness`), **identique en DEV et en PROD** |
| Costum backend | embarqué sur l'entité : `costum.slug: "OpenAtlas"` (O majuscule), hôte `www.open-atlas.org`, **aucun SSO**. `COSTUM_RESOLVED("openAtlas")` → `sourceKey: ["openAtlas"]`, `typeObj` : projects, events, proposals, crowdfunding, donation, organization |
| Formulaire des projets | `618b7b4abc572b35b4505da3` — « OCECO : GOUVERNANCE & PROJET » (`type: aap`, **sans `aapType`**), config OCECO partagé `618b7afe0ee16538e8282a21` ; fourni par Francki le 01/10 (§6) |
| Backends | DEV `http://communecter74-dev` · PROD `https://www.communecter.org` |
| Langues | `fr` (défaut) + `en` |
| Header / Footer | `transparent-scroll` / `sidebar-columns` (gabarit Rézo la mer) |
| SDK | `@communecter/cocolight-api-client` **1.0.191** |
| Branche | `openatlas` (créée depuis `fdev` le 01/10) — deux commits : module AAC (`choose` optionnel), puis le site |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| 30/09 | Francki + Claude | Sondage backend (entité, costum, formulaires, périmètres), création de la config, lot 1 (accueil, communauté, pages légales), création de ce dossier |
| 01/10 | Francki + Claude | Lot 2 : bloc `aac` sur le formulaire OCECO, page `/projets`, bande et aperçu sur l'accueil ; sondage de la visibilité publique (§6, §13) |
| 01/10 | Francki + Claude | Lot 3 (moteur) : `choose` n'est plus deviné par le module AAC — un AAP n'en a pas ; retiré de cette config. Revue `revue-fonctionnalite` : 1 majeur (étape d'évaluation rouverte à l'auteur) et 7 mineurs, tous corrigés (§10) |
| 02/10 | Francki + Claude | Lot 4 : accueil recomposé d'après une maquette HTML reçue d'un ami de Francki (structure et textes repris, palette rouge du logo conservée, police Sora) ; pages `/accompagnement` et `/contact` ; nav et footer refaits (§10) |

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
| `/` | 9 | `hero-parallax` « Le réseau qui appartient à ceux qui le font vivre » (3 badges, boutons vers communecter.org et `/contact`) · `cta-card-grid` « Un logiciel, une instance centrale » (Communecter → dépôt Git, Communecter.org) · `content` « Ce que permet Communecter » (6 tags) · `categories-grid` « Ce qui guide notre travail » (4 principes, 4 colonnes) · `aac-highlight` + `aac-directory` `preview` (projets) · `content` « Un accompagnement sur mesure » (→ `/accompagnement`, `/contact`) · `action-tiles` « Communecter.org au cœur, des réseaux tout autour » (4 sites de référence, externes) · `cta` « Envie de contribuer, d'adhérer… » (→ `/contact`, `/communaute`) |
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

Header : nav Projets · Communauté · Accompagnement · Communecter.org (lien externe), bouton
« Nous écrire » → `/contact` ; utilitaires `themeSwitch`, `langSwitch`, `auth`, `notifications`.
`piggyBank`/`pledge` **coupés**.

Footer (`sidebar-columns`) :

| Colonne | Liens |
|---|---|
| Le site | Projets · Communauté · Accompagnement · Nous contacter (`/contact`) · À propos d'Open Atlas (`/profil/openAtlas`) |
| Outils | Communecter (logiciel) → dépôt Git · Communecter.org (instance) |
| Références | tiers-lieux.org · lescommuns.tiers-lieux.org · parent62.00.re · equipements-sportifs-974.00.re |
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
| Assets | `../public/images/openAtlas/` : `logo.png`, `logo-dark.png`, `logo-symbol.png`, `logo-symbol-dark.png`, `logo-symbol-neutral.png`, `favicon.png` |
| CSS | [`../src/index-rezo-la-mer.css`](../src/index-rezo-la-mer.css) (partagée, **non modifiée**) |
| Tests | `../tests/preflight/__effective__/open-atlas.json` (instantané du préflight — ne projette pas le bloc `aac`) |

---

## 8. Choix techniques et justifications

| Choix | Pourquoi |
|---|---|
| Config écrite à la main, pas `config:init` | `config:init` ne part que d'un archétype du manifest ; ni Rézo la mer ni la Fédération des CAE n'en sont. Chrome repris de Rézo la mer, bouts AAC/annuaire de la Fédération |
| Header `transparent-scroll` + footer `sidebar-columns` | Le « template rezo » demandé ; le header prend un logo-pastille carré, d'où le **symbole** + le titre texte |
| 6 variantes du logo | Le logo fourni a le mot « Open Atlas » **en blanc** : invisible sur fond clair. `logo-symbol.png` (encre bleu nuit) en clair, `logo-symbol-dark.png` (blanc d'origine) via `header.logoDark`. Le footer n'a **pas** de `logoDark` : `logo-symbol-neutral.png` (encre gris-bleu) reste lisible sur les deux fonds |
| `primary` = `oklch(0.57 0.21 18)` | Rouge du logo (`#E2334E` ≈ `oklch(0.60 0.209 18)`) assombri pour tenir **4,99:1** avec le blanc ; en sombre `oklch(0.66 0.20 18)` avec encre bleu nuit (5,66:1). Toutes les paires porteuses ≥ 4,5:1 |
| Encre `oklch(0.22 0.017 264)` | Bleu nuit du logo, neutre froid de toute la palette |
| Police Sora (lot 4) | Celle de la maquette d'accueil ; remplace Urbanist |
| `customCSS` : `--ocean-*`, `--turquoise`, `--shadow-glow`, `--gradient-section` recolorés | La feuille `index-rezo-la-mer` est partagée et impose du turquoise (halo, bandeaux des `searchHeader`) ; `:root:root` / `:root:root.dark` battent ses `:root` / `.dark` |
| Halo des titres de héro coupé en clair par `:root:not(.dark) .text-shadow-glow` (lot 4) | ⚠️ La surcharge de `--text-shadow-glow` posée au lot 1 n'a **jamais agi** : la variable est déclarée en `@theme`, Tailwind fige sa valeur dans la classe au build (mesuré le 02/10 : variable à `none`, halo toujours rendu). Seule une règle sur la classe l'éteint. Gardé en sombre |
| Principes en `categories-grid` (4 colonnes) | `features-glass` plafonne à 3 colonnes (4 principes ⇒ 3 + 1) et `cards` coupe les textes à 2 lignes |
| Bouton « Découvrir Communecter » → communecter.org | Un lien d'ancre (`#outils`) ne fait pas défiler la page (mesuré : l'URL passe à `/#outils`, la section reste à 980 px) |
| Liens externes en `cta-card-grid` / `action-tiles` | Ces sections passent par `<Link>` : les URL `https://` partent en navigation classique, **dans le même onglet** |
| Communauté par `links.memberOf` + `notSourceKey` | Le périmètre `sourceKey` compte 0 organisation (§6) |
| Deux onglets plutôt qu'une liste | Recette `page-communaute-onglets` : une carte de personne et une carte d'organisation n'ont pas le même contrat |
| Page `/projets` plutôt que `/aac/communs` | Le vocabulaire du site est « projets » ; la route de module `/aac` reste montée |
| `showDepositButton: false` | Le formulaire est **fermé** : le bouton s'afficherait (le module ne garde que `form.active`) et le dépôt échouerait au save |
| Filtres `usage` et `maturity` coupés | Pas de catalogue d'usages ni de champ de maturité sur ce formulaire |
| `aac-highlight` en ton `muted` | En ton `primary`, la feuille Rézo force `text-foreground` sur `h2`/`p` : titre et texte sombres sur le rouge, contraste insuffisant (§13) |
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

---

## 11. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Accueil | ✅ | 9 sections d'après la maquette ; « Ils nous font confiance » en attente de logos |
| 1b | Accompagnement | ✅ | page dédiée |
| 1c | Contact | 🟡 | formulaire posé ; **aucun destinataire** tant que `costum.contactMail` est vide (§13) |
| 2 | Communauté — membres | ✅ | 92 (DEV) / 91 (PROD) |
| 3 | Communauté — organisations | ✅ | 18 |
| 4 | Pages légales | 🟡 | structure posée, mentions `[à compléter]` |
| 5 | Thème clair/sombre + logo | ✅ | |
| 6 | Projets — branchement | ✅ | formulaire OCECO, annuaire, fiche |
| 7 | Projets — publication | ✅ | 144 projets titrés publics (pas de sélection sur un AAP) |
| 8 | Projets — dépôt | ❌ | formulaire fermé |
| 9 | Pages d'outils | ❌ | lot ultérieur, contenu à produire |
| 10 | Déploiement | ❌ | entrée Coolify et domaine à décider |
| 11 | Commit | ✅ | branche `openatlas` — merge et déploiement à faire |

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
| Page outil « Communecter » (la maquette pointe vers `communecter-fonctionnalites.html`) : les tags « Ce que permet Communecter » et la carte Communecter y mèneront | Francki |
| Anneaux jaunes sous la dernière carte des principes, vus dans Chromium headless : ils viennent du blob décoratif flouté de `categories-grid` (masqué ⇒ 0 pixel jaune) ; le jaune n'est pas dans la palette — artefact probable du rendu logiciel, **à confirmer dans un vrai navigateur** | Francki |
| Domaine et entrée Coolify | Francki |
| Liens d'ancre de page (`#id`) qui ne font pas défiler ; tokens `@theme` de `shared.css` (`--text-shadow-glow`, sans doute `--shadow-glow`) figés au build, donc non surchargeables par thème ; bug `aac-highlight` ton `primary` sur feuille Rézo ; `onlymemberaccess` lu à la racine ; poids SSR des listes ; `<title>` SSR d'une fiche = nom du FORMULAIRE (corrigé à l'hydratation) ; compteur « 0 RÉSULTAT » pendant le chargement de l'annuaire (relevés par la revue du 01/10, antérieurs) | moteur |
