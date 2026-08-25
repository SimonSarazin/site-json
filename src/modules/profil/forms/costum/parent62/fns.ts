// Clés `afterSubmit` du costum parent62 (config JSON, aucun descripteur TS) — cf. `registerSpecFns.ts`.
import { getDescriptor, registerAfterSubmitFn, type AfterSubmitFn } from "../../specRegistries";
import { costumListsOf, staticListValues } from "@/lib/costumLists";
import { normalizeFilterValue } from "@/modules/search/lib/dropdownFilters";

/**
 * Fait grandir une liste STATIQUE du costum (`costum.lists.<champ>`) avec les valeurs qu'un formulaire
 * `valueSelect` creatable vient d'accepter en saisie libre — sinon une valeur inédite (ex. un thème
 * jamais vu) reste propre à l'entité qui vient d'être créée et n'apparaît nulle part ailleurs (ni dans
 * les filtres via `optionsKey`, ni proposée au prochain utilisateur qui tape le même mot).
 *
 * ENTIÈREMENT PILOTÉ PAR LA CONFIG (`config.costumForms.<formId>.fields.<champ>.widgetProps`), pas par
 * une liste codée en dur ici : un champ ne grandit sa liste costum QUE si `widget: "valueSelect"` ET
 * `widgetProps.saveNewValue: true` — **`false` par défaut**, opt-in explicite par champ. `listKey`
 * (`widgetProps.list`) fixe la liste costum CIBLE quand elle diffère du nom du champ — cas réel :
 * `category` sur `parent62-affiche` (Compliqué/Difficile/À changer) porte le MÊME nom de champ qu'un
 * filtre `resource-category` totalement différent (Vidéo/…) — écrire dans `costum.lists.category` aurait
 * mélangé les deux taxonomies (d'où `list: "categoriesParole"` en config).
 *
 * RÉSERVÉ À L'ADMIN (`carrier.isAdmin()`) : plusieurs formulaires costum qui déclenchent ce hook (ex.
 * `add-parent62-event`) sont aussi exposés en PUBLIC, sans authentification admin
 * (`requiresAdmin: false`). Sans cette garde, n'importe quel visiteur pourrait injecter une valeur dans
 * la taxonomie PARTAGÉE `costum.lists.<champ>` — qui alimente ensuite les propositions/filtres pour tout
 * le monde — avant même qu'un admin ait validé sa soumission. La saisie libre du champ lui-même
 * (`creatable` sur `ValueSelectField`) n'est PAS concernée : elle reste ouverte à tous, seule la
 * PROMOTION vers la liste partagée est gardée.
 *
 * DÉDOUBLONNAGE CASSE/ACCENTS SEULEMENT (décision produit) : une valeur déjà connue à la casse/aux
 * accents près n'est PAS réécrite (`normalizeFilterValue`, déjà utilisé par les filtres — cf.
 * `dropdownFilters.ts`). Aucune modération de contenu : une valeur réellement inédite part telle
 * quelle, immédiatement, sans validation humaine — c'est le compromis demandé, pas une garantie de
 * qualité de la taxonomie.
 *
 * ÉCRITURE, PAS FUSION ATOMIQUE : `updateField(path, value, {arrayForm:true})` est un `$push` Mongo, pas
 * un `$addToSet` (aucune des deux formes n'est exposée par le SDK) — le dédoublonnage ci-dessus est fait
 * CÔTÉ CLIENT, avant l'appel, contre `staticListValues(carrier)`. Puisque `carrier` est REFRESH (voir
 * plus bas) après chaque soumission qui écrit, ce dédoublonnage reste correct d'une soumission à l'autre
 * dans le MÊME onglet — seul le cas RÉSIDUEL de deux soumissions strictement simultanées (avant que la
 * première n'ait eu le temps de répondre ET de rafraîchir) peut encore produire un doublon (coût
 * cosmétique, pas une perte de donnée) : ni `$addToSet` ni un verrou ne sont exposés par le SDK pour ça.
 *
 * Un appel PAR VALEUR nouvelle (jamais un tableau en un seul appel) : le comportement de `updateField`
 * avec une `value` tableau + `arrayForm` n'est documenté que pour `$pullAll` (avec `pull`), pas pour un
 * push multiple — on ne parie pas dessus.
 *
 * Non bloquant : les écritures partent en tâche de fond (`afterSubmit` n'est pas awaited par
 * `EntityFormModal`) ; un échec est loggué, jamais remonté à l'utilisateur (la fiche vient d'être
 * enregistrée avec succès, ce n'est pas à cette étape de le contredire).
 *
 * `carrier.refresh()` (UNE FOIS, après que toutes les écritures de cette soumission se soient réglées) :
 * la méthode SDK existante, pas un store maison — `_setData` réassigne `costum`/`lists` sur le MÊME
 * proxy réactif (« preserves reactive signals »), donc les consommateurs abonnés via
 * `useCostumListsReactive` (`@/hooks/useCostumLists`, filtres ET `ValueSelectField`) se remettent à jour
 * tout seuls, sans `setEntity`/nouveau contexte. Sans ce refresh, `carrier` restant figé pour toute la
 * session (`useState` rempli une fois au boot, cf. `CocolightProvider`), la valeur resterait invisible
 * partout jusqu'au reload.
 */

