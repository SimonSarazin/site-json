# Administration (`config.admin`) — recette avancée

> Chargé à la demande depuis la skill `config-assistant` (SKILL.md § Recettes
> avancées).

Le back-office `/admin` (gestion membres/contenu/import-export/référencement/modération) est 100 %
config-driven — référence : **[doc/30-module-admin.md](../../../../doc/30-module-admin.md)**. PAS de
dérivation runtime : le bloc se GÉNÈRE explicitement puis se personnalise.

1. **Squelette** : `npm run admin:scaffold -- <config> [--write]` — dérive les onglets des types
   gérés par le site (`profiles.addConfig` ∪ `costumForms.entityType`), auto-validé par le schéma.
2. **Personnaliser** : colonnes (`columns` : `"chemin"` ou `{path,label}` localisé), `rowActions`/
   `bulkActions`, filtres `source` (mêmes `baseParams` que searchProStatic), `access` par
   page/onglet/section (`superAdmin`|`siteAdmin`|`entityAdmin`), `condition` (VisibilityCondition).
   Resource `answers` (réponses CoForm) : `create: {"coform": "<formId>"}` (bouton « Créer » →
   CoFormModal, les answers n'ayant pas de modale d'entité) et `preview: {type: "coform-answer",
   editButton: true}` (détail au clic sur une ligne, même contenu que l'annuaire public).
   Forme exacte : `npm run config:schema admin`. ⚠ `status.*` = contrat futur (ne pas configurer),
   l'export est réservé super-admin (plancher backend).
3. **Valider + voir** : `config:validate` (le discriminatedUnion attrape toute section fautive avec
   l'erreur précise) puis préversion `/admin` (l'entrée apparaît dans le menu avatar + Ctrl+K pour
   les admins du carrier).

Exemple canonique vivant : `npm run config:example -- admin` (bloc réel de parent62, 6 onglets).
