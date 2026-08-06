[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet EDIH Cyber Réunion — Pôle européen d'innovation numérique

> **Document de travail du projet de configuration.** Il consigne l'état réel de la config après la
> refonte du 27/07, et les points qui restent à trancher. **À tenir à jour à chaque lot livré**,
> selon le formalisme du skill [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Search](../doc/07-module-search.md) ·
> [Module formEngine](../doc/28-module-formengine.md) · [Module Admin](../doc/30-module-admin.md) ·
> [Module Profil](../doc/08-module-profil.md). Mémoire : `[[project-cyber-reunion]]`.

Dernière mise à jour : **2026-08-03** (réseaux sociaux au patron `fieldArray`, SDK 1.0.172 publiée, gates rejoués).

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
| SDK | `@communecter/cocolight-api-client` **1.0.172** (publiée npm, `^1.0.172` — commit `09e145a0` du 03/08) |
| Historique | **62 commits** (`git log --follow`, au 03/08) |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| — → 26/07 | Thomas | Construction de la config, formulaire costum, back-office |
| 27/07 | Claude | `24e551e4` refonte home + footer institutionnel + mode sombre · `46edeb50` `/annuaire` : retrait du champ de recherche et du filtre de zone en double · `ac8ee07d` retrait de `showActiveFiltersTags`, mort sur `/annuaire` |
| 28/07 | Claude | État des lieux et création de ce dossier |
| 30/07 | Claude | `5ae354d2` le champ « Réseaux sociaux » passe d'`editSocial` (qui n'enregistrait **rien**) au patron `fieldArray` de tiers-lieux |
| 03/08 | Claude | Merge de `fix/institut-bleu-ui` dans `main` (17 commits, moteur — aucun changement de cette config) · SDK **1.0.172** publiée (`09e145a0`) · gates rejoués, mise à jour de ce dossier |

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
(identité · qualification · contact) — recompté le 03/08.

**Réseaux sociaux réparés le 30/07** (`5ae354d2`) : le champ `socialNetwork` employait le widget
`editSocial` — l'ancre du profil **citoyen**, dont les neuf saisies écrivent sur des clés
(`github`, `facebook`…) que ce descripteur ne déclarait pas. Résultat mesuré : l'utilisateur
saisissait dans neuf champs reliés à rien, la clé `socialNetwork` restait vide. Remplacé par le
patron `fieldArray` de tiers-lieux (lu depuis sa config, référence unique des 5 formulaires) :
nom d'UI `socialLinks`, `path: socialNetwork` (la clé serveur ne change pas), `social:read`/
`social:write`, `clear: ""`, un select de plateforme (8 options) + un champ URL par ligne.