/**
 * Sélectionne, parmi les valeurs SOUMISES pour un champ (chaîne en mono, tableau en multi), celles qui
 * sont VRAIMENT nouvelles par rapport à `connues` — dédoublonnage casse/accents (`normalizeFilterValue`),
 * chaînes vides/blanches ignorées (un multi-select peut soumettre `""` pour un slot vidé), et
 * dédoublonnage aussi ENTRE les valeurs soumises (`themes` en multi peut répéter la même saisie).
 *
 * Pure — extraite pour être testée isolément (cf. `fns.test.ts`) sans mock réseau/carrier.
 */
export function selectNewValues(soumis: unknown, connues: readonly string[]): string[] {
  const candidats = Array.isArray(soumis)
    ? soumis.filter((v): v is string => typeof v === "string" && v.trim() !== "")
    : typeof soumis === "string" && soumis.trim() !== ""
      ? [soumis]
      : [];
  const vues = new Set(connues.map(normalizeFilterValue));
  const nouvelles: string[] = [];
  for (const valeur of candidats) {
    const norme = normalizeFilterValue(valeur);
    if (vues.has(norme)) continue;
    vues.add(norme);
    nouvelles.push(valeur);
  }
  return nouvelles;
}

/** `formId` = id du costum form (`getDescriptor`), pour introspecter SES champs `valueSelect` à l'appel
 *  (pas au moment de l'enregistrement — le descripteur n'est pas forcément encore enregistré alors). */
export function growCostumLists(formId: string): AfterSubmitFn {
  return (ctx, values) => {
    const carrier = ctx.carrier;
    if (!carrier || !carrier.isAdmin()) return;
    const descriptor = getDescriptor(formId);
    if (!descriptor) return;
    const listes = costumListsOf(carrier);
    const ecritures: Promise<unknown>[] = [];
    for (const [field, def] of Object.entries(descriptor.fields)) {
      if (def.widget !== "valueSelect" || def.widgetProps?.saveNewValue !== true) continue;
      const listKey = (def.widgetProps?.list as string | undefined) ?? field;
      const connues = staticListValues(listes[listKey]) ?? [];
      for (const valeur of selectNewValues(values[field], connues)) {
        ecritures.push(
          carrier.updateField(`costum.lists.${listKey}`, valeur, { arrayForm: true })
            .catch((e: unknown) => console.error(`[parent62/growCostumLists] échec ajout "${valeur}" à costum.lists.${listKey}`, e)),
        );
      }
    }
    if (ecritures.length === 0) return;
    Promise.allSettled(ecritures).then(() =>
      carrier.refresh().catch((e: unknown) =>
        console.error("[parent62/growCostumLists] échec du refresh carrier post-écriture", e)));
  };
}

registerAfterSubmitFn("parent62-article-grow", growCostumLists("parent62-article"));
registerAfterSubmitFn("parent62-affiche-grow", growCostumLists("parent62-affiche"));
registerAfterSubmitFn("parent62-recovery-center-grow", growCostumLists("parent62-recovery-center"));
registerAfterSubmitFn("parent62-event-grow", growCostumLists("parent62-event"));
