import { useEffect, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useCostumListsReactive } from "@/hooks/useCostumLists";
import { costumListValuesQuery } from "@/hooks/useCostumListValues";
import { costumSlugOf, isDynamicList, staticListValues } from "@/lib/costumLists";
import { resolveListSources, type SourceDeValeurs } from "@/lib/listSources";

/**
 * Résolution des valeurs de listes `costum.lists` — l'orchestration commune à TOUS les consommateurs
 * (champ de formulaire, filtres de page, menu du header).
 *
 * DEUX CHOSES QUE L'APPELANT N'A PLUS À SAVOIR :
 *  1. Sous quelle FORME chaque liste est déclarée en base. Une statique (tableau/map) est lue en
 *     mémoire, sans requête ; une recette (`{collection, distinct, where}`, badges) part chez le
 *     serveur (`costum/co/listvalues`, qui refuse justement les statiques). Se tromper de clé de
 *     config ne produisait aucune erreur, juste un repli silencieux sur les options figées : c'est ce
 *     piège que la détection automatique supprime.
 *  2. S'il faut substituer ou fusionner. On fusionne, dans l'ordre déclaré — cf. `resolveListSources`
 *     pour la règle exacte et pour l'union des `variants`, sans laquelle un filtre alimenté par deux
 *     collections rate les fiches de l'une d'elles.
 *
 * DEUX NIVEAUX, parce que les appelants ne groupent pas pareil :
 *  - `useListEntries` — le socle : N couples (clé, liste) résolus en UNE passe `useQueries`, regroupés
 *    par clé. C'est la forme qu'il faut dès qu'on résout plusieurs ENTITÉS à la fois (un filtre par
 *    groupe, un item par menu) : un hook ne s'appelle pas dans une boucle, et `useQueries` exige un
 *    nombre et un ordre de requêtes constants d'un rendu à l'autre.
 *  - `useListSources` — le cas simple : une entité, une ou plusieurs listes, déjà fusionnées.
 */

/** Une liste à résoudre, rattachée à la CLÉ de l'entité qui la demande (id de filtre, item de nav…). */
export interface EntreeDeListe {
  /** Regroupement : toutes les entrées de même clé sont fusionnées ensemble, dans l'ordre. */
  cle: string;
  /** Nom de la liste dans `costum.lists`. */
  nom: string;
  /** Costum porteur, si différent de celui du site. */
  costumSlug?: string;
  /** Recherche transmise au SERVEUR — n'a de sens que pour une liste qu'il a coupée (`tronquees`). */
  q?: string;
  /** Plafond demandé au serveur pour cette liste. */
  limit?: number;
}

export interface ResolutionParCle {
  /** Une source par entrée, dans l'ordre déclaré — prêtes pour `resolveListSources`. */
  sources: SourceDeValeurs[];
  /** Toutes les sources dynamiques ont répondu (succès, échec, ou requête jamais lancée). */
  regle: boolean;
  /** Listes que le serveur a COUPÉES : au-delà du plafond, c'est à lui de chercher (`q`). */
  tronquees: string[];
}

export interface OptionsSourcesListe {
  /** Socle déclaré en config (`enum` d'un champ, `options` d'un filtre) — source PRIORITAIRE. */
  declared?: readonly string[];
  /** Costum porteur des listes, si différent de celui du site. */
  costumSlug?: string;
  /** Plafond transmis au serveur pour chaque recette. */
  limit?: number;
  /** Coupe toute résolution (champ non concerné, liste absente...). */
  enabled?: boolean;
}

export interface ResultatSourcesListe {
  values: string[];
  variants: Record<string, string[]>;
  /** « Toutes les sources ont répondu », JAMAIS « on a déjà des valeurs » — un socle non vide en
   *  fournit dès le premier rendu, et annoncer « prêt » trop tôt laisse l'hydratation URL d'un filtre
   *  s'exécuter avant l'arrivée des valeurs, ce qui efface la sélection par défaut. */
  ready: boolean;
}

/** Références STABLES pour « rien » — un littéral neuf à chaque rendu invaliderait en boucle les mémos
 *  qui en dépendent (même raison que `AUCUNE_LISTE` dans `useCostumLists`). */
const AUCUNE_VALEUR: string[] = [];
const AUCUNE_ENTREE: EntreeDeListe[] = [];

/** Séparateur des clés de dépendance jointes : impossible dans un nom de liste (`[A-Za-z0-9_-]`,
 *  garde serveur `LIST_NAME_PATTERN`) comme dans une valeur affichable. */
const SEP = "␟";

/**
 * Résout N couples (clé, liste) en UNE passe et les regroupe par clé.
 *
 * `entrees` doit être MÉMORISÉ par l'appelant : son ordre et son nombre commandent ceux des requêtes.
 */
