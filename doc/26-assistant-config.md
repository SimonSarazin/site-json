# Assistant de génération de config (Claude) — document de réflexion

> **Statut : exploration / design** (branche `feat/config-assistant`). Ce document
> ancre la réflexion dans l'existant du code ; il deviendra la doc du module quand
> l'implémentation sera décidée. Rien ici n'est encore implémenté.
>
> **Décisions prises** :
> - **Cible : les devs, avec Claude Code** → architecture **C** retenue (skill
>   dans le repo). Pas de clé API à gérer, pas de route serveur, pas de dep IA.
> - **Périmètre v1 : from-scratch ET édition incrémentale** — le from-scratch
>   n'est qu'une séquence d'éditions incrémentales pilotée par un plan.
> - Les architectures A (CLI API) et B (onglet AdminPanel) restent documentées
>   comme évolutions possibles ; l'outillage déterministe (validation, export
>   de schéma) est conçu pour être **réutilisable par B** plus tard.

## Objectif

Un assistant conversationnel qui **génère et édite la config JSON d'un site**
(SiteForge étant 100 % JSON-driven) en s'appuyant sur Claude : « crée-moi un
site pour une association de surf à Saint-Pierre avec une page d'accueil, une
page événements et un formulaire de contact » → config valide, prévisualisée
en live, éditable par itérations (« ajoute une FAQ », « passe le thème en bleu
océan »).

---

## Ce que le code offre déjà (vérifié)

L'idée est étonnamment peu coûteuse parce que **les quatre briques dures existent déjà** :

### 1. Le schéma Zod est la source de vérité… et il est exportable en JSON Schema

- `src/types/site-schema.ts` (~2 030 lignes) : `SiteConfig` racine, `Header`,
  `Footer`, `Page`, et **68 sections** discriminées par
  `z.discriminatedUnion("type", […])` (L1325).
- **zod 4.1.13 fournit `z.toJSONSchema()` natif** (vérifié sur place : il
  fonctionne sur nos schémas). On peut donc produire, à la volée ou au build,
  le JSON Schema de n'importe quel morceau (une section, le header, le theme…)
  et le donner à Claude comme `input_schema` d'un tool → **génération contrainte
  par construction**, pas seulement « espérée valide ».
- Limites connues : les `.refine()`/`.check()` (ex. `LocalizedString` exige
  `fr` ; unicité des `path` de pages) ne sont **pas représentables** en JSON
  Schema → option `unrepresentable: "any"` + **revalidation systématique avec
  le vrai schéma Zod côté serveur** (boucle d'erreurs, cf. plus bas).
- Les schémas n'ont **aucun `.describe()`** aujourd'hui — mais les commentaires
  français du fichier et `src/components/admin/section-meta.ts` (métadonnées
  des 60+ sections pour le panel) fournissent la matière sémantique à injecter
  dans le prompt système.

### 2. Un AdminPanel existe, avec auto-formulaires Zod et persistance câblée

- `src/components/admin/AdminPanel.tsx` (1 028 lignes, **dev-only** —
  `import.meta.env.DEV` dans `RootLayout`) : 10 modes d'édition (pages,
  sections, header, footer, settings…), drag-and-drop (`@dnd-kit`),
  **`ZodAutoForm`** qui génère un formulaire depuis n'importe quel schéma Zod
  (LocalizedString, image, icône, code, enum, array, objets imbriqués).
- Hooks déjà exposés : `useSite()` (lire), `patch()` (modifier en mémoire →
  **préversion immédiate**), `saveConfig()` (persister), `highlightSection()`
  (feedback visuel sur la page).
- L'assistant peut donc être **un mode de plus** dans le `View` union du panel,
  réutilisant tel quel patch/save/highlight.

### 3. La boucle de persistance + préversion live est déjà bidirectionnelle

- **Client → serveur** : message WS `config-save` (AdminPanel L332) →
  `dev-server.js` L121-128 → `fs.writeFileSync(SITE_CONFIG_PATH)`.
- **Serveur → clients** : `fs.watchFile` (500 ms) → `normalizeSiteConfig`
  (sanitization DOMPurify) → WS `config-update` → `entry-client.tsx` met à jour
  `window.__CONFIG__` + `CustomEvent('site-config-update')` → **le site se met
  à jour sans reload**.
