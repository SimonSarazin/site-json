# Assistant de génération de config (Claude) — document de réflexion

> **Statut : phases 0 et 1 livrées** (cf. « État d'avancement » ci-dessous) —
> l'outillage (`config:validate`, `config:schema`, `entity:slug`) et la skill
> `.claude/skills/config-assistant/SKILL.md` existent. Ce document reste la **note
> de conception et de justification** : il ancre la réflexion dans l'existant du
> code et documente les architectures écartées ; la doc d'usage, elle, vit dans
> SKILL.md.
>
> **Décisions prises** :
> - **Cible : les devs, avec Claude Code** → architecture **C** retenue (skill
>   dans le repo). Pas de clé API à gérer, pas de route serveur, pas de dep IA.
> - **Périmètre v1 : from-scratch ET édition incrémentale** — le from-scratch
>   n'est qu'une séquence d'éditions incrémentales pilotée par un plan.
> - Les architectures A (CLI API) et B (onglet AdminPanel) restent documentées
>   comme évolutions possibles ; l'outillage déterministe (validation, export
>   de schéma) est conçu pour être **réutilisable par B** plus tard.
>
> **État d'avancement** :
> - ✅ **Phase 0 (outillage)** : `scripts/validate-config.ts` (+ erreurs d'union
>   enrichies de la valeur reçue), `scripts/config-schema.ts` (sélecteurs
>   `sections`/`section:<type>`/`header`/`footer`/`theme`/`meta`/`auth`/`page`/
>   `profiles`/`root`), `scripts/entity-slug.ts` (`search`/`check` sans auth,
>   testés sur le backend réel ; `create` = point ouvert n°5). Exécution :
>   `tsx` (résout le TS + alias `@/`) ; alias npm `config:validate` /
>   `config:schema` / `entity:slug`.
> - ✅ **Phase 1 (skill + anti-dérive)** : `.claude/skills/config-assistant/SKILL.md`
>   (workflow, tables semi-stables, recettes modules, règles maison, thème,
>   protocole de maintenance) + test préflight
>   `tests/preflight/skill-integrity.test.ts` (croise les tables avec les enums
>   header/footer, `src/modules/`, l'outillage ; interdit les anciens noms).
> - Le point ouvert n°6 (sections nommées par site) est **résolu** : découplage
>   fait (renommage 753369a + dé-hardcoding hero-search f581520 /
>   hero-entity-banner 01909a9 + variants tonals 953db2e).
> - Le theming s'est simplifié depuis la rédaction : couleurs dans
>   `config.theme` (modèle prouvé sur equipements + famille rezo-la-mer,
>   90b5200) et effets génériques par défaut dans `src/styles/shared.css`
>   (462026a) — la skill encode ces règles.

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

- `src/types/site-schema.ts` (~2 376 lignes) : `SiteConfig` racine, `Header`,
  `Footer`, `Page`, et **77 sections** discriminées par
  `z.discriminatedUnion("type", […])` (`src/types/site-schema.ts:1530`).
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
  des **77 sections** pour le panel) fournissent la matière sémantique à injecter
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
| Qualité | `scripts/audit-config.ts` (`npm run audit:config`) : traductions manquantes, liens internes morts, thème incomplet | advisory (`--strict` → exit 1) |

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

**Ne jamais générer tout le config d'un coup.** Le JSON Schema de toutes les
sections réunies est volumineux et le contexte se dilue. Découper en étapes outillées :

1. **Interview** (modèle conversationnel) : type de site, langues, pages
   souhaitées, ton/couleurs → produit un *plan* (liste de pages + sections
   pressenties, choix `header.type`/`footer.type` parmi les noms de DESIGN).
