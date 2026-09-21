[← Index des projets](README.md) · [← Doc technique](../doc/README.md)

# Projet Réseau KPA-Cité

> Document de travail du projet de configuration SiteForge, à tenir à jour avec l'état réel du dépôt.
>
> Voir aussi : [Module Search](../doc/07-module-search.md) · [Module formEngine](../doc/28-module-formengine.md)
> Mémoire : `[[project-kpacite]]`

Dernière mise à jour : **2026-09-21** — première configuration créée.

## 1. Contexte du projet

Le projet consiste à créer un site SiteForge pour le **Réseau KPA-Cité**, avec un annuaire des KPAs et un auto-diagnostic collectif.

| | |
|---|---|
| Site SiteForge | slug `kpacite` → [`config.prod.kpacite.json`](../config.prod.kpacite.json) |
| Entité | organisation Communecter « KPA-Cité », slug `kpacite` |
| Backend | `https://www.communecter.org` |
| CSS | `index-tiers-lieux` hérité de l'archétype |
| Branche | à confirmer |
| Formulaire | `69307ce54d830127904c6ee5` |

## 2. Objectifs de la configuration

- Présenter le Réseau KPA-Cité.
- Afficher l'annuaire des KPAs sur `/kpas`.
- Proposer le diagnostic collectif sur `/diagnostic-collectif`.
- Utiliser l'identité visuelle fournie : jaune, turquoise et rouge.

## 3. Architecture générale

Le site s'appuie sur SiteForge côté client, Communecter pour les données et le formulaire CoForm pour le diagnostic. L'annuaire interroge les organisations de la source `kpacite`.

## 4. Cahier des charges intégré

- Accueil avec deux accès directs : annuaire et diagnostic.
- Annuaire en grille responsive, cartes avec image et ouverture en panneau.
- Diagnostic en formulaire wizard avec progression et numéros d'étapes.

## 5. Modèle de données réel

Le probe du **2026-09-21** confirme **6 résultats** pour `sourceKey: ["kpacite"]`. Le formulaire est référencé par son identifiant CoForm fourni par le projet.

## 6. Fichiers concernés

| Domaine | Fichier |
|---|---|
| Configuration | [`config.prod.kpacite.json`](../config.prod.kpacite.json) |
| Déclaration du site | [`sites.json`](../sites.json) |
| Logo | [`public/images/kpacite/logo.svg`](../public/images/kpacite/logo.svg) |
| Documentation | [`doc-projets/kpacite.md`](kpacite.md) |

## 7. Choix techniques et justifications

- Archétype `navigatorDesTierslieux` pour réutiliser le chrome portail et le moteur d'annuaire.
- Section `searchProStatic` pour l'annuaire des organisations.
- Section `coform` avec le formulaire réel `69307ce54d830127904c6ee5`.
- Logo SVG local pour rendre immédiatement le header, le footer et le favicon.

## 8. Étapes de mise en place

1. Déposer ou remplacer le logo final dans `public/images/kpacite/` si nécessaire.
2. Tester avec `VITE_SLUG=kpacite npm run dev`.
3. Exécuter `config:render` et les tests navigateur avant déploiement.

## 9. Impacts des modifications

- Nouvelle entrée `kpacite` ajoutée à `sites.json`.
- Nouvelle configuration créée avec 3 pages et 6 sections.
- Nouveau logo local ajouté.

## 10. Checklist d'avancement

| Fonctionnalité | État | Détail |
|---|---|---|
| Configuration de base | ✅ | Validée par `config:validate` |
| Annuaire KPAs | ✅ | Probe : 6 résultats |
| Diagnostic collectif | ✅ | Formulaire configuré |
| Identité visuelle | ✅ | Couleurs et logo SVG en place |
| Rendu SSR | 🟡 | À vérifier |
| Déploiement | 🟡 | À planifier |

## 11. Dépendances SDK ↔ cocolight-api-client

Aucune demande spécifique identifiée pour cette première version.

## 12. Points d'attention / limitations

Le logo SVG est une version vectorielle locale du visuel fourni. Il peut être remplacé par le fichier de marque final sans modifier les composants, en conservant le chemin déclaré ou en mettant à jour les trois références de logo.

## 13. Évolutions à prévoir & questions en attente

- Confirmer le contenu éditorial de l'accueil.
- Confirmer les filtres supplémentaires souhaités dans l'annuaire.
- Confirmer la branche et le domaine de déploiement.
