[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Rézo la mer — Le réseau des passionné·es de la mer (La Réunion)

> **Document de travail du projet de configuration.** Il consigne l'état réel de la config, ce que
> le costum legacy contient encore et **n'a pas été porté**, et les arbitrages qui restent à rendre.
> Créé après le constat que rezo-la-mer n'est pas une config bâclée mais un **portage arrêté en
> chemin**. **À tenir à jour à chaque lot livré**, selon le formalisme du skill
> [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Search](../doc/07-module-search.md) ·
> [Module Ampli](../doc/22-module-ampli.md) · [Module CoForm](../doc/21-module-coform.md) ·
> [Module Cagnotte](../doc/18-module-cagnotte.md) · [Module Auth](../doc/23-module-auth.md).
> Mémoire : `[[project-rezo-la-mer]]`.

Dernière mise à jour : **2026-07-28** (création du dossier · les 5 pages légales posées).
**Le chantier principal reste à cadrer** — cf. §13.

---

## 1. Contexte du projet

Réseau des acteurs et des passionnés de la mer à La Réunion. Le site SiteForge existe et fonctionne :
5 pages de contenu, données réelles, thème complet. Mais le costum legacy dont il est issu porte
**35 pages**, dont toute une sous-application d'appels à projets qui n'a pas été reprise.

Le symptôme visible de cet écart, ce sont les **liens morts du pied de page** : celui-ci décrit le
site d'origine, pas celui qui existe.

### Identité

| | |
|---|---|
| Slug | `rezoLaMer` |
| Costum backend | `rezoLaMer` (collection `organizations` — **« Rézo la mer - OCEAKNOWLOGIE »**) |
| Siège | Saint-Leu (97411), La Réunion — *voie non renseignée en base* |
| Contact public | `contact@rezolamer.org` |
| Config | [`../config.prod.rezo-la-mer.json`](../config.prod.rezo-la-mer.json) |
| CSS | [`../src/index-rezo-la-mer.css`](../src/index-rezo-la-mer.css) — également employé par `eXtremeDefiAdeme` |
| Langues | `fr` (défaut) + `en` · bloc `theme` **complet** |
| Header / Footer | `transparent-scroll` / `sidebar-columns` |
| SDK | `@communecter/cocolight-api-client` **1.0.169** |
| Historique | **54 commits** touchant la config |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| — → 25/07 | Thomas | Construction des 5 pages de contenu, thème, `b1104947` « 41 constats levés » |
| 28/07 | Claude | Diagnostic, création des 5 pages légales, relevé du legacy non porté, création de ce dossier |

---

## 2. Objectifs de la configuration

1. Donner au réseau un site public : présentation, projets, événements, communauté, ressources.
2. Permettre aux membres de **publier** projets, événements et lieux depuis le site.
3. **À cadrer** : reprendre ou non la sous-application d'appels à projets du costum legacy.

---

## 3. Architecture générale

```
                 ┌───────────────────────────────────────────┐
   Visiteur ───► │  SiteForge (site-json)                    │
                 │   10 pages (5 contenu + 5 légales)        │
                 │   header transparent-scroll               │
                 │   footer sidebar-columns                  │
                 └──────────────┬────────────────────────────┘
                                │ searchCostum
                 ┌──────────────▼────────────────────────────┐
                 │  Backend Cocolight — costum rezoLaMer     │
                 │  35 pages `app` · module AAP · ampli      │
                 │  ← 21 pages NON PORTÉES                   │
                 └───────────────────────────────────────────┘
```

---

## 4. Le costum legacy — ce qu'il contient (relevé le 28/07)

`costum.app` compte **35 entrées**, qui se partagent en deux familles.

### 4.1 Les 14 pages de site (`#app.view` / `#app.search`)

| Entrée legacy | Correspondance SiteForge | État |
|---|---|---|
| `#welcome` | `/` | ✅ portée |
| `#projets` | `/projets` | ✅ portée |
| `#coevent` | `/evenements` | ✅ portée |
| `#communaute` | `/communaute` | ✅ portée |
| `#ressources` | `/ressources` | ✅ portée |
| `#nous-contacter` | `/contact` | ❌ **manquante** — et `/contact` est lié 2× dans la config |
| `#actus` · `#actualites-amplifions-le-sens-océanique` | `/blog` ? | 🟡 à décider — `/blog` est lié mais n'existe pas |
| `#feuille-de-route` | — | 🟡 à décider |
| `#presentationAap` | — | 🟡 à décider |
| `#organismAap` · `#projectDropdown` · `#proposalDropdown` · `#teste` | — | vues techniques ou d'essai, sans doute hors périmètre |

### 4.2 Les 21 pages du module AAP (`#app.aap`)

Une **sous-application complète** d'appels à projets, pas quelques pages :

`#coformAap` (soumettre un dossier) · `#communityAap` · `#configurationAap` · `#contributionAap` ·
`#dashboardAap` (observatoire) · `#detailProjectAap` · `#detailProposalAap` · `#documentationAap` ·
`#editCoformAap` · `#faqAap` · `#kanbanCoremuAap` · `#myactionsAap` · `#myprojectsAap` ·
`#myproposalsAap` · `#newprojectAap` · `#newproposalAap` · `#observatoryAap` ·
`#organismchooserAap` · `#projectsAap` · `#proposalAap` · `#sessionAap`.

**SiteForge n'a pas de module AAP.** Il dispose de briques voisines — `coform` (formulaires
dynamiques), `cagnotte` (financement collaboratif, jalons et actions), `observatoire` (tableaux de
bord config-driven) — mais leur assemblage en un parcours d'appel à projets reste à concevoir.
C'est **le** chantier de ce projet, et il n'est pas chiffré.

