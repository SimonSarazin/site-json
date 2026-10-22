import { useDiscussionsQuery } from "./useDiscussionsQuery";
import { totalUnread } from "../lib/discussions";

/**
 * Le nombre total de messages non lus, tous porteurs confondus.
 *
 * Il ne coûte **aucune requête de plus** : il partage la clé de cache du rail, que le panneau
 * charge déjà. C'est ce qui rendra trivial le futur point d'entrée dans le chrome du site —
 * une cloche calquée sur `NotificationBell`, derrière un drapeau de configuration.
 */
export function useDiscussionUnread(options?: { readonly enabled?: boolean }) {
  const rail = useDiscussionsQuery({ kind: "rail" }, { enabled: options?.enabled ?? true });
  return {
    unread: totalUnread(rail.carriers),
    isLoading: rail.isLoading,
    /** Faux tant que la session n'est pas établie : l'endpoint refuse les appels anonymes. */
    isReady: rail.isSuccess,
  };
}
