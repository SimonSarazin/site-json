import { useMemo, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useCostumListsReactive } from "@/hooks/useCostumLists";
import { costumListValuesQuery } from "@/hooks/useCostumListValues";
import { capitaliser, costumSlugOf, isDynamicList, staticListValues } from "@/lib/costumLists";
import { resolveListSources, type SourceDeValeurs } from "@/lib/listSources";
import { normalizeFilterValue } from "@/modules/search/lib/dropdownFilters";

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
    list: string | string[];
    costumSlug?: string;
    /** Les `options` déclarées deviennent le SOCLE (fusionné, libellés i18n conservés) au lieu d'un
     *  simple repli de chargement. Opt-in — cf. le commentaire de `resoudreSources` ci-dessous. */
    withDeclared?: boolean;
  };
  /** DÉPRÉCIÉ — alias de `optionsFrom.list`. Distinguait autrefois la source STATIQUE de la source
   *  dynamique ; la forme est désormais détectée à la lecture, le rédacteur de config n'a plus à
   *  choisir. Conservé pour les configs existantes. */
  optionsKey?: string;
}

/**
 * Résout les options des filtres qui tirent leurs valeurs d'une ou plusieurs listes `costum.lists`.
 *
 * UNE SEULE MÉCANIQUE, N SOURCES (cf. `@/lib/listSources`) : les `options` déclarées en config
 * peuvent servir de SOCLE
 * (`withDeclared`), puis chaque liste nommée est résolue SELON SA FORME — statique lue en mémoire,
 * recette envoyée à `costum/co/listvalues`. `optionsKey` n'est plus qu'un alias de `optionsFrom.list` :
 * se tromper de clé ne produisait aucune erreur, juste un repli silencieux sur les options figées.
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
export type FiltreResolu<T> = T & { optionsReady: boolean };

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

export function useDynamicFilterOptions<T extends FiltreAOptions>(
  filtres: readonly T[] | undefined,
  /** Terme cherché par filtre (`{ [id du filtre]: terme }`) — DÉJÀ débouncé par l'appelant. */
  recherches?: Record<string, string>,
): FiltreResolu<T>[] {
  const { api, entity: carrier } = useCocolight();
  const slugSite = costumSlugOf(carrier);

  // Abonné aux signaux réactifs natifs du SDK (cf. `@/hooks/useCostumLists`) : tout `carrier.refresh()`
  // réussi redéclenche ce hook tout seul, sans store maison ni reload.
  const listesStatiques = useCostumListsReactive(carrier);

  // UNE entrée par couple (filtre, liste) — un filtre peut en nommer plusieurs, et `useQueries` exige
  // un nombre et un ordre constants d'un rendu à l'autre : on aplatit donc une bonne fois.
  const entrees = useMemo(() => {
    const out: Array<{ idFiltre: string; nom: string; costumSlug?: string }> = [];
    for (const f of filtres ?? []) {
      for (const nom of nomsDeListes(f)) {
        out.push({ idFiltre: f.id, nom, costumSlug: f.optionsFrom?.costumSlug });
      }
    }
    return out;
  }, [filtres]);

  // La recherche n'est transmise au SERVEUR que pour une liste qu'il a coupée : tant qu'on tient la
  // liste entière, filtrer localement est plus rapide et ne consomme rien. Mémorisé par COUPLE
  // (filtre, liste) : deux listes du même filtre peuvent être coupées indépendamment.
  const tronquees = useRef<Record<string, boolean>>({});
  const resultats = useQueries({
    queries: entrees.map((e) => {
      const cle = `${e.idFiltre}/${e.nom}`;
      const terme = tronquees.current[cle] ? (recherches?.[e.idFiltre] ?? "").trim() : "";
      // Même règle que `useListSources` et que le menu du header : seule une RECETTE part chez le
      // serveur (il refuse les statiques, déjà livrées avec le costum). Un costum ÉTRANGER n'a pas ses
      // déclarations ici : on interroge, lui seul sait.
      const etranger = !!e.costumSlug && e.costumSlug !== slugSite;
      return costumListValuesQuery(
        api as never,
        e.costumSlug ?? slugSite,
        e.nom,
        etranger || isDynamicList(listesStatiques[e.nom]),
        { limit: PLAFOND, ...(terme ? { q: terme } : {}) },
      );
    }),
  });
  // Mémorisé APRÈS la réponse : la première requête part sans `q`, découvre la troncature, et les
  // suivantes deviennent des recherches serveur.
  entrees.forEach((e, i) => {
    if (resultats[i]?.data?.tronque) tronquees.current[`${e.idFiltre}/${e.nom}`] = true;
  });

  // RÉGLÉ = la requête a répondu, quel qu'en soit le sort : succès, échec, ou jamais lancée (liste
  // statique, ou porteur sans slug). À distinguer absolument de « a des valeurs » :
  // `costumListValuesQuery` renvoie `{values: []}` dans TOUS les cas d'échec, et faire porter
  // `optionsReady` sur la présence de valeurs laissait le drapeau à `false` POUR TOUJOURS — ce qui
  // gelait la synchro URL⇄filtres de la PAGE ENTIÈRE (plus de permalien, plus de deep-link, plus de
  // retour arrière), et pas seulement le groupe concerné.
  const regles = resultats.map((r) => r.isFetched || r.fetchStatus === "idle");

  // `join` plutôt que la référence : react-query rend un tableau neuf à chaque rendu, et une dépendance
  // par identité relancerait le mémo en boucle. L'état RÉGLÉ en fait partie, sans quoi le passage
  // « en cours » → « réglé à vide » ne rejouerait rien.
  const termes = entrees.map((e) => (recherches?.[e.idFiltre] ?? "").trim()).join("|");
  const empreinte = resultats
    .map((r, i) => `${regles[i] ? "1" : "0"}` + (r.data?.values ?? []).join(""))
    .join("");

  return useMemo(() => {
    if (!filtres?.length) return [];

    // Sources et état RÉGLÉ, regroupés par filtre — l'ordre des entrées suit celui des listes déclarées,
    // donc celui de la fusion.
    const parFiltre = new Map<string, { sources: SourceDeValeurs[]; regle: boolean }>();
    entrees.forEach((e, i) => {
      const acc = parFiltre.get(e.idFiltre) ?? { sources: [], regle: true };
      const statique = staticListValues(listesStatiques[e.nom]);
      if (statique) {
        acc.sources.push({ values: statique });
      } else {
        const data = resultats[i]?.data;
        acc.sources.push({ values: data?.values ?? [], variants: data?.variants });
        acc.regle = acc.regle && (regles[i] ?? false);
      }
      parFiltre.set(e.idFiltre, acc);
    });

    return filtres.map((f) => {
      const res = parFiltre.get(f.id);
      if (!res) return { ...f, optionsReady: true };

      const declarees = f.options ?? [];
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
      if (!values.length) return { ...f, optionsReady: pret };

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
  }, [filtres, entrees, empreinte, termes, listesStatiques]);
}
