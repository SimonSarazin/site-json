[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet eXtrême Défi — ADEME, mobilité du quotidien

> **Document de travail du projet de configuration.** Il consigne l'état réel de la config et le
> constat central de ce projet : **une vitrine éditoriale aboutie posée sur un costum vide**.
> **À tenir à jour à chaque lot livré**, selon le formalisme du skill
> [`doc-projet`](../.claude/skills/doc-projet/SKILL.md).
>
> Voir aussi : [Module Search](../doc/07-module-search.md) ·
> [Module Agenda](../doc/29-module-agenda.md) · [Schémas de sections](../doc/05-schemas-sections.md).
> Mémoire : `[[project-extreme-defi-ademe]]`.

Dernière mise à jour : **2026-08-03** (MR !30 « profile-tools » + suites de revue, SDK 1.0.172, test de déploiement réussi).

---

## 1. Contexte du projet

Programme de l'**ADEME** pour réinventer la mobilité du quotidien : concevoir, expérimenter et
industrialiser des **véhicules intermédiaires légers**.

Le site est **l'inverse exact de rezo-la-mer**. Là où rezo-la-mer a des données réelles et une
navigation qui promet des pages inexistantes, eXtrême Défi a une **page d'accueil éditoriale
soignée et complète** — argumentaire chiffré, manifeste, feuille de route, 47 logos partenaires —
mais ses trois pages de données sont **quasiment vides**.

L'audit ne peut pas le voir : `audit:config` vérifie les liens, les traductions et les assets, pas
le remplissage du costum. **0 constat, et pourtant deux pages sur quatre ne montrent rien.**

### Identité

| | |
|---|---|
| Slug | `eXtremeDefiAdeme` |
| Costum backend | `eXtremeDefiAdeme` — collection **`projects`** (« eXtrême Défi Ademe ») — 1 des 2 seuls du parc avec tiers-lieux |
| Config | [`../config.prod.eXtremeDefiAdeme.json`](../config.prod.eXtremeDefiAdeme.json) |
| CSS | [`../src/index-extreme-defi.css`](../src/index-extreme-defi.css) — propre au site |
| Langues | `fr` (défaut) + `en` · bloc `theme` **complet** |
| Header / Footer | `transparent-scroll` / `contact-partners` |
| SDK | `@communecter/cocolight-api-client` **1.0.172** — publiée sur npm (`^1.0.172`) |
| Déploiement | Coolify `site-json-extremedefi` · domaine `extremedefi.00.re` (cf. `sites.json`) |
| Historique | **65 commits** (`git log --follow`, au 2026-08-03) |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| — → 29/06 | Thomas | Construction de la config ; dernier passage sur le fichier le 2026-06-29 |
| 28/07 | Claude | État des lieux, création de ce dossier |
| 30/07 | Mirana | MR !30 « profile-tools » : section profil `profile-tools` + modal d'ajout après connexion (`656a7c05`, `d6af3da3`) |
| 03/08 | Thomas + Claude | Suites de revue MR !30 (`029da8cb`) ; SDK 1.0.172 ; **test de déploiement Coolify réussi** ; mise à jour de ce dossier |

---

## 2. Objectifs de la configuration

1. **Présenter le programme** : manifeste, argumentaire chiffré, démarche, feuille de route.
2. Donner à voir **l'écosystème** : 47 partenaires industriels et associatifs.
3. Exposer les **projets, l'agenda et la communauté** du défi — *aujourd'hui sans contenu*.

---

## 3. Architecture générale

```
                 ┌────────────────────────────────────────────┐
   Visiteur ───► │  SiteForge (site-json)                     │
                 │   4 pages · 14 sections                    │
                 │   /  ← 8 sections éditoriales RICHES       │
                 │   /projets /agenda /communaute ← VIDES     │
                 └──────────────┬─────────────────────────────┘
                                │ searchCostum
                 ┌──────────────▼─────────────────────────────┐
                 │  Backend Cocolight — eXtremeDefiAdeme      │
                 │  4 projets · 2 événements · 0 acteur       │
                 └────────────────────────────────────────────┘
```

Depuis le 30/07 (MR !30), la nav ne compte plus que 3 entrées (`/`, `/projets` — libellé
« Action collective » —, `/agenda`) : `/communaute` est **hors nav mais pas hors site** — la page
existe toujours et le CTA du header, un bouton du hero et une tuile « participer » y mènent encore.

---

## 4. Ce que la config met en œuvre

### 4.1 La page d'accueil — 8 sections, du vrai contenu

| Section | Contenu |
|---|---|
| `hero-parallax` | Image de fond, badges, CTA, indicateur de défilement |
| `cta` (« manifeste ») | Accroche + boutons |
| `stats` (« chiffres-clés ») | **6 arguments chiffrés et sourcés** — 10× moins coûteux (0,6-0,8 €/km pour une voiture), 10× plus durable (13 ans), 10× plus léger (1 240 kg de référence), 10× plus simple, 10× plus efficient (10-50 Wh/km), « 1× la vitesse qu'il faut » |
| `html` (« mission ») | 1 121 caractères de texte éditorial |
| `features-glass` (« démarche ») | Les étapes du programme |
| `timeline` (« saisons ») | **5 jalons datés** — 2022 « Rêvons la roue » · 2023 concepts et expérimentations · 2024 premières usines · 2025 industrialisation · 2026 maturation des marchés |
| `action-tiles` (« participer ») | 3 tuiles → `/projets`, `/communaute`, `/agenda` |
| `logoCloud` (« partenaires ») | **47 logos**, tous présents dans `public/images/eXtremeDefiAdeme/partners/` (vérifié fichier par fichier) |

C'est une vitrine soignée : l'argumentaire des « 10× » est rédigé, chiffré et bilingue.

### 4.2 Les trois pages de données

| Page | Sections | Contenu réel |
|---|---|---|
| `/projets` | `searchHeader` + `searchProStatic` | **4 projets** — cf. §5 |
| `/agenda` | `searchHeader` + `agenda` | **2 événements** — cf. §5 |
| `/communaute` | `searchHeader` + `tabs` (citoyens / organisations) | **0** — les deux onglets sont vides · **hors nav depuis le 30/07** (décision produit ; page conservée) |

### 4.3 Ce que la config n'a pas

Ni `costumForms`, ni `admin`, ni `floatingActionButton`, ni `commandPalette` : **10 clés racine**
seulement (dont `auth` et `profiles`).

En revanche — correction du constat du 28/07 — `/projets` et `/agenda` portent bien des boutons
d'ajout (`searchHeader.buttons`, `action: add-project` / `add-event`, présents depuis `2a16d07a`
du 2026-04-28) : réservés aux admins par défaut (donc invisibles des visiteurs), ils sont **ouverts
à tous depuis le 30/07** (`requiresAdmin: false`, `d6af3da3`) et enchaînent connexion → modal
d'ajout. Rien en revanche pour « rejoindre la communauté » (aucun parcours d'inscription citoyen).

