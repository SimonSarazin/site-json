import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useT } from "@/hooks/useT";
import { cheminAnnotation } from "@/modules/search/lib/costumSubType";
import "@/modules/admin/i18n";

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
}

interface ReferenceVars {
  carrier: ReferencingCarrier;
  op: ReferenceOp;
  type: string;
  id: string;
  /** L'entité CIBLE (ligne du tableau) — porte les écritures d'annotation via `updateField`.
   *  Requise pour `classify`, et pour l'annotation/modération au référencement. */
  cible?: AnnotableEntity;
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

/** Mutation de (dé)référencement d'un élément sous le costum du carrier (P5). Toast + refetch. */
export function useReferenceElement(onDone?: () => void) {
  const queryClient = useQueryClient();
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
        // L'annotation est TOUJOURS réglée, même sans sous-type choisi (`""` → $unset). Sans cela,
        // une valeur laissée par un désréférencement passé HORS de cette UI (interface legacy, appel
        // direct, nettoyage best-effort raté) survivrait et reclasserait l'entité en silence avec
        // l'ancien sous-type — et elle serait de nouveau DANS le périmètre, donc consultée. Le
        // référencement devient ainsi auto-réparant, indépendamment du backend en face.
        try {
          await ecrire(cible, cheminAnnotation(slug), subType ?? "");
        } catch {
          if (subType) toast.warning(t("useReferenceElement.referencedUnclassified"));
        }
        if (moderate) {
          try {
            // MODÉRATION SCOPÉE via VALIDATE_GROUP (dévalider = poser `preferences.toBeValidated.<slug>`),
            // PAS via updateField : sur une entité ÉTRANGÈRE, l'admin costum n'a pas les droits
            // d'édition de l'élément — le Node durci refuserait un updatepathvalue hors allowance
            // (401), là où validategroup est le canal d'AUTORITÉ costum-admin des DEUX backends
            // (cascade legacy incluse). Jamais le boolean global, qui masquerait l'entité ailleurs.
            await carrier.validateGroup(type, id, false);
          } catch {
            toast.warning(t("useReferenceElement.referencedUnmoderated"));
          }
        }
      }
      // Dé-référencement : nettoyage best-effort de l'annotation (une orpheline serait de toute
      // façon inerte — le scope costum s'applique en $and au-dessus de tout filtre).
      if (op === "unreference" && slug) {
        try {
          await ecrire(cible, cheminAnnotation(slug), "");
        } catch { /* best-effort */ }
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
      onDone?.();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t("useReferenceElement.error"));
    },
  });
}
