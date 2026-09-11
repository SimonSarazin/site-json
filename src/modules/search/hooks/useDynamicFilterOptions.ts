import { useMemo, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import { useCocolight } from "@/hooks/useCocolight";
import { useListEntries, type EntreeDeListe } from "@/hooks/useListSources";
import { capitaliser } from "@/lib/costumLists";
import { geoShapeQueryOptions, type GeoShapeEntity } from "@/lib/geoShapes/geoShapeQuery";
import { resolveListSources, type SourceDeValeurs } from "@/lib/listSources";
import { normalizeFilterValue } from "@/modules/search/lib/dropdownFilters";
import type { GeoShapeSource } from "@/types/geo-shape-schema";

/** Une option de filtre telle qu'elle circule ici — `dropdownFilters` comme `filterGroups`. */
interface OptionFiltre {
  id: string;
  label: unknown;
  value?: string;
  name?: string;
  variants?: string[];
}

/** Forme minimale d'un filtre à options — vaut pour `dropdownFilters` comme pour `filterGroups`. */
interface FiltreAOptions {
  id: string;
  options?: OptionFiltre[];
  optionsFrom?: {
    /** Une liste `costum.lists`, ou PLUSIEURS à fusionner (un même champ alimenté depuis plusieurs
     *  collections = une recette par collection). Forme de chacune détectée automatiquement. */
    list?: string | string[];
    costumSlug?: string;
    /** Les `options` déclarées deviennent le SOCLE (fusionné, libellés i18n conservés) au lieu d'un
     *  simple repli de chargement. Opt-in — cf. le commentaire de `useDynamicFilterOptions`. */
    withDeclared?: boolean;
    /** Couche de contours servant de référentiel — exclusive de `list` (cf. `OptionsFromSchema`). */
    shapes?: GeoShapeSource;
  };
  /** DÉPRÉCIÉ — alias de `optionsFrom.list`. Distinguait autrefois la source STATIQUE de la source
   *  dynamique ; la forme est désormais détectée à la lecture, le rédacteur de config n'a plus à
   *  choisir. Conservé pour les configs existantes. */
  optionsKey?: string;
}

/**
 * Résout les options des filtres qui déclarent une source DYNAMIQUE.
 *
 * DEUX ORIGINES, exclusives (cf. `OptionsFromSchema`) :
 *
 *  • `list` / `optionsKey` — UNE SEULE MÉCANIQUE, N SOURCES (cf. `@/lib/listSources`) : les `options`
 *    déclarées en config peuvent servir de SOCLE (`withDeclared`), puis chaque liste nommée est
 *    résolue SELON SA FORME — statique lue en mémoire, recette envoyée à `costum/co/listvalues`.
 *    `optionsKey` n'est plus qu'un alias de `optionsFrom.list` : se tromper de clé ne produisait
 *    aucune erreur, juste un repli silencieux sur les options figées.
 *
 *  • `shapes` — le référentiel d'une couche de contours. L'option porte l'`_id` du document et
 *    AFFICHE son `name` : les deux sont dissociés, ce qui est tout l'intérêt — on filtre sur un
 *    identifiant stable (`address.zonirisId`) pendant que le libellé, lui, suit les corrections de
 *    nom faites en base. La requête est celle de la carte (`geoShapeQueryOptions`), à la clé près :
 *    quand la page dessine déjà la couche, le filtre ne coûte AUCUN octet de plus.
 *
 * POURQUOI DES VALEURS DYNAMIQUES : le filtre suit la donnée réelle au lieu d'une liste figée qui
 * dérive (mesuré sur institutBleu : 12 territoires déclarés contre 64 en base, soit 52 valeurs
 * injoignables).
 *
 * SOCLE OPT-IN, PAS PAR DÉFAUT. Sans `withDeclared`, les valeurs résolues REMPLACENT les options
 * déclarées — comportement historique, délibéré : fusionner partout ferait réapparaître des valeurs de
 * config qui n'existent plus en base, donc des filtres qui ne rendent rien. Avec `withDeclared`, les
 * options déclarées passent en tête et **gardent leur libellé traduit** (une valeur venue de la base et
 * absente du socle s'affiche, elle, en `capitaliser(valeur)` — traduire supposerait une table à
 * maintenir, donc la dérive qu'on vient de supprimer).
 *
 * Un filtre sans `optionsFrom` ni `optionsKey` est renvoyé inchangé, sans aucune requête.
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
   *  écrit pas, et les consommateurs lisent `filter.options` sans garde — `SearchHeaderSection`
   *  en fait 7 lectures directes, et un filtre 100 % dynamique n'a aucune option déclarée. */
  options: NonNullable<T["options"]>;
};

