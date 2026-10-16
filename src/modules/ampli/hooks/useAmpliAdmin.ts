import type { CreateAmpliResult } from "@communecter/cocolight-api-client";

import { useCocolight } from "@/hooks/useCocolight";
import { useHydrated } from "@/hooks/useHydrated";
import { useMutationWithToast } from "@/hooks/useMutationWithToast";
import { useSite } from "@/hooks/useSite";
import { levelSatisfies, resolveAdminAccessLevel } from "@/modules/admin/lib/adminEntry";
import { ampliSourceMode, ampliTitle } from "../lib/costumAmpli";
import type { AmpliModel } from "../types";

/** Ce que l'écran de création envoie : le serveur fabrique le formulaire de dépôt. */
export interface AmpliDraft {
  /** Le serveur en dérive la CLÉ de l'entrée — cf. `ampliSlug` (SDK). */
  name: string;
  description?: string;
  tags?: string[];
}

/**
 * L'utilisateur peut-il créer et supprimer des amplis ?
 *
 * Même gate que le back-office du site (`siteAdmin` = admin du porteur, super-admin
 * compris), miroir de l'`isInterfaceAdmin()` que les deux actions legacy exigent.
 * Le serveur revérifie le droit : ce gate n'est qu'un confort d'affichage.
 *
 * Deux restrictions de plus :
 *  - amplis ACTIVÉS seulement (`config.ampli !== true` → rien à créer ni à
 *    supprimer : le site ne lit aucun costum) ;
 *  - jamais avant l'hydratation — `me` et les liens de l'entité sont toujours
 *    vides au SSR, les lire plus tôt ferait diverger le premier rendu client.
 */
export function useCanManageAmplis(): boolean {
  const { config } = useSite();
  const { me, entity } = useCocolight();
  const hydrated = useHydrated();

  if (!hydrated || ampliSourceMode(config.ampli) !== "costum") return false;
  return levelSatisfies(resolveAdminAccessLevel(me, entity), "siteAdmin");
}

/**
 * Crée un ampli dans `costum.ampli` du porteur (`BaseEntity.createAmpli`).
 *
 * Mode A du SDK : le serveur crée AUSSI le formulaire de dépôt et ses cinq
 * questions, et renvoie les chemins obtenus — l'ampli est donc utilisable
 * immédiatement, sans passer par Co.
 *
 * ⚠️ Le serveur ÉCRASE sans prévenir une entrée dont le nom donne un slug déjà
 * pris. La garde est à l'appelant (`AmpliCreateDialog`, via `ampliSlug`).
 */
export function useCreateAmpli() {
  const { entity, refreshEntity } = useCocolight();

  return useMutationWithToast<CreateAmpliResult, AmpliDraft>({
    mutationFn: async (draft) => {
      if (!entity) throw new Error("Entité porteuse du costum indisponible");
      const result = await entity.createAmpli(draft);
      // `costum` arrive AVEC l'entité (`element/about`) : sans ce rechargement,
      // ni la liste ni la page vers laquelle on redirige ne connaîtraient le
      // nouvel ampli. Le serveur a déjà réinitialisé son cache costum.
      await refreshEntity();
      return result;
    },
    successKey: "AmpliList.create.success",
    errorKey: "AmpliList.create.error",
    getSuccessParams: (result) => ({ name: result.ampli?.name || result.slug }),
    namespace: "modules/ampli",
  });
}

/**
 * Supprime un ampli de `costum.ampli` (`BaseEntity.removeAmpli`), avec ses pages
 * Co et son bouton de menu.
 *
 * Le formulaire de dépôt et les propositions déjà déposées SURVIVENT : le
 * legacy ne les touche pas (cf. la doc du SDK). Le dialogue de confirmation le
 * dit à l'utilisateur.
 */
export function useRemoveAmpli() {
  const { entity, refreshEntity } = useCocolight();

  return useMutationWithToast<void, AmpliModel>({
    mutationFn: async (ampli) => {
      if (!entity) throw new Error("Entité porteuse du costum indisponible");
      // La clé de l'entrée, pas un ObjectId : c'est ce que le legacy attend.
      await entity.removeAmpli(ampli.slug);
      await refreshEntity();
    },
    successKey: "AmpliList.delete.success",
    errorKey: "AmpliList.delete.error",
    getSuccessParams: (_result, ampli) => ({ name: ampliTitle(ampli) }),
    namespace: "modules/ampli",
  });
}
