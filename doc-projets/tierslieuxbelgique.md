# Tiers-lieux Belgique — document de travail

[Projets](README.md) · [Documentation technique](../doc/README.md)

> Document de travail partagé, à tenir à jour. Mémoire : `[[project-tierslieuxbelgique]]`.

Dernière mise à jour : **12/11/2026**.

## 1. Contexte

Créer un site SiteForge pour le réseau belge, inspiré de tiers-lieux.org et de
[tierslieux.xyz](https://www.tierslieux.xyz/). L'utilisateur a confirmé l'entité
`tierslieuxbelgique`, le français et un premier périmètre adapté.
Branche : `tiers-lieux-xyz-belgique`. Porteur : organisation « Tiers Lieux Belgique ».

## 2. Objectifs

Accueil, annuaire global, annuaire et carte des lieux, annuaires des accompagnants
et des membres, actualités, événements et présentation du réseau.

## 3. Architecture générale

SiteForge charge la configuration du slug `tierslieuxbelgique` ; les annuaires
et l'agenda interrogent le backend Communecter. L'annuaire des accompagnants
reprend les critères de rôle et de validation du site belge existant ; celui des
membres reprend le rattachement à l'organisation et exclut les invitations.

## 4. Cahier des charges

Première version en français ; identité inspirée du terracotta du site existant.
Logo et photographies restent à intégrer.

## 5. Modèle de données

Le 12/11/2026, `config:probe` a trouvé 38 organisations dans le périmètre de
l'annuaire des lieux, 20 résultats pour les accompagnants et 394 résultats dans
celui de l'agenda. Ces chiffres sont ponctuels et ne constituent pas forcément
des totaux ; les événements à venir restent à vérifier. Les actualités du
porteur ont été affichées en navigateur.
Le 12/11/2026, la sonde de l'annuaire des membres a trouvé 112 résultats et celle
de l'annuaire global 156 résultats.

## 6. Fichiers concernés

| Domaine | Fichier |
|---|---|
| Configuration | [config.prod.tierslieuxbelgique.json](../config.prod.tierslieuxbelgique.json) |
| Enregistrement | [sites.json](../sites.json) |
| Instantané préflight | [tierslieuxbelgique.json](../tests/preflight/__effective__/tierslieuxbelgique.json) |
| Correction du fil d'actualités | [NewsSection.tsx](../src/modules/news/components/sections/NewsSection.tsx) |
| Tests du fil | [NewsSection.test.tsx](../src/modules/news/components/sections/NewsSection.test.tsx) |

## 7. Choix techniques

Entité existante `tierslieuxbelgique` ; CSS partagé de tiers-lieux.org ;
palette propre en configuration. Pour les accompagnants, la recherche ne se
limite pas à `sourceKey` : elle reprend les rattachements, le rôle
`Accompagnant.e.s` et l'exclusion des profils en attente de validation de
tierslieux.xyz.

Les fiches d'organisations et le formulaire d'édition reprennent à l'identique
ceux de tiers-lieux.org, y compris les références aux formulaires de recensement
et de services de ce site. Les cartes de l'annuaire reprennent aussi ses options
d'affichage ; le périmètre de recherche belge reste inchangé.

Le menu reprend les rubriques du site belge existant. Les lieux, accompagnants,
nouvelles, acteurs et événements pointent vers les pages locales ; les rubriques qui ne
sont pas encore migrées ouvrent les pages ou services d'origine. Le header
`mega-menu` permet les sous-menus sur ordinateur et mobile.

L'annuaire `/communaute` utilise les cartes de profil de tiers-lieux.org et les
filtres `links.memberOf` / `isInviting` observés sur la page Acteurs belge ; sa
liste de compétences reprend celle des accompagnants.
Les fiches de personnes affichent leur champ `skills` lorsqu'il est renseigné,
grâce à la section générique `profile-fields` ; les fiches de lieux sont inchangées.

L'annuaire `/annuaire` reprend le périmètre de l'annuaire global de tierslieux.xyz,
avec une recherche commune et des cartes de présentation adaptées aux tiers-lieux. Une comparaison
des identifiants le 12/11/2026 y retrouve tous les résultats des trois annuaires
existants : 147 fiches distinctes, plus 9 autres fiches rattachées au réseau.
Ces chiffres et recouvrements sont susceptibles d'évoluer avec les données.
La colonne de filtres reprend le principe de tiers-lieux.org et les sept groupes
de la cartographie belge : typologies, réseaux, enjeux, milieu, mode de gestion,
transport et accessibilité. Les valeurs sont envoyées comme tags, combinés en ET
comme sur la cartographie source. Aucun filtre ne restreint l'annuaire par défaut.
Le contrôle « Ouvert maintenant » n'est pas encore implémenté : la source envoie
`openingHours=true`, paramètre non pris en charge par la recherche SiteForge actuelle.

## 8. Étapes de mise en place

Configuration initiale créée. Reste à confirmer le logo, les photos, les contenus
et les conditions de déploiement ; vérifier la carte sur un navigateur
disposant de WebGL.

## 9. Impacts des modifications

La configuration belge est distincte de celle de tiers-lieux.org. La validation
passe ; l'audit signale 89 traductions anglaises conservées dans les blocs
repris à l'identique alors que le site est configuré en français seul. Les trois
périmètres de recherche ont des résultats. L'accueil,
le fil d'actualités et l'annuaire des accompagnants ont été vérifiés en navigateur,
dont un filtre de compétence. Le correctif du fil est partagé avec les autres
sites ; ses tests ciblés et le typecheck passent. Le rendu SSR des cinq pages
initiales avait été vérifié avant l'ajout de l'annuaire. La fiche du lieu « La
Walcourtoisie » a été comparée en navigateur à celle de tiers-lieux.org ; les
tests de routage de l'édition et de configuration effective passent. L'édition
connectée n'a pas été vérifiée. Le nouvel annuaire et le filtre Leadership ont
été vus en navigateur. Le préflight global du 12/11/2026 présente huit échecs,
notamment sur des références de formulaires belges et des inventaires globaux.
L'annuaire global affiche des profils et des lieux ; la recherche de La
Walcourtoisie fonctionne. Les tests ciblés des règles de cartes passent.
Le champ de compétences a été vérifié sur la fiche de Dimitri Biot ; les tests
ciblés du profil passent. Les sept groupes de filtres ont été comparés aux
valeurs de la cartographie ; une combinaison incluant une virgule, son
rechargement et la réinitialisation ont été vérifiés en navigateur, ainsi que
le filtre Santé sur mobile. Le rendu SSR de huit pages et les tests ciblés passent.

## 10. Checklist d'avancement

| Élément | État | Détail |
|---|---|---|
| Configuration | ✅ | 8 pages, 18 sections |
| Données | 🟡 | Annuaires et agenda sondés ; actualités visibles |
| Identité | 🟡 | Palette posée ; logo et photos à intégrer |
| Navigation | 🟡 | Rubriques du site existant ; pages manquantes liées à la source |
| Préflight | 🟡 | Huit échecs sur des références belges et des contrôles globaux |
| Déploiement | ❌ | À définir |

## 11. Dépendances SDK

À confirmer pour les usages connectés ; aucun module d'administration activé.

## 12. Points d'attention

Les données de l'annuaire sont filtrées par le tag `TiersLieux` et la source du
réseau. Les données de services et de formulaires de la fiche dépendent des
réponses existantes dans les formulaires de tiers-lieux.org ; les vérifier pour
les lieux belges. Les compétences des accompagnants sont une liste fixe issue du site
existant : à synchroniser si celui-ci évolue. Les pages légales propres au site
et le consentement sont à définir avant déploiement. Aucun dossier d'images
dédié n'est déclaré pour l'instant.

## 13. Évolutions et questions

Valider le logo, les photos, les textes, le contact, les pages légales et les
fonctionnalités connectées avec le porteur du projet.