Le pied de page `contact-partners` porte en revanche l'adresse de l'ADEME (Angers), 3 logos de
soutien, et **délègue le socle légal au site institutionnel** `xd.ademe.fr` (cf. §12).

---

## 5. Modèle de données réel (sondé le 2026-07-28)

`config:probe` — **4 périmètres, 2 peuplés, 2 vides**. Et le décompte par type, fait directement
sur le costum, est plus sévère encore :

| Type | Entités | Détail |
|---|---|---|
| `projects` | **4** | « Xtrem defi project », **« Qcsqcqsc »**, **« hbrhnrhn »**, **« qscqsc »** |
| `events` | **2** | « xTremDefi event », **« qscqscqscqsc »** |
| `citoyens` | **0** | → onglet « Communauté » vide |
| `organizations` | **0** | → onglet « Organisations » vide |
| `poi` | **0** | — |

> ⚠️ **Sur 6 entités au total, 4 sont des saisies au clavier** (« Qcsqcqsc », « hbrhnrhn »,
> « qscqsc », « qscqscqscqsc ») et les 2 autres portent des noms d'essai (« Xtrem defi project »,
> « xTremDefi event »). **Aucune entité authentique.**

Les pages `/projets` et `/agenda` affichent donc du bruit de saisie en production, et `/communaute`
n'affiche rien du tout — alors que la page d'accueil renvoie vers les trois par ses tuiles.

Cet écart est **invisible pour l'audit** : `audit:config` est statique et ne sonde pas les données.
Seul `config:probe` le révèle, et encore : il compte les résultats, il ne juge pas leur qualité.

---

## 6. Fichiers concernés