2. **Génération par morceau** : `meta` + `theme` → `header`/`footer` → puis
   **page par page**, chaque page limitée aux schémas des sections retenues par
   le plan (pas l'intégralité du catalogue). La forme exacte de chaque morceau vient de
   `z.toJSONSchema(<sous-schéma>)` — consultée via `config-schema.ts` dans
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
- 2-3 **configs prod réels comme few-shots** (`sites.json` fait autorité : 20 slugs
  pour 15 configs, dont des familles réutilisées — ex. 6 communes sur le même config) ;
- les règles maison : `header.type`/`footer.type` = noms de design, jamais de
  site ; `LocalizedString` exige `fr` ; chemins internes existants.

**Édition incrémentale** (probablement le 80 % d'usage) : même mécanique mais
le tool reçoit la config actuelle + l'instruction, et ne retourne qu'un *patch*
(la page ou la section visée), jamais le document entier.

---

## Risques & garde-fous

| Risque | Garde-fou | Concerne |
|---|---|---|
| JSON invalide (refinements non représentables en JSON Schema) | Revalidation Zod systématique (`validate-config.ts`) + boucle d'erreurs | C + B |
| Hallucination de chemins/images/liens | `audit-config` (liens morts) ; règle « pas d'URL inventée » dans SKILL.md | C + B |
| Schéma trop gros pour le contexte | Découpage par morceau + plan préalable ; `config-schema.ts` cible le morceau | C + B |
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
├── validate-config.ts # Zod parse d'UN fichier config → erreurs lisibles, exit code
├── config-schema.ts   # imprime le JSON Schema d'un sous-schéma (z.toJSONSchema)
└── entity-slug.ts     # recherche/vérifie un slug d'entité Cocolight (cf. § Slug)
```

Ces trois scripts sont **déterministes, sans IA, sans dépendance nouvelle** —
c'est l'outillage que la skill appelle, et qu'un futur backend B réutiliserait
tel quel.

- **`validate-config.ts <fichier>`** — charge `SiteConfig` (le vrai schéma,
  refinements inclus) et `parse()` le fichier ; sortie : erreurs Zod formatées
  par chemin (`pages[2].sections[0].props.title : fr manquant`), exit 1 si
  invalide. C'est **l'outil de la boucle** : la skill l'exécute après chaque
  écriture et corrige jusqu'à vert. (Les preflight Vitest font ça mais sur
  *tous* les configs et via le runner — trop lent pour itérer.)
- **`config-schema.ts <sélecteur>`** — ex. `config-schema.ts section:pricing`
  ou `header` → imprime le JSON Schema (`z.toJSONSchema`, `unrepresentable:
  "any"`, `reused: "ref"`) du morceau demandé. Évite à la skill de relire les
  2 360 lignes de `site-schema.ts` pour connaître la forme exacte d'une section ;
  la sortie est compacte et exhaustive (enums, champs requis, défauts).
  ⚠️ **Un schéma partagé sort en `$ref`** : `CardConfSchema`, réutilisé par
  `list.card` ET `list.itemRules[].card`, n'apparaît qu'une fois en `$defs`, et
  le nœud qui le référence n'a **aucune** `properties`. Un lecteur de forme doit
  donc déréférencer — `derefJsonSchemaNode(node, root)`
  (`scripts/lib/config-blocks.ts`). Corollaire pour le registre de descriptions :
  décrire `list.itemRules[].card.type` écraserait `list.card.type`, les deux
  chemins désignant le même nœud ; on ne décrit que le dernier segment propre à
  chaque emplacement (`list.itemRules[].card`).

### Le workflow encodé dans SKILL.md

1. **Interview** (si from-scratch) : nom, langues, pages, ton/couleurs,
   features (recherche ? news ? coform ? cagnotte ?), assets disponibles
   (logo ? photos ?).
2. **Conception design** (cf. § Capacités de conception) : à partir de
   l'intention, proposer **2-3 directions argumentées** — archétype le plus
   proche parmi les configs existants, `header.type`/`footer.type` (avec leur
   identité visuelle), composition de pages section par section (via le
   catalogue), direction de thème. **L'utilisateur tranche avant de générer.**
3. **Slug** : vérifier/choisir le slug d'entité Cocolight (`entity-slug.ts` —
   cf. § Slug) ; c'est un prérequis dur, le site ne boote pas sans entité.
4. **Setup** : copier `config.dev.json` (ou le config archétype le plus proche)
   comme base ; entrée `sites.json` + CSS (`src/index-<slug>.css` créé ou
   réutilisé) ; dossier d'assets `public/images/<slug>/` (cf. § Assets).
5. **Génération par morceaux** : `meta`+`theme` → `header`/`footer` → page par
   page. Avant chaque morceau : `config-schema.ts` pour la forme exacte ;
   après : `validate-config.ts` → corriger les erreurs → re-valider.
6. **Garde-fous qualité** : `npm run audit:config` (liens morts, i18n, thème) ;
   `npm run test:preflight` en validation finale.
7. **Préversion live** : `VITE_SLUG=<slug> npm run dev` dans un terminal — le
   watcher (`fs.watchFile`, 500 ms) pousse chaque écriture au navigateur sans
   reload. Le dev garde le site ouvert à côté et voit chaque itération.
8. **Édition incrémentale** : même mécanique sans l'interview — localiser le
   morceau visé (page/section), `config-schema.ts` si besoin, patch minimal,
   valider, l'HMR montre le résultat.

### Capacités de conception (au-delà de la génération de JSON)

La skill n'est pas un sérialiseur : elle doit **concevoir**. Quatre capacités,
chacune adossée à des sources vérifiées dans le repo.

#### a) Réfléchir le design en fonction de la demande

La skill doit raisonner « intention → design » et proposer des directions
argumentées, pas choisir en silence. Matière à encoder dans SKILL.md :

**Identité visuelle des headers** (vérifiée dans `src/components/layout/header/`) :

| `header.type` | Identité | Champs spécifiques |
|---|---|---|
| `standard` | barre horizontale sticky, fond plein, dropdowns | `height` (sm/md/lg), `announcement` |
| `mega-menu` | méga-menu au survol en colonnes, bord bas arrondi | `nav[].megaMenu.width` |
| `transparent-scroll` | fixe, transparent sur le hero → opaque au scroll | `transparent`, `urgenceButton`, `ctaButton` |
| `minimal` | barre compacte, typo uppercase espacée | `logoTitle`, `logoIcon` |
| `underline-nav` | nav soulignée (indicateur animé), fond marqué | `piggyBank` (+ `utilities.piggyBank`), `urgenceButton`, `ctaButton` |
| `transparent-dark` | barre sombre fixe, transparente sur le hero seul | `logoTitle`, `entityLogoOverride`, `ctaButton` |

**Identité des footers** (idem `footer/`) :

| `footer.type` | Identité | Champs spécifiques |
|---|---|---|
| `rich` | newsletter + colonnes de liens + socials + copyright | `newsletter`, `columns[]`, `socials[]` |
| `minimal-centered` | logo centré + nav horizontale + légal | `columns[0].links`, `legalLinks` |
| `sidebar-columns` | sidebar (logo+description+socials) + grille de colonnes | `style: "plain"\|"card"`, `description` |
| `contact-partners` | bloc contact (icônes) + grille de logos partenaires | `contactSection.items[]`, `partners.logos[]`, `partners.title`, `partners.note` |

`partners.note` porte la **mention de financement** sous les logos. Un
cofinancement public s'accompagne d'une formulation imposée par le financeur
(dispositif, opérateur, cadre) que les seuls logos ne portent pas ; sans ce
champ elle finissait recopiée dans le `copyright`, où elle n'a rien à faire.
Exemple en production : `config.prod.institut-bleu.json` (FIM/DGAMPA, Année de
la mer, Région Réunion).

**Archétypes** parmi les configs réelles du parc (`sites.json` fait autorité) :
commune institutionnelle (`commune-transparente`, partagé par 6 communes,
header `transparent-dark`),
réseau/annuaire (`tiers-lieux`, `mega-menu` + recherche), sport/santé
(`sport-sante-bien-etre`, coform + POI), portfolio (`julie-pot-vin`,
`minimal`), équipements (`equipements-Sportifs`, `transparent-scroll` +
`contact-partners`). La conception démarre par « quel archétype est le plus
proche ? » puis ajuste.

**Thème** : `config.theme` (couleurs light/dark, typo) + le CSS de site
(`src/index-<slug>.css`, mappé par `sites.json`). Règles : tokens
**light ET dark** systématiques (cf. pièges corrigés en 06baffb), pas de
couleur en dur dans les sections — les tokens du thème.

#### b) Connaître chaque élément et module, et comment l'utiliser

Deux catalogues à exposer à la skill :

- **Sections** : `src/components/admin/section-meta.ts` — **77 sections** avec
  `label` + description française orientée intention (« Bannière principale
  avec titre, sous-titre et CTA »). C'est le menu de composition des pages ;
  `config-schema.ts section:<type>` donne ensuite la forme exacte des props.
- **Modules** : chaque module a des sections, des clés de config et des
  **prérequis backend**. Recette d'activation par module (à encoder, format
  « pour utiliser X, ajouter Y, prérequis Z ») :

| Module | Sections / surface | Clés JSON | Prérequis backend |
|---|---|---|---|
| **search** | `searchPro`, `searchProStatic`, `filters`, `searchHeader`, `cardCountCT`, `thematics` | `baseParams` (`sourceKey[]`, `defaultTypes[]`, `locality`), `list` (card/detailsMode/preview) | entité + données indexées (sourceKey) |
| **news** | `news` | `props.entitySlug`, `maxItems`, `showComments/Reactions` | entité avec fil d'actus |
| **coform** | routes `/coform` + sections form | réf. de formulaire | CoForm défini côté Communecter |
| **cagnotte** | `actions`, `finance`, `*-summary`, `cagnotte-layout` | `idProjet`, layouts | projet + Stripe/HelloAsso (`/api/helloasso/checkout-intent`) |
| **profil** | `/profil/:slug` + `member`, profile-header/info | `config.profiles` (tabs, editModal, addConfig) | types d'entités du backend |
| **auth** | `loginForm/registerForm/recoverPasswordForm` + `<AuthMenu>` | `config.auth` (variant, menu, SSO), `header.utilities.auth` | SSO/comptes Communecter |
| **notification** | cloche header + section `notifications` | `header.utilities.notifications` | notifications backend |
| **commandPalette** | palette ⌘K | `config.commandPalette`, `header.utilities.search` | — |
| **ampli** | routes ampli | `config.ampli` | campagne ampli |
| **interop** | pods Discourse/Mediawiki | clés interop | instances externes |

La skill doit refuser d'activer un module dont le prérequis backend n'est pas
confirmé par l'utilisateur (ex. pas de `searchPro` sans `sourceKey` réel).

#### c) Slug : rechercher un existant ou en créer un (lib Cocolight)

**Fait vérifié** : le slug de `sites.json`/`VITE_SLUG` sert à la fois à
résoudre config+CSS **et** à charger l'entité Cocolight au boot
(`apiClient.ts` L91-130 : `entitySlug(slug)` public ou `me.entityBySlug(slug)`
connecté). **Sans entité portant ce slug, le site ne démarre pas.** Le choix
du slug n'est donc pas cosmétique — c'est une liaison backend.

`scripts/entity-slug.ts` (l'api-client fonctionne côté Node — le SSR le
prouve ; `VITE_BASE_URL_BACKEND` requis) :

- `entity-slug.ts search <nom>` → candidats via `globalAutocomplete`
  (**sans auth**) : slug, type (Organization/Project), nom.
- `entity-slug.ts check <slug>` → l'entité existe ? (`entitySlug(slug)`) —
  utilisé aussi pour vérifier la disponibilité avant création.
- `entity-slug.ts create …` → **nécessite une authentification**
  (`addOrganization`/`addProject` de l'EndpointApi). Deux options : credentials
  en env local (pattern `.env.test` des e2e), ou guider l'utilisateur vers la
  création in-app (le module profil a déjà `AddOrganizationModal` /
  `useAddOrganization`). À trancher en phase d'implémentation.

#### d) Logo, favicon, images

Conventions vérifiées sur les configs du parc + `public/` :

- **Emplacement** : `public/images/<slug>/` (dossier par site — ex.
  `communeTransparente/logo.png`, `rezoLaMer/hero-ocean.jpg`).
- **Référencement** : chemin absolu `/images/<slug>/fichier.ext` (6 configs ;
  5 utilisent le relatif sans `/` — les deux marchent, **normaliser sur
  l'absolu**). `meta.favicon` : idem, ou `/favicon.ico`.
- **`logoIcon`** (header/footer) : nom d'icône Lucide (`"leaf"`) **ou** SVG
  inline — alternative légère quand il n'y a pas de logo bitmap.
- **Obtention des fichiers** : la skill a accès au filesystem → copier les
  fichiers fournis par l'utilisateur dans `public/images/<slug>/` (l'endpoint
  d'upload `POST /api/admin/upload-image` est l'équivalent pour le panel ;
  MIME acceptés : jpeg/png/gif/webp/svg/avif, 10 Mo max).
- **Jamais d'URL inventée** : image fournie, asset existant du site, banque du
  backend, ou rien (les sections tolèrent l'absence). URLs externes : penser à
  l'allowlist de l'optimiseur `/img` (`IMAGE_OPTIMIZER_ALLOWED_DOMAINS`).
- **Workflow assets** : demander à l'interview « avez-vous un logo / des
  photos ? » ; sinon proposer `logoIcon` Lucide + sections sans image, plutôt
  que des placeholders cassés.

### Règles maison à encoder dans la skill

- `header.type` / `footer.type` / `card.type` / `preview.type` = **noms de
  design, jamais de site** (doc/03, doc/07).
- `LocalizedString` : `fr` obligatoire ; toutes les langues de `meta.languages`
  souhaitées (audit-config le vérifie).
- Chemins internes : doivent exister dans `pages[].path` ou les routes de
  modules (`/profil`, `/login`, `/coform`…) — pas de chemin inventé.
- Images : pas d'URL inventée — assets existants du site, ou laisser vide.
- Sections : choisir dans le catalogue réel (descriptions dans
  `src/components/admin/section-meta.ts`) ; en cas de doute sur les props,
  `config-schema.ts section:<type>`.
- Familles de configs : pour un site « commune », partir de
  `config.prod.commune-transparente.json` (6 communes le partagent), etc.

### Ce que ce choix simplifie (vs A/B)

| Sujet | Avec la skill |
|---|---|
| Clé API | aucune (c'est la session Claude Code du dev) |
| Serveur | rien à ajouter ; dev-server inchangé |
| Deps | zéro nouvelle dépendance runtime |
| Préversion | dev-server existant (watcher + HMR) |
| Corrections manuelles | l'AdminPanel/ZodAutoForm reste dispo en parallèle |
| Évolution vers B | `validate-config.ts`/`config-schema.ts` deviennent le backend de validation du panel |

### Se maintenir à jour (résistance à la dérive)

Le risque n°1 d'une skill riche : **sa connaissance dérive du code** (le repo
vient d'en faire la démonstration — renommages `CardPoiSSBE→CardPoiAmenities`,
refactors headers/footers — qui ont périmé doc/07 et CLAUDE.md). Trois couches
de défense, par ordre de préférence :

**1. Dériver, ne jamais dupliquer (couche volatile).** Tout ce qui est
dérivable du code n'est PAS écrit dans SKILL.md — il est lu au moment de
l'usage :

| Connaissance | Source vivante (à l'invocation) |
|---|---|
| Types de header/footer/card/preview, enums | `config-schema.ts` → `z.toJSONSchema` du schéma **courant** |
| Liste + props de toutes les sections | `config-schema.ts sections` (membres de la discriminatedUnion) + `section-meta.ts` lu en direct |
| Modules disponibles + leurs sections | `src/modules/*/` (découverte `import.meta.glob` — listable par script) |
| Archétypes / configs existants | `sites.json` + `config.prod.*.json` lus en direct |
| Slugs d'entité | `entity-slug.ts` (backend interrogé en direct) |

→ Par construction, ces faits sont **toujours à jour** : la skill ne connaît pas
le *nombre* de sections, elle sait **où les lire**. (Corollaire pour ce document
et pour SKILL.md : le seul compte écrit à la main est celui de la forme
`**N sections**`, surveillé par `tests/preflight/section-meta.test.ts` ; tout
nombre écrit hors de cette forme dérive en silence — c'est ce qui est arrivé
ici, « 60+ », « 60 » et « 68 » ayant coexisté pour 75 sections réelles.)

**2. Vérifier ce qui doit rester écrit (couche semi-stable).** Les tables de
jugement (identité visuelle des designs, recettes d'activation des modules)
gagnent à être rédigées — mais elles doivent être **vérifiables** :

- Un garde-fou *doctor* — script dédié ou test préflight (même pattern que
  `config-integrity`) : croise les mentions de SKILL.md avec
  le code — chaque `header.type`/`footer.type` cité existe dans l'enum, chaque
  module cité existe dans `src/modules/`, chaque section citée est dans la
  discriminatedUnion. **Échec = la skill a dérivé** → le commit qui change le
  schéma casse le test et force la mise à jour de la skill (même discipline
  que la parité i18n fr/en déjà en place). *Retenu : le test préflight
  `tests/preflight/skill-integrity.test.ts`.*
- Dans SKILL.md, une consigne de défiance : *« en cas de contradiction entre
  cette skill et le code, le code a raison — vérifie via les scripts, puis
  propose une mise à jour de la skill »*.

**3. La skill se met à jour elle-même (boucle de maintenance).** C'est Claude
Code : la skill peut **éditer son propre SKILL.md**. Protocole encodé :
quand l'assistant détecte une dérive (doctor rouge, enum inconnu, section
disparue) ou qu'on lui demande (« mets-toi à jour »), il analyse les commits
récents touchant `site-schema.ts` / `src/modules/` / `section-meta.ts` /
`sites.json`, met à jour les tables semi-stables de SKILL.md, et committe la
mise à jour comme n'importe quel changement (relecture humaine au diff). La
même passe peut proposer la mise à jour de doc/26.

**Règle d'architecture qui en découle** : SKILL.md ne contient que (a) le
*workflow* et les *règles de jugement* — stables — et (b) les tables
semi-stables **couvertes par le doctor**. Jamais de liste d'enum, de props ou
de chemins recopiés à la main.

## Phases proposées

> Phases 0 et 1 livrées (cf. « État d'avancement » en tête) ; ce qui suit est le
> plan d'origine.

- **Phase 0 — outillage** : `scripts/validate-config.ts` +
  `scripts/config-schema.ts` + `scripts/entity-slug.ts` (search/check d'abord ;
  create si la question d'auth est tranchée). Petits, testables unitairement,
  utiles même sans l'assistant — ex. valider un config à la main.
- **Phase 1 — la skill** : `.claude/skills/config-assistant/SKILL.md` —
  workflow + capacités de conception (tables d'identité design, catalogue
  modules, règles assets/slug) **+ le garde-fou anti-dérive dès le départ**
  (test préflight `skill-integrity` : les mentions de
  SKILL.md existent dans le code) ; itérer sur des cas réels (1 site
  from-scratch + 3-4 éditions incrémentales sur les configs existants) et
  durcir les règles maison au fil des ratés.
- **Phase 2 — confort** : enrichir `section-meta.ts` de descriptions
  exploitables (ou `.describe()` dans les schémas — profite aussi au panel) ;
  éventuel `audit:config --file <x>` pour ne vérifier qu'un config.
- **Phase 3 (optionnelle, plus tard)** — passerelle vers B : exposer les mêmes
  scripts derrière `POST /api/assistant` + onglet panel pour éditeurs non-devs.

## Mode réparation : audit → corriger → améliorer (décidé)

L'audit (`scripts/audit-config.ts`, migré en TS) est le point d'entrée de la
réparation d'un config existant. Décisions prises :

- **Nouvelles catégories** (en plus de trad/liens/locales/theme/orphelines) :
  `asset-manquant` (fichier absent de public/), `cle-strippee` (clé inconnue du
  schéma, ignorée par Zod — révélateur de config mort OU de trou de schéma ;
  44 trouvées au premier passage), `module-prereq` (searchPro/Static sans
  baseParams ; news.entitySlug et cagnotte.idProjet écartés — replis
  contextuels légitimes).
- **Sortie structurée** : chaque constat = `{category, path, message,
  severity, fixability}` ; `--json` pour l'assistant/CI ; `--file <x>` pour un
  seul config.
- **Fixabilité** pilote le flux : `auto` (lot mécanique) · `proposer` (choix
  humain) · `suggestion` (opt-in). Lots = commits relisibles, ordre schéma →
  assets/liens → clés mortes → i18n → améliorations, `config:validate` entre
  chaque.
- **Constats assumés** : `.audit-baseline.json` versionné à la racine, clé par
  fichier de config, entrées `{category, path}` — exclus de `--strict`.
- **Traductions** : écrites directement par l'assistant, en lot séparé relu au
  diff.
- Workflow encodé dans la skill (§ « Mode réparation »).

## Points de design restant à trancher

1. **Skill vs slash command** : une *skill* (`.claude/skills/`, auto-invocable
   quand le sujet s'y prête) ou une *commande* explicite (`/config-assistant`) ?
   Reco : skill avec description précise — l'invocation reste naturelle
   (« ajoute une page contact au site rezo-la-mer »).
2. **Granularité de `config-schema.ts`** : sélecteurs à supporter
   (`section:<type>`, `header`, `footer`, `theme`, `meta`, `page`) — et faut-il
   un mode « liste des types de section + résumé une ligne » pour le plan ?
3. **`.describe()` dans les schémas** : investissement transversal (profite à
   la skill, au panel, à la doc) mais ~2 000 lignes à annoter — incrémental ?
4. **Création du CSS de thème** : la skill peut copier/adapter un
   `src/index-<site>.css` existant, mais le theming fin (tokens light/dark)
   mérite ses propres règles dans SKILL.md (cf. les pièges teal-light/dark
   corrigés en 06baffb).
5. **Création d'entité (slug)** : `entity-slug.ts create` exige une auth —
   credentials en env local (pattern `.env.test`) ou renvoi vers la création
   in-app (`AddOrganizationModal`) ? Search/check (sans auth) sont eux
   tranchés et suffisent à démarrer.
6. **Sections encore nommées par site** (`hero-rezo-la-mer`,
   `hero-tiers-lieux`…) : la skill doit-elle les éviter au profit des
   génériques pour les nouveaux sites (reco : oui), en attendant leur
   éventuel découplage (même chantier que les cartes search) ?
