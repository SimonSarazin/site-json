---
name: doc-projet
description: Crée et maintient la doc de travail d'un projet de configuration SiteForge dans site-json/doc-projets/ (une page par projet en cours) selon un formalisme standard, partagée entre intervenants. À utiliser dès qu'on démarre, documente ou met à jour un projet de config (parent62-like), qu'on demande de refléter l'état réel du dépôt dans la doc projet, ou de créer/déplacer une doc de projet hors de doc/.
---

# Skill `doc-projet` — doc de travail d'un projet de config

Ce skill produit et tient à jour, pour **chaque projet de configuration** (un site `config.prod.<slug>.json`),
un **dossier de travail partageable** dans [`doc-projets/`](../../../doc-projets/README.md) — distinct
de la doc technique du moteur ([`doc/`](../../../doc/README.md)). Une page par projet en cours :
`doc-projets/<slug>.md`. Modèle de référence : [`doc-projets/parent62.md`](../../../doc-projets/parent62.md).

## Règle d'or : dériver, ne pas réciter

La doc projet **reflète l'état réel du dépôt**, elle ne le réinvente pas. Les faits volatils se
**lisent au runtime** avant d'écrire, jamais de mémoire :

| Fait à documenter | Le lire via |
|---|---|
| Pages / sections / nav du site | `config.prod.<slug>.json` (`npx tsx scripts/validate-config.ts config.prod.<slug>.json` donne le compte) |
| Formulaires costum | `config.prod.<slug>.json` → `costumForms{}` |
| Version du SDK | `node_modules/@communecter/cocolight-api-client/package.json` |
| Branche / merges / commits | `git -C site-json log --oneline`, `git branch -vv` |
| État des gates | `config:validate`, `audit:config`, `typecheck`, `lint`, `test:unit`, `build` (résultats réels) |
| Modèle de données | base locale **en lecture seule** (find/count/distinct/aggregate) — jamais d'écriture |

**Le code et la config font foi.** Si la doc contredit le dépôt, corriger la doc — jamais l'inverse.
Ne **jamais inventer** un chiffre, un chemin ou une décision : à défaut de preuve, écrire « à confirmer ».

## Emplacement & convention

- Un fichier par projet : `doc-projets/<slug>.md` (slug = celui de `config.prod.<slug>.json`).
- Index : `doc-projets/README.md` (tableau des projets en cours) — y ajouter une ligne par projet.
- Liens relatifs depuis `doc-projets/<slug>.md` : config = `../config.prod.<slug>.json`,
  code = `../src/…`, doc moteur = `../doc/NN-*.md`.
- **Ne pas** placer la doc projet dans `doc/` (réservé au moteur, numéroté) ni dans `.claude/`
  (outillage). La doc projet est un livrable **partagé** avec l'équipe.

## Formalisme standard (sections)

Créer/mettre à jour une page projet avec **ces sections**, dans cet ordre (cf. `parent62.md`) :

1. **En-tête** — retour index (`README.md`) + doc technique (`../doc/README.md`), blockquote
   « document de travail … à tenir à jour », « Voir aussi » (docs moteur liées), lien mémoire
   `[[project-<slug>]]`, **date de dernière mise à jour**.
2. **Contexte du projet** — le besoin, l'existant, l'objectif ; identité (slug, costum, orga,
   backend, SDK, branche, chef de projet) ; **historique des chantiers** (par intervenant, daté).
3. **Objectifs de la configuration** — ce que la config doit produire concrètement (liste).
4. **Architecture générale** — schéma des briques (WP ↔ backend ↔ SiteForge), voies de filtrage.
5. **Cahier des charges (intégré)** — constat, exigences par domaine, budget/phasage.
6. **Modèle de données réel** — périmètre (collections/compteurs), champs, encodage, costum backend.
7. **Fichiers concernés** — table domaine → fichiers (config, code, tests, déploiement).
8. **Choix techniques et justifications** — décision → pourquoi.
9. **Étapes de mise en place** — de la config au déploiement (variables d'env, DNS, build).
10. **Impacts des modifications** — pour chaque lot/merge notable : ce qui change, régressions à
    revalider, résultat des gates.
11. **Checklist d'avancement** — par partie/budget : #, fonctionnalité, état (✅/🟡/❌), détail.
12. **Dépendances SDK ↔ cocolight-api-client** — demandes, état, preuve/substitut.
13. **Points d'attention / limitations**.
14. **Évolutions à prévoir & questions en attente** — question → responsable.

Toutes les sections ne s'appliquent pas à tout projet ; garder l'ordre, marquer « — » ou « à venir »
si vide. Style : français, tables Markdown, états par emoji, chiffres **datés et sourcés**.

## Workflow

**Créer** une doc projet :
1. Lire la config du projet + l'état du dépôt (règle d'or).
2. Copier la trame des 14 sections ci-dessus ; remplir depuis les faits lus.
3. Ajouter la ligne dans `doc-projets/README.md`.
4. Créer/mettre à jour la mémoire `.claude/memory/project-<slug>.md` (décisions/pourquoi/pièges,
   **terse**) et son entrée dans `MEMORY.md` — **sans dupliquer** la doc.

**Mettre à jour** (« mets à jour la doc de <projet> ») :
1. Relire l'état réel (config, commits récents, gates).
2. Reporter les changements dans les sections concernées (surtout **Impacts**, **Checklist**,
   **Dépendances**, **Questions**).
3. Mettre à jour la **date** en en-tête.
4. Synchroniser la mémoire si une décision/piège nouveau est apparu.

## Articulation mémoire / plans / doc

- **Mémoire** (`.claude/memory/project-<slug>.md`) : le *pourquoi* et les pièges, interne, court.
- **Plans** (`.claude/plans/plan-<slug>-*.md`) : plans de tâche approuvés, ponctuels.
- **Doc projet** (`doc-projets/<slug>.md`) : le dossier *partageable*, source de vérité lisible.

La doc **référence** mémoire (`[[project-<slug>]]`) et plans, elle ne les recopie pas.

## Maintenance (anti-dérive)

- Si un chiffre/chemin/état de la doc ne correspond plus au dépôt, **mettre à jour la doc**, pas le
  dépôt. À la demande « mets-toi à jour », relire les commits récents touchant le projet et proposer
  un diff des sections concernées.
- Sur `git` : ce skill **n'exécute jamais** push/merge/rebase ni commit sans accord explicite — il
  recommande les commandes (cf. `CLAUDE.md` du monorepo).
- Base de données : **lecture seule** stricte pour dériver le modèle de données.
