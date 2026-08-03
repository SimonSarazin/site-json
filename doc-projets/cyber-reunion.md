[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet EDIH Cyber Réunion — Pôle européen d'innovation numérique

> **Document de travail du projet de configuration.** Il consigne l'état réel de la config après la
> refonte du 27/07, et les points qui restent à trancher. **À tenir à jour à chaque lot livré**,
> selon le formalisme du skill [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Search](../doc/07-module-search.md) ·
> [Module formEngine](../doc/28-module-formengine.md) · [Module Admin](../doc/30-module-admin.md) ·
> [Module Profil](../doc/08-module-profil.md). Mémoire : `[[project-cyber-reunion]]`.

Dernière mise à jour : **2026-07-28** (création du dossier, au lendemain de la refonte).

---

## 1. Contexte du projet

**EDIH** — European Digital Innovation Hub pour la cybersécurité à La Réunion. Le site est un
**annuaire de l'écosystème cyber** de la zone océan Indien, doublé d'une cartographie et d'un espace
membres.

Le site institutionnel du pôle vit ailleurs, sur `www.cyber-reunion.fr` : cette config est un
**complément**, pas un remplacement. Elle lui délègue d'ailleurs son socle légal et plusieurs appels
à l'action.

### Identité

| | |
|---|---|
| Slug | `cyberReunion` |
| Costum backend | `cyberReunion` (collection `organizations` — « EDIH - Cyber Réunion ») |
| Config | [`../config.prod.cyber-reunion.json`](../config.prod.cyber-reunion.json) |
| CSS | [`../src/index-cyber-reunion.css`](../src/index-cyber-reunion.css) — 51 variables, bloc `theme` complet |
| Langues | `fr` (défaut) + `en` |
| Header / Footer | `standard` / `contact-partners` (9 logos) |
| Site institutionnel | `www.cyber-reunion.fr` — porte le socle légal |
| SDK | `@communecter/cocolight-api-client` **1.0.169** |
| Historique | **61 commits** |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| — → 26/07 | Thomas | Construction de la config, formulaire costum, back-office |
| 27/07 | Claude | `24e551e4` refonte home + footer institutionnel + mode sombre · `46edeb50` `/annuaire` : retrait du champ de recherche et du filtre de zone en double · `ac8ee07d` retrait de `showActiveFiltersTags`, mort sur `/annuaire` |
| 28/07 | Claude | État des lieux et création de ce dossier |

---

## 2. Objectifs de la configuration

1. **Recenser** les acteurs de la cybersécurité de la zone — « de l'Afrique australe à l'Inde ».
2. Les rendre **cherchables et cartographiables**.
3. Permettre à une structure de **se référencer elle-même**.
4. Renvoyer vers les services du pôle (diagnostic cyber, urgence) hébergés sur le site institutionnel.

---

## 3. Architecture générale

```
                 ┌──────────────────────────────────────────┐
   Visiteur ───► │  SiteForge (site-json)                   │
                 │   4 pages · 12 sections                  │
                 │   /annuaire : PANNEAU de filtres         │
                 │   /mapping · /membres                    │
                 └──────────────┬───────────────────────────┘
                                │ searchCostum
                 ┌──────────────▼───────────────────────────┐
                 │  Backend Cocolight — cyberReunion        │
                 │  693 acteurs                             │
                 └──────────────────────────────────────────┘
                                │
                    délègue ────┴───► www.cyber-reunion.fr
                                      (mentions légales, cookies,
                                       diagnostic, urgence cyber)
```

**Voie de filtrage : le PANNEAU.** `/annuaire` emploie `gridLayout` + `filters` (2 groupes :
type d'acteur, pays). Son `searchHeader` porte donc `showSearch: false` — le panneau rend déjà son
propre champ, sans condition. C'est le correctif du 27/07 (`46edeb50`), après avoir constaté deux
champs de recherche sur la même page.

---

## 4. Ce que la config met en œuvre

### 4.1 Les 4 pages

| Page | Sections | Rôle |
|---|---|---|
| `/` | 6 | `html` ×2 (hero + mission) · `features-glass` (6 entrées) · `action-tiles` (4) · `cta-card-grid` (4) · `cta` (référencement) |
| `/annuaire` | 2 | `searchHeader` (titre seul) + `gridLayout` — panneau à 2 groupes |
| `/mapping` | 2 | `searchHeader` + `searchProStatic` |
| `/membres` | 2 | `searchHeader` + section `member` |

### 4.2 Formulaire costum

**`cyber-reunion-organization`** — `organizations`, **19 champs, tous placés**, 3 sections
(identité · qualification · contact).

> ⚠️ Ce formulaire emploie le **format PLAT** (`section.fields[]` directement), et non
> `section.groups[].fields[]` comme les 13 autres formulaires du parc. `sectionGroups()` normalise
> les deux, mais un outil de comptage qui ne lit que `groups` conclura « 0 champ placé » — l'erreur
> a été commise puis corrigée en rédigeant ce dossier.

Il est ouvert par le **bouton flottant** « Référencer ma structure » (bas-gauche, icône
`building-2`), gardé par `condition: {auth: …}`.

### 4.3 Back-office — 5 onglets

`Tableau de bord` · **`Fiches à valider`** (modération des membres) · `Contenu` · `Import / Export` ·
`Référencement`.

L'onglet « Fiches à valider » indique une **modération a priori** des inscriptions.

---

## 5. Modèle de données réel (sondé le 2026-07-28)

`config:probe` — **2 périmètres, 2 peuplés, 0 vide** :

| Page | Résultats |
|---|---|
| `/annuaire` · `/mapping` | **693** acteurs (les deux, même périmètre) |

Le troisième affichage, `/membres`, passe par la section `member` (liens de l'entité costum) et
n'est pas sondé par `config:probe`, qui ne couvre que les `baseParams`.

> Pour mémoire, une correction du 27/07 porte sur ce chiffre : la section `cardCountCT` de la home
> annonçait **2 588** acteurs au lieu de 693, parce qu'elle élargissait son `$or` avec la localité.
> C'est ce qui a motivé la prop `scope` ajoutée au moteur (`c8cb2ba9`).

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config | [`../config.prod.cyber-reunion.json`](../config.prod.cyber-reunion.json) |
| Thème | [`../src/index-cyber-reunion.css`](../src/index-cyber-reunion.css) |
| Déclaration | [`../sites.json`](../sites.json) → `cyberReunion` |
| Panneau de filtres | [`../src/modules/search/sections/FiltersSection.tsx`](../src/modules/search/sections/FiltersSection.tsx) |
| Compteur | [`../src/modules/search/sections/CardCountCTSection.tsx`](../src/modules/search/sections/CardCountCTSection.tsx) |

---

## 7. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| `showSearch: false` sur le `searchHeader` de `/annuaire` | Le panneau `filters` rend son propre champ **sans condition** : le laisser à `true` produisait deux champs de recherche sur la même page |
| `showActiveFiltersTags` retiré | `activeFilterTags` ne se dérive que de `props.dropdownFilters`, que cette section ne déclare pas — le réglage était **inerte** |
| Socle légal **délégué** à `www.cyber-reunion.fr` | Le pôle a son site institutionnel ; dupliquer ses mentions légales créerait deux versions à maintenir |
| Formulaire en **format plat** | 19 champs sur 3 sections courtes : les groupes multi-colonnes n'apportent rien ici |

---

## 8. Étapes de mise en place

```bash
PORT=5247 VITE_SLUG=cyberReunion \
  SITE_CONFIG_PATH=config.prod.cyber-reunion.json \
  SITE_CSS_PATH=src/index-cyber-reunion.css \
  node server/dev-server.js

npm run config:validate -- config.prod.cyber-reunion.json
npm run audit:config    -- --file config.prod.cyber-reunion.json
npx tsx scripts/config-probe.ts config.prod.cyber-reunion.json
```

---

## 9. Impacts des modifications

### 27/07 — refonte (3 commits)

- **`24e551e4`** — refonte de la home, footer institutionnel, mode sombre.
- **`46edeb50`** — `/annuaire` : retrait du champ de recherche **et** du filtre de zone en double.
  Deux systèmes de filtrage coexistent dans le moteur (HERO à `dropdownFilters` · PANNEAU
  `gridLayout` + `filters`) et **ne communiquent pas** ; les mélanger sur une page produit des
  doublons. Ce piège s'est reproduit depuis sur institut-bleu.
- **`ac8ee07d`** — retrait de `showActiveFiltersTags`, inerte faute de `dropdownFilters`.

### 28/07 — aucun changement de config

Correctifs du moteur dont ce site bénéficie :

| Correctif | Effet ici |
|---|---|
| `scope` sur `cardCountCT` (`c8cb2ba9`) | La prop existe désormais ; **la config ne l'emploie pas encore** — cf. §13 |
| Garde d'authentification (`f24a6531`) | Le bouton flottant « Référencer ma structure » hérite d'une invitation à se connecter si sa `condition` venait à sauter |
| `outline` sur `hero-parallax` (`bcf43aec`) | Aucun — ce site n'emploie pas cette section |

### Gates au 28/07

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 4 pages / 12 sections |
| `audit:config` | ✅ **0 constat** |
| `config:probe` | ✅ 2 périmètres, 2 OK |

---

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Slug + CSS dans `sites.json` | ✅ | `cyberReunion` → `index-cyber-reunion` |
| 2 | Thème + mode sombre | ✅ | Bloc `theme` complet, 51 variables — mode sombre traité le 27/07 |
| 3 | Annuaire | ✅ | 693 acteurs, panneau à 2 filtres, un seul champ de recherche depuis le 27/07 |
| 4 | Cartographie | ✅ | `/mapping` — même périmètre |
| 5 | Membres | ✅ | Section `member` avec rôles et gestion |
| 6 | Référencement d'une structure | ✅ | Formulaire costum 19 champs + bouton flottant |
| 7 | Back-office | ✅ | 5 onglets dont « Fiches à valider » (modération a priori) |
| 8 | Socle légal | ✅ | Délégué à `www.cyber-reunion.fr` (mentions légales, cookies) |
| 9 | QR code flottant | ❌ | **Encode `https://test.com`** — cf. §13 |
| 10 | Rendu navigateur | 🟡 | Home et `/annuaire` vus le 27/07 ; `/mapping` et `/membres` jamais |
| 11 | Mode sombre | 🟡 | Traité le 27/07 sur la home ; les 3 autres pages non vérifiées |

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

Aucune demande en cours.

---

## 12. Points d'attention / limitations

- ⚠️ **Formulaire costum en format PLAT** (cf. §4.2) — seul cas du parc. Tout outil de comptage ou
  de vérification des champs doit lire `section.fields` **et** `section.groups[].fields`.
- **Deux voies de filtrage qui ne se parlent pas** : ce site emploie le PANNEAU. Ne jamais y ajouter
  un `showSearch` de hero — c'est le défaut corrigé le 27/07.
- **`cardCountCT` élargit son périmètre par défaut** : mesuré à 2 588 au lieu de 693 sur ce site.
  La prop `scope` existe depuis le 28/07 mais n'est pas encore posée ici.
- Config JSON **jamais parsée par Zod au runtime** : toute clé doit être écrite explicitement.
- Le site institutionnel `www.cyber-reunion.fr` porte une partie de l'expérience (diagnostic,
  urgence cyber, mentions légales) : toute évolution doit rester cohérente avec lui.

---

## 13. Évolutions à prévoir & questions en attente

| # | Question | Responsable |
|---|---|---|
| 1 | **Le QR code flottant encode `https://test.com`** — valeur d'essai laissée en production. Quelle URL doit-il porter ? | Cyber Réunion / Thomas |
| 2 | **Cinq des huit appels à l'action de la home mènent à `/annuaire`** : « Soumettre une initiative », « Participer », « Co-financer », « Découvrir les projets », « Devenir prestataire ». Cinq promesses distinctes, une seule destination — et aucune ne fait ce qu'elle annonce. Les trois autres pointent tous vers la même page de `cyber-reunion.fr`. À revoir | Thomas |
| 3 | La section `cardCountCT` de la home doit-elle recevoir `scope: "costum"` pour annoncer 693 plutôt que 2 588 ? | Thomas |
| 4 | `/mapping` et `/annuaire` servent **exactement le même périmètre** (693). Est-ce voulu — deux vues d'un même ensemble, comme sur tiers-lieux — ou faut-il différencier ? | Thomas |
| 5 | `/mapping` et `/membres` : rendu navigateur et mode sombre jamais vérifiés | Thomas |