### 4.3 Campagne `ampli`

Le costum déclare une campagne d'amplification, **« amplifions-le-sens-océanique »**, avec 5 pages
(`welcome`, `messages`, `reseau`, `statistique`…).

**SiteForge a un module `ampli`**, employé en production par `config.prod.tiers-lieux.json`. Cette
campagne est donc a priori **portable sans développement**, par configuration.

### 4.4 Ce qui n'existe PAS dans le legacy

- **Aucun formulaire costum.** `typeObj.project.dynFormCostum` ne contient qu'une clé `afterSave`
  pointant sur `costum[costum.slug].project.afterSave` : c'est un **hook de post-enregistrement**,
  pas une définition de formulaire. Les trois autres types (`organizations`, `event`, `poi`) ne
  portent qu'un `add`. Il n'y a donc **rien à porter côté formEngine** — contrairement à
  institut-bleu.
- Aucun back-office costum.

### 4.5 Deux listes costum inemployées

| Liste | Valeurs |
|---|---|
| `domaine` | 8 — Conservation marine · Recherche scientifique · Éducation et sensibilisation · Nettoyage des océans · Biodiversité marine · Pêche durable · Zones protégées · Climat et océans |
| `impacttype` | 6 — Environnemental · Social · Économique · Éducatif · Scientifique · Politique |

Ce sont les facettes métier du réseau. **Aucun filtre de la config SiteForge ne les emploie**
aujourd'hui — les pages `/projets` et `/ressources` n'offrent donc pas ces axes de tri.

---

## 5. Modèle de données réel (sondé le 2026-07-28)

`config:probe` — **6 périmètres, 6 peuplés, 0 vide** :

| Page | Périmètre | Résultats |
|---|---|---|
| `/communaute` → onglet 1 | citoyens | **52** |
| `/evenements` (liste) | events | 9 |
| `/projets` | projects | 7 |
| `/evenements` (à la une) | events | 5 |
| `/communaute` → onglet 2 | organisations | 4 |
| `/ressources` | poi | 2 |