| Domaine | Fichiers |
|---|---|
| Config | [`../config.prod.eXtremeDefiAdeme.json`](../config.prod.eXtremeDefiAdeme.json) |
| Thème | [`../src/index-extreme-defi.css`](../src/index-extreme-defi.css) |
| Déclaration | [`../sites.json`](../sites.json) → `eXtremeDefiAdeme` |
| Logos partenaires | `../public/images/eXtremeDefiAdeme/partners/` — 47 fichiers |

---

## 7. Choix techniques et justifications

| Décision | Pourquoi |
|---|---|
| Argumentaire en section `stats` plutôt qu'en `html` | Les 6 « 10× » sont des données structurées (valeur, libellé, description) : la section les rend de façon homogène et bilingue, là où du HTML figerait la mise en forme |
| `timeline` pour la feuille de route | 5 jalons **réellement séquentiels** et datés (2022→2026) — c'est le cas d'usage où une timeline dit quelque chose de vrai plutôt que de décorer |
| Logos en fichiers **locaux** | Servis par `/img` (redimensionnement + avif/webp). Des logos externes seraient refusés par l'allowlist du middleware |

---

## 8. Étapes de mise en place

```bash
PORT=5246 VITE_SLUG=eXtremeDefiAdeme \
  SITE_CONFIG_PATH=config.prod.eXtremeDefiAdeme.json \
  SITE_CSS_PATH=src/index-extreme-defi.css \
  node server/dev-server.js

npm run config:validate -- config.prod.eXtremeDefiAdeme.json
npm run audit:config    -- --file config.prod.eXtremeDefiAdeme.json
npx tsx scripts/config-probe.ts config.prod.eXtremeDefiAdeme.json
```

### Déploiement (Coolify)

```bash
npm run deploy -- eXtremeDefiAdeme   # POST /deploy force:true sur l'app site-json-extremedefi
```

**Testé avec succès le 2026-08-03** : rebuild ~6 min, `NODE_ENV=production` vérifié dans le
conteneur. App Coolify `site-json-extremedefi`, domaine `extremedefi.00.re` (cf. `sites.json`).

### Variables d'environnement notables

| Variable | Rôle ici |
|---|---|
| `VITE_SITE_PUBLIC_URL` | **Nouvelle** (merge du 03/08, `be7a320c`) : URL publique du site-json lui-même — canonical, `og:url`/`og:image`, `sitemap.xml`, flux RSS. Lue par `getSitePublicUrl()` ([`../src/lib/constant/common.ts`](../src/lib/constant/common.ts)) et `server/lib/sitemap.js`. Dérivée par `deploy:env` depuis `sites.json` (`aliases[0]` prioritaire, sinon `domain`) — pas d'`aliases` pour ce site, donc `domain` = `extremedefi.00.re`. Repli `getServerUrl()` si absente (comportement historique) |
| `VITE_SERVER_URL` | **À ne pas confondre** : serveur communecter (images `/upload`, embed co2, cagnotte) — garde sa valeur parc |

---

## 9. Impacts des modifications

### 03/08 — Test de déploiement RÉUSSI

`npm run deploy -- eXtremeDefiAdeme` → POST `/deploy` `force: true` sur Coolify
(app `site-json-extremedefi`), rebuild ~6 min, `NODE_ENV=production` vérifié dans le conteneur.

### 03/08 — Moteur : merge `fix/institut-bleu-ui` + SDK 1.0.172 (`94251b7b`, `09e145a0`)

| Changement | Effet ici |
|---|---|
| SDK `1.0.172` **publiée sur npm** (fini le `npm pack` local) | Règle notamment la pose du scope costum côté admin (`setCostumScope`, cf. `../src/modules/admin/lib/ensureCostumScope.ts`) — **sans effet direct ici** : la config n'a pas de bloc `admin` |
| `VITE_SITE_PUBLIC_URL` (`be7a320c`) | URL publique propre au site pour canonical / og / sitemap / RSS — cf. §8 ; repli `getServerUrl()` tant qu'elle n'est pas posée |

Typecheck et preflight (22 fichiers / 412 tests) verts après le merge.

### 03/08 — Suites de revue MR !30 (`029da8cb`)

