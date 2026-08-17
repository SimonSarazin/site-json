# Migration d'appropriation — la section admin `ownershipMigration`

> Reprise de la **PROPRIÉTÉ** d'un lot de fiches d'un costum cédant (régional/agrégateur) vers le
> site courant, le cédant les conservant en **référencement**. C'est la reprise du STOCK — la
> moitié « création » du modèle régional/communal est déjà couverte par les `mutation.stamps` des
> costumForms (cf. `commentaire/modele-data-reseau-equipements-sportifs.md`).
> Spec serveur normative : `cocolight-backend/docs/28-OWNERSHIP-MIGRATION.md` (endpoints
> `TRANSFER_SOURCE_*`, nés en miroir legacy/Node).

## Pourquoi une section produit (et plus un script)

Le produit ne savait PAS transférer une propriété (l'import préserve la provenance, `setsource`
refuse `set=source`) — d'où le script CLI `tools/commune-ownership-migration/` (désormais **secours
offline**). La voie produit apporte ce que le script n'avait pas : gate serveur (super-admin OU
admin des DEUX costums), re-check intégral à l'apply, journal `sourceMigrations` (snapshot AVANT
écriture) avec **rollback serveur**, historique consultable, audit activityStream par fiche, et le
contrôle de schéma **correct** (fusion moteur⊕overlay des deux slugs — le script lisait le doc
`costum` nu, faux verdicts sur les satellites).

## Le geste

```
source.key / source.keys      :  from  →  site courant
reference.costum              :  += from                 (si keepReference, défaut)
reference.costumTypes.<from>  :  = <subType>             (annotation de sous-type)
```

Réécriture EN PLACE (`_id` préservé : images, liens, slug, historique). Après migration le cédant
continue de voir les fiches (périmètre `$or[source.keys, reference.costum]`) : **migrer AVANT de
déployer la config du site repreneur** — aucune coupure ; l'inverse afficherait un site vide.

## Config (section costum, registre `registerAdminSection`)

```json
{
  "id": "migration",
  "label": { "fr": "Migration", "en": "Migration" },
  "icon": "arrow-left-right",
  "access": "siteAdmin",
  "sections": [
    {
      "type": "ownershipMigration",
      "access": "siteAdmin",
      "props": {
        "from": "equipementsSportifs974",
        "collections": ["poi"],
        "selectors": [
          { "field": "address.codeInsee", "value": "97415",
            "label": { "fr": "Fiches de la commune (Insee 97415)", "en": "Municipal records" } }
        ],
        "subType": "auto",
        "keepReference": true
      }
    }
  ]
}
```

- `from` : slug du costum CÉDANT. Le repreneur est TOUJOURS le site courant (`to` implicite).
- `selectors` : sélections de masse proposées (radio si plusieurs). `field` ∈ whitelist SERVEUR
  (`address.codeInsee`, `address.level1/3/4`, `address.localityId`, `address.addressLocality`,
  `tags`, `type`) — pas de filtre libre. Le `codeInsee` est le seul discriminant fiable pour une
  commune (423/432 fiches de Saint-Paul sont étiquetées « BOIS DE NEFLES SAINT-PAUL »).
- `subType` : `"auto"` (déduit du `type` si la sélection est homogène), `""` (aucune annotation),
  ou valeur explicite (doit correspondre au `subType` du costumForm du site, ex. `recoveryCenter`).
- `keepReference: false` = transfert sec (correction de provenance) — pas de référencement.
- Props VALIDÉES par le zod local de la section (`AdminCustomSectionSchema` laisse `props` libre).

**Rejouer pour une autre commune** = copier le bloc en changeant `value` (et le `from` si autre
dataset). Les contrôles bloquants serveur encaissent la data moins uniforme des communes suivantes.

## Le flux (composant `AdminOwnershipMigrationSection` + hook `useOwnershipMigration`)

1. **Choix** : sélecteur (+ collection si plusieurs) → **Analyser** (dry-run serveur, rien n'est écrit) ;
2. **Analyse** : table des contrôles (✓/⚠/✗, ids dépliés), répartitions par localité/type, panneau
   schéma (champs du cédant couverts ?), exemple avant/après ;
3. **Confirmation** (`ConfirmDialog`) — poste `expectedCount` : si la sélection a bougé depuis
   l'analyse, le serveur refuse (`selectionDrift`) ;
4. **Rapport** : compteurs auto-vérifiés (`migrated`, `verification.stillOwnedByFrom` attendu 0),
   `migrationId`, **Télécharger le snapshot (JSON)**, **Annuler la migration** ;
5. **Historique** : tous les runs du site (cédant ou repreneur), statut
   `appliquée`/`annulée`/`incomplète`, snapshot et rollback par run.

Le gate réel est SERVEUR (admin des DEUX costums) : un `siteAdmin` du site qui n'administre pas le
cédant reçoit « Vous n'êtes pas autorisé à administrer ces costums. » — l'UI n'est jamais l'autorité.
`ensureCostumScope` est reposé avant chaque appel (7/19 sites ont un carrier au `source.key` étranger).

## V2 prévue (aucun changement serveur/contrat)

Le contrat accepte déjà `selection[ids][]` (≤ 1000) : brancher un `bulkAction` « Transférer la
propriété » sur la sélection d'`AdminResourceTable` et une `rowAction` à la fiche = extraire de la
section un dialog réutilisable + étendre l'enum d'actions du schéma resource. Le mode
`annotateOnly` (rattrapage d'annotations en masse) est lui aussi déjà servi par le serveur.

## Pièges connus

- **Ré-imports RES** : BUG-L-236 (le `$set` de `reference` à l'update d'import REMPLAÇAIT le
  sous-document → perte des références et annotations posées par la migration — des DEUX côtés,
  le Node détruisant même sans clé nouvelle). **CORRIGÉ en miroir L+B le 2026-08-17**
  (fusion avec l'existant, rien d'écrit sans clé nouvelle, byte-identique). Déployer le fix
  legacy AVANT tout rafraîchissement RES d'un dataset migré.
- **Auto-référencement récurrent** : chaque ré-import communal repousse le slug du site dans son
  propre `reference.costum` ; l'apply le nettoie (`cleanSelfReference`) mais le flux le recrée.
- L'**export du cédant** ré-exporte les fiches migrées (il les référence) — voulu, cadrer par
  `filters` si indésirable.
- Fiches en modération : les flags `preferences.toBeValidated.<from>` SURVIVENT (modèle scopé).
