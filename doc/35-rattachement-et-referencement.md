[← Index](README.md)

# Rattachement et référencement

Comment une fiche appartient à un costum, et quel formulaire la décrit. Dix clés participent, réparties
sur **deux axes distincts** — et la confusion vient de ce qu'on les prend pour un seul.

> **En un mot** : l'axe A répond à « à qui est cette fiche, qui la voit ». L'axe B répond à « quel
> formulaire la décrit, lequel s'ouvre pour l'éditer ». Une fiche peut être visible sans être
> éditable, et éditable par un formulaire dont elle n'est pas native.

## Axe A — appartenance et visibilité

| Clé | Où | Ce qu'elle fait |
|---|---|---|
| `scope` | costumForm | écrit `source.key` **à la création** — `constant` (valeur fixe) ou `slugFrom: "carrier"` (le porteur) |
| `reference.costum` | base | posé par l'action de référencement de l'admin, ou par l'`afterSave` legacy quand la provenance diffère du costum |
| `sourceKey` | `baseParams` | le serveur le traduit en `$or[source.keys, reference.costum]` — donc **« possédée OU référencée »** |
| `notSourceKey` | `baseParams` | échappe au périmètre costum |

> ⚠️ `notSourceKey` a longtemps été présenté comme obligatoire pour les listes d'`answers`. C'est faux :
> c'est un **contournement**, et c'est lui qui faisait remonter le stock d'un site voisin sur
> `/creneaux` de maison-sport-sante-la-tampon (42 créneaux sur 43 n'appartenaient pas au site). Il en a
> été retiré ; **8 configs du parc le portent encore**.

## Axe B — quel formulaire

| Clé | Où | Ce qu'elle fait |
|---|---|---|
| `identity` | costumForm | comment un **NATIF** de ce form se reconnaît en base (ex. `{type: "Cooperative"}`). Même grammaire qu'`editModalMatch`. **Absent = form par défaut de la collection.** Sert à la lecture, **jamais à écrire** ces champs |
| `subType` | costumForm | le sous-type **canonique** du costum. C'est la valeur écrite dans `reference.costumTypes.<slug>` **au référencement** |
| `subTypeLabel` | costumForm | son libellé dans le sélecteur de référencement |
| `costumSubType` | `baseParams` | s'étend en `$or[ <identity>, reference.costumTypes.<slug> ]` — **couvre les deux branches à la fois**, natifs et référencés |
| `editModals[]` | `profiles.<kind>` | table de routage : la **première** route dont la condition est satisfaite gagne. Chaque route porte `editModal` + `editModalMatch` et/ou `when` |
| `editModal` + `editModalMatch` | `profiles.<kind>` | format **historique**, une seule route — repli quand `editModals` ne matche pas |
| `costumSlug` | costumForm | épingle le schéma costum en édition (plus la découverte e2e et la cohérence de la whitelist d'écriture) |

`editModalMatch` est **plat** — `{clé: valeur}`, ET implicite, égalité stricte ou `.includes` sur un
tableau. `when` est un `PredicateJson` (`and`/`or`/`not`, `eq`/`contains`/`in`…), **cumulatif** avec
`editModalMatch`, et seul capable d'exprimer une condition **disjonctive** — typiquement « provenance
**ou** rattachement secondaire ».

> ⚠️ Une route `editModals` **sans condition est un catch-all** : elle s'applique à toute la collection,
> y compris aux fiches étrangères au costum, et masque les routes suivantes. À placer en dernier.
> Le schéma est en `strictObject` exprès : sans lui, `wen` au lieu de `when` serait silencieusement
> supprimé par Zod et la route redeviendrait catch-all — le bug même que `when` corrige.

## Ce qui va ensemble

C'est le point que la liste des clés ne montre pas.

| Vous posez | Vous obtenez |
|---|---|
| `identity` seul | les **natifs** sont reconnus. Le référencement n'écrit rien : `reference.costumTypes` reste vide |
| `identity` + `subType` | les natifs **et** les référencés deviennent adressables par sous-type |
| … + `costumSubType` en `baseParams` | la **recherche** voit les deux branches d'un coup |
| … + `editModals`/`editModalMatch` | l'**édition** ouvre le bon formulaire pour les deux |

**`identity` seul ne suffit donc pas dès qu'on référence.** C'est un piège vécu, pas théorique.

## Le piège vécu — maison-sport-sante-la-tampon

Le costumForm `structure` déclare `identity` mais **pas `subType`**. Conséquence en chaîne :

1. au référencement des 14 fiches, rien n'est écrit dans `reference.costumTypes.associationEkilibre` ;
2. `editModalMatch` n'a donc **rien à matcher** sur ces fiches ;
3. la route d'édition a dû être bornée par un `when` disjonctif sur `sourceKeys`/`reference.costum`.

Le contournement fonctionne. Mais il a d'abord été **documenté à tort** comme un choix — « les fiches
référencées n'ont pas de champ `type` » — alors que la cause est une pièce manquante de la chaîne.
Le constat était juste, la cause fausse, et la justification a survécu plusieurs jours dans la doc
projet avant d'être corrigée.

## Qui a quoi dans le parc

| Config | `identity` | `subType` | `costumSubType` | `editModalMatch` |
|---|---|---|---|---|
| **institut-bleu** | ✓ | ✓ | **✓ (seul du parc)** | ✓ |
| equipements-Sportifs | ✓ | ✓ | — | ✓ |
| saint-paul-sport | ✓ | ✓ | — | ✓ |
| maison-sport-sante-la-tampon | ✓ | **—** | — | **—** |

**Institut-bleu est le seul à porter la chaîne entière** — et c'est aussi celui qui l'a introduite
(`costumSubType`, `subType`, `subTypeLabel` et `identity` naissent tous le **2026-08-06**, dans le
commit `feat(referencement): rattachement des référencés à un sous-type`).

Pour dater une clé ou voir sa diffusion : `npm run config:changelog key <nom>`.

## Gardes existantes

| Garde | Ce qu'elle vérifie |
|---|---|
| `tests/preflight/edit-modal-scope.test.ts` | une route d'édition costum doit être bornée à son périmètre |
| `strictObject` sur `editModals[]` | une clé inconnue fait échouer la validation au lieu d'être supprimée |
| `tests/preflight/costum-form-slug.test.ts` | `costumSlug` exigé sur tout costumForm |

## Voir aussi

- [Module profil](08-module-profil.md) — formulaires costum, `EditModalRegistry`
- [Module formEngine](28-module-formengine.md) — le document costum et sa compilation
- [Module search](07-module-search.md) — `baseParams`, périmètres, facettes
- [Module admin](30-module-admin.md) — l'onglet Référencement, `restrictActionsToOwned`, `openData`