| Changement | Détail |
|---|---|
| `ProfileTabLayout` | Le `sticky` passe sur la **pile** de `rightSections`, plus sur chaque carte — deux cartes sticky sœurs se superposaient (cas inédit : les 218 `rightSections` du parc n'avaient qu'un élément) ; + gouttière `space-y-6` ; conditionné par `stackIsSticky` pour ne pas coller `actions-summary`/`finance-summary` |
| Archétype `profiles` | Snapshot régénéré (`config:example -- profiles --write`) : `profile-tools` entre dans l'exemple canonique servi à `config-assistant` |
| Config | Ligne à espaces (reliquat du retrait de l'entrée de nav) supprimée |
| doc/08 | Compteur de sections profil 19 → 21 (+ `profile-about-ssbe`, `profile-tools`) |

Non traité volontairement : le retrait de l'onglet de nav `/communaute` (décision produit) et les
libellés français en dur de `TOOLS_MAP` (préexistant — cf. §12).

### 30/07 — MR !30 « profile-tools » + modal d'ajout après connexion (`656a7c05`, `d6af3da3`)

| Changement | Détail |
|---|---|
| Nouvelle section profil `profile-tools` | Bloc « Nos outils » extrait de `ProfileTiersLieuxInfo` en composant autonome sans vocabulaire tiers-lieux (`ProfileTools.tsx`, namespace i18n `ProfileTools` fr/en) ; posé ici sur `profiles.projects`, onglet « À propos », `rightSections` avec `sticky: true` |
| Nav | « Projets » → « **Action collective** » ; onglet `/communaute` retiré. La page avait été supprimée par erreur puis **restaurée** (3 liens la référençaient encore : CTA header, hero, tuile « participer ») |
| Boutons d'ajout ouverts à tous | `requiresAdmin: false` sur `add-project` (`/projets`) et `add-event` (`/agenda`) — jusque-là réservés aux admins (défaut du composant `ActionButtonGroup` : `requiresAdmin !== false` ; le schéma le déclare `optional()` sans default) |
| Connexion → modal d'ajout | `ActionButtonGroup` : `openLogin({ onSuccess })` ouvre le modal d'ajout directement après la connexion réussie, au lieu de laisser le visiteur recliquer |

À revalider : parcours visiteur non connecté « Proposer un projet / un événement » (login → modal),
rendu de la carte outils sur un profil projet (sidebar à 2 cartes sticky — corrigée par `029da8cb`).

### Gates au 03/08

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 4 pages / 14 sections (relancé le 03/08) |
| `audit:config` | ✅ 0 constat (relancé le 03/08) |
| `typecheck` + `test:preflight` | ✅ après le merge du 03/08 (22 fichiers / 412 tests) |
| `config:probe` | 🟡 non resondé — dernier sondage le 28/07 (2 périmètres vides, cf. §5) |
| Déploiement | ✅ testé le 03/08 (cf. ci-dessus) |

### 28/07 — aucun changement de config

Le site a bénéficié de correctifs du moteur livrés pour d'autres projets :

| Correctif | Effet ici |
|---|---|
| `CardEvent` sans image (`0aed89c6`) | Ses 2 événements n'ont aucune image : ils passent sur la variante typographique au lieu d'une carte-affiche vide de 288 px |
| `useItem` → repli `profilImageUrl` (`0aed89c6`) | Aucun de ses événements ne porte ce champ : sans effet |
| `agenda.maxWidth` (`23cdbd94`) | Aucun — clé absente, `container` historique conservé |
| Garde d'authentification (`f24a6531`) | Aucun — la config n'ouvre aucune modale d'ajout |

### Gates au 28/07

| Gate | Résultat |
|---|---|
| `config:validate` | ✅ 4 pages / 14 sections |
| `audit:config` | ✅ **0 constat** — mais l'audit ne sonde pas les données (cf. §5) |
| `config:probe` | 🟡 4 périmètres — **2 OK, 2 vides** |

---

## 10. Checklist d'avancement

| # | Fonctionnalité | État | Détail |
|---|---|---|---|
| 1 | Slug + CSS dans `sites.json` | ✅ | `eXtremeDefiAdeme` → `index-extreme-defi` |
| 2 | Thème | ✅ | Bloc `theme` complet |
| 3 | Page d'accueil éditoriale | ✅ | 8 sections, argumentaire chiffré, feuille de route, 47 logos vérifiés |
| 4 | `/projets` | ❌ | 4 entités dont **3 saisies au clavier** |
| 5 | `/agenda` | ❌ | 2 événements dont **1 saisie au clavier** |
| 6 | `/communaute` | ❌ | **0 entité** sur les deux onglets — retirée de la nav le 30/07 (page conservée, 3 liens y mènent encore) |
| 7 | Contribution depuis le site | 🟡 | Boutons « Proposer un projet / un événement » **ouverts à tous depuis le 30/07** (`requiresAdmin: false`) + modal d'ajout enchaîné après connexion. Toujours ni `costumForms` ni back-office ; rien pour rejoindre la communauté |
| 8 | Socle légal | 🟡 | **Délégué à l'ADEME** — accessibilité, données personnelles et cookies renvoient vers `xd.ademe.fr`. Seules les **mentions légales** ne sont liées nulle part |
| 9 | Rendu navigateur | ❌ | Jamais vérifié |
| 10 | Mode sombre | ❌ | Jamais vérifié |
| 11 | Section profil `profile-tools` | ✅ | `profiles.projects` · onglet « À propos » · sidebar sticky (MR !30 + suites `029da8cb`) |
| 12 | Déploiement Coolify | ✅ | Testé le 03/08 : `npm run deploy -- eXtremeDefiAdeme`, rebuild ~6 min, `NODE_ENV=production` vérifié |

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

Aucune demande propre à ce projet. SDK aligné parc : **1.0.172 publiée sur npm**
(`package.json` → `^1.0.172`, commit `09e145a0` du 2026-08-03) — fini l'installation par
`npm pack` local.

---

## 12. Points d'attention / limitations

- ⚠️ **Le costum vit dans la collection `projects`**, comme tiers-lieux et contrairement aux 9 autres
  costums du parc résolus le 28/07. Un script qui suppose `organizations` se trompera.
- ⚠️ **Un audit vert ne dit rien du remplissage.** `audit:config` est statique : il vérifie liens,
  traductions et assets. Ce site en est la démonstration — 0 constat, et pourtant deux pages sur
  quatre sans contenu. Toujours croiser avec `config:probe`.
- **Le socle légal est DÉLÉGUÉ à l'ADEME**, et non absent : le pied de page renvoie vers
  `xd.ademe.fr/accessibilite`, `xd.ademe.fr/politique-de-protection-des-donnees` et
  `xd.ademe.fr/politique-des-cookies`. C'est un choix cohérent pour un programme institutionnel — le
  cadre juridique appartient à l'ADEME. **Seules les mentions légales ne sont liées nulle part** ;
  l'adresse de l'éditeur figure toutefois dans le bloc contact du pied de page (ADEME, 20 avenue du
  Grésillé, Angers).
- ⚠️ **`/communaute` est hors nav mais pas hors site** (depuis le 30/07) : le CTA du header, un
  bouton du hero et une tuile « participer » y mènent toujours (4 références dans la config). La
  page vide reste donc atteignable en un clic depuis l'accueil.
- Les libellés de `TOOLS_MAP` (carte « Nos outils » → section `profile-tools`) sont **en français
  en dur** alors que le site est fr/en — préexistant, signalé en revue MR !30, non traité
  volontairement (`029da8cb`).
- Config JSON **jamais parsée par Zod au runtime** : toute clé doit être écrite explicitement.

---

## 13. Évolutions à prévoir & questions en attente

| # | Question | Responsable |
|---|---|---|
| 1 | **Purger les 4 saisies au clavier** (« Qcsqcqsc », « hbrhnrhn », « qscqsc », « qscqscqscqsc ») : elles s'affichent en production sur `/projets` et `/agenda` | ADEME / Thomas |
| 2 | **Le costum sera-t-il alimenté ?** Sans projets ni acteurs réels, les trois pages de données et les tuiles « participer » de l'accueil mènent au vide. À défaut, envisager de masquer ces pages et de garder la vitrine seule | Thomas |
| 3 | **Mentions légales** : le pied de page délègue accessibilité, données personnelles et cookies à `xd.ademe.fr`, mais rien ne renvoie aux mentions légales. Ajouter un lien vers celles de l'ADEME, ou une page propre au site | ADEME |
| 4 | Contribution : **résolue en partie le 30/07** (boutons « Proposer » ouverts à tous + modal après connexion). Reste : aucun parcours pour rejoindre la communauté | Thomas |
| 5 | Rendu navigateur et mode sombre : jamais vérifiés | Thomas |
| 6 | `/communaute` hors nav (décision produit, `029da8cb`) mais **3 liens y mènent encore** (CTA header, hero, tuile « participer ») : retirer les liens ou réintégrer l'onglet ? | Thomas / ADEME |
| 7 | Traduire les libellés `TOOLS_MAP` (français en dur) pour la version anglaise du site | à confirmer |