> ⚠️ Ce formulaire emploie le **format PLAT** (`section.fields[]` directement), et non
> `section.groups[].fields[]` comme les autres formulaires du parc. `sectionGroups()` normalise
> les deux, mais un outil de comptage qui ne lit que `groups` conclura « 0 champ placé » — l'erreur
> a été commise puis corrigée en rédigeant ce dossier. **Le piège a mordu une seconde fois le
> 30/07** : le renommage `socialNetwork` → `socialLinks` ne traitait d'abord que `groups[].fields`,
> laissant ici une référence de section vers un champ disparu — invisible pour `config:validate`
> comme pour les préflight (aucun outil ne vérifie qu'une référence pointe un champ déclaré).
> Réparé dans le même commit, avec audit des 266 références de champ du parc : 0 orpheline.

Il est ouvert par le **bouton flottant** « Référencer ma structure » (bas-gauche, icône
`building-2`), gardé par `condition: {auth: …}`.

### 4.3 Back-office — 5 onglets

`Tableau de bord` · **`Fiches à valider`** (modération des membres) · `Contenu` · `Import / Export` ·
`Référencement`.

L'onglet « Fiches à valider » indique une **modération a priori** des inscriptions.

---

## 5. Modèle de données réel (sondé le 2026-08-03)

`config:probe` — **2 périmètres, 2 peuplés, 0 vide** :

| Page | Résultats |
|---|---|
| `/annuaire` · `/mapping` | **693** acteurs (les deux, même périmètre) |

Le troisième affichage, `/membres`, passe par la section `member` (liens de l'entité costum) et
n'est pas sondé par `config:probe`, qui ne couvre que les `baseParams`.

> Pour mémoire, une mesure de l'audit du 27-28/07 porte sur ce chiffre : un compteur `cardCountCT`
> annoncerait ici **2 588** acteurs au lieu de 693, parce que la section élargit son `$or` avec la
> localité et le slug du costum. C'est ce qui a motivé la prop `scope` ajoutée au moteur
> (`c8cb2ba9`, dont le message cite la mesure). Précision vérifiée le 03/08 : la section
> `cardCountCT` **n'a jamais figuré dans cette config** (0 occurrence sur tout l'historique du
> fichier) — la mesure décrivait ce qu'elle afficherait si on l'ajoutait.

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

### Variables d'environnement (déploiement)

Depuis le merge du 03/08 (`fix/institut-bleu-ui`), une nouvelle variable s'ajoute au déploiement :

| Variable | Valeur pour ce site | Rôle |
|---|---|---|
| `VITE_SITE_PUBLIC_URL` | `https://cyber-reunion.00.re` (dérivée par `deploy:env` depuis `sites.json` : pas d'`aliases` déclaré → repli sur `domain`) | URL publique du site-json **lui-même** : canonical, `og:url`/`og:image`, `sitemap.xml`, flux RSS — lue par `getSitePublicUrl()` ([`../src/lib/constant/common.ts`](../src/lib/constant/common.ts)) et `server/lib/sitemap.js`. Si absente : repli `getServerUrl()` (comportement historique) |
| `VITE_SERVER_URL` | valeur parc (serveur communecter) | **Ne pas confondre** : images `/upload`, embed co2, cagnotte — garde sa valeur parc |

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
| `scope` sur `cardCountCT` (`c8cb2ba9`) | La prop existe désormais ; **la section n'est pas dans la config** (cf. §5 et §13) |
| Garde d'authentification (`f24a6531`) | Le bouton flottant « Référencer ma structure » hérite d'une invitation à se connecter si sa `condition` venait à sauter |
| `outline` sur `hero-parallax` (`bcf43aec`) | Aucun — ce site n'emploie pas cette section |

### 30/07 — réseaux sociaux au patron `fieldArray` (`5ae354d2`)

Seul commit touchant cette config depuis le 28/07 (partagé avec `sport-sante-bien-etre`) :

- **Ce qui change** : le champ `socialNetwork` (widget `editSocial`, qui n'enregistrait rien —
  cf. §4.2) devient `socialLinks` (widget `fieldArray`, `path: socialNetwork`) ; la référence de
  section (format plat) est mise à jour. La clé serveur reste `socialNetwork`.
- **Prérequis backend** : le patron n'était utilisable sur autre chose qu'une organisation que
  depuis ce jour-là — ici la collection est `organizations`, déjà couverte par le legacy.
- **À revalider** : la saisie réelle des réseaux sociaux via « Référencer ma structure »
  (jamais testée en navigateur depuis le correctif).
- **Gates au commit** (message de `5ae354d2`) : `config:validate` ✅, préflight 337/337 ✅,
  typecheck ✅, audit des 266 références de champ du parc → 0 orpheline.

### 03/08 — merge `fix/institut-bleu-ui` + SDK 1.0.172 (aucun changement de cette config)

La branche `fix/institut-bleu-ui` (17 commits) est mergée dans `main` (`94251b7b`). Effets ici :

| Changement moteur | Effet ici |
|---|---|
| SDK `@communecter/cocolight-api-client` **1.0.172 publiée** (`09e145a0`) — fin du `npm pack` local | Fiabilise la pose du scope costum côté admin (`setCostumScope`, cf. [`../src/modules/admin/lib/ensureCostumScope.ts`](../src/modules/admin/lib/ensureCostumScope.ts)) — concerne le back-office 5 onglets |
| `VITE_SITE_PUBLIC_URL` (`be7a320c`) | Nouvelle variable de déploiement — cf. §8 ; sans elle, canonical/sitemap retombent sur `getServerUrl()` |

### Gates au 03/08 (rejoués sur `main`)

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 4 pages / 12 sections |
| `audit:config` | ✅ **0 constat** (RAS, thème complet) |
| `config:probe` | ✅ 2 périmètres, 2 OK — 693 résultats chacun |
| `typecheck` (`tsc -b`) | ✅ |
| `test:preflight` | ✅ 22 fichiers / 412 tests |

---

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Slug + CSS dans `sites.json` | ✅ | `cyberReunion` → `index-cyber-reunion` |
| 2 | Thème + mode sombre | ✅ | Bloc `theme` complet, 51 variables — mode sombre traité le 27/07 |
| 3 | Annuaire | ✅ | 693 acteurs, panneau à 2 filtres, un seul champ de recherche depuis le 27/07 |
| 4 | Cartographie | ✅ | `/mapping` — même périmètre |
| 5 | Membres | ✅ | Section `member` avec rôles et gestion |
| 6 | Référencement d'une structure | ✅ | Formulaire costum 19 champs + bouton flottant — réseaux sociaux réparés le 30/07 (`5ae354d2`, descripteur vérifié compilé et rendu ; saisie réelle en navigateur restant à voir, cf. §13 question 6) |
| 7 | Back-office | ✅ | 5 onglets dont « Fiches à valider » (modération a priori) |
| 8 | Socle légal | ✅ | Délégué à `www.cyber-reunion.fr` (mentions légales, cookies) |
| 9 | QR code flottant | ❌ | **Encode `https://test.com`** — cf. §13 |
| 10 | Rendu navigateur | 🟡 | Home et `/annuaire` vus le 27/07 ; `/mapping` et `/membres` jamais |
| 11 | Mode sombre | 🟡 | Traité le 27/07 sur la home ; les 3 autres pages non vérifiées |

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

Aucune demande spécifique à ce projet.

| Fait | État | Preuve |
|---|---|---|
| SDK **1.0.172 publiée sur npm** (`package.json` → `^1.0.172`) — fin de l'installation par `npm pack` local | ✅ 03/08 | Commit `09e145a0` ; `node_modules/@communecter/cocolight-api-client/package.json` → `1.0.172` |
| Pose du scope costum côté admin (`setCostumScope`) réglée par la 1.0.172 | ✅ | [`../src/modules/admin/lib/ensureCostumScope.ts`](../src/modules/admin/lib/ensureCostumScope.ts) — concerne le back-office de ce site |

---

## 12. Points d'attention / limitations

- ⚠️ **Formulaire costum en format PLAT** (cf. §4.2) — seul cas du parc. Tout outil de comptage ou
  de vérification des champs doit lire `section.fields` **et** `section.groups[].fields`. Le piège
  s'est **réalisé** le 30/07 (`5ae354d2`) : un renommage limité à `groups[].fields` a laissé ici une
  référence orpheline, que ni `config:validate` ni les préflight ne détectent — aucun outil ne
  vérifie qu'une référence de section pointe un champ déclaré.
- ⚠️ **`editSocial` est un widget « User uniquement »** : sur toute autre collection il rend neuf
  saisies reliées à rien. Pour une organisation, employer le patron `fieldArray` +
  `path: socialNetwork` (référence : config tiers-lieux) — c'est le correctif du 30/07.
- **Deux voies de filtrage qui ne se parlent pas** : ce site emploie le PANNEAU. Ne jamais y ajouter
  un `showSearch` de hero — c'est le défaut corrigé le 27/07.
- **`cardCountCT` élargit son périmètre par défaut** : mesuré à 2 588 au lieu de 693 sur les
  données de ce site (message du commit `c8cb2ba9`). La section n'est **pas dans la config**
  (vérifié le 03/08) — si on l'ajoute un jour, poser `scope: "costum"` d'emblée.
- Config JSON **jamais parsée par Zod au runtime** : toute clé doit être écrite explicitement.
- Le site institutionnel `www.cyber-reunion.fr` porte une partie de l'expérience (diagnostic,
  urgence cyber, mentions légales) : toute évolution doit rester cohérente avec lui.

---

## 13. Évolutions à prévoir & questions en attente

| # | Question | Responsable |
|---|---|---|
| 1 | **Le QR code flottant encode `https://test.com`** — valeur d'essai laissée en production. Quelle URL doit-il porter ? | Cyber Réunion / Thomas |
| 2 | **Cinq des huit appels à l'action de la home mènent à `/annuaire`** : « Soumettre une initiative », « Participer », « Co-financer », « Découvrir les projets », « Devenir prestataire ». Cinq promesses distinctes, une seule destination — et aucune ne fait ce qu'elle annonce. Les trois autres pointent tous vers la même page de `cyber-reunion.fr`. À revoir | Thomas |
| 3 | Faut-il un compteur `cardCountCT` sur la home ? La section n'y a **jamais figuré** (vérifié le 03/08) ; si oui, la poser avec `scope: "costum"` pour annoncer 693 et non 2 588 (cf. §12) | Thomas |
| 4 | `/mapping` et `/annuaire` servent **exactement le même périmètre** (693, re-sondé le 03/08). Est-ce voulu — deux vues d'un même ensemble, comme sur tiers-lieux — ou faut-il différencier ? | Thomas |
| 5 | `/mapping` et `/membres` : rendu navigateur et mode sombre jamais vérifiés | Thomas |
| 6 | Saisie réelle des **réseaux sociaux** via « Référencer ma structure » à revalider en navigateur depuis le correctif du 30/07 (`5ae354d2`) | Thomas |
| 7 | `VITE_SITE_PUBLIC_URL=https://cyber-reunion.00.re` à poser au déploiement Coolify (cf. §8) — sans elle, canonical/sitemap retombent sur `getServerUrl()` | Thomas |
