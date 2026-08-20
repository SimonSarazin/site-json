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
| Institut Bleu — économie bleue (La Réunion) | `institutBleu` | [institut-bleu.md](institut-bleu.md) | Portage du costum legacy — lots 0→9 faits (annuaire · cartographie · agenda · fiche et formulaire acteur · pages éditoriales · back-office · auth · hooks backend · design). Restent les essais UI connectés, le build et le déploiement |
| Sport Santé Bien-être (La Réunion) | `sportSanteBienetre` | [sport-sante-bien-etre.md](sport-sante-bien-etre.md) | 19 pages · 6 formulaires costum · back-office 7 onglets. Audit 16 → 4 constats (28/07) ; **4 arbitrages de contenu en attente** (grille professionnels, hero /public) et rendu navigateur jamais vérifié |
| Ekilib.re — Maison Sport Santé du Tampon | `associationEkilibre` | [maison-sport-sante-la-tampon.md](maison-sport-sante-la-tampon.md) | Sous-site territorial du costum SSBE (CP 97430/97418). Vitrine + annuaires créneaux/structures ✅ (11 pages, audit 0 constat), fiche détail structure + back-office/KPIs CDC 4.2 commités le 06/08. **Actualités (CRUD POI, remplace News) ✅ opérationnelles le 19/08** — création réelle confirmée en base, photo comprise (§9.7 quater) ; cause racine du blocage trouvée et corrigée en base (`costum.slug` manquant sur l'organisation porteuse, hors `site-json`). Piste ouverte : la même cause pourrait débloquer `structure` en édition, à retester. Restent : MR `ekilibre`→`main`, contact cassé (`/api/contact`), déploiement |
| Rézo la mer (La Réunion) | `rezoLaMer` | [rezo-la-mer.md](rezo-la-mer.md) | **Portage arrêté en chemin** : 5 pages portées sur 14 au legacy, plus un module AAP de 21 pages jamais repris. 5 pages légales posées le 28/07 (à compléter). 14 liens morts et le cadrage de l'AAP en attente |
| Tiers-Lieux.org — réseau national | `navigatorDesTierslieux` | [tiers-lieux.md](tiers-lieux.md) | **Config aboutie** : 4 303 lieux, observatoire à 10 dimensions, panneau de filtres, formulaire costum, seul emploi du module `ampli`. 0 constat d'audit, 10/10 périmètres. État des lieux, pas de chantier en cours |
| eXtrême Défi — ADEME | `eXtremeDefiAdeme` | [extreme-defi-ademe.md](extreme-defi-ademe.md) | **Vitrine aboutie, costum vide** : accueil éditoriale riche (argumentaire chiffré, feuille de route, 47 partenaires) mais 4 projets dont 3 saisies au clavier, 0 acteur. Audit vert, 2 périmètres vides sur 4. Outils de profil (MR !30) livrés et **premier déploiement Coolify réussi le 03/08** |
| EDIH Cyber Réunion | `cyberReunion` | [cyber-reunion.md](cyber-reunion.md) | Annuaire de 693 acteurs, complément de `www.cyber-reunion.fr`. Refonte du 27/07 (home, footer, doublons de filtres), réseaux sociaux des formulaires réparés (`fieldArray`, 30/07). Audit vert, 2/2 périmètres. Reste : QR code de test, 5 CTA de home qui mènent tous au même endroit |
| RéseauSanté — Rézo Santé Réunion | `rezoSanteReunion` | [rezo-sante-reunion.md](rezo-sante-reunion.md) | **Config neuve (29/07)** : 14 pages, 41 sections, audit vert. Costum backend **créé le 30/07** (config minimale, §6bis) mais périmètres toujours vides → pages de recherche désertes tant que rien n'est peuplé. Feuille CSS propre + titres Fraunces (30/07), hero-carousel en **essai** sur /thematiques. Les 5 actions d'engagement demandées (like/partenaire/soutien/intéressé/réutilise) et le partenariat inter-orga **n'existent pas dans le produit** — chiffrage en 3 couches dans la doc |
| RELIEF — réseau des tiers-lieux d'Auvergne-Rhône-Alpes | `relief` | [relief.md](relief.md) | **Config neuve (12/08)**, dérivée de tiers-lieux avec retraits mesurés en base : 522 lieux au périmètre, observatoire 7 dimensions, agenda rattaché par `links.organizer` (hors périmètre), formulaire d'ajout gardé au périmètre. 1 constat d'audit (lien « Décider ensemble » en `#`). Entrée Coolify posée le 14/08 (`aura.00.re`) — **merge dans `main` et déploiement à faire** |
| Équipements sportifs — Région Réunion | `equipementsSportifs974` | [equipements-sportifs.md](equipements-sportifs.md) | **Config aboutie** : 3 052 équipements (RES), observatoire de référence à 13 dimensions, table brute `/data`, réservation de créneaux. Audit vert, 3/3 périmètres. Reste : marqueurs légaux à compléter (dupliqués avec saint-paul-sport) |
| Saint-Paul Sport — commune de Saint-Paul | `saintpaulSport1` | [saint-paul-sport.md](saint-paul-sport.md) | Déclinaison d'`equipementsSportifs974` scopée commune, 100 % config. Lot du 30/07 : `/actualites` à onglets Actus (POI articles, drawer) / Événements (layout `timeline` du module search). Audit vert ; **données articles à créer** et probe/rendu à rejouer (mongo down) |

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
