# Docs de projet (configs de travail)

Espace **dédié aux documents de travail des projets de configuration** — distinct de la doc
technique/fonctionnelle du moteur ([`../doc/`](../doc/README.md)). Une page par **projet en cours**,
tenue à jour au fil des lots. Ces documents sont **partagés** entre les intervenants d'un projet
(config, décisions, avancement, dépendances, impacts).

Le formalisme et la maintenance de ces pages sont pilotés par le skill
[`doc-projet`](../.claude/skills/doc-projet/SKILL.md).

## Projets

| Projet | Slug | Doc | État |
|---|---|---|---|
| Réseau Parentalité 62 | `parent62` | [parent62.md](parent62.md) | Partie 1 en cours — moteur de recherche complété (25/07) ; **déploiement à faire** |
| Institut Bleu — économie bleue (La Réunion) | `institutBleu` | [institut-bleu.md](institut-bleu.md) | Portage du costum legacy — lots 0-2 faits (annuaire · cartographie · agenda) ; fiche acteur, formulaire acteur et back-office à venir |

## Pourquoi un répertoire séparé de `doc/`

- `doc/NN-*.md` documente le **moteur SiteForge** (features réutilisables, evergreen, numérotées).
- `doc-projets/<slug>.md` documente **un client/config précis** (CDC intégré, données réelles,
  avancement, blocages) — un genre différent, vivant, propre à chaque prestation.

Séparer évite les collisions de numérotation et garde une frontière nette « moteur » vs « projet ».

## Articulation avec la mémoire et les plans

- **Mémoire** (`.claude/memory/project-<slug>.md`) : décisions/pourquoi/pièges, **terse**, interne.
- **Plans** (`.claude/plans/plan-<slug>-*.md`) : plans de tâche approuvés, **ponctuels**.
- **Doc de projet** (ici) : le dossier **partageable**, source de vérité lisible par l'équipe.

La doc de projet **référence** mémoire et plans (liens `[[project-<slug>]]`), sans les dupliquer.