- Autrement dit : *l'assistant écrit la config, l'utilisateur voit le site
  changer en direct*. C'est le différenciateur UX, et il est gratuit.

### 4. La validation multi-niveaux existe

| Niveau | Outil | Bloquant |
|---|---|---|
| Schéma | `SiteConfig.parse()` (Zod) | oui |
| Intégrité | `tests/preflight/` (sites-configs, config-integrity) | oui |
| Qualité | `scripts/audit-config.mjs` (`npm run audit:config`) : traductions manquantes, liens internes morts, thème incomplet | advisory (`--strict` → exit 1) |

→ La **boucle de correction** de l'assistant est triviale : générer → `parse()`
→ renvoyer les erreurs Zod (messages français inclus) à Claude → régénérer,
puis `audit:config` en garde-fou qualité (liens morts, i18n).

### Côté intégration API

- **Aucune dépendance IA** aujourd'hui ; serveur Express extensible (il existe
  déjà des POST : `/api/admin/upload-image` dev-only, `/api/helloasso/checkout-intent`).
- Convention secrets : les `VITE_*` sont exposés client ; une
  **`ANTHROPIC_API_KEY` doit rester server-side** (route Express qui proxy
  l'appel Claude — la clé ne touche jamais le navigateur).

---

## Architectures candidates

### A. Outil dev en CLI (`npm run assistant`)
Interview en terminal → écrit `config.X.json` → le watcher HMR rafraîchit le
site ouvert à côté. Léger, clé API en env local, zéro surface serveur.
*Mais* : UX pauvre (pas de diff visuel, pas de highlight), réservé aux devs.

### B. Onglet « Assistant » dans l'AdminPanel ⭐ recommandé
Chat dans le panel + route `POST /api/assistant` (dev-server d'abord) qui porte
la clé et orchestre la boucle générer/valider. Réutilise **tout** : `ZodAutoForm`
pour ajuster à la main ce que l'IA propose, `patch()` pour la préversion
instantanée *avant* d'écrire, `config-save` pour persister, `highlightSection()`
pour montrer ce que l'assistant vient de changer.
Flux : prompt → propositions → **préversion live (patch en mémoire)** →
« garder / annuler / affiner » → save.

### C. Skill Claude Code ⭐ retenue
Une skill versionnée dans le repo (`.claude/skills/`) qui fait de Claude Code
l'assistant : elle encode le *workflow* (interview → plan → génération par
morceaux → validation → préversion) et s'appuie sur de petits **scripts
déterministes** (validation, export de schéma) plutôt que sur une intégration
API. L'utilisateur = un dev avec Claude Code ; la préversion live vient du
dev-server déjà en place (watcher + HMR).

**Elles ne s'excluent pas** : C est retenue pour la v1 ; B (onglet panel pour
éditeurs finaux) resterait possible plus tard **en réutilisant les mêmes
scripts** comme backend de validation ; A n'a plus d'intérêt propre.

---

## Design de la boucle de génération (cœur du sujet)

**Ne jamais générer tout le config d'un coup.** Le JSON Schema des 68 sections
est volumineux et le contexte se dilue. Découper en étapes outillées :

1. **Interview** (modèle conversationnel) : type de site, langues, pages
   souhaitées, ton/couleurs → produit un *plan* (liste de pages + sections
   pressenties, choix `header.type`/`footer.type` parmi les noms de DESIGN).
2. **Génération par morceau** : `meta` + `theme` → `header`/`footer` → puis
   **page par page**, chaque page limitée aux schémas des sections retenues par
   le plan (pas les 68). La forme exacte de chaque morceau vient de
   `z.toJSONSchema(<sous-schéma>)` — consultée via `config-schema.mjs` dans
   l'architecture C (skill), ou fournie comme `input_schema` d'un tool dans
   l'architecture B (API).
3. **Validation serveur après chaque morceau** : `parse()` Zod du sous-schéma
   réel (refinements inclus) ; en cas d'échec → erreurs renvoyées à Claude
   (elles sont déjà localisées et précises), max N tours.
