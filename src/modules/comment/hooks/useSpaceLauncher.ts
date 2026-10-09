import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useDiscussionUrlState } from "./useDiscussionUrlState";
import { parseDiscussionValue, sameTarget, threadValue } from "../lib/filKey";
import { belongsToSpace, generalTarget, spaceKey } from "../lib/space";
import type { CommentTarget, SpaceRef } from "../types";

export interface SpaceLauncher {
  /** La modale de CET espace doit-elle être ouverte ? */
  readonly open: boolean;
  /** Le fil de cet espace que l'adresse désigne, s'il y en a un. */
  readonly target: CommentTarget | null;
  /** Ouvre l'espace — sur son fil général, ou sur le fil donné. Empile une entrée d'historique. */
  readonly openAt: (target?: CommentTarget) => void;
  /** Change de fil, ou revient à la liste (`null`), sans fermer. Remplace l'entrée courante. */
  readonly select: (target: CommentTarget | null) => void;
  /** Ferme. Défait l'ouverture si elle vient d'ici (« retour »), sinon remplace l'adresse. */
  readonly close: () => void;
}

/**
 * Ce que le lanceur range dans l'ENTRÉE d'historique (`location.state`), sous une clé à lui :
 *   - `pushed` — cette entrée a été empilée par `openAt` : la fermer, c'est y renoncer ;
 *   - `list`   — la modale y est ouverte sur la LISTE des fils, ce qu'une adresse ne sait pas dire.
 * `space` borne la marque à un espace : celle d'un autre commun ne vaut rien ici.
 */
interface EntryMark {
  readonly space: string;
  readonly pushed?: true;
  readonly list?: true;
}
const MARK_KEY = "commentSpace";

function readMark(state: unknown, space: string): EntryMark | null {
  const mark = (state as Record<string, unknown> | null | undefined)?.[MARK_KEY] as Partial<EntryMark> | null | undefined;
  if (!mark || typeof mark !== "object" || mark.space !== space) return null;
  return { space, ...(mark.pushed === true ? { pushed: true } : {}), ...(mark.list === true ? { list: true } : {}) };
}

/** L'état d'une entrée avec notre marque posée, ou retirée — le reste appartient à d'autres. */
function withMark(state: unknown, mark: EntryMark | null): unknown {
  const others = state && typeof state === "object" ? { ...(state as Record<string, unknown>) } : {};
  delete others[MARK_KEY];
  if (mark) others[MARK_KEY] = mark;
  return Object.keys(others).length > 0 ? others : null;
}

/** L'adresse saurait-elle RELIRE ce fil ? Elle l'écrit sans contrôle, mais ne relit qu'un chemin court et sans surprise. */
function isAddressable(target: CommentTarget): boolean {
  const reread = parseDiscussionValue(threadValue(target));
  return reread.kind === "thread" && sameTarget(reread.target, target);
}

/**
 * Ce qu'une fiche doit savoir pour ouvrir l'ESPACE de discussion de son élément.
 *
 * Même règle que `useDiscussionLauncher` : **`open` est dérivé au rendu**, d'où un lien profond
 * qui ouvre la modale dès le premier rendu. Deux différences, qui tiennent à ce qu'est un espace :
 *
 *   - l'adresse ne compte que si elle désigne un fil DE CET ESPACE. `?discussion=…` appartient à
 *     tout le site : le fil d'un autre commun, ou d'une actualité, ne doit pas ouvrir cette fiche ;
 *   - elle ne demande pas les non-lus du rail — celui-ci exige une session, et une fiche se lit
 *     sans. Le compteur de l'espace vient de `useDiscussionSpaceQuery`.
 *
 * **Aucun état React.** Ce que l'adresse ne dit pas — la modale ouverte sur la liste des fils,
 * l'entrée empilée par l'ouverture — vit dans l'entrée d'historique elle-même, et arrive donc au
 * même rendu que l'adresse. Tenu dans un état local, il arrivait AVANT elle (l'adresse atteint
 * React dans une transition) : la modale s'ouvrait sans son fil, se rouvrait seule si on la fermait
 * dans l'intervalle, et « retour » ne la fermait pas (mesuré au navigateur le 07/10).
 *
 * **Fermer défait l'ouverture** (arbitré le 09/10). Une modale ouverte d'ici a empilé une entrée :
 * la croix et Échap y renoncent, comme « retour » — celui-ci ramène ensuite à la page d'avant la
 * fiche, comme si l'on n'avait rien ouvert. Arrivé par un lien, il n'y a rien à défaire :
 * l'adresse est remplacée. Le panneau général, lui, empile à la fermeture (`useDiscussionUrlState`).
 */