Le réseau est **petit mais réel** : 79 entités. La config n'a aucun périmètre faux — ce qui distingue
nettement ce projet de commune-transparente.

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config | [`../config.prod.rezo-la-mer.json`](../config.prod.rezo-la-mer.json) |
| Thème | [`../src/index-rezo-la-mer.css`](../src/index-rezo-la-mer.css) — ⚠ **partagé avec `eXtremeDefiAdeme`** |
| Déclaration | [`../sites.json`](../sites.json) → slug `rezoLaMer` |
| Modules candidats au portage AAP | [`../src/modules/coform/`](../src/modules/coform) · [`../src/modules/cagnotte/`](../src/modules/cagnotte) · [`../src/modules/observatoire/`](../src/modules/observatoire) · [`../src/modules/ampli/`](../src/modules/ampli) |

---

## 7. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| Les 5 pages légales n'affirment **que** des faits établis, le reste en `[à compléter]` | Un texte juridique faux engage l'éditeur. Deux tours de rédaction ont été nécessaires : le premier affirmait une quarantaine de choses invérifiables (mesures de sécurité, traceurs, gratuité, modération) |
| `/cookies` renvoie à `/confidentialite#cookies` plutôt qu'à une 6ᵉ page | Une page cookies distincte dupliquerait la section 4 de la politique. L'ancre est posée en fr **et** en en |
| Les formulaires d'ajout restent les **génériques** (`add-project`, `add-event`, `add-poi`) | Le legacy n'en définit aucun de spécifique (§4.4) — rien ne justifie un `costumForms` |

---

## 8. Étapes de mise en place

```bash
PORT=5244 VITE_SLUG=rezoLaMer \
  SITE_CONFIG_PATH=config.prod.rezo-la-mer.json \
  SITE_CSS_PATH=src/index-rezo-la-mer.css \
  node server/dev-server.js

npm run config:validate -- config.prod.rezo-la-mer.json
npm run audit:config    -- --file config.prod.rezo-la-mer.json
npx tsx scripts/config-probe.ts config.prod.rezo-la-mer.json
```

---

## 9. Impacts des modifications

### Lot du 28/07 — les 5 pages légales (27 constats → 21)

Le pied de page annonçait 5 rubriques légales dont **aucune n'existait**, mentions légales et
politique de confidentialité comprises — deux obligations pour un site public en France.