/**
 * Plafond demandé au serveur. En deçà, la liste arrive ENTIÈRE et la recherche se fait dans le
 * navigateur — instantanée, sans aller-retour. Au-delà, le serveur coupe (`tronque`) et c'est LUI qui
 * cherche : sans cela, plafonner rendrait invisibles les valeurs situées après la coupe alphabétique.
 * 300 couvre 7 des 8 listes dynamiques du parc (la plus grosse, `tagsDocument`, en compte 1 209).
 */
const PLAFOND = 300;

/** Les listes d'un filtre, normalisées — `optionsFrom.list` (une ou plusieurs) ou l'alias `optionsKey`. */
function nomsDeListes(f: FiltreAOptions): string[] {
  const brut = f.optionsFrom?.list ?? f.optionsKey;
  if (!brut) return [];
  const noms = Array.isArray(brut) ? brut : [brut];
  return noms.filter((n): n is string => typeof n === "string" && n !== "");
}

/** Valeur portée par une option déclarée — `value` d'abord (dropdownFilter), `name` ensuite
 *  (filterGroup à `field`), `id` en dernier recours. */
function valeurDe(o: OptionFiltre): string {
  return o.value ?? o.name ?? o.id;
}

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
  const { entity: carrier } = useCocolight();

  // UNE entrée par couple (filtre, liste) — un filtre peut en nommer plusieurs, et `useListEntries`
  // exige un nombre et un ordre d'entrées constants d'un rendu à l'autre.
  //
  // La recherche n'est transmise au SERVEUR que pour une liste qu'il a COUPÉE : tant qu'on tient la
  // liste entière, filtrer localement est plus rapide et ne consomme rien. Mémorisé par couple
  // (filtre, liste) : deux listes du même filtre peuvent être coupées indépendamment.
  const tronquees = useRef<Record<string, boolean>>({});
  const termes = (filtres ?? [])
    .map((f) => `${f.id}=${(recherches?.[f.id] ?? "").trim()}`)
    .join("|");
  const entrees = useMemo<EntreeDeListe[]>(() => {
    const out: EntreeDeListe[] = [];
    for (const f of filtres ?? []) {
      for (const nom of nomsDeListes(f)) {
        const terme = tronquees.current[`${f.id}/${nom}`] ? (recherches?.[f.id] ?? "").trim() : "";
        out.push({ cle: f.id, nom, costumSlug: f.optionsFrom?.costumSlug, limit: PLAFOND, ...(terme ? { q: terme } : {}) });
      }
    }
    return out;
    // `termes` (chaîne) plutôt que `recherches` (objet neuf à chaque frappe) : seul son CONTENU compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtres, termes]);

  const parFiltre = useListEntries(entrees);

  // Mémorisé APRÈS la réponse : la première requête part sans `q`, découvre la troncature, et les
  // suivantes deviennent des recherches serveur.
  for (const [id, res] of parFiltre) {
    for (const nom of res.tronquees) tronquees.current[`${id}/${nom}`] = true;
  }

  // Référentiel géographique : EXACTEMENT la requête de la carte — même clé, même fetcher, même
  // fraîcheur (`geoShapeQueryOptions`). Quand la page dessine déjà cette couche, le filtre la lit dans
  // le cache et n'ajoute AUCUN appel ; sinon c'est lui qui la déclenche, et la carte la trouvera prête.
  // Ordre STABLE, comme pour les listes : `useQueries` exige un nombre et un ordre constants.
  const contours = useMemo(
    () => (filtres ?? []).filter((f) => !!f.optionsFrom?.shapes),
    [filtres],
  );
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

  return useMemo(() => {
    if (!filtres?.length) return [];

    const parIdContours = new Map<string, { options: ReturnType<typeof optionsDepuisContours>; regle: boolean }>();
    contours.forEach((f, i) => parIdContours.set(f.id, {
      options: optionsDepuisContours(resultatsContours[i]?.data),
      regle: reglesContours[i] ?? false,
    }));

    return filtres.map((f) => {
      // `options` est OBLIGATOIRE dans le type de sortie du schéma (`.default([])`), mais la config JSON
      // n'est jamais parsée par Zod au runtime : un filtre 100 % dynamique (`optionsFrom` seul, aucune
      // option écrite à la main — le cas du filtre « Catégorie » de parent62 depuis le retrait des
      // catégories par défaut) arrive donc ici avec `options: undefined`, et les 7 lectures de
      // `filter.options` de `SearchHeaderSection` (`getDropdownSelectedValues`) plantaient la section
      // entière. Ce hook est le normaliseur de la liste consommée par le rendu : le défaut se pose
      // ICI, au seul point qui résout les options.
      const declarees = f.options ?? [];

      if (f.optionsFrom?.shapes) {
        const res = parIdContours.get(f.id);
        // Même règle de repli que pour une liste : tant que les contours ne sont pas arrivés, les
        // options DÉCLARÉES continuent de servir, mais le filtre est signalé NON PRÊT pour que
        // l'hydratation URL attende les vraies valeurs. Une requête réglée sans contour dessinable
        // débloque l'hydratation plutôt que de figer la page.
        if (!res?.options.length) return { ...f, options: declarees, optionsReady: res?.regle ?? false };
        return { ...f, optionsReady: true, options: res.options };
      }

      const res = parFiltre.get(f.id);
      if (!res) return { ...f, options: declarees, optionsReady: true };

      const socle: SourceDeValeurs[] = f.optionsFrom?.withDeclared
        ? [{ values: declarees.map(valeurDe).filter((v) => v !== "") }]
        : [];
      const { values, variants } = resolveListSources([...socle, ...res.sources]);

      // PRÊT = toutes les sources dynamiques ont répondu — JAMAIS « on a déjà des valeurs ». La nuance
      // est tout sauf cosmétique depuis qu'un socle déclaré (`withDeclared`) fournit des valeurs dès le
      // premier rendu : annoncer « prêt » alors qu'une recette est encore en vol laisse l'hydratation URL
      // s'exécuter trop tôt, puis l'arrivée des valeurs rejoue l'effet de lecture — qui, l'URL étant vide
      // et l'hydratation déjà faite, EFFACE la sélection par défaut (cible « Actualités » de parent62).
      // Une source réglée mais VIDE est prête, elle : on débloque au lieu de figer la page sur une liste
      // qui ne répondra jamais.
      const pret = res.regle;
      // Tant que rien n'est résolu, on garde les options DÉCLARÉES : le filtre reste utilisable (et un
      // repli écrit à la main continue de servir) au lieu de disparaître.
      if (!values.length) return { ...f, options: declarees, optionsReady: pret };

      // Une option DÉCLARÉE est réutilisée telle quelle pour la valeur qu'elle porte : c'est ce qui
      // conserve son libellé traduit (et sa couleur, son `level`…). Les valeurs venues de la base et
      // absentes du socle n'ont pas de libellé : seule leur CASSE d'affichage est retouchée, la valeur
      // stockée reste intacte (c'est elle qui part en requête, au caractère près).
      const parValeur = new Map(declarees.map((o) => [normalizeFilterValue(valeurDe(o)), o]));
      return {
        ...f,
        optionsReady: pret,
        options: values.map((v) => {
          // `variants` : toutes les graphies derrière la valeur affichée. Le filtre doit interroger le
          // GROUPE entier — n'envoyer que « Le Port » laisserait de côté les fiches portant « LE PORT »
          // ou « Le port », qui coexistent réellement en base.
          const groupe = variants[v];
          const declaree = parValeur.get(normalizeFilterValue(v));
          if (declaree) {
            const fusion = groupe?.length
              ? [...new Set([...(declaree.variants ?? []), ...groupe])]
              : declaree.variants;
            return { ...declaree, ...(fusion?.length ? { variants: fusion } : {}) };
          }
          // `value` ET `name` : un `dropdownFilter` lit `value`, un `filterGroup` à `field` lit `name` —
          // c'est ce dernier qui part en `{ <field>: { $in: [...] } }` et doit donc porter la valeur
          // EXACTE stockée. Les renseigner tous deux rend ces options utilisables par les deux mécanismes.
          return { id: v, label: capitaliser(v), value: v, name: v, ...(groupe?.length ? { variants: groupe } : {}) };
        }),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtres, parFiltre, contours, empreinteContours]);
}