export function useSpaceLauncher(space: SpaceRef, options?: { readonly param?: string }): SpaceLauncher {
  const { selection, open: empiler, select: remplacer } = useDiscussionUrlState({ param: options?.param });
  const { key: entree, state } = useLocation();
  const navigate = useNavigate();
  const cle = spaceKey(space);

  const target = useMemo(
    () => (selection.kind === "thread" && belongsToSpace(selection.target, space) ? selection.target : null),
    [selection, space],
  );
  const marque = useMemo(() => readMark(state, cle), [state, cle]);
  const open = target !== null || marque?.list === true;

  // Un seul ordre d'ouverture ou de fermeture par entrée. L'adresse arrive dans une transition :
  // tant qu'elle n'est pas là, un second ordre repartirait du même état — deux touchers sur le
  // bouton empileraient deux entrées jumelles, deux Échap feraient deux « retour » et quitteraient
  // la fiche. Relâché à chaque entrée qui arrive, traversée de l'historique comprise.
  const enVol = useRef(false);
  useEffect(() => { enVol.current = false; }, [entree]);

  // Un fil qui n'ouvrirait pas la modale ne s'écrit pas : l'adresse le perdrait à la relecture, et
  // la modale se fermerait sur un paramètre que plus rien ne sait lire.
  const ouvrable = useCallback(
    (cible: CommentTarget) => belongsToSpace(cible, space) && isAddressable(cible),
    [space],
  );

  const select = useCallback((cible: CommentTarget | null) => {
    if (cible !== null && !ouvrable(cible)) return;
    // La marque suit l'entrée qu'on remplace : empilée d'ici ou non, sur la liste ou non.
    const gardee: EntryMark | null = marque?.pushed || cible === null
      ? { space: cle, ...(marque?.pushed ? { pushed: true } : {}), ...(cible === null ? { list: true } : {}) }
      : null;
    remplacer(cible ? { kind: "thread", target: cible } : { kind: "none" }, { state: withMark(state, gardee) });
  }, [cle, marque, ouvrable, remplacer, state]);

  const openAt = useCallback((voulue?: CommentTarget) => {
    const cible = voulue ?? generalTarget(space);
    // Déjà ouverte, ce n'est plus une ouverture : empiler romprait « fermer défait l'ouverture ».
    if (open) { select(cible); return; }
    if (!ouvrable(cible) || enVol.current) return;
    enVol.current = true;
    empiler({ kind: "thread", target: cible }, { state: withMark(state, { space: cle, pushed: true }) });
  }, [cle, empiler, open, ouvrable, select, space, state]);

  const close = useCallback(() => {
    if (!open || enVol.current) return;
    enVol.current = true;
    if (marque?.pushed) {
      void navigate(-1);
      return;
    }
    // Rien à défaire derrière : on remplace. Et l'on n'efface que NOTRE fil — l'adresse d'une
    // autre discussion n'est pas à cette fiche.
    remplacer(target ? { kind: "none" } : selection, { state: withMark(state, null) });
  }, [marque, navigate, open, remplacer, selection, state, target]);

  return { open, target, openAt, select, close };
}
