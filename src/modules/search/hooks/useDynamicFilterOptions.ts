import { useMemo, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { costumListValuesQuery } from "@/hooks/useCostumListValues";
import { capitaliser, costumSlugOf } from "@/lib/costumLists";

/** Forme minimale d'un filtre à options — vaut pour `dropdownFilters` comme pour `filterGroups`. */
interface FiltreAOptions {
  id: string;
  options?: Array<{ id: string; label: unknown; value?: string; name?: string; variants?: string[] }>;
  optionsFrom?: { list: string; costumSlug?: string };
}

/**
 * Résout les options des filtres qui déclarent une source DYNAMIQUE (`optionsFrom`).
 *
 * Les valeurs viennent d'une liste du costum (`costum.lists.<nom>`, forme `{collection, distinct}`),
 * c'est-à-dire de la donnée réelle : le filtre suit ce que les fiches contiennent, au lieu d'une liste
 * figée dans la config qui dérive (mesuré sur institutBleu : 12 territoires déclarés contre 64 en base,
 * soit 52 valeurs injoignables).
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
export type FiltreResolu<T> = T & { optionsReady: boolean };

/**
 * Plafond demandé au serveur. En deçà, la liste arrive ENTIÈRE et la recherche se fait dans le
 * navigateur — instantanée, sans aller-retour. Au-delà, le serveur coupe (`tronque`) et c'est LUI qui
 * cherche : sans cela, plafonner rendrait invisibles les valeurs situées après la coupe alphabétique.
 * 300 couvre 7 des 8 listes dynamiques du parc (la plus grosse, `tagsDocument`, en compte 1 209).
 */
const PLAFOND = 300;

export function useDynamicFilterOptions<T extends FiltreAOptions>(
  filtres: readonly T[] | undefined,
  /** Terme cherché par filtre (`{ [id du filtre]: terme }`) — DÉJÀ débouncé par l'appelant. */
  recherches?: Record<string, string>,
): FiltreResolu<T>[] {
  const { api, entity: carrier } = useCocolight();
  const slugSite = costumSlugOf(carrier);

  // Les filtres à source dynamique, dans un ordre STABLE : `useQueries` exige un nombre et un ordre
  // constants d'un rendu à l'autre.
  const dynamiques = useMemo(
    () => (filtres ?? []).filter((f) => !!f.optionsFrom),
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
    return filtres.map((f) => {
      if (!f.optionsFrom) return { ...f, optionsReady: true };
      const res = parId.get(f.id);
      const valeurs = res?.values;
      // Tant que la liste n'a pas répondu, on garde les options DÉCLARÉES : le filtre reste utilisable
      // (et un éventuel repli écrit à la main continue de servir) au lieu de disparaître — mais il est
      // signalé NON PRÊT, pour que l'hydratation URL attende ses vraies valeurs.
      // Une liste RÉGLÉE mais VIDE est prête, elle : on garde ses options déclarées et on DÉBLOQUE
      // l'hydratation, au lieu de figer la page sur une liste qui ne répondra jamais.
      if (!valeurs?.length) return { ...f, optionsReady: res?.regle ?? false };
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
  }, [filtres, dynamiques, empreinte, termes]);
}