4. **Assemblage + validation globale** (`SiteConfig.parse`) + `audit-config`
   (réutiliser ses fonctions de check, pas le process : liens morts, i18n).
5. **Préversion** : `patch()` en mémoire → l'utilisateur voit ; `config-save`
   seulement sur action explicite. Undo = garder le config précédent en mémoire.

**Contexte à injecter** (prompt système) :
- `section-meta.ts` (catalogue descriptif des sections, déjà rédigé pour le panel) ;
- 2-3 **configs prod réels comme few-shots** (il y en a 17, dont des familles
  réutilisées — ex. 8 communes sur le même config) ;
- les règles maison : `header.type`/`footer.type` = noms de design, jamais de
  site ; `LocalizedString` exige `fr` ; chemins internes existants.

**Édition incrémentale** (probablement le 80 % d'usage) : même mécanique mais
le tool reçoit la config actuelle + l'instruction, et ne retourne qu'un *patch*
(la page ou la section visée), jamais le document entier.

---

## Risques & garde-fous

| Risque | Garde-fou | Concerne |
|---|---|---|
| JSON invalide (refinements non représentables en JSON Schema) | Revalidation Zod systématique (`validate-config.mjs`) + boucle d'erreurs | C + B |
| Hallucination de chemins/images/liens | `audit-config` (liens morts) ; règle « pas d'URL inventée » dans SKILL.md | C + B |
| Schéma trop gros pour le contexte | Découpage par morceau + plan préalable ; `config-schema.mjs` cible le morceau | C + B |
| XSS dans `html`/`markdown` générés | `normalizeSiteConfig` (DOMPurify) déjà sur le chemin | C + B |
| Clé API côté client | Sans objet en C (session Claude Code) ; en B : route serveur uniquement, jamais de `VITE_ANTHROPIC_*` | B |
| Coûts API | Sans objet en C (compte du dev) ; en B : cap de tours, quotas | B |
| AdminPanel sans contrôle d'accès (auth commentée, L208) | Dev-only aujourd'hui ; **à durcir avant toute exposition** B | B |

---

## Design détaillé — la skill `config-assistant` (architecture C)

### Anatomie

```
.claude/skills/config-assistant/
├── SKILL.md            # workflow + règles maison + références (commité, partagé)
└── (références)        # pointeurs vers section-meta.ts, configs exemples, doc/

scripts/
├── validate-config.mjs # Zod parse d'UN fichier config → erreurs lisibles, exit code
└── config-schema.mjs   # imprime le JSON Schema d'un sous-schéma (z.toJSONSchema)
```

Les deux scripts sont **déterministes, sans IA, sans dépendance nouvelle** —
c'est l'outillage que la skill appelle, et qu'un futur backend B réutiliserait
tel quel.

- **`validate-config.mjs <fichier>`** — charge `SiteConfig` (le vrai schéma,
  refinements inclus) et `parse()` le fichier ; sortie : erreurs Zod formatées
  par chemin (`pages[2].sections[0].props.title : fr manquant`), exit 1 si
  invalide. C'est **l'outil de la boucle** : la skill l'exécute après chaque
  écriture et corrige jusqu'à vert. (Les preflight Vitest font ça mais sur
  *tous* les configs et via le runner — trop lent pour itérer.)
- **`config-schema.mjs <sélecteur>`** — ex. `config-schema.mjs section:pricing`
  ou `header` → imprime le JSON Schema (`z.toJSONSchema`, `unrepresentable:
  "any"`) du morceau demandé. Évite à la skill de relire les 2 030 lignes de
  `site-schema.ts` pour connaître la forme exacte d'une section ; la sortie est
  compacte et exhaustive (enums, champs requis, défauts).

### Le workflow encodé dans SKILL.md

1. **Interview** (si from-scratch) : nom/slug, langues, pages, ton/couleurs,
   features (recherche ? news ? coform ?) → écrire un **plan** court (pages +
   sections pressenties + `header.type`/`footer.type` choisis dans les noms de
   DESIGN).
2. **Setup** : copier `config.dev.json` (ou le config le plus proche parmi les
   17 — ex. famille « commune ») comme base ; ajouter l'entrée `sites.json` +
   CSS (créer `src/index-<slug>.css` ou réutiliser).
