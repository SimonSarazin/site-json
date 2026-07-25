# POC SiteForge - Générateur de Sites JSON

## Présentation

SiteForge est un générateur de sites web innovant qui transforme des configurations JSON simples en sites web modernes, performants, et entièrement personnalisables.

## Fonctionnalités principales

* **Configuration JSON intuitive :** Définissez intégralement votre site grâce à un simple fichier JSON.
* **Design moderne et adaptatif :** Composants UI avec support natif du responsive design, thèmes sombre/clair, et animations fluides.
* **Multilingue natif :** Support automatique de plusieurs langues avec basculement selon les préférences utilisateur.
* **Performances optimisées :** Lazy loading, optimisation automatique des images, et code splitting.
* **Sécurité avancée :** Validation stricte des schémas, et sanitisation automatique du contenu.
* **Architecture modulaire :** Ajoutez facilement de nouveaux composants et étendez les fonctionnalités selon vos besoins.

## Structure du projet

```
scripts/              # Scripts utilitaires
server/               # Serveurs de développement et production
src/                  # Source de l'application
  components/         # Composants React réutilisables
  contexts/           # Contextes React pour la gestion d'état global
  data/               # Données et exemples JSON
  helpers/            # Fonctions utilitaires
  hooks/              # Hooks personnalisés React
  lib/                # Librairies et utilitaires généraux
  modules/            # Modules spécifiques (ex: recherche avancée)
  types/              # Déclarations TypeScript globales
  entry-client.tsx    # Entrée côté client
  entry-server.tsx    # Entrée côté serveur (SSR)
  RootLayout.tsx      # Composant racine
```

## 📖 Documentation

Pour une documentation complète (installation, configuration, schémas JSON, SSR, modules, i18n, etc.), consultez :
[doc/README.md](./doc/README.md)

---

## 🛠️ Installation

### Cloner le dépôt
```bash
git clone https://gitlab.adullact.net/pixelhumain/site-json
cd site-json
```

### Installer les dépendances
```bash
npm install
# ou yarn install
```

Le client API `@communecter/cocolight-api-client` est déclaré dans `package.json` et installé automatiquement par la commande ci-dessus (aucun clone séparé n'est nécessaire).

### Créer le fichier `.env`

Créez un fichier `.env` à la racine du projet (voir [Configuration](./doc/02-configuration.md) pour le détail des variables). Les lignes commentées (en grisé) donnent un exemple de configuration alternative : le serveur QA, qui sert de serveur de test, ainsi que le slug et le fichier de configuration de tiers-lieux.org.

```bash
VITE_BASE_URL_BACKEND=http://localhost:3000
# VITE_BASE_URL_BACKEND=https://qa.communecter.org
VITE_SERVER_URL=http://localhost:3000
# VITE_SERVER_URL=https://qa.communecter.org
VITE_SLUG=default
# VITE_SLUG=franceTierslieux
VITE_MON_DOMAIN=monsite-exemple.com

SITE_CONFIG_PATH=./config.prod.json
# SITE_CONFIG_PATH=./config.prod.tiers-lieux.json
```

### Démarrer en mode développement
```bash
npm run dev
# ou yarn dev
```

Ouvrez ensuite http://localhost:5173 pour naviguer sur le site.

## Commandes principales

* **Développement local :**

```bash
npm run dev
```

* **Build pour production :**

```bash
npm run build
npm run build:ssr
```

* **Prévisualisation du build :**

```bash
npm run preview
```

* **Lancement du serveur de production :**

```bash
npm run start
```

## Personnalisation

Configurez facilement votre site via les fichiers JSON dans `config.prod.json` ou en adaptant les exemples dans `src/data/demo-site.ts`.


## Contribution

Nous accueillons volontiers vos contributions ! Veuillez créer une pull request sur GitHub ou signaler des problèmes via la section "Issues".

## Licence

Ce projet est sous licence MIT. Consultez le fichier [LICENSE](LICENSE) pour plus de détails.

