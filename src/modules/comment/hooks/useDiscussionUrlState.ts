import { useCallback, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router";
import {
  DEFAULT_DISCUSSION_PARAM,
  formatDiscussionValue,
  parseDiscussionValue,
  parseMessageFragment,
  type DiscussionSelection,
} from "../lib/filKey";

/**
 * La sélection du panneau vit dans l'URL, pas dans React.
 *
 * Les trois colonnes ne se parlent pas : le rail écrit l'URL, la clé de requête de la colonne
 * suivante change, et celle-ci se recharge seule. Aucun état partagé, donc aucune
 * désynchronisation possible — et une adresse partagée rouvre exactement la même vue.
 *
 * Conséquence directe : **rien à synchroniser dans un effet**. On dérive au rendu. C'est ce
 * qui évite le `setState` dans un effet que `react-hooks/set-state-in-effect` proscrit, et
 * qui a déjà causé un défaut au J7 (une ouverture manuelle perdue à chaque relecture).
 *
 * **Écart assumé sur l'historique** : ouvrir et fermer le panneau EMPILE une entrée (`push`),
 * les changements internes la REMPLACENT (`replace`). C'est ce qui donne gratuitement, au
 * bouton retour d'un mobile, la navigation à trois niveaux : message → fil → fermeture.
 */
export interface DiscussionUrlState {
  /** Ce que l'URL désigne : rien, un porteur, un fil, ou « tout ». */
  readonly selection: DiscussionSelection;
  /** Le message visé par le fragment (`#m-…`), s'il y en a un. */
  readonly messageId: string | null;
  /** Le panneau est-il ouvert ? (une sélection, quelle qu'elle soit) */
  readonly isOpen: boolean;
  /** Ouvre le panneau — empile une entrée d'historique. */
  readonly open: (selection: DiscussionSelection, options?: UrlWriteOptions) => void;
  /** Change la sélection à l'intérieur du panneau — remplace l'entrée courante. */
  readonly select: (selection: DiscussionSelection, options?: UrlWriteOptions) => void;
  /** Ferme le panneau — empile une entrée, pour que « retour » rouvre. */
  readonly close: () => void;
}

export interface UrlWriteOptions {
  /**
   * Ce que l'ENTRÉE d'historique écrite doit retenir (`location.state`) — pour ce qu'une adresse
   * ne dit pas mais qui doit suivre « retour » et « suivant ». Absent : l'entrée ne retient rien.
   */
  readonly state?: unknown;
}

export interface UseDiscussionUrlStateOptions {
  /** Nom du paramètre d'URL. Configurable par site ; `discussion` par défaut. */
  readonly param?: string;
}

export function useDiscussionUrlState(
  { param = DEFAULT_DISCUSSION_PARAM }: UseDiscussionUrlStateOptions = {},
): DiscussionUrlState {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hash } = useLocation();

  const raw = searchParams.get(param);
  // Dérivé au rendu : l'URL est la seule source, il n'y a rien à recopier ailleurs.
  const selection = useMemo(() => parseDiscussionValue(raw), [raw]);
  const messageId = useMemo(() => parseMessageFragment(hash), [hash]);

  /**
   * L'écriture repart des paramètres EN PLACE, pour ne toucher qu'au sien. Ce n'est pas une file
   * d'attente : la fonction de mise à jour de react-router reçoit l'instantané du rendu, pas le
   * résultat de l'écriture précédente — deux écritures dans le même rendu partent du même état,
   * et la seconde l'emporte. Qui en émet deux d'affilée s'en garde lui-même (`useSpaceLauncher`
   * n'écoute qu'un ordre par entrée d'historique).
   */
  const write = useCallback(
    (next: DiscussionSelection, replace: boolean, state?: unknown) => {
      setSearchParams(previous => {
        const params = new URLSearchParams(previous);
        const value = formatDiscussionValue(next);
        if (value === null) params.delete(param);
        else params.set(param, value);
        return params;
      }, { replace, state });
    },
    [param, setSearchParams],
  );

  return {
    selection,
    messageId,
    isOpen: selection.kind !== "none",
    open: useCallback((s: DiscussionSelection, options?: UrlWriteOptions) => write(s, false, options?.state), [write]),
    select: useCallback((s: DiscussionSelection, options?: UrlWriteOptions) => write(s, true, options?.state), [write]),
    close: useCallback(() => write({ kind: "none" }, false), [write]),
  };
}
