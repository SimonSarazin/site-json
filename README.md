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
