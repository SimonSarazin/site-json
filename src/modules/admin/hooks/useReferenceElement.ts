import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useT } from "@/hooks/useT";
import { cheminAnnotation } from "@/modules/search/lib/costumSubType";
import "@/modules/admin/i18n";
import { publicSurfaceKeys } from "@/lib/queryKeys";
import { useCocolight } from "@/hooks/useCocolight";

/**
 * Carrier costum exposant le référencement (BaseEntity, lib ≥ 1.0.160) : rattache/détache un élément
 * du costum courant (`reference.costum` / `source.keys`) via SET_SOURCE (SetSourceAction), et la
 * modération scopée via VALIDATE_GROUP (ValidateGroupAction).
 */
export interface ReferencingCarrier {
  slug?: string;
  addReference: (type: string, id: string) => Promise<{ result: boolean; msg?: string } | null>;
  removeReference: (type: string, id: string) => Promise<{ result: boolean; msg?: string } | null>;
  removeFromSource: (type: string, id: string) => Promise<{ result: boolean; msg?: string } | null>;
  validateGroup: (type: string, id: string, valid: boolean) => Promise<unknown>;
}

/** `classify` : (re)pose la seule ANNOTATION de sous-type, sans toucher au référencement. */
export type ReferenceOp = "reference" | "unreference" | "detach" | "classify";

/**
 * Cible des écritures d'annotation : une ENTITÉ lib (les lignes des tableaux admin en sont — les
 * résultats de recherche sont des instances). `updateField` est la voie HAUT-NIVEAU de BaseEntity
 * vers `updatepathvalue` (validations + normalisation du payload) — jamais d'appel `endpointApi`
 * brut ici.
 */
export interface AnnotableEntity {
  updateField: (path: string, value: unknown) => Promise<unknown>;
  /** Document de la ligne. Les tableaux admin tournent en `variant: "admin"`, qui renvoie le
   *  document COMPLET : l'annotation courante est donc lisible sans requête supplémentaire. */
  serverData?: Record<string, unknown>;
}

/**
 * Y a-t-il une annotation `reference.costumTypes.<slug>` À EFFACER sur la cible ?
 *
 * Répond `true` par DÉFAUT quand le document n'est pas lisible (`serverData` absent, ou `reference`
 * hors projection) : on ne saute une écriture que lorsqu'on peut PROUVER qu'elle est inutile.
 * L'inverse — présumer « rien à nettoyer » sur une donnée qu'on n'a pas vue — rejouerait le défaut
 * qu'on vient de corriger, en sautant silencieusement un nettoyage nécessaire.
 */
function peutPorterUneAnnotation(cible: AnnotableEntity | undefined, slug: string): boolean {
  const sd = cible?.serverData;
  if (!sd || !("reference" in sd)) return true; // non lisible → on écrit, comme avant
  const ref = sd.reference as { costumTypes?: Record<string, unknown> } | undefined;
  const valeur = ref?.costumTypes?.[slug];
  return valeur !== undefined && valeur !== "";
}

interface ReferenceVarsBase {
  carrier: ReferencingCarrier;
  type: string;
  id: string;
  /**
   * Sous-type de rattachement (clé `subType` d'un form de `costumForms`) — écrit dans
   * `reference.costumTypes.<slug>` : c'est l'annotation qui classe une entité RÉFÉRENCÉE sans jamais
   * toucher ses champs cœur (ils portent la sémantique d'un autre site). Mono-form : posé
   * automatiquement par l'appelant ; multi-form : choix de l'admin dans le sélecteur.
   */
  subType?: string;
  /** Pose `preferences.toBeValidated.<slug>` (SCOPÉ) — opt-in `moderateReferenced` de la section. */
  moderate?: boolean;
}

/**
 * Les variables sont une UNION DISCRIMINÉE sur `op`, et non un objet à `cible` optionnelle : les
 * trois ops qui écrivent l'annotation l'EXIGENT au type, `detach` (qui n'y touche pas) l'interdit.
 *
 * POURQUOI le type et pas une garde à l'exécution : un `cible?:` uniforme laisse un appelant
 * l'oublier en silence. C'est arrivé — `f59739ff` a introduit `cible` et mis à jour un appelant
 * sur deux ; `AdminResourceTable` a continué de compiler, et pendant un mois son retrait de
 * référence a laissé l'annotation en place sur les six sites qui exposent l'action (`ecrire()`
 * lève « cible manquante » AVANT tout appel réseau, dans un `catch` best-effort). Le compilateur
 * refuse désormais ce qu'une revue avait laissé passer.
 */
type ReferenceVars =
  | (ReferenceVarsBase & {
      op: Exclude<ReferenceOp, "detach">;
      /** L'entité CIBLE (ligne du tableau) — porte les écritures d'annotation via `updateField`. */
      cible: AnnotableEntity;
    })
  | (ReferenceVarsBase & {
      /** Retrait du RATTACHEMENT (`source.keys`) : ne touche à aucune annotation. */
      op: "detach";
      cible?: never;
    });