export function useListEntries(
  entrees: readonly EntreeDeListe[],
  options?: { enabled?: boolean },
): Map<string, ResolutionParCle> {
  const { api, entity: carrier } = useCocolight();
  const slugSite = costumSlugOf(carrier);
  const declarations = useCostumListsReactive(carrier);
  const actif = options?.enabled ?? true;

  // Une liste NI déclarée NI servie par un costum étranger ne sera résolue par personne : le silence
  // est le pire retour possible (c'est ainsi qu'une faute de frappe dans un nom de liste passait
  // inaperçue). En DEV, on le dit — dans un effet, pour ne pas le répéter à chaque rendu.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    for (const e of entrees) {
      if (!e.costumSlug && declarations[e.nom] === undefined) {
        console.warn(`[useListSources] liste "${e.nom}" absente de costum.lists — aucune valeur ne sera résolue.`);
      }
    }
  }, [entrees, declarations]);

  const resultats = useQueries({
    queries: entrees.map((e) => {
      // Un costum ÉTRANGER n'a pas ses déclarations ici : impossible de détecter la forme localement,
      // on interroge donc le serveur (qui refusera poliment si la liste est statique).
      const etranger = !!e.costumSlug && e.costumSlug !== slugSite;
      return costumListValuesQuery(
        api as never,
        e.costumSlug ?? slugSite,
        e.nom,
        actif && (etranger || isDynamicList(declarations[e.nom])),
        // Toujours un objet, jamais `undefined` : c'est ce que `useQueries` a besoin de voir pour
        // inférer un type de `data` homogène sur tout le tableau de requêtes.
        { ...(e.limit ? { limit: e.limit } : {}), ...(e.q ? { q: e.q } : {}) },
      );
    }),
  });

  // RÉGLÉ = la requête a répondu, quel qu'en soit le sort — succès, échec, ou jamais lancée
  // (`enabled:false` pour une statique). À ne surtout pas confondre avec « a des valeurs » : les
  // échecs rendent `{values: []}`, et faire porter l'état prêt sur la présence de valeurs le
  // laisserait à `false` pour toujours.
  const regles = resultats.map((r) => r.isFetched || r.fetchStatus === "idle");

  // `join` plutôt que la référence : react-query rend un tableau neuf à chaque rendu, une dépendance
  // par identité relancerait le mémo en boucle. L'état RÉGLÉ et la troncature en font partie, sans
  // quoi le passage « en cours » vers « réglé » ne rejouerait rien.
  //
  // Joint sur `SEP` et non sur la chaîne vide : concaténer sans séparateur rend deux listes
  // DIFFÉRENTES indiscernables (`["ab","c"]` et `["a","bc"]` donnent la même empreinte), et le mémo
  // garderait alors les anciennes sources. Les `variants` en font partie pour la même raison : une
  // graphie NOUVELLE apparue en base derrière une valeur déjà connue ne change pas `values`, mais
  // change ce que le filtre doit interroger — sans elle dans l'empreinte, cette graphie resterait
  // hors du filtre jusqu'au prochain montage.
  const empreinte = resultats
    .map(
      (r, i) =>
        (regles[i] ? "1" : "0") +
        (r.data?.tronque ? "T" : "") +
        (r.data?.values ?? AUCUNE_VALEUR).join(SEP) +
        SEP +
        Object.entries(r.data?.variants ?? {})
          .map(([v, g]) => v + "=" + (g ?? []).join(SEP))
          .join(SEP),
    )
    .join(SEP);

  return useMemo(() => {
    const parCle = new Map<string, ResolutionParCle>();
    entrees.forEach((e, i) => {
      const acc = parCle.get(e.cle) ?? { sources: [], regle: true, tronquees: [] };
      // Statique : déjà en mémoire, aucune requête n'a été émise pour elle. `staticListValues` rend
      // `null` si la clé est une recette OU n'est pas déclarée ici (costum étranger) — c'est alors le
      // résultat serveur qui fait foi.
      const statique = staticListValues(declarations[e.nom]);
      if (statique) {
        acc.sources.push({ values: statique });
      } else {
        const data = resultats[i]?.data;
        acc.sources.push({ values: data?.values ?? AUCUNE_VALEUR, variants: data?.variants });
        acc.regle = acc.regle && (regles[i] ?? false);
        if (data?.tronque) acc.tronquees.push(e.nom);
      }
      parCle.set(e.cle, acc);
    });
    return parCle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrees, empreinte, declarations]);
}

/**
 * Cas simple : UNE entité, une ou plusieurs listes, fusionnées avec le socle déclaré en config.
 * Enveloppe `useListEntries` — cf. sa docstring pour les règles de résolution.
 */
export function useListSources(
  lists: string | readonly string[] | null | undefined,
  options?: OptionsSourcesListe,
): ResultatSourcesListe {
  // Clé de dépendance = la chaîne jointe, pas le tableau : un appelant qui reconstruit `["a","b"]` à
  // chaque rendu (cas du moteur de formulaire, qui remappe `options`) relancerait sinon le mémo en
  // boucle, et avec lui tout le tableau de requêtes.
  const cleNoms = typeof lists === "string" ? lists : (lists ?? AUCUNE_VALEUR).join(SEP);
  const costumSlug = options?.costumSlug;
  const limit = options?.limit;
  const entrees = useMemo(
    () =>
      cleNoms === ""
        ? AUCUNE_ENTREE
        : cleNoms
            .split(SEP)
            .filter((nom) => nom !== "")
            .map((nom) => ({ cle: "", nom, costumSlug, limit })),
    [cleNoms, costumSlug, limit],
  );

  const parCle = useListEntries(entrees, { enabled: options?.enabled });
  const cleDeclared = (options?.declared ?? AUCUNE_VALEUR).join(SEP);

  return useMemo(() => {
    const res = parCle.get("");
    const declared = cleDeclared === "" ? AUCUNE_VALEUR : cleDeclared.split(SEP);
    const socle: SourceDeValeurs[] = declared.length ? [{ values: declared }] : [];
    return {
      ...resolveListSources([...socle, ...(res?.sources ?? [])]),
      ready: res?.regle ?? true,
    };
  }, [cleDeclared, parCle]);
}
