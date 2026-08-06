import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useT } from "@/hooks/useT";
import { useCocolight } from "@/hooks/useCocolight";
import { cheminAnnotation } from "@/modules/search/lib/costumSubType";
import "@/modules/admin/i18n";

/**
 * Carrier costum exposant le référencement (BaseEntity, lib ≥ 1.0.160) : rattache/détache un élément
 * du costum courant (`reference.costum` / `source.keys`) via SET_SOURCE (SetSourceAction).
 */
export interface ReferencingCarrier {
  slug?: string;
  addReference: (type: string, id: string) => Promise<{ result: boolean; msg?: string } | null>;
  removeReference: (type: string, id: string) => Promise<{ result: boolean; msg?: string } | null>;
  removeFromSource: (type: string, id: string) => Promise<{ result: boolean; msg?: string } | null>;
}

/** `classify` : (re)pose la seule ANNOTATION de sous-type, sans toucher au référencement. */
export type ReferenceOp = "reference" | "unreference" | "detach" | "classify";

interface ReferenceVars {
  carrier: ReferencingCarrier;
  op: ReferenceOp;
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

/** Mutation de (dé)référencement d'un élément sous le costum du carrier (P5). Toast + refetch. */
export function useReferenceElement(onDone?: () => void) {
  const queryClient = useQueryClient();
  const { api } = useCocolight();
  const t = useT("modules/admin");

  /** Écrit un chemin sur l'entité CIBLE via updatepathvalue (`value: ""` → $unset côté backend). */
  const ecrire = async (collection: string, id: string, path: string, value: unknown) => {
    const client = api as unknown as {
      endpointApi: { updatePathValue: (d: Record<string, unknown>) => Promise<unknown> };
    } | null;
    if (!client) throw new Error("api indisponible");
    await client.endpointApi.updatePathValue({ id, collection, path, value });
  };

  return useMutation({
    mutationFn: async ({ carrier, op, type, id, subType, moderate }: ReferenceVars) => {
      const slug = carrier.slug ?? "";

      if (op === "classify") {
        // Reclassement / rattrapage d'un « référencé non classé » : l'annotation seule.
        if (!slug || !subType) throw new Error(t("useReferenceElement.error"));
        await ecrire(type, id, cheminAnnotation(slug), subType);
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
        if (subType) {
          try {
            await ecrire(type, id, cheminAnnotation(slug), subType);
          } catch {
            toast.warning(t("useReferenceElement.referencedUnclassified"));
          }
        }
        if (moderate) {
          try {
            // Chemin SCOPÉ — jamais le boolean global, qui masquerait l'entité chez les autres sites.
            // Échoue si l'entité porte déjà un `preferences.toBeValidated` scalaire (chemin sous
            // scalaire) : toléré, documenté.
            await ecrire(type, id, `preferences.toBeValidated.${slug}`, true);
          } catch { /* non bloquant */ }
        }
      }
      // Dé-référencement : nettoyage best-effort de l'annotation (une orpheline serait de toute
      // façon inerte — le scope costum s'applique en $and au-dessus de tout filtre).
      if (op === "unreference" && slug) {
        try {
          await ecrire(type, id, cheminAnnotation(slug), "");
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
