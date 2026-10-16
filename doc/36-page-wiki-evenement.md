# Page wiki d'un événement (MediaWiki)

Sur la fiche d'un événement, le bouton **Page wiki** crée sur un MediaWiki (movilab.org pour tiers-lieux.org) la page qui documente la rencontre, à partir du modèle `Evenement` (`Modèle:Evenement` sur le wiki ; « Evenement et CR » n'est que le nom dans sa documentation). Le lien reste dans la description de l'événement. Une fois le lien présent, le bouton devient **Mettre à jour la page wiki**.

Visible pour qui peut éditer l'événement (`canEditProfile`). Absent si le serveur n'a pas de wiki configuré.

## Configuration (serveur uniquement)

| Variable | Rôle |
|---|---|
| `WIKI_API_URL` | API du wiki, ex. `https://movilab.org/api.php`. Sans elle, la fonction est désactivée (503, bouton masqué). |
| `WIKI_PAGE_BASE_URL` | Préfixe des URL de page. Défaut : `<origine de WIKI_API_URL>/index.php?title=` |
| `WIKI_TEMPLATE` | Nom du modèle, imposé tel quel (ex. `Event`). Sans elle, `Evenement` est utilisé s'il existe sur le wiki, sinon `Event`. |
| `WIKI_BOT_USER` | Identifiant du bot password (`Compte@NomDuBot`) |
| `WIKI_BOT_PASSWORD` | Mot de passe du bot password |

Le bot password se crée sur le wiki (Spécial:BotPasswords) avec les droits « créer, modifier des pages ». Ne jamais commiter ces valeurs.

## Fonctionnement

1. `GET /api/wiki/event/:id/plan` : titre (`Nom (AAAA-MM-JJ)`) et URL de la page, sans authentification (données publiques).
2. Le client ajoute un lien Markdown « Voir le compte rendu de l'événement sur le wiki » (l'ancienne ligne `Documentation de la rencontre : <url>` est remplacée) à la description (`updateDescription`). Le backend refuse si l'utilisateur n'a pas le droit d'éditer.
3. `POST /api/wiki/event/:id` (en-tête `Authorization`) : le serveur relit l'événement dans le backend, **vérifie que la description contient l'URL**, puis crée la page avec le compte robot (`createonly` : une page existante n'est jamais écrasée).

## Mise à jour

Si la page existe déjà, le même `POST` la met à jour : seuls l'appel du modèle (nom, date, lieu, image, résumé…) et la section « Description » sont régénérés depuis tiers-lieux.org. Le compte-rendu et tout ce qui a été écrit sur le wiki sont conservés. L'image est retéléversée. À déclencher depuis le bouton après une modification de l'événement ; ce n'est pas automatique.


L'image de l'événement (moins de 9 Mo, hébergée sur le backend ; WebP et autres formats refusés par le wiki sont convertis en JPEG) est téléversée sur le wiki par le compte robot, puis renseignée dans `Main_Picture`. Sans image, ou si le téléversement échoue, le modèle affiche son logo par défaut. Le bot password doit donc aussi avoir le droit « téléverser des fichiers ».

C'est l'étape 2 qui sert de preuve de droit : le compte robot n'écrit jamais sur la seule foi du navigateur, et le contenu de la page vient du backend, pas de la requête.

Si l'étape 3 échoue, le lien reste dans la description. Un nouvel essai ne le duplique pas.

Code : `server/api/wiki-event.js`, `src/modules/profil/actions/mutations/wikiPage.ts`, `src/modules/profil/components/action-buttons/WikiPageButton.tsx`.

## Modèles supportés

Les paramètres suivent le modèle choisi :

- `Evenement` (movilab.org) : `Main_Picture, name, type, description, Tags, location, from, startDate, urlpad, complement`.
- `Event` (ex. wiki.lafabriquedesmobilites.fr) : `Main_Picture, Lang, name, type, description, Tags, Location, startDate, endDate, contact` (`contact` reçoit l'organisateur).

Un autre modèle est traité comme `Evenement`. Pour un nouveau wiki, ajouter son profil de paramètres dans `wikitexte`.

## Protection anti-bot

Certains wikis (La Fabrique des Mobilités) placent leur API derrière une protection anti-robot qui répond `402`. Le serveur de tiers-lieux.org peut alors être refusé : il faut demander à l'administrateur du wiki d'autoriser l'IP du serveur ou le compte du bot.