Créées : `/mentions-legales` · `/confidentialite` · `/cgu` · `/licences` · `/accessibilite`
(section `html`, `layout: fullwidth`, gabarit repris d'`equipements-Sportifs` et `tiers-lieux`).
`/cookies` repointé sur `/confidentialite#cookies`.

**Méthode et honnêteté du contenu.** Deux tours de rédaction multi-agents avec contrôle adversarial.
Le premier tour a été **rejeté sur les 5 pages** — une quarantaine d'affirmations invérifiables. Le
dossier de faits a été enrichi de ce que la config PROUVE du fonctionnement (comptes utilisateur via
`config.auth` + routes du module, types d'entités via `config.profiles`, absence de bandeau de
consentement), puis le second tour est passé **conforme sur les 5 pages, 0 fait inventé**.

Faits publiés : dénomination, commune, `contact@rezolamer.org`, licence MIT de la **plateforme**
(pas du site ni de ses contenus). Deux coordonnées de la fiche de l'organisation — une adresse
personnelle et un mobile — **n'ont pas été publiées**.

> ⚠️ **Ces pages ne sont pas publiables en l'état.** Forme juridique, SIREN/RNA, voie du siège,
> directeur de la publication, hébergeur, inventaire des cookies, durées de conservation, mesures de
> sécurité, statut de l'audit d'accessibilité : tout porte `[à compléter]`.

Vérifié : 0 couleur littérale, 0 lien interne mort dans les pages ajoutées, préflight 274 tests.

---

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Slug + CSS dans `sites.json` | ✅ | ⚠ CSS partagé avec `eXtremeDefiAdeme` |
| 2 | Thème | ✅ | Bloc `theme` complet |
| 3 | Pages de contenu | ✅ | 5 pages, 6 périmètres tous peuplés (79 entités) |
| 4 | Socle légal | 🟡 | 5 pages posées, **à compléter par le porteur** avant publication |
| 5 | Publication par les membres | ✅ | `add-project`, `add-event`, `add-poi` — gardés par l'authentification depuis le 28/07 |
| 6 | Page contact | ❌ | `#nous-contacter` existe au legacy, `/contact` est lié 2× et n'existe pas |
| 7 | Actualités | ❌ | `#actus` au legacy, `/blog` lié, page absente |
| 8 | Parcours d'adhésion | ❌ | `/rejoindre` lié **4×** dont le CTA du header — `/register` existe pourtant côté moteur |
| 9 | Facettes métier | ❌ | Listes `domaine` et `impacttype` du costum inemployées |
| 10 | Campagne `ampli` | ❌ | « amplifions-le-sens-océanique » (5 pages) non portée — le module existe pourtant |
| 11 | Module AAP | ❌ | 21 pages legacy — **chantier non cadré** |
| 12 | Back-office | — | Aucun au legacy, aucun besoin identifié |
| 13 | Rendu navigateur | ❌ | **Jamais vérifié** |

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

Aucune demande en cours. Un portage AAP en ferait probablement naître.

---

## 12. Points d'attention / limitations

- **`src/index-rezo-la-mer.css` est partagé avec `eXtremeDefiAdeme`.** Toute retouche du thème
  affecte deux sites.
- **14 liens morts subsistent** (voir §13). Le pied de page décrit le site legacy.
- L'ancre **`#donnees`** du pied de page ne correspond à aucun `id` de section — les ids déclarés
  sur `/` sont `hero-rezo-la-mer`, `mission`, `features`, `actions`, `community`, `cta`.
- Config JSON **jamais parsée par Zod au runtime** : toute clé doit être écrite explicitement.
- Le costum legacy reste en ligne : toute reprise éditoriale doit s'y référer plutôt qu'inventer.

---

## 13. Évolutions à prévoir & questions en attente

| # | Question | Responsable |
|---|---|---|
| 1 | **Le module AAP (21 pages) est-il dans le périmètre ?** C'est le chantier structurant. SiteForge n'a pas d'équivalent ; il faudrait assembler `coform` + `cagnotte` + `observatoire`. À cadrer avant tout chiffrage | Thomas |
| 2 | **Les 14 liens morts restants** : `/rejoindre` (×4, dont le CTA du header) · `/proposer-projet` (×3) · `/participer` (×2) · `/contact` (×2) · `/inscrire-organisation` · `/contribuer` · `/benevole` · `/equipe` · `/gouvernance` · `/partenaires` · `/blog` · `/cagnotte` · `/explorer` · `/plan-du-site`. Créer, repointer ou retirer ? Plusieurs ont un équivalent immédiat : `/rejoindre` → `/register` que le module auth fournit déjà | Thomas |
| 3 | `/contact` et `/blog` correspondent à des pages legacy réelles (`#nous-contacter`, `#actus`) : reprise éditoriale à faire | Institut / Thomas |
| 4 | **Compléter les 5 pages légales** : forme juridique, SIREN/RNA, voie du siège, directeur de la publication, hébergeur, cookies déposés, durées de conservation, statut de l'audit d'accessibilité, licences des contenus | Rézo la mer |
| 5 | La campagne `ampli` « amplifions-le-sens-océanique » doit-elle être portée ? Le module existe et sert déjà tiers-lieux | Thomas |
| 6 | Les listes costum `domaine` (8 valeurs) et `impacttype` (6) doivent-elles devenir des facettes de `/projets` et `/ressources` ? | Thomas |
| 7 | Ancre `#donnees` du pied de page : à quelle section doit-elle mener ? | Thomas |
| 8 | Rendu navigateur et mode sombre : jamais vérifiés | Thomas |
