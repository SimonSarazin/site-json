[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet projets.re — l'Appel à Communs à l'interface « editorial » (La Réunion)

> **Document de travail du projet de configuration.** Il porte le contexte, les décisions,
> l'architecture, l'avancement, les impacts et les dépendances du site **`projetsre`**. À tenir
> à jour à chaque lot livré, selon le formalisme du skill
> [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module AAC](../doc/34-module-aac.md) (§3.4 pour les variantes d'interface) ·
> [RFC Variantes d'interface AAC](../doc/36-rfc-variantes-interface-aac.md) ·
> [Fédération des CAE](federation-des-cae.md) (le seul autre site AAC, modèle de config).
> Mémoire : `[[project-projetsre]]`. Plan approuvé : `plan-d-tail-pour-integrer-iterative-lemon.md`.

Dernière mise à jour : **2026-10-15** — suites de la revue de la MR `aac-dev` :
- merge de main : `choose` n'est plus deviné, mais il est déjà déclaré ici ;
- interrupteur **`aac.detail.demoBlocks`** : allumé sur projets.re, **à couper avant la mise en ligne** ;
- formulaire **mesuré en DEV et en PROD** : 1 réponse, 0 visible pour un anonyme ;
- chemin `adresse` corrigé : il désignait une question de l'ancien formulaire.

Reste le déploiement.

---

## 1. Contexte du projet

**projets.re** doit présenter, soutenir et financer les projets et communs d'un territoire (La
Réunion). Il utilise **tout le module AAC** — annuaire, fiche, dépôt, sélection, financement,
paliers, contributeurs — mais avec l'interface d'une **maquette Lovable**
(`~/Téléchargements/lovable-project-23e1b63d`, route `projets.index` et `projets.$slug`), sur
**deux écrans seulement** : l'annuaire et la fiche d'un commun. Le reste du chrome (header,
footer, pages de contenu) reste piloté par la config SiteForge.

| | |
|---|---|
| Slug | **`projetsre1`** — organisation « ProjetsRe », id `6abb847deb4ce02b4c3e6b4e` (remplace l'entité `projetsre` du 21/09 depuis le 29/09) ; résolue en DEV et en PROD (15/10) |
| Config | [`config.prod.projetsre.json`](../config.prod.projetsre.json) — 4 pages, 7 sections (fichier, CSS et images gardent le nom `projetsre`) |
| Formulaire AAC | **`6abb8521ac535a1b7e617a0f`** — « ProjetsRe », `type: aap` sans `aapType`, 4 étapes (`aapStep1` à `aapStep4`), présent en DEV et en PROD (15/10) ; remplace `6ab104ffa43c9446fb595a86` |
| Interface | clé **`editorial`** (fiche, cartes, coquille d'annuaire) ; contenu de démonstration par `aac.detail.demoBlocks` |
| Feuille CSS | `src/index-projetsre.css` (créée) |
| Branche | `aac-dev` |
| SDK | `@communecter/cocolight-api-client` `^1.0.201` (depuis le merge de main du 15/10) |

**Historique des chantiers**

| Date | Intervenant | Chantier |
|---|---|---|
| 17/09 | Anatole + Claude | Étude de faisabilité puis plan (8 lots) ; décisions § 8 |
| 17/09 | Claude | Lots 1–2 commités : `f97fc117` (registre de variantes hors du module blog), `cd7aea60` (fiche → contrôleur + vue) |
| 17–21/09 | Claude | Lots 3–5 et 7 — **non commités** (consigne : ne pas commiter) |
| 21/09 | Anatole | Entité `projetsre` et formulaire AAC créés sur communecter-dev |
| 21/09 | Claude | Lot 6 : config du site, `sites.json`, logo, fixture, `.env` — non commités |
| 23/09 | Anatole | Question « Adresse » (`tpls.forms.cplx.address`) ajoutée au formulaire ; clé `directory.fields.adresse` posée dans la config |
| 23/09 | Claude | Lot 8 : rôle `adresse`, affichage de la commune (interface `editorial`) et filtre « Commune » — non commité |
| 23/09 | Claude | Héros de la fiche `editorial` au plus près de la maquette (financement, Exporter / Soutenir) — non commité |
| 28/09 | Claude | Réactions sorties de la carte de financement (`CommunReactionStats`), dans la colonne d'Exporter / Soutenir — non commité |
| 29/09 | Claude | Revue avant commit des lots 3 à 9 : bloquants corrigés, paquet `funding.reactions`, commentaires condensés — non commité |
| 29/09 | — | Entité et formulaire remplacés : org `projetsre1` (`6abb847d…`), formulaire `6abb8521…` ; slug du site → `projetsre1` |
| 15/10 | Claude | Suites de la revue de la MR `aac-dev` : merge de main (résolution indexée, non commitée), interrupteur `demoBlocks`, mesure DEV/PROD, chemin `adresse`, correctifs (repli Suspense, requête désactivée ≠ erreur), nettoyages — non commités |

## 2. Objectifs de la configuration

1. Un site AAC complet dont l'annuaire et la fiche ont l'allure de la maquette projets.re.
2. **Aucune fonctionnalité AAC perdue** : ce que la maquette n'a pas (grille/liste, tri, dépôt,
   suppression, sélection, projet lié, édition, galerie, défilement infini) est conservé et restylé.
3. Ce que la maquette montre et que l'AAC n'a pas est affiché **en démonstration**, clairement marqué —
   seulement tant que `aac.detail.demoBlocks` est allumé.
4. Pages **comme federationDesCae** : `/` (bandeau contribuer, aperçu de l'annuaire, bandeau déposer),
   `/aac/communs`, `/mentions-legales`, `/confidentialite`.
5. Zéro changement de rendu pour les sites qui ne choisissent pas l'interface.

## 3. Architecture générale

```
config.aac.detail.pageVariant ─┐          useCommunDetailController ─→ view-model ─→ AAC_DETAIL_VARIANTS[clé]
config.aac.directory.default*  ├─ useAacDirectoryContext().variants                     default | editorial
aac-directory.props.*Variant ──┘          useAacDirectoryController ─→ view-model ─→ AAC_DIRECTORY_SHELL/CARD/ROW/SKELETON_VARIANTS
```

Les contrôleurs portent TOUTE la logique ; une interface n'est qu'une vue (cf. doc/34 §3.4). Les
interfaces code-splittées sont déclarées dans `src/modules/aac/variants/lazyVariants.ts`, chargé
par le chunk d'entrée (piège mesuré, § 10 21/09).

## 4. Architecture — correspondance maquette → AAC

| Maquette | AAC |
|---|---|
| Barre de filtres : recherche · commune · thème · besoin · stade | recherche · **thème = tags** · **besoin = usages** · **stade = maturité** · **commune = `directory.fields.adresse`** (lot 8) |
| Carte projet (`project-card`) | `CommunCardEditorial` (+ `CommunRowEditorial` pour la vue liste, absente de la maquette) |
| Fiche : 7 onglets | fiche · action · argent · communauté · vie réels (blocs AAC ; vie = actus et agenda du projet lié, lot 9) ; maturation · coopérations en démo |
| Carte « Financement réuni » + « Soutenir ce projet » | la **vraie** `CommunFinancingCard` en `layout="hero"` : grille de la maquette au rapport 7/12 – 5/12 de la fiche federation-des-cae, résumé « N cofinanceurs · X restant à financer » ; les réactions (absentes de la maquette) sont un composant à part, `CommunReactionStats` : à partir de `lg`, à droite du titre, dans la colonne d'Exporter / Soutenir (même bord, même largeur) ; sous la description en dessous |
| `DossierExport` | bouton désactivé, au-dessus de « Soutenir » (emplacement `secondaryAction` de la carte) |
| Onglet « Argent et transparence » : `Expense` · `Funder` | deux colonnes, **dépenses à gauche, cofinanceurs à droite** (inverse de la maquette, voulu) : `CommunFinancingSection` et `CommunCofinancersTable` en `layout="list"` ; le clic sur une dépense déplie ses financements reçus (financeur, date, montant, Payé / Partiel / Promesse) |

## 5. Cahier des charges (intégré)

— Pas de cahier des charges formel : le besoin est la maquette et la demande « intégrer
seulement les 2 pages et laisser les fonctionnalités qui n'existent pas encore sur AAC en
statique » (17/09). Budget/phasage : à confirmer.

## 6. Modèle de données réel

### Formulaire `6abb8521ac535a1b7e617a0f` (« ProjetsRe »)

Il est lu le 15/10 comme le lit l'application (`entity.form` puis `buildAacFormMeta`), en DEV et en
PROD, avec le même résultat. Il compte 4 étapes : `aapStep1` porte 26 questions, `aapStep2` à
`aapStep4` en portent 2 chacune.

Toutes les questions déclarées par la config existent sur ce formulaire, **sauf l'ancien chemin
`adresse`** :
- `aapStep1mud6k0tblptwdgxwd5a` était la question du formulaire du 21/09 ;
- la question adresse du formulaire actuel est **`aapStep1mumh6n3r1f11d73gwbn`**
  (`tpls.forms.cplx.address`, sans libellé) ;
- la config pointe sur elle depuis le 15/10.

Comme le formulaire du 21/09, celui-ci n'a pas les questions de prose « modèle économique »,
« gouvernance », « cadre juridique », « partenariats » et « modalités de contribution » que déclare la
config de la Fédération.

| Mesure (`directoryproposal`, anonyme, 15/10) | DEV | PROD |
|---|---|---|
| Réponses | 1 | 1 |
| … avec un titre (ce que l'annuaire garde) | 1 | 1 |
| … sélectionnées par ProjetsRe (ce que voit un anonyme) | **0** | **0** |
| Contrôle (`zzzBogus`) | 0 | 0 |

**Conséquence :** l'annuaire public reste vide tant qu'aucun commun n'est sélectionné. Le contexte de
sélection est l'organisation `6abb847d…`, la 1ʳᵉ entrée de `form.parent`.

`config:probe` (15/10, DEV et PROD) :
- aucun `baseParams` sondable, puisque le site n'a que l'AAC ;
- contrôle AAC sans constat : `choose` déclaré (`answers.aapStep2.choose`) = question du formulaire
  (« Séléctionné pour l'afficher dans le 'directory' », libellé tel quel).

| Écran | Question (étape `aapStep1` sauf mention) | Clé de config |
|---|---|---|
| Titre | `titre` — « Nom du commun » | `directory.fields.title` |
| Accroche | `aapStep1lzi62x3etw49gyc424d` — « Description courte » | `directory.fields.description` |
| Descriptif long (onglet « La fiche ») | `description` — « Description longue » | lu sur l'étape de dépense |
| Filtre **Thème** | `aapStep1m03ot9qymmfgashp7l` — « Besoins auquel répond le commun » (`checkboxNew`, 10 catégories : outils de gestion, formation, gouvernance…) | `directory.fields.tags` — même choix que la Fédération ; la question libre « Tags » (50+ valeurs éparses) écartée |
| Filtre **Stade** | `aapStep1m2ucu54mopm33osqxpd` — « Le commun est-il suffisamment mature… » (`radioNew`, 4 options) | `directory.fields.maturity` |
| Filtre **Besoin** | — aucune question d'usages catégorisés | **masqué** (règle : filtre résolu sans option) |
| Filtre **Commune** | `aapStep1mumh6n3r1f11d73gwbn` — question adresse (`tpls.forms.cplx.address`, **sans libellé** sur le formulaire) | `directory.fields.adresse` — la commune s'affiche aussi sur la carte, la ligne et la fiche |
| Prose | `aapStep1lusoklfzokkn4svl1ei` « Cas d'usages » · `aapStep1m0w49vpl5jm001xwvsv` « Décrivez l'équipe ou la communauté » | `detail.sections` (`usages`, `equipe`) |
| Galerie | documents `aapStep1.image` | `detail.gallery` |
| Sélection | `aapStep2.choose` | `directory.fields.choose` |
| Financement | `depense`, `aapStep3.financer`, `aapStep3.generateproject` | rôles résolus |

Questions **non affichées** volontairement : IBAN, SIRET, **adresse de la structure hôte**
(`aapStep1m0dibyxe3bj095mwc2s`, une question texte — à ne pas confondre avec la question
`Adresse` géolocalisée ci-dessus) et représentant légal (données sensibles), liens forum/chat,
mail public, référent. `users` non déclaré :
le compteur de membres retombe sur `user_count` du backend (la Fédération compte `links.cae`).

## 7. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Socle variantes | `src/lib/variants.ts` (+ test) · `src/modules/blog/variants/registry.ts` (alias) |
| Fiche | `pages/AacCommunDetailPage.tsx` (coquille) · `hooks/useCommunDetailController.ts` · `hooks/useCommunToc.ts` · `components/pageDetail/variants/{registry.ts, CommunDetailDefault.tsx}` · `lib/communDetailContent.tsx` · `components/pageDetail/CommunSection.tsx` |
| Annuaire | `sections/AacDirectorySection.tsx` · `hooks/useAacDirectoryController.ts` · `components/directory/variants/{items.ts, shells.ts, AacDirectoryShellDefault.tsx}` · `components/directory/AacDirectoryResults.tsx` · `lib/{directoryFilterActions.ts, communPath.ts}` |
| Interface editorial | `src/modules/aac/variants/lazyVariants.ts` · `variants/editorial/*` (fiche, carte, ligne, squelette, coquille, `FilterPopover`, `EditorialSection`) · `variants/editorial/demo/{demoContent.ts, DemoBlocks.tsx, DemoNotice.tsx}` |
| Config / i18n | `src/modules/aac/schema.ts` (`pageVariant`, `default*Variant`, `cardVariant`, `shellVariant`) · `i18n/{fr,en}.json` (branche `editorial.*`) · `src/index-projetsre.css` |
| Tests | `detail.conformance.test.tsx` · `directory.conformance.test.tsx` · `useCommunDetailController.test.tsx` · `communDetailContent.test.tsx` · `directoryFilterActions.test.ts` · préflights `aac-variants.test.ts`, `lazy-entry-facades.test.ts` |
| Site (lot 6) | `config.prod.projetsre.json` · `sites.json` · `public/images/projetsre/` · `tests/preflight/__effective__/projetsre.json` |
| Actus et agenda (lot 9) | `components/pageDetail/{CommunNewsSection,CommunAgendaSection}.tsx` (+ tests) · `hooks/useCommunProjectEvents.ts` (+ test) · `hooks/useCommunProjectEntity.ts` (`useCommunProjectEntityQuery`) · `lib/communEvents.ts` (+ test) · `constants/queryKeys.ts` (`COMMUN_EVENTS`) · `hooks/useCommunDetailController.ts` · `variants/editorial/CommunDetailEditorial.tsx` · `variants/editorial/demo/*` (démo actus/agenda retirée) · `src/modules/news/components/NewsFeed.tsx` (+ test, extrait de `sections/NewsSection.tsx`) |
| Onglet argent en listes (29/09) | `components/pageDetail/{CommunFinancingSection,CommunCofinancersTable}.tsx` (+ tests) · `components/pageDetail/CommunSkeletons.tsx` (`ListRowsSkeleton`) · `variants/editorial/CommunDetailEditorial.tsx` · `i18n/{fr,en}.json` (`editorial.detail.expenses`, `detail.financing.expensesTotal`) |
| Adresse & filtre Commune (lot 8) | `lib/communAddress.ts` (+ test) · `lib/parseAacAnswer.ts` · `lib/resolveAacCardFields.ts` · `lib/{filtersKey,filterCommuns,aacQueryParams,directoryFilters,directoryFilterActions}.ts` · `hooks/{useAacFacets,useAacDirectoryController}.ts` · `components/directory/AacDirectoryFilters.tsx` · `variants/editorial/{DirectoryShellEditorial,CommunCardEditorial,CommunRowEditorial,CommunDetailEditorial}.tsx` (+ `address.test.tsx`) · `schema.ts` · `i18n/{fr,en}.json` · `pages/AacPage.tsx` |

## 8. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| Contrôleur + vue, pas de fork de composants | Seule garantie structurelle de « mêmes fonctionnalités » ; tenue par les tests de conformité |
| Contenu de démo marqué « Exemple », commandes désactivées | Choix du commanditaire (17/09) ; le bandeau évite qu'on prenne ces données pour celles du commun |
| Démo derrière un interrupteur, `aac.detail.demoBlocks`, faux par défaut (15/10) | Demandé par la revue de la MR : sans interrupteur, le site en ligne servirait des dons, des chiffres et des témoignages inventés sur des projets réels. Allumé sur projets.re tant que c'est une maquette |
| Filtre Commune : rôle `adresse` + filtrage **client** | Un filtre demande un rôle ET un chemin ; le serveur n'a qu'un créneau `$or` (pris par la visibilité) et ne fait que des regex non ancrées — « Saint-Denis » ramènerait « Saint-Denis-de-la-Réunion » |
| Rôle `adresse` **sans scan**, contrairement à `image` | Une question `tpls.forms.cplx.address` se devine pourtant à son `componentType` ; mais le rôle allume un filtre, et le deviner le ferait surgir chez les sites qui n'ont rien demandé |
| Facette groupée par NOM de commune, pas par `localityId` | Clé de cache lisible, comparaison repliée comme les tags, et une adresse en texte libre (sans `localityId`) reste groupable. Limite : deux communes homonymes fusionnent |
| Clé `editorial`, pas `lagoon` | `lagoon`/`basalt` ne servent à aucun des deux écrans ; nommer par design, jamais par site |
| Filtres en popover à choix multiple | Un `Select` à choix unique perdait la sémantique OU/ET |
| Vraie carte de financement à la place de « Soutenir » | L'ancre `#soutenir` de la maquette visait un onglet fermé |
| Liens de la carte par un contexte (`useShowSection`), pas par une prop | Défaut = défilement direct, donc rien à changer côté `default` ; une interface à onglets fournit sa table ancre → onglet, et tout bloc qui mène à une section en profite |
| Mise en page `hero` de `CommunFinancingCard` plutôt qu'un bouton « Soutenir » séparé | Le bouton dépend de l'état de la carte (garde de connexion, rejeu post-login par `fundButtonRef`, hôte de la cagnotte) : le sortir dupliquait cette logique |
| `default` embarqué, `editorial` code-splittée depuis le chunk d'entrée | Zéro changement pour les autres sites ; préchargements SSR préservés (§ 10) |
| Polices par `config.theme` (Manrope, Instrument Serif en `serif`) | Modifiables sans build ; Google Fonts répond 200 aux graisses demandées (vérifié) |

## 9. Étapes de mise en place

1. **Lot 0 (Communecter)** : créer l'organisation `projetsre` (communecter-dev puis prod) ; créer le
   formulaire AAC et son `aapConfig` ; relever les identifiants de questions ; vérifier en prod le
   correctif du **500 de `getformbyid`**.
2. **Lot 6 (dépôt)** : `config.prod.projetsre.json` copié de `config.prod.federationDesCae.json`,
   adapté — `theme` (palette oklch de la maquette, `defaultMode: light`), `aac` (`formId`,
   `directory.fields`, `detail.sections` en icônes kebab-case, `pageVariant`/`defaultCardVariant`/
   `defaultShellVariant: "editorial"`), `cagnotteModuleConfig.defaultType: "aac"` (**indispensable**),
   header `standard`, footer `sidebar-columns`, 4 pages ; `sites.json`
   (`css: "index-projetsre"`, domaine `projetsre.00.re` **à confirmer**) ; logo ; fixture
   `__effective__` (`npm run test:preflight -- -u effective-config`, relue).
3. Gates : `config:validate`, `audit:config`, `typecheck`, `lint`, `test:preflight` (deux fois : avant
   et après `npm run build`).
4. Déploiement (`deploy:create`, `deploy:env`, `deploy:dns`) — **sur accord uniquement**.
5. **Avant la mise en ligne** :
   - couper `aac.detail.demoBlocks` (ou retirer la clé) ;
   - sélectionner les communs à publier : sans sélection, l'annuaire public est vide (§ 6).

**Prévisualiser sans le lot 0** : config jetable = celle de federationDesCae + les trois clés
`editorial` + le thème projets.re, servie par
`NODE_ENV=production VITE_SLUG=federationDesCae SITE_CONFIG_PATH=<copie> node server/prod-server.js`
après `VITE_SLUG=federationDesCae SITE_CSS_PATH=./src/index-projetsre.css npm run build`.
(Le serveur de dev Vite + Chromium a été tué par manque de mémoire sur la machine de travail.)

## 10. Impacts des modifications

**17/09 — lots 1–2 (commités).** Registre générique hors du blog ; fiche découpée en coquille,
contrôleur et vue. `AacCommunDetailPage.test.tsx` passé **sans une ligne modifiée** ; SSR de
federationDesCae identique (hors ordre des `modulepreload`).

**17/09 — lots 3–4.** Clés d'interface au schéma, registres fiche/annuaire, contrôleur d'annuaire,
gestes de filtrage partagés. Seule retouche des tests existants : `variants: {}` dans deux mocks du
contexte. SSR de federationDesCae identique hors préchargements et ids `useId` (profondeur d'arbre).

**17–21/09 — lot 5.** Interface `editorial` complète, démo, CSS, i18n. Captures Playwright sur les
données de federationDesCae : annuaire (grille, liste, popover de filtre), accueil, les 7 onglets
de la fiche, mobile 390 px sans débordement horizontal ; aucune erreur console hors le 500 connu.

**21/09 — régression trouvée et corrigée.** Déclarées en `lazy` DANS leurs registres, les vues
`editorial` faisaient perdre aux chunks de la fiche et de la section annuaire leur façade de
manifest : **75 → 48** `modulepreload` SSR sur la fiche de federationDesCae, **58 → 48** sur
l'annuaire, sans rien au rendu. Corrigé par `variants/lazyVariants.ts` (chunk d'entrée). Après
correction : corps HTML identique à `72b63243` sur `/`, `/aac`, `/aac/communs`, `/usages` et la
fiche ; préchargements **62 → 71 / 58 → 67 / 60 → 69 / 48 → 48 / 75 → 83** — même contenu, quelques
modules AAC désormais en chunks partagés. Nouveau préflight **`lazy-entry-facades`** ; il a révélé
**7 modules déjà sans façade avant ce chantier** (dont `ToolsCatalogSection`, que federationDesCae
rend sur `/usages`) — dette listée dans le test.

**Gates (21/09)** : `typecheck` ✅ · `lint` ✅ (2 avertissements préexistants) · suite unitaire
complète **4 483 tests / 360 fichiers** ✅ · `test:preflight` avec build **645 tests** ✅.

**21/09 — lot 6, le site.** `config.prod.projetsre.json` bâti sur celui de la Fédération : thème
projets.re (palette oklch de la maquette, Manrope + Instrument Serif, `defaultMode: light`), bloc
`aac` sur le formulaire ci-dessus avec les trois clés `editorial`, `cagnotteModuleConfig.defaultType:
"aac"`, header `standard` (logotype SVG texte `images/projetsre/logo.svg`), footer
`sidebar-columns`, 4 pages (accueil, `/aac/communs`, mentions légales et confidentialité en
« [à compléter] »). Textes réécrits pour projets.re d'après la maquette — **à relire**. `sites.json`
sans `coolifyApp` ni `domain` (domaine à confirmer). `.env` local : `SITE_CONFIG_PATH` et
`VITE_SLUG` sur projetsre (lignes Fédération commentées). **Gates** : `config:validate` ✅ (4 pages,
7 sections) · `audit:config` **0 constat** · `test:preflight` **664 tests** ✅ · rendu SSR des 5 routes
en 200 et captures accueil + annuaire conformes (0 projet : aucune réponse encore).

**23/09 — lot 8, l'adresse et le filtre « Commune ».** La clé `aac.directory.fields.adresse`,
posée dans la config mais **inconnue du schéma**, était strippée par Zod et signalée
`cle-strippee` par `audit:config` — du config mort. Le rôle existe désormais (9e rôle de
`directory.fields`), il est lu par `lib/communAddress.ts` qui réutilise `parseStoredToEntries`
du module coform, et il porte deux choses : la **commune** sur la carte, la ligne et la fiche de
l'interface `editorial` (l'adresse complète en infobulle), et le **filtre « Commune »** de la
maquette — côté client, comme `usage` et `maturity`.

Trois effets de bord assumés :

- l'interface **`default`** reçoit elle aussi le contrôle « Commune » (panneau latéral), alors
  que l'affichage reste `editorial` : le test de conformité impose qu'un filtre activé et
  résolu ait un contrôle dans **toutes** les coquilles. Sans rôle `adresse` il n'y a aucune
  option, donc rien n'est rendu — federationDesCae est inchangé ;
- le bloc de tags **dupliqué** de `CommunCardEditorial` (les tags s'affichaient deux fois,
  séquelle d'une édition en cours) a été retiré : c'est là que la commune se loge ;
- `__effective__/projetsre.json` n'a **pas** bougé : cette fixture est une projection des
  menus, routes d'édition et baseParams admin — elle ne porte pas le bloc `aac`.

**Gates (23/09)** : `typecheck` ✅ · `lint` ✅ (24 avertissements, tous préexistants et dans des
fichiers non touchés) · suite `src/modules/aac` **630 tests / 59 fichiers** ✅ ·
`config:validate` ✅ · `audit:config` **0 constat sur projetsre** (le `cle-strippee` a disparu :
la preuve directe que la clé est lue) · `test:preflight` **663/664** — le seul échec,
`coform.placeView.joinSection.elementLabel_cae` vide en fr, vient du commit `037a0f90` et est
**antérieur** à ce lot.

**23/09 — héros de la fiche, au plus près de la maquette.** La grille du héros enveloppait la
carte de financement **complète** (réactions, « Financement participatif », tuiles, « Financer ce
commun ») à côté d'un bouton Export isolé. `CommunFinancingCard` reçoit une mise en page
`layout="hero"` : réactions compactes sans fond sous les badges, puis la carte « Financement
réuni » de la maquette — son « déjà dépensés et justifiés », que l'AAC ne connaît pas, devient
« N cofinanceurs · X restant à financer » — et à droite « Exporter » puis « Soutenir ce projet »
empilés, sans « Porté par » (donnée absente de l'AAC) ni note « Bientôt disponible ». Le rendu
`full` de l'interface `default` est inchangé. Le test de conformité compare désormais les props
de la carte en `toMatchObject` : une vue peut ajouter `layout` / `secondaryAction`, pas modifier
celles du contrôleur.

**23/09 — les liens de la carte ouvrent l'onglet, puis défilent.** Montant et jauge (→ besoins
financiers), « N cofinanceurs » et la valeur « Contributeurs » (→ cofinanceurs), les paliers
(→ objectifs, en `full`) : la carte ne défile plus elle-même, elle **demande** la section par
`useShowSection` (`hooks/useCommunSectionNav.ts`). Sans fournisseur — la fiche verticale
`default` — c'est le défilement direct d'avant. L'interface `editorial` fournit
`tabbedSectionNav` avec sa table ancre → onglet (`SECTION_TAB`) : l'onglet s'ouvre (`flushSync`,
pour que l'ancre soit dans le DOM), puis on défile. **Toute future interface à onglets** n'a
qu'à fournir sa table. Le test de conformité l'impose désormais : pour chaque interface, chaque
lien de la carte doit trouver son ancre au moment du défilement.

**Gates (23/09)** : `typecheck` ✅ · `lint` ✅ sur les fichiers touchés · suite `src/modules/aac`
**646 tests / 60 fichiers** ✅ · vérifié dans le navigateur (onglet « Argent et transparence »
ouvert, besoins financiers calés sous l'en-tête).

**28/09 — réactions au-dessus d'Exporter / Soutenir.** Les trois réactions sortent de `CommunFinancingCard` dans
`CommunReactionStats`, avec leur état, la modale « J'utilise » et leur rejeu post-connexion. La
carte `full` le rend là où étaient ses stats (fiche `default` inchangée) ; en `hero`, la carte
n'a plus de réactions et l'interface `editorial` les place : ligne de 3 à droite du titre et de
la description à partir de `lg`, dans la colonne de droite d'une grille identique à celle du
bloc financement — même bord et même largeur qu'Exporter / Soutenir ; sous la description en
dessous (`max-w-xl`). Les deux grilles du héros suivent le rapport de la fiche federation-des-cae
(`CommunDetailDefault`) : 12 colonnes, 7 à gauche, 5 à droite (`gap-6` conservé). À 1024 px, la
colonne de droite fait 385 px et les libellés tiennent (en 2/3 – 1/3, elle n'en faisait que 303). L'intention post-connexion reste unique, portée par la page : chaque
composant ne consomme que la sienne (`reaction` ou `fund`). Le test de conformité vérifie qu'une
interface qui rend les réactions à part leur passe les props de la carte, et qu'elles
disparaissent avec le financement.

**Gates (28/09)** : `lint` ✅ sur les fichiers touchés · suite `src/modules/aac` **665 tests /
62 fichiers** ✅ · `typecheck` ✅ sur ce lot · captures à 1440, 1024 et 390 px conformes.

**29/09 — lot 9 : « Actus et agenda » réel.** L'onglet `vie` lit le **projet lié** au commun
(`vm.objectives.news` / `.agenda`, phase `project` seulement) : fil d'actualités complet
(`NewsFeed`, extrait de `NewsSection` sans changer l'onglet news des profils) et agenda compact
(`project.getEvents` : à venir, puis passés, « Voir plus »). Sans projet, un message ; pendant la
résolution, des squelettes. La démo actus/agenda (`DemoNewsAgendaTab`, `DEMO_NEWS`, `DEMO_EVENTS`)
est retirée. L'interface `default` est inchangée ; le test de conformité vérifie, pour une
interface qui les rend, les props du contrôleur et l'absence hors phase `project`.

**Gates (29/09)** : suites `src/modules/aac` + `src/modules/news` **709 tests / 69 fichiers** ✅ ·
préflights `i18n-files`, `aac-variants`, `lazy-entry-facades` ✅ — `AgendaSection` a désormais sa
façade et sort de la dette (6 modules restants) · `typecheck` et `lint` ✅ sur ce lot ·
builds Vite client + SSR ✅ · **non vérifié dans le navigateur** : aucun commun
de communecter-dev n'a de projet avec actus ou événements (0 réponse projetsre, 2 réponses
FédéCAE avec projet, sans actus ni événements).

**29/09 — onglet « Argent et transparence » au plus près de la maquette.** Les grandes cartes de
paliers et le tableau des cofinanceurs, empilés, deviennent les deux listes sobres de la maquette
côte à côte (`lg:grid-cols-2`) : « Dépenses engagées » à gauche, « Cofinanceurs » à droite. Pas de
fork : les deux blocs reçoivent une mise en page `layout="list"` (même principe que
`layout="hero"` de la carte), le rendu par défaut de la fiche `default` est inchangé.
- **Dépenses** : une ligne par dépense, libellé + « N % collecté » (ou badge « Clos ») à gauche,
  montant à droite, chevron ; le clic déplie l'**historique des financements reçus** sur cette
  dépense. Modifier / clore / supprimer / restaurer restent au survol, « Ajouter un palier » au-dessus.
  Pied « Total : X », dépenses closes exclues comme dans la carte.
- **Cofinanceurs** : logo réel (la maquette a une icône `Landmark`), nom (lien de profil), badge
  du type, montant à droite ; le porteur reste mis en avant.
- Écarts assumés : colonnes inversées (demande), « Total » et non « Total dépensé » — l'AAC connaît
  le budget des dépenses, pas les dépenses justifiées. Ancres `besoins-financiers` / `cofinanceurs`
  inchangées : les liens de la carte héros ouvrent toujours l'onglet puis défilent.

**29/09 — revue avant commit (lots 3 à 9).**
- Bloquants : `console.log` de débogage retiré de `CommunCardEditorial` ; liste des appels à projets
  retirée pour de bon de la démo (`DEMO_CALLS`, `DemoCall`, clé `editorial.detail.calls.todo`) —
  `DemoCallsBlock` garde titre, bandeau « Exemple », intro et bouton désactivé. `lint`, `tsc -b` et
  `npm run build` ne cassent plus.
- Bugs mineurs : plus de puce « • » après la commune quand la carte n'a pas de tag ; le fil d'actus
  de la fiche charge par 12 comme l'onglet news des profils (la clé de cache news n'inclut pas la
  taille de page : à 5, le profil du projet s'arrêtait à 5 actus) ; libellés de logs et
  commentaires rendus exacts après le déplacement des réactions.
- Contrôleur : `vm.funding.reactions`, paquet prêt à épandre pour `CommunReactionStats` (la vue
  `editorial` ne choisit plus ses props dans `funding.card`) ; la conformité compare à ce paquet.
- Qualité : `ProjectPhaseSection` factorise les onglets action / communauté / vie de l'`editorial` ;
  paquet `results` commun aperçu / annuaire ; constante de tags locale à la carte `editorial`
  (`aacDisplay.ts` revient à l'identique) ; la fiche ne pose un `Suspense` que pour une interface
  code-splittée. Commentaires du diff condensés (plus d'historique ni de mesures dans le code).
- Doc : rôle `keywords` ajouté à doc/34 (§3.1, 10 rôles).

**Gates (29/09, après revue)** : `lint` ✅ (fichiers modifiés) · `tsc` ✅ · suites `src/modules/aac`
+ `news` + `blog` + `src/lib/variants` **750 tests / 75 fichiers** ✅ · préflights `i18n-files`,
`aac-variants`, `skill-integrity`, `lazy-entry-facades` ✅ · `npm run build` (client + SSR) ✅.

**15/10 — suites de la revue de la MR `aac-dev`.**

- **Merge de main** (`origin/main` `4daa30c3`, résolution indexée, non commitée) : main ne devine
  plus `choose`. Les conflits sont résolus sur le comportement de main : `choose: null` et
  `CONFIG_ONLY_ROLES`, plus les rôles `adresse` / `keywords`. La fiche masque à l'auteur l'étape de
  `choose`, sinon l'étape d'évaluation **trouvée** (`evalStepKeyFound`). `sites.json` garde
  `openAtlas` et `projetsre1`. projets.re déclare déjà `choose`, donc rien ne change ici.
- **Démo derrière `aac.detail.demoBlocks`** : faux par défaut, `true` dans la config de projets.re.
  Coupé, la fiche n'a ni blocs « Exemple » ni onglets Maturation et Coopérations. L'onglet
  Communauté passe alors sur une colonne, avec un message quand aucun projet n'est lié.
- **Chemin `adresse` corrigé** (§ 6) et **mesure DEV/PROD** du formulaire.
- **Correctifs** :
  - le repli `Suspense` de l'annuaire est le squelette de l'interface, pas celui par défaut ;
  - un projet lié dont la requête n'est pas encore partie s'affiche en chargement, plus en erreur
    (agenda, actualités) ;
  - le lien « voir tout » passe par `NavLink` (lien externe hors du routeur) ;
  - `GRID_COLS` est regroupé en un seul module ;
  - les lectures de la réponse sont mémoïsées dans le contrôleur de la fiche.

**Gates (15/10)** :
- `typecheck` ✅ · `lint` 0 erreur (23 avertissements, tous antérieurs) · `npm run build` ✅ ·
  `config:validate` ✅ (projets.re, tiers-lieux, open-atlas) ;
- suite unitaire + préflights **6 439 tests / 554 fichiers** ✅, hors `site-assets` (dossiers vides
  locaux sous `public/images/`, hors dépôt) ;
- `lazy-entry-facades` : `search/components/SwitchDetailsMode.tsx` est **déjà sans façade sur main**
  (build de `origin/main` seul, 15/10). Il est inscrit à `KNOWN_WITHOUT_FACADE`, avec la dette
  existante.

## 11. Checklist d'avancement

| # | Lot | État | Détail |
|---|---|---|---|
| 0 | Entité + formulaire Communecter | ✅ | `projetsre1` et formulaire `6abb8521…` présents en DEV et en PROD (mesurés le 15/10) ; 1 réponse, 0 sélectionnée |
| 1 | Socle `src/lib/variants.ts` | ✅ | Commité `f97fc117` |
| 2 | Fiche : contrôleur + vue | ✅ | Commité `cd7aea60` |
| 3 | Registre de la fiche + préflight | ✅ | Non commité |
| 4 | Annuaire : contrôleur + registres | ✅ | Non commité |
| 5 | Interface `editorial` | ✅ | Non commité ; stories design-sync **non faites** (aucun composant AAC dans le bundle design-sync) |
| 6 | Site `projetsre` | ✅ | Config, `sites.json`, logo, fixture `__effective__`, `.env` — non commités ; **déploiement à faire** |
| 7 | Documentation | ✅ | doc/34 §3.4 et §3.1, doc/36, ce dossier, SKILL config-assistant |
| 8 | Adresse + filtre « Commune » | ✅ | Rôle `adresse`, commune sur carte/ligne/fiche (`editorial`), filtre client — non commité ; **à voir sur des réponses réelles** (0 au 21/09) |
| 9 | Onglet « Actus et agenda » réel | 🟡 | Fil d'actualités et agenda du projet lié — non commité ; tests ✅ ; **à voir sur un commun réel** (projet avec actus et événements) et en connecté (publication) |
| 10 | Suites de la revue de la MR `aac-dev` (15/10) | 🟡 | Merge de main indexé (non commité), corrections non indexées — § 10 |

## 12. Dépendances SDK ↔ cocolight-api-client

Aucune demande nouvelle : le chantier n'ajoute aucun endpoint. Dépendance backend héritée :
**`getformbyid` en 500** sur les forms `aapConfig` (doc/34 §3) — constaté encore le 21/09 sur
communecter-dev ; sans lui, les libellés exacts des usages (`form.params`) manquent et les cartes
retombent sur les identifiants (accents perdus).

## 13. Points d'attention / limitations

- Le contenu de démonstration est **le même sur tous les communs**. Il n'est rendu que si
  `aac.detail.demoBlocks: true` ; coupé, les onglets Maturation et Coopérations disparaissent.
  Retirer un bloc quand la fonctionnalité arrive (plan de retrait dans `demoContent.ts`).
- **Actus et agenda** n'existent qu'avec un **projet lié** : sans projet, l'onglet affiche
  « Les actualités et l'agenda s'ouvrent dès qu'un projet est lié à ce commun. ». L'agenda liste
  les événements dont le projet est **organisateur ou participant** (`project.getEvents`), sur tout
  le réseau, pas seulement ceux du site. Publier une actualité demande d'être admin ou
  contributeur du **projet** (droits du module news).
- Les titres `h1`–`h3` du site passent en police d'affichage graisse 400 (`index-projetsre.css`) :
  voulu par la maquette, mais cela touche aussi le chrome SiteForge du site.
- `lagoon`/`basalt` de la maquette ne sont pas portés (inutilisés par les deux écrans).
- La fiche garde des blocs de prose vides (« Aucun renseignement disponible ») si les questions
  déclarées ne sont pas remplies — comportement de `CommunProse`, commun aux deux interfaces.
- **Filtre « Commune »** : la facette groupe par NOM, donc deux communes homonymes de
  départements différents fusionnent ; et le filtre étant client, il impose le balayage borné à
  300 communs (au-delà, le compteur est un minorant — déjà le cas de `usage` et `maturité`).
- Le `geo`/`geoPosition` de la réponse adresse est lu mais **rien ne l'affiche** : aucune carte
  n'est ajoutée à l'annuaire.

## 14. Évolutions à prévoir & questions en attente

| Question | Responsable |
|---|---|
| ~~Entité et formulaire en prod~~ | **vérifié le 15/10** — `projetsre1` et `6abb8521…` résolus en PROD, mêmes identifiants et mêmes comptes qu'en DEV |
| Sélectionner les communs à publier : 0 sélectionné, l'annuaire public est vide | admins ProjetsRe |
| Couper `aac.detail.demoBlocks` à la mise en ligne | Anatole |
| Libellé de la question adresse (`aapStep1mumh6n3r1f11d73gwbn`, vide sur le formulaire) | Anatole |
| Domaine : `projetsre.00.re` ? (puis `coolifyApp`, `deploy:create/env/dns`) | à confirmer |
| Logo : le logotype SVG texte provisoire convient-il ? | à confirmer |
| Relecture des textes d'accueil et remplissage des « [à compléter] » des pages légales | commanditaire |
| Questions de prose à ajouter au formulaire (modèle économique, gouvernance…) ? | commanditaire |
| `getformbyid` en 500 sur ce formulaire aussi (communecter-dev) — correctif legacy à déployer | backend |
| ~~Filtre Commune~~ | **tranché le 23/09** — livré au lot 8 (rôle `directory.fields.adresse`) |
| ~~Actus et agenda en démo~~ | **tranché le 29/09** — livrés au lot 9 (données du projet lié) |
| Fonctionnalités en démo (maturation, coopérations, avis, soutiens, impact, appels) : lot produit ? | commanditaire |
| Dette des 6 modules sans façade (préflight `lazy-entry-facades` ; `AgendaSection` réparé au lot 9) | à planifier hors projet |
