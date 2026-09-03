import { useMemo, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import { useCocolight } from "@/hooks/useCocolight";
import { costumListValuesQuery } from "@/hooks/useCostumListValues";
import { capitaliser, costumSlugOf } from "@/lib/costumLists";
import { geoShapeQueryOptions, type GeoShapeEntity } from "@/lib/geoShapes/geoShapeQuery";
import type { GeoShapeSource } from "@/types/geo-shape-schema";

/** Forme minimale d'un filtre à options — vaut pour `dropdownFilters` comme pour `filterGroups`. */
interface FiltreAOptions {
  id: string;
  options?: Array<{ id: string; label: unknown; value?: string; name?: string; variants?: string[] }>;
  optionsFrom?: { list?: string; costumSlug?: string; shapes?: GeoShapeSource };
}

/**
 * Résout les options des filtres qui déclarent une source DYNAMIQUE (`optionsFrom`).
 *
 * DEUX ORIGINES, exclusives (cf. `OptionsFromSchema`) :
 *
 *  • `list` — une liste du costum (`costum.lists.<nom>`, forme `{collection, distinct}`), c'est-à-dire
 *    la donnée réelle : le filtre suit ce que les fiches contiennent, au lieu d'une liste figée dans la
 *    config qui dérive (mesuré sur institutBleu : 12 territoires déclarés contre 64 en base, soit
 *    52 valeurs injoignables). La valeur affichée EST la valeur filtrée.
 *
 *  • `shapes` — le référentiel d'une couche de contours. L'option porte l'`_id` du document et
 *    AFFICHE son `name` : les deux sont dissociés, ce qui est tout l'intérêt — on filtre sur un
 *    identifiant stable (`address.zonirisId`) pendant que le libellé, lui, suit les corrections de
 *    nom faites en base. La requête est celle de la carte (`geoShapeQueryOptions`), à la clé près :
 *    quand la page dessine déjà la couche, le filtre ne coûte AUCUN octet de plus.
 *
 * SUBSTITUTION, PAS FUSION. Une valeur dynamique n'a pas de libellé traduit — elle s'affiche telle
 * qu'elle est stockée, et sert d'identifiant. C'est un choix : traduire supposerait de maintenir une
 * table en config, donc de recréer la dérive qu'on vient de supprimer.
 *
 * Un filtre SANS `optionsFrom` est renvoyé inchangé, et aucune requête n'est émise pour lui : les
 * configs existantes gardent exactement leur comportement.
 */
/**
 * `optionsReady` distingue « pas encore chargé » de « chargé et vide ». Sans ce drapeau, un filtre
 * dynamique dont les options déclarées servent de repli pendant le chargement paraît prêt, et
 * l'hydratation URL s'exécute trop tôt : elle rejette les valeurs qu'elle ne connaît pas encore, puis
 * se marque comme faite. C'est exactement ce qui perdait le deep-link.
 */
export type FiltreResolu<T extends { options?: unknown }> = T & {
  optionsReady: boolean;
  /** TOUJOURS un tableau, même avant réception : une config qui ne déclare qu'`optionsFrom` n'en
   *  écrit pas, et les consommateurs lisent `filter.options` sans garde. */
  options: NonNullable<T["options"]>;
};

/**
 * Plafond demandé au serveur. En deçà, la liste arrive ENTIÈRE et la recherche se fait dans le
 * navigateur — instantanée, sans aller-retour. Au-delà, le serveur coupe (`tronque`) et c'est LUI qui
 * cherche : sans cela, plafonner rendrait invisibles les valeurs situées après la coupe alphabétique.
 * 300 couvre 7 des 8 listes dynamiques du parc (la plus grosse, `tagsDocument`, en compte 1 209).
 */
const PLAFOND = 300;

/**
 * Contours → options. Le libellé est le `name` du document, l'identité son `_id` : c'est cette
 * DISSOCIATION qui fait tout l'intérêt de la source — le filtre interroge un identifiant que les
 * corrections de nom ne bougent pas, pendant que l'affichage, lui, suit ces corrections.
 *
 * `value` ET `name` pour la même raison que la branche `list` : un `dropdownFilter` lit `value`, un
 * `filterGroup` à `field` lit `name`. Un contour sans nom retombe sur son `_id` — mieux vaut une
 * option laide qu'une option muette, qu'on ne saurait ni lire ni retirer.
 */
export function optionsDepuisContours(
  data: FeatureCollection | undefined,
): Array<{ id: string; label: string; value: string; name: string }> {
  const options: Array<{ id: string; label: string; value: string; name: string }> = [];
  for (const contour of data?.features ?? []) {
    const id = contour.id == null ? "" : String(contour.id);
    if (!id) continue;
    const nom = contour.properties?.name;
    options.push({
      id,
      label: typeof nom === "string" && nom.trim() ? nom : id,
      value: id,
      name: id,
    });
  }
  return options;
}

export function useDynamicFilterOptions<T extends FiltreAOptions>(
  filtres: readonly T[] | undefined,
  /** Terme cherché par filtre (`{ [id du filtre]: terme }`) — DÉJÀ débouncé par l'appelant. */
  recherches?: Record<string, string>,
): FiltreResolu<T>[] {
  const { api, entity: carrier } = useCocolight();
  const slugSite = costumSlugOf(carrier);

  // Les filtres à source dynamique, SÉPARÉS PAR ORIGINE et dans un ordre STABLE : `useQueries` exige
  // un nombre et un ordre constants d'un rendu à l'autre, et les deux origines n'ont ni le même
  // fetcher ni la même clé.
  const dynamiques = useMemo(
    () => (filtres ?? []).filter((f) => !!f.optionsFrom?.list),
    [filtres],
  );
  const contours = useMemo(
    () => (filtres ?? []).filter((f) => !!f.optionsFrom?.shapes),
    [filtres],
  );

  // La recherche n'est transmise au SERVEUR que pour une liste qu'il a coupée : tant qu'on tient la
  // liste entière, filtrer localement est plus rapide et ne consomme rien.
  const tronquees = useRef<Record<string, boolean>>({});
  const resultats = useQueries({
    queries: dynamiques.map((f) => {
      const terme = tronquees.current[f.id] ? (recherches?.[f.id] ?? "").trim() : "";
      return costumListValuesQuery(
        api as never,
        f.optionsFrom?.costumSlug ?? slugSite,
        f.optionsFrom?.list ?? null,
        true,
        { limit: PLAFOND, ...(terme ? { q: terme } : {}) },
      );
    }),
  });
  // Mémorisé APRÈS la réponse : la première requête part sans `q`, découvre la troncature, et les
  // suivantes deviennent des recherches serveur.
  dynamiques.forEach((f, i) => {
    if (resultats[i]?.data?.tronque) tronquees.current[f.id] = true;
  });

  // RÉGLÉ = la requête a répondu, quel qu'en soit le sort : succès, échec, ou jamais lancée
  // (`enabled:false` quand le porteur n'a pas de slug). À distinguer absolument de « a des valeurs » :
  // `costumListValuesQuery` renvoie `{values: []}` dans TOUS les cas d'échec, et faire porter
  // `optionsReady` sur la présence de valeurs laissait le drapeau à `false` POUR TOUJOURS — ce qui
  // gelait la synchro URL⇄filtres de la PAGE ENTIÈRE (plus de permalien, plus de deep-link, plus de
  // retour arrière), et pas seulement le groupe concerné.
  const regles = resultats.map((r) => r.isFetched || r.fetchStatus === "idle");

  // Référentiel géographique : EXACTEMENT la requête de la carte — même clé, même fetcher, même
  // fraîcheur (`geoShapeQueryOptions`). Quand la page dessine déjà cette couche, le filtre la lit dans
  // le cache et n'ajoute AUCUN appel ; sinon c'est lui qui la déclenche, et la carte la trouvera prête.
  const resultatsContours = useQueries({
    queries: contours.map((f) => ({
      ...geoShapeQueryOptions(
        (carrier as GeoShapeEntity | null) ?? null,
        f.optionsFrom?.shapes as GeoShapeSource,
      ),
      // Même garde que `useGeoShapes` : sans entité, le fetcher jetterait. La requête reste `idle`,
      // donc RÉGLÉE au sens ci-dessous — l'hydratation URL n'est pas gelée pour autant.
      enabled: Boolean(carrier),
    })),
  });
  const reglesContours = resultatsContours.map((r) => r.isFetched || r.fetchStatus === "idle");
  // `dataUpdatedAt` plutôt que le contenu : une couche peut porter des milliers de contours, sérialiser
  // leurs identifiants à chaque rendu coûterait plus que le mémo n'économise.
  const empreinteContours = resultatsContours
    .map((r, i) => `${reglesContours[i] ? "1" : "0"}:${r.dataUpdatedAt}`)
    .join("|");

  // `join` plutôt que la référence : react-query rend un tableau neuf à chaque rendu, et une dépendance
  // par identité relancerait le mémo en boucle. L'état RÉGLÉ en fait partie, sans quoi le passage
  // « en cours » → « réglé à vide » ne rejouerait rien.
  const termes = dynamiques.map((f) => (recherches?.[f.id] ?? "").trim()).join("|");
  const empreinte = resultats
    .map((r, i) => `${regles[i] ? "1" : "0"}` + (r.data?.values ?? []).join(""))
    .join("");

  return useMemo(() => {
    if (!filtres?.length) return [];
    const parId = new Map<string, { values: string[]; variants: Record<string, string[]>; regle: boolean }>();
    dynamiques.forEach((f, i) => parId.set(f.id, {
      ...(resultats[i]?.data ?? { values: [], variants: {} }),
      regle: regles[i] ?? false,
    }));
    const parIdContours = new Map<string, { options: ReturnType<typeof optionsDepuisContours>; regle: boolean }>();
    contours.forEach((f, i) => parIdContours.set(f.id, {
      options: optionsDepuisContours(resultatsContours[i]?.data),
      regle: reglesContours[i] ?? false,
    }));
    return filtres.map((f) => {
      // `options` TOUJOURS présent en sortie : une config qui ne déclare qu'`optionsFrom` n'écrit pas
      // de tableau, et le `default([])` du schéma Zod ne s'applique pas — la config est chargée telle
      // quelle, jamais parsée au runtime. Les consommateurs, eux, lisent `filter.options` sans garde
      // (`SearchHeaderSection.getDropdownSelectedValues`) : c'est ici, au seul point qui résout les
      // options, que le tableau vide doit être garanti.
      const declarees = f.options ?? [];
      if (!f.optionsFrom) return { ...f, options: declarees, optionsReady: true };
      if (f.optionsFrom.shapes) {
        const res = parIdContours.get(f.id);
        // Même règle de repli que pour une liste : tant que les contours ne sont pas arrivés, les
        // options DÉCLARÉES continuent de servir, mais le filtre est signalé NON PRÊT pour que
        // l'hydratation URL attende les vraies valeurs. Une requête réglée sans contour dessinable
        // débloque l'hydratation plutôt que de figer la page.
        if (!res?.options.length) return { ...f, options: declarees, optionsReady: res?.regle ?? false };
        return { ...f, optionsReady: true, options: res.options };
      }
      const res = parId.get(f.id);
      const valeurs = res?.values;
      // Tant que la liste n'a pas répondu, on garde les options DÉCLARÉES : le filtre reste utilisable
      // (et un éventuel repli écrit à la main continue de servir) au lieu de disparaître — mais il est
      // signalé NON PRÊT, pour que l'hydratation URL attende ses vraies valeurs.
      // Une liste RÉGLÉE mais VIDE est prête, elle : on garde ses options déclarées et on DÉBLOQUE
      // l'hydratation, au lieu de figer la page sur une liste qui ne répondra jamais.
      if (!valeurs?.length) return { ...f, options: declarees, optionsReady: res?.regle ?? false };
      // La valeur EST l'identifiant : pas de slug, donc pas de collision entre deux valeurs proches
      // (« Salon professionnel » et « Salon professionnel, » coexistent réellement en base).
      // `value` ET `name` : un `dropdownFilter` lit `value`, un `filterGroup` à `field` lit `name` —
      // c'est ce dernier qui part en `{ <field>: { $in: [...] } }` et doit donc porter la valeur EXACTE
      // stockée. Les renseigner tous deux rend ces options utilisables par les deux mécanismes.
      // `variants` : toutes les graphies derrière la valeur affichée. Le filtre doit interroger le
      // GROUPE entier — n'envoyer que « Le Port » laisserait de côté les fiches portant « LE PORT » ou
      // « Le port », qui coexistent réellement en base.
      // `label` : seule la CASSE D'AFFICHAGE est retouchée (1ʳᵉ lettre en majuscule). Les valeurs sont
      // saisies librement, donc écrites au petit bonheur — « baleines », « économie de la mer » —, et une
      // liste de filtres où une entrée sur deux commence en minuscule se lit mal. La valeur stockée
      // (`id`/`value`/`name`) reste INTACTE : c'est elle qui part dans la requête, elle doit correspondre
      // au caractère près à ce qu'il y a en base.
      return {
        ...f,
        optionsReady: true,
        options: valeurs.map((v) => {
          const g = res?.variants?.[v];
          return { id: v, label: capitaliser(v), value: v, name: v, ...(g?.length ? { variants: g } : {}) };
        }),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtres, dynamiques, contours, empreinte, empreinteContours, termes]);
}
