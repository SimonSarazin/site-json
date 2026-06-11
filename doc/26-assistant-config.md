# Assistant de génération de config (Claude) — document de réflexion

> **Statut : exploration / design** (branche `feat/config-assistant`). Ce document
> ancre la réflexion dans l'existant du code ; il deviendra la doc du module quand
> l'implémentation sera décidée. Rien ici n'est encore implémenté.

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

### C. Skill Claude Code (zéro code dans le repo)
Une skill/commande qui connaît le schéma et travaille directement sur les
fichiers config (l'utilisateur = un dev avec Claude Code). Disponible
immédiatement, rien à maintenir — mais inaccessible aux éditeurs non-devs et
sans préversion intégrée.

**Elles ne s'excluent pas** : C est utilisable dès maintenant pour nous ; B est
la cible produit ; A devient un sous-produit de B (même backend, front en moins).

---

## Design de la boucle de génération (cœur du sujet)

**Ne jamais générer tout le config d'un coup.** Le JSON Schema des 68 sections
est volumineux et le contexte se dilue. Découper en étapes outillées :

1. **Interview** (modèle conversationnel) : type de site, langues, pages
   souhaitées, ton/couleurs → produit un *plan* (liste de pages + sections
   pressenties, choix `header.type`/`footer.type` parmi les noms de DESIGN).
2. **Génération par morceau**, chaque étape étant un tool dont
   l'`input_schema` est `z.toJSONSchema(<sous-schéma>)` :
   `meta` + `theme` → `header`/`footer` → puis **page par page**, chaque page
   limitée aux schémas des sections retenues par le plan (pas les 68).
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

| Risque | Garde-fou |
|---|---|
| Clé API côté client | Route serveur uniquement ; jamais de `VITE_ANTHROPIC_*` |
| JSON invalide malgré le tool schema (refinements) | Revalidation Zod systématique + boucle d'erreurs |
| Hallucination de chemins/images/liens | `audit-config` (liens morts) ; images via l'uploader existant ou banque du site |
| Schéma trop gros pour le contexte | Découpage par morceau + plan préalable ; sections limitées au plan |
| Coûts API | Cap de tours de correction ; modèle léger pour l'interview, fort pour la génération |
| AdminPanel sans contrôle d'accès (auth commentée, L208) | Dev-only aujourd'hui ; **à durcir avant toute exposition** (rôle admin + rate-limit sur `/api/assistant`) |
| XSS dans `html`/`markdown` générés | `normalizeSiteConfig` (DOMPurify) déjà sur le chemin |

---

## MVP proposé (phases)

- **Phase 0 — spike (1 fichier)** : script `scripts/assistant-spike.mjs` :
  prompt en argument → appel Claude (tool use avec `z.toJSONSchema(Page)`) →
  boucle de validation → écrit un config dérivé de `config.dev.json` → on
  juge la qualité réelle de génération avant d'investir dans l'UI.
- **Phase 1 — backend** : `POST /api/assistant` dans `dev-server.js`
  (clé server-side, orchestration interview/génération/validation, streaming
  des étapes).
- **Phase 2 — UI panel** : mode `assistant` dans le `View` union de
  l'AdminPanel : chat, diff lisible des changements proposés, préversion via
  `patch()`, garder/annuler, `highlightSection()`.
- **Phase 3 — durcissement** : auth/rôles, quotas, télémétrie de coût,
  éventuel passage prod (le panel est dev-only aujourd'hui — décision à part).

## Questions ouvertes (à trancher)

1. **Cible** : outil interne dev (A/C suffisent) ou éditeurs finaux (B) ?
2. **Périmètre v1** : génération from-scratch, édition incrémentale, ou les deux ?
   (l'incrémental est plus simple ET plus utile au quotidien)
3. **Modèle d'exécution** : API Anthropic directe (SDK `@anthropic-ai/sdk` côté
   serveur) vs Claude Agent SDK (si on veut des étapes agentiques : lire les
   configs existants, lancer audit-config lui-même…)
4. **Prod ou dev-only** : tant que l'AdminPanel est dev-only, l'assistant l'est
   aussi — l'amener en prod implique auth + facturation des appels.