3. **Génération par morceaux** : `meta`+`theme` → `header`/`footer` → page par
   page. Avant chaque morceau : `config-schema.mjs` pour la forme exacte ;
   après : `validate-config.mjs` → corriger les erreurs → re-valider.
4. **Garde-fous qualité** : `npm run audit:config` (liens morts, i18n, thème) ;
   `npm run test:preflight` en validation finale.
5. **Préversion live** : `VITE_SLUG=<slug> npm run dev` dans un terminal — le
   watcher (`fs.watchFile`, 500 ms) pousse chaque écriture au navigateur sans
   reload. Le dev garde le site ouvert à côté et voit chaque itération.
6. **Édition incrémentale** : même mécanique sans l'interview — localiser le
   morceau visé (page/section), `config-schema.mjs` si besoin, patch minimal,
   valider, l'HMR montre le résultat.

### Règles maison à encoder dans la skill

- `header.type` / `footer.type` / `card.type` / `preview.type` = **noms de
  design, jamais de site** (doc/03, doc/07).
- `LocalizedString` : `fr` obligatoire ; toutes les langues de `meta.languages`
  souhaitées (audit-config le vérifie).
- Chemins internes : doivent exister dans `pages[].path` ou les routes de
  modules (`/profil`, `/login`, `/coform`…) — pas de chemin inventé.
- Images : pas d'URL inventée — assets existants du site, ou laisser vide.
- Sections : choisir dans le catalogue réel (68 types, descriptions dans
  `src/components/admin/section-meta.ts`) ; en cas de doute sur les props,
  `config-schema.mjs section:<type>`.
- Familles de configs : pour un site « commune », partir de
  `config.prod.commune-transparente.json` (8 communes le partagent), etc.

### Ce que ce choix simplifie (vs A/B)

| Sujet | Avec la skill |
|---|---|
| Clé API | aucune (c'est la session Claude Code du dev) |
| Serveur | rien à ajouter ; dev-server inchangé |
| Deps | zéro nouvelle dépendance runtime |
| Préversion | dev-server existant (watcher + HMR) |
| Corrections manuelles | l'AdminPanel/ZodAutoForm reste dispo en parallèle |
| Évolution vers B | `validate-config.mjs`/`config-schema.mjs` deviennent le backend de validation du panel |

## Phases proposées

- **Phase 0 — outillage** : `scripts/validate-config.mjs` +
  `scripts/config-schema.mjs` (petits, testables unitairement, utiles même sans
  l'assistant — ex. valider un config à la main).
- **Phase 1 — la skill** : `.claude/skills/config-assistant/SKILL.md` ;
  itérer sur des cas réels (1 site from-scratch + 3-4 éditions incrémentales
  sur les configs existants) et durcir les règles maison au fil des ratés.
- **Phase 2 — confort** : enrichir `section-meta.ts` de descriptions
  exploitables (ou `.describe()` dans les schémas — profite aussi au panel) ;
  éventuel `audit:config --file <x>` pour ne vérifier qu'un config.
- **Phase 3 (optionnelle, plus tard)** — passerelle vers B : exposer les mêmes
  scripts derrière `POST /api/assistant` + onglet panel pour éditeurs non-devs.

## Points de design restant à trancher

1. **Skill vs slash command** : une *skill* (`.claude/skills/`, auto-invocable
   quand le sujet s'y prête) ou une *commande* explicite (`/config-assistant`) ?
   Reco : skill avec description précise — l'invocation reste naturelle
   (« ajoute une page contact au site jardin-ocean »).
2. **Granularité de `config-schema.mjs`** : sélecteurs à supporter
   (`section:<type>`, `header`, `footer`, `theme`, `meta`, `page`) — et faut-il
   un mode « liste des types de section + résumé une ligne » pour le plan ?
3. **`.describe()` dans les schémas** : investissement transversal (profite à
   la skill, au panel, à la doc) mais ~2 000 lignes à annoter — incrémental ?
4. **Création du CSS de thème** : la skill peut copier/adapter un
   `src/index-<site>.css` existant, mais le theming fin (tokens light/dark)
   mérite ses propres règles dans SKILL.md (cf. les pièges teal-light/dark
   corrigés en 06baffb).