/** Mutation de (dé)référencement d'un élément sous le costum du carrier (P5). Toast + refetch. */
export function useReferenceElement(onDone?: () => void) {
  const queryClient = useQueryClient();
  // Slug du costum PORTEUR — scope le fil blog dans `publicSurfaceKeys` (le slug de la
  // fiche touchée n'aurait aucun sens ici).
  const { entity: porteur } = useCocolight();
  const t = useT("modules/admin");

  /** Écrit un chemin sur l'entité cible (`value: ""` → $unset, des deux côtés L et B). */
  const ecrire = async (cible: AnnotableEntity | undefined, path: string, value: unknown) => {
    if (!cible) throw new Error("cible manquante pour l'écriture d'annotation");
    await cible.updateField(path, value);
  };

  return useMutation({
    mutationFn: async ({ carrier, op, type, id, cible, subType, moderate }: ReferenceVars) => {
      const slug = carrier.slug ?? "";

      if (op === "classify") {
        // Reclassement / rattrapage d'un « référencé non classé » : l'annotation seule.
        if (!slug || !subType) throw new Error(t("useReferenceElement.error"));
        await ecrire(cible, cheminAnnotation(slug), subType);
        return { result: true } as { result: boolean; msg?: string };
      }

      const res =
        op === "reference" ? await carrier.addReference(type, id)
        : op === "unreference" ? await carrier.removeReference(type, id)
        : await carrier.removeFromSource(type, id);
      // Refus métier en HTTP 200 (`{result:false, msg}`, ex. SetSourceAction « You can't add existed
      // element as sourceKey ») — sinon toast de succès sur une écriture qui n'a pas eu lieu.
      // `null` = champ absent (parité legacy `Rest::json(null)`) : pas un échec.
      if (res && res.result === false) throw new Error(res.msg || t("useReferenceElement.error"));

      // ANNOTATION de sous-type + modération scopée — APRÈS le référencement, et ÉCHEC-TOLÉRANTES :
      // le référencement a eu lieu, l'entité est dans le périmètre ; un raté ici la laisse « non
      // classée », rattrapable par l'action Classer. Ne jamais faire échouer la mutation pour ça.
      if (op === "reference" && slug) {
        // Le référencement est AUTO-RÉPARANT : il ne se contente pas de poser le sous-type demandé,
        // il efface aussi (`""` → $unset) une annotation périmée laissée par un désréférencement
        // passé HORS de cette UI (interface legacy, appel direct, nettoyage raté). Sans ça, la
        // valeur survivrait et reclasserait l'entité en silence avec l'ANCIEN sous-type — et elle
        // serait de nouveau DANS le périmètre, donc consultée.
        //
        // La condition ne restreint que les cas où il n'y a RIEN à faire, et jamais par supposition :
        // `peutPorterUneAnnotation` répond `true` dès que le document n'est pas lisible. Sur les
        // 4 sites (des 6 qui exposent l'action) dont aucun form ne déclare de `subType`, on évite
        // ainsi un `$unset` d'un champ jamais posé à chaque clic.
        if (subType || peutPorterUneAnnotation(cible, slug)) {
          try {
            await ecrire(cible, cheminAnnotation(slug), subType ?? "");
          } catch (err) {
            // Un throw client (cible manquante) et un 401 du Node durci doivent être distinguables
            // d'un succès : `onSuccess` affiche « Référencé » quoi qu'il arrive ici.
            console.warn(`[reference] annotation « ${cheminAnnotation(slug)} » non écrite (non bloquant)`, err);
            if (subType) toast.warning(t("useReferenceElement.referencedUnclassified"));
          }
        }
        if (moderate) {
          try {
            // MODÉRATION SCOPÉE via VALIDATE_GROUP (dévalider = poser `preferences.toBeValidated.<slug>`),
            // PAS via updateField : sur une entité ÉTRANGÈRE, l'admin costum n'a pas les droits
            // d'édition de l'élément — le Node durci refuserait un updatepathvalue hors allowance
            // (401), là où validategroup est le canal d'AUTORITÉ costum-admin des DEUX backends
            // (cascade legacy incluse). Jamais le boolean global, qui masquerait l'entité ailleurs.
            await carrier.validateGroup(type, id, false);
          } catch (err) {
            console.warn(`[reference] modération scopée non appliquée sur ${type}/${id} (non bloquant)`, err);
            toast.warning(t("useReferenceElement.referencedUnmoderated"));
          }
        }
      }
      // Dé-référencement : nettoyage best-effort de l'annotation (une orpheline serait de toute
      // façon inerte — le scope costum s'applique en $and au-dessus de tout filtre).
      if (op === "unreference" && slug) {
        if (peutPorterUneAnnotation(cible, slug)) {
          try {
            await ecrire(cible, cheminAnnotation(slug), "");
          } catch (err) {
            // Muet pour l'utilisateur (l'orpheline est inerte : le scope costum s'applique en $and
            // au-dessus de tout filtre) mais PAS pour le développeur — c'est ce silence total qui a
            // laissé le défaut de `cible` manquante vivre un mois sur six sites.
            console.warn(`[reference] annotation « ${cheminAnnotation(slug)} » non nettoyée au retrait (non bloquant)`, err);
          }
        }
      }
      return res;
    },
    onSuccess: (_res, vars) => {
      const msg = t(
        vars.op === "reference" ? "useReferenceElement.referenced"
        : vars.op === "unreference" ? "useReferenceElement.unreferenced"
        : vars.op === "classify" ? "useReferenceElement.classified"
        : "useReferenceElement.detached");
      toast.success(msg);
      // REVIEW M5 : invalide TOUTES les requêtes admin (autres filtres statut, Contenu vs
      // Référencement, tuiles dashboard) — le refetch() du composant ne couvre que la clé active.
      void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] ?? "").startsWith("admin-") });
      // …et les surfaces PUBLIQUES : ce geste change la VISIBILITÉ d'une fiche, or les listes du site
      // vivent dans des espaces de clés disjoints de `admin-*` (search, agenda, fil blog). Sans ça,
      // la page publique reste sur son cache jusqu'au rechargement — alors que le chemin FORMULAIRE,
      // lui, les rafraîchit déjà via l'`invalidateFn` du costumForm.
      for (const key of publicSurfaceKeys(porteur?.slug ?? undefined)) void queryClient.invalidateQueries({ queryKey: key });
      onDone?.();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("useReferenceElement.error"));
    },
  });
}
