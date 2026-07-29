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

Dernière mise à jour : **2026-07-28** (création du dossier · levée de 12 des 16 constats d'audit).
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
| SDK | `@communecter/cocolight-api-client` **1.0.169** |
| Branche courante | `feat/institut-bleu-et-correctifs-parc` |
| Historique | **73 commits** touchant la config |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| — → 25/07 | Thomas | Construction de la config (19 pages), des 6 formulaires costum et du back-office ; travaux blog (fil, RSS, SEO, palette) partagés avec le moteur |
| 25/07 | Thomas | `b1104947` — « rezo-la-mer, SSBE, équipements sportifs : 41 constats levés » |
| 28/07 | Claude | Diagnostic complet, levée de 12 constats (cf. §9), création de ce dossier |

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

| Formulaire | Entité | Champs déclarés | dont **placés** |
|---|---|---|---|
| `sport-sante-bienetre-organizations` | organizations | 45 | 27 |
| `sport-sante-bienetre-mss` | organizations | 35 | 25 |
| `sport-sante-bienetre-recovery-center` | poi | 33 | 28 |
| `sport-sante-bienetre-formation` | projects | 26 | 16 |
| `sport-sante-bienetre-session-formation` | events | 22 | 14 |
| `sport-sante-bienetre-article` | poi | 11 | 6 |

> ⚠️ **L'écart « déclarés vs placés » n'est pas anodin.** Le moteur rend en parcourant
> `sections → groups → fields[]` ([`shared.tsx:47`](../src/modules/formEngine/layouts/shared.tsx),
> [`GenericForm.tsx:107`](../src/modules/formEngine/components/GenericForm.tsx)) : **un champ
> déclaré mais placé dans aucune section n'est jamais rendu.** Une partie de l'écart est
> légitime (sous-champs de widgets composites : `streetAddress`/`postalCode` sous `address`,
> `facebook`/`instagram` sous `socialNetwork`, `mobile` sous `telephone`) ; le reste est du
> vestige de conversion. 10 de ces vestiges ont été supprimés le 28/07 (cf. §9).

### 4.3 Back-office (`config.admin`, 7 onglets)

`Tableau de bord` · `Membres` · `Organisations` (2 formulaires) · `Lieux & actualités` (2) ·
`Formations` (2) · `Import / Export` · `Référencement`.

**Les 6 formulaires costum n'étaient exposés QUE là.** Rien, côté public, n'ouvrait de formulaire
avant le 28/07.

---

## 5. Modèle de données réel (sondé le 2026-07-28)

`config:probe` sur le costum `sportSanteBienetre` — **9 périmètres, 8 peuplés, 1 vide** :

| Page | Périmètre | Résultats |
|---|---|---|
| `/equipements-sportifs` | poi équipements | **3 052** |
| `/creneaux` | créneaux | **263** |
| `/structure` · `/mapping` | organisations du réseau | **171** (les deux) |
| `/mss` | Maisons Sport-Santé | 13 |
| `/formation` | formations | 4 |
| `/listing-formations` · `/projets` | offres · projets | 2 · 2 |
| `/communaute` → onglet « Organisations » | — | **0 ⛔** |

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

---

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Slug + CSS dans `sites.json` | ✅ | `sportSanteBienetre` → config + `index-sport-sante-bien-etre` |
| 2 | Thème | ✅ | Bloc `theme` complet en config + 75 variables CSS |
| 3 | Socle légal | ✅ | `/mentions-legales`, `/confidentialite`, `/accessibilite` existent |
| 4 | Jeux de données du territoire | ✅ | Équipements (3 052), créneaux (263), structures (171), MSS (13) |
| 5 | Communauté | 🟡 | Onglet « Membres » OK ; onglet « Organisations » **vide** (id en dur, §5) |
| 6 | Formulaires costum | 🟡 | 6 déclarés et exposés dans `/admin` ; **1 seul** ouvert côté public depuis le 28/07 |
| 7 | Inscription d'une structure | ✅ | Modale branchée sur `/communaute`, gardée par l'authentification |
| 8 | Connexion | ✅ | Widget `utilities.auth` ; le CTA cassé du header est retiré |
| 9 | Back-office | ✅ | 7 onglets — **essai UI connecté à faire** |
| 10 | Blog | ✅ | `articleFeed` + RSS + SEO + palette (travaux du 25/07) |
| 11 | Palette ⌘K | ✅ | `entitySearch` + `articleSearch` |
| 12 | Grille « professionnels » | ❌ | 3 tuiles sur 6 mènent à des pages inexistantes (§13) |
| 13 | Hero `/public` | ❌ | 1 CTA mort, 1 CTA qui renvoie à l'accueil depuis une sous-page (§13) |
| 14 | Rendu navigateur | ❌ | **Jamais vérifié** — aucune capture de ce site à ce jour |
| 15 | Mode sombre | ❌ | Jamais vérifié |

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

Aucune demande en cours. La config n'emploie que des méthodes publiques déjà disponibles en
**1.0.169** (`searchCostum`, `coformAnswersSearch`).

---

## 12. Points d'attention / limitations

- **Écart « champs déclarés vs placés »** dans les 6 formulaires (cf. §4.2). Avant de traduire ou de
  renommer un champ, vérifier qu'il est **placé dans une section** — sinon il n'existe pas à l'écran.
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
| 1 | **Grille « Le réseau Sport Santé »** (`/espace-professionnels`, `features-glass`, 6 tuiles) : 3 tuiles mènent à des pages inexistantes — « Aide à la prescription » (`/prescription`), « Stratégie régionale Sport Santé » (`/strategie`), « Rapports & Publications » (`/ressources`). **Créer les 3 pages, repointer, ou retirer les tuiles ?** Rapprochements possibles mais non équivalents : `/presentation` pour la stratégie, `/blog` pour les publications | Thomas |
| 2 | **Hero de `/public`** : le CTA « Sport et santé pour tous » pointe vers `/rejoindre` (inexistant), et le second, « Sport et santé sur ordonnance », vers `/` — un lien vers l'accueil depuis une sous-page. Les deux libellés sont des **slogans, pas des actions** : le hero est à repenser plutôt qu'à rafistoler | Thomas |
| 3 | Les 5 autres formulaires costum (`mss`, `formation`, `session-formation`, `recovery-center`, `article`) doivent-ils être ouverts au public comme l'a été `organizations`, ou rester réservés au back-office ? | Thomas |
| 4 | Les 6 formulaires déclarent 172 champs dont **116 placés**. Faut-il purger les vestiges restants, ou certains sont-ils attendus par le backend en écriture ? | Thomas |
| 5 | `/communaute` → onglet « Organisations » : l'id `682b2ac5e05a1d45844340e7` est-il périmé, ou aucune organisation n'a-t-elle jamais été rattachée ? | Thomas |
| 6 | Rendu navigateur et mode sombre : à parcourir sur les 19 pages | Thomas |
