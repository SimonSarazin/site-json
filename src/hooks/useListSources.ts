import { useEffect, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useCocolight } from "@/hooks/useCocolight";
import { useCostumListsReactive } from "@/hooks/useCostumLists";
import { costumListValuesQuery } from "@/hooks/useCostumListValues";
import { costumSlugOf, isDynamicList, staticListValues } from "@/lib/costumLists";
import { resolveListSources, type SourceDeValeurs } from "@/lib/listSources";

/**
 * Résout les valeurs proposées par UNE OU PLUSIEURS listes `costum.lists`, fusionnées avec un socle
 * déclaré en config.
 *
 * DEUX CHOSES QUE L'APPELANT N'A PLUS À SAVOIR :
 *  1. Sous quelle FORME chaque liste est déclarée en base. Une statique (tableau/map) est lue en
 *     mémoire, sans requête ; une recette (`{collection, distinct, where}`, badges) part chez le
 *     serveur (`costum/co/listvalues`, qui refuse justement les statiques). La détection est faite ici
 *     par `isDynamicList` — même règle que le menu dynamique du header, qui l'appliquait déjà seul.
 *     Se tromper de clé de config ne produisait aucune erreur, juste un repli silencieux sur les
 *     options figées : c'est ce piège qu'on supprime.
 *  2. S'il faut substituer ou fusionner. On fusionne, toujours, dans l'ordre : le socle d'abord (ses
 *     libellés i18n survivent), puis chaque liste. Cf. `resolveListSources` pour la règle exacte et
 *     pour l'union des `variants`, sans laquelle un filtre rate les fiches de l'autre collection.
 *
 * `ready` distingue « pas encore chargé » de « chargé et vide » — un filtre s'en sert pour ne pas
 * hydrater l'URL trop tôt (il rejetterait des valeurs qu'il ne connaît pas encore, puis se marquerait
 * comme fait, ce qui perd le deep-link). Une liste statique est prête d'emblée ; une requête qui
 * échoue est prête aussi, sinon la page resterait figée sur une liste qui ne répondra jamais.
 */
export interface OptionsSourcesListe {
  /** Socle déclaré en config (`enum` d'un champ, `options` d'un filtre) — source PRIORITAIRE. */
  declared?: readonly string[];
  /** Costum porteur des listes, si différent de celui du site. */
  costumSlug?: string;
  /** Plafond transmis au serveur pour chaque recette (cf. `PLAFOND` côté filtres). */
  limit?: number;
  /** Coupe toute résolution (champ non concerné, liste absente...). */
  enabled?: boolean;
}

export interface ResultatSourcesListe {
  values: string[];
  variants: Record<string, string[]>;
  ready: boolean;
}

/** Référence STABLE pour « aucune valeur » — un littéral `[]` serait un tableau neuf à chaque rendu,
 *  et invaliderait en boucle les mémos qui en dépendent (même raison que `AUCUNE_LISTE` dans
 *  `useCostumLists`). */
const AUCUNE_VALEUR: string[] = [];

/** Séparateur des clés de dépendance jointes : impossible dans un nom de liste (`[A-Za-z0-9_-]`,
 *  garde serveur `LIST_NAME_PATTERN`) comme dans une valeur affichable. */
const SEP = "␟";

export function useListSources(
  lists: string | readonly string[] | null | undefined,
  options?: OptionsSourcesListe,
): ResultatSourcesListe {
  const { api, entity: carrier } = useCocolight();
  const slugSite = costumSlugOf(carrier);
  const slug = options?.costumSlug ?? slugSite;
  // Un costum ÉTRANGER n'a pas ses déclarations dans le carrier du site : impossible de détecter la
  // forme localement, on interroge donc le serveur (qui refusera poliment si la liste est statique).
  const costumEtranger = !!options?.costumSlug && options.costumSlug !== slugSite;

  const declarations = useCostumListsReactive(carrier);
  const actif = options?.enabled ?? true;
  const limit = options?.limit;

  // Ordre et nombre STABLES d'un rendu à l'autre : `useQueries` l'exige. La clé de dépendance est la
  // chaîne jointe, pas le tableau — un appelant qui reconstruit `["a","b"]` à chaque rendu (cas du
  // moteur de formulaire, qui remappe `options`) relancerait sinon le mémo en boucle.
  const cleNoms = typeof lists === "string" ? lists : (lists ?? AUCUNE_VALEUR).join(SEP);
  const noms = useMemo(
    () => (cleNoms === "" ? AUCUNE_VALEUR : cleNoms.split(SEP).filter((n: string) => n !== "")),
    [cleNoms],
  );

  // Une liste NI déclarée NI servie par un costum étranger ne sera résolue par personne : le silence
  // est le pire retour possible (c'est ainsi qu'une faute de frappe dans un nom de liste passait
  // inaperçue). En DEV, on le dit — dans un effet, pour ne pas le répéter à chaque rendu.
  useEffect(() => {
    if (!import.meta.env.DEV || costumEtranger) return;
    for (const nom of noms) {
      if (declarations[nom] === undefined) {
        console.warn(`[useListSources] liste "${nom}" absente de costum.lists — aucune valeur ne sera résolue.`);
      }
    }
  }, [noms, declarations, costumEtranger]);

  const resultats = useQueries({
    queries: noms.map((nom) =>
      costumListValuesQuery(
        api as never,
        slug,
        nom,
        actif && (costumEtranger || isDynamicList(declarations[nom])),
        // Toujours un objet, jamais `undefined` : c'est ce que `useQueries` a besoin de voir pour
        // inférer un type de `data` homogène sur tout le tableau de requêtes.
        { ...(limit ? { limit } : {}) },
      ),
    ),
  });

  // RÉGLÉ = la requête a répondu, quel qu'en soit le sort — succès, échec, ou jamais lancée
  // (`enabled:false` pour une statique). À ne surtout pas confondre avec « a des valeurs » : les
  // échecs rendent `{values: []}`, et faire porter `ready` sur la présence de valeurs le laisserait
  // à `false` pour toujours.
  const regles = resultats.map((r) => r.isFetched || r.fetchStatus === "idle");

  // `join` plutôt que la référence : react-query rend un tableau neuf à chaque rendu, une dépendance
  // par identité relancerait le mémo en boucle. L'état RÉGLÉ en fait partie, sans quoi le passage
  // « en cours » vers « réglé à vide » ne rejouerait rien.
  const cleDeclared = (options?.declared ?? AUCUNE_VALEUR).join(SEP);
  const empreinte = resultats
    .map((r, i) => (regles[i] ? "1" : "0") + (r.data?.values ?? AUCUNE_VALEUR).join(""))
    .join("");

  return useMemo(() => {
    const sources: SourceDeValeurs[] = [];
    const declared = cleDeclared === "" ? AUCUNE_VALEUR : cleDeclared.split(SEP);
    if (declared.length) sources.push({ values: declared });
    noms.forEach((nom, i) => {
      // Statique : déjà en mémoire, aucune requête n'a été émise pour elle. `staticListValues` rend
      // `null` si la clé est une recette OU n'est pas déclarée ici (costum étranger) — c'est alors le
      // résultat serveur qui fait foi.
      const statique = staticListValues(declarations[nom]);
      if (statique) {
        sources.push({ values: statique });
        return;
      }
      const data = resultats[i]?.data;
      sources.push({ values: data?.values ?? AUCUNE_VALEUR, variants: data?.variants });
    });
    return { ...resolveListSources(sources), ready: regles.every(Boolean) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleDeclared, noms, empreinte, declarations]);
}
