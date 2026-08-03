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

Dernière mise à jour : **2026-07-28** (création du dossier — état des lieux).

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
| SDK | `@communecter/cocolight-api-client` **1.0.169** |
| Historique | **62 commits** |

### Historique des chantiers

| Date | Intervenant | Chantier |
|---|---|---|
| — → 29/06 | Thomas | Construction de la config ; dernier passage sur le fichier le 2026-06-29 |
| 28/07 | Claude | État des lieux, création de ce dossier |

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
| `/communaute` | `searchHeader` + `tabs` (citoyens / organisations) | **0** — les deux onglets sont vides |

### 4.3 Ce que la config n'a pas

Ni `costumForms`, ni `admin`, ni `floatingActionButton`, ni `commandPalette` : **10 clés racine**
seulement. Aucun moyen, depuis le site, d'ajouter un projet ou de rejoindre la communauté.

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

---

## 9. Impacts des modifications

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
| 6 | `/communaute` | ❌ | **0 entité** sur les deux onglets |
| 7 | Contribution depuis le site | ❌ | Ni formulaire costum, ni bouton d'ajout, ni back-office |
| 8 | Socle légal | 🟡 | **Délégué à l'ADEME** — accessibilité, données personnelles et cookies renvoient vers `xd.ademe.fr`. Seules les **mentions légales** ne sont liées nulle part |
| 9 | Rendu navigateur | ❌ | Jamais vérifié |
| 10 | Mode sombre | ❌ | Jamais vérifié |

---

## 11. Dépendances SDK ↔ `cocolight-api-client`

Aucune demande en cours.

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
- Config JSON **jamais parsée par Zod au runtime** : toute clé doit être écrite explicitement.

---

## 13. Évolutions à prévoir & questions en attente

| # | Question | Responsable |
|---|---|---|
| 1 | **Purger les 4 saisies au clavier** (« Qcsqcqsc », « hbrhnrhn », « qscqsc », « qscqscqscqsc ») : elles s'affichent en production sur `/projets` et `/agenda` | ADEME / Thomas |
| 2 | **Le costum sera-t-il alimenté ?** Sans projets ni acteurs réels, les trois pages de données et les tuiles « participer » de l'accueil mènent au vide. À défaut, envisager de masquer ces pages et de garder la vitrine seule | Thomas |
| 3 | **Mentions légales** : le pied de page délègue accessibilité, données personnelles et cookies à `xd.ademe.fr`, mais rien ne renvoie aux mentions légales. Ajouter un lien vers celles de l'ADEME, ou une page propre au site | ADEME |
| 4 | Aucun moyen de contribuer depuis le site (ni formulaire, ni bouton d'ajout). Est-ce délibéré — vitrine institutionnelle — ou une étape non faite ? | Thomas |
| 5 | Rendu navigateur et mode sombre : jamais vérifiés | Thomas |
