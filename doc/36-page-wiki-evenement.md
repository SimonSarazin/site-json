# Page wiki d'un événement (MediaWiki)

Sur la fiche d'un événement, le bouton **Page wiki** crée sur un MediaWiki (movilab.org pour tiers-lieux.org) la page qui documente la rencontre, à partir du modèle `Evenement et CR`. Le lien reste dans la description de l'événement. Une fois le lien présent, le bouton devient **Ouvrir la page wiki**.

Visible pour qui peut éditer l'événement (`canEditProfile`). Absent si le serveur n'a pas de wiki configuré.

## Configuration (serveur uniquement)

| Variable | Rôle |
|---|---|
| `WIKI_API_URL` | API du wiki, ex. `https://movilab.org/api.php`. Sans elle, la fonction est désactivée (503, bouton masqué). |
| `WIKI_PAGE_BASE_URL` | Préfixe des URL de page. Défaut : `<origine de WIKI_API_URL>/index.php?title=` |
| `WIKI_BOT_USER` | Identifiant du bot password (`Compte@NomDuBot`) |
| `WIKI_BOT_PASSWORD` | Mot de passe du bot password |

Le bot password se crée sur le wiki (Spécial:BotPasswords) avec les droits « créer, modifier des pages ». Ne jamais commiter ces valeurs.

## Fonctionnement

1. `GET /api/wiki/event/:id/plan` : titre (`Nom (AAAA-MM-JJ)`) et URL de la page, sans authentification (données publiques).
2. Le client ajoute `Documentation de la rencontre : <url>` à la description (`updateDescription`). Le backend refuse si l'utilisateur n'a pas le droit d'éditer.
3. `POST /api/wiki/event/:id` (en-tête `Authorization`) : le serveur relit l'événement dans le backend, **vérifie que la description contient l'URL**, puis crée la page avec le compte robot (`createonly` : une page existante n'est jamais écrasée).

L'image de l'événement (JPG, PNG, GIF ou WebP, moins de 9 Mo, hébergée sur le backend) est téléversée sur le wiki par le compte robot, puis renseignée dans `Main_Picture`. Sans image, ou si le téléversement échoue, le modèle affiche son logo par défaut. Le bot password doit donc aussi avoir le droit « téléverser des fichiers ».

C'est l'étape 2 qui sert de preuve de droit : le compte robot n'écrit jamais sur la seule foi du navigateur, et le contenu de la page vient du backend, pas de la requête.

Si l'étape 3 échoue, le lien reste dans la description : le bouton « Ouvrir la page wiki » ne dit pas que la page existe. Un nouvel essai ne duplique pas le lien.

Code : `server/api/wiki-event.js`, `src/modules/profil/actions/mutations/wikiPage.ts`, `src/modules/profil/components/action-buttons/WikiPageButton.tsx`.
