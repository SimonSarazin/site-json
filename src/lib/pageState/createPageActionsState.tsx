import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Helpers passés à la closure `actions` du caller.
 * - `set`  : setter état brut (signature React standard, accepte une valeur ou un updater)
 * - `reset`: remet l'état au `initialState` initial (utile pour les "clear" composés)
 * - `get`  : lit l'état frais (via ref) — utile pour des actions qui ont besoin
 *           du state courant sans devoir le faire passer en argument (évite les
 *           closures stale).
 */
export interface PageActionsHelpers<S> {
  set: React.Dispatch<React.SetStateAction<S>>;
  reset: () => void;
  get: () => S;
}

interface PageActionsConfig<
  S,
  A extends Record<string, (...args: never[]) => unknown>,
  D extends Record<string, unknown> = Record<string, never>
> {
  /** Nom affiché dans displayName du Provider + dans les messages d'erreur des hooks. */
  name: string;
  /** État initial. Accepte une valeur ou une factory (équivalent du 2e overload de useState). */
  initialState: S | (() => S);
  /** Constructeur des actions. La closure reçoit `set`/`reset`/`get`. */
  actions: (helpers: PageActionsHelpers<S>) => A;
  /**
   * Fonction pure qui calcule des valeurs dérivées de l'état. Appelée à chaque
   * render du Provider quand l'état change. Mémoïsée par état brut.
   */
  derived?: (state: S) => D;
}

export interface PageActionsContextValue<
  S,
  A extends Record<string, (...args: never[]) => unknown>,
  D extends Record<string, unknown> = Record<string, never>
> {
  /** État courant + valeurs dérivées (D mergé dans S). */
  state: S & D;
  /** Actions générées par la closure du caller. Référence stable entre renders. */
  actions: A;
}

export interface PageActionsStateResult<
  S,
  A extends Record<string, (...args: never[]) => unknown>,
  D extends Record<string, unknown> = Record<string, never>
> {
  /** Composant Provider à monter autour de l'arbre consommateur. */
  Provider: React.FC<{ children: ReactNode }>;
  /** Hook strict — throw si pas monté dans son Provider. */
  use: () => PageActionsContextValue<S, A, D>;
  /** Hook optionnel — retourne `null` hors Provider. */
  useOptional: () => PageActionsContextValue<S, A, D> | null;
  /** Context React brut — exposé pour les tests ou Provider custom. */
  Context: React.Context<PageActionsContextValue<S, A, D> | null>;
}

/**
 * Factory pour créer un contexte React de type "actions" — pattern adapté
 * aux modules qui partagent un état avec quelques setters + actions composées
 * entre plusieurs sections d'une même page.
 *
 * Forme du retour : `{ state, actions }`.
 * - `state` contient les champs bruts + les `derived` (mémoïsés).
 * - `actions` est une référence stable (mémoïsée une seule fois), donc les
 *   composants qui ne lisent que `actions` ne re-rendent pas quand le state
 *   change. (Pour exploiter ça, splitter les contextes serait plus radical
 *   mais pas implémenté ici — KISS pour la 1ère itération.)
 *
 * Convention d'usage par les modules :
 * ```ts
 * // modules/search/contexts/pageFilters.ts
 * export const PageFilters = createPageActionsState({
 *   name: "PageFilters",
 *   initialState: { selectedFilters: {}, searchQuery: "" },
 *   actions: ({ set, reset }) => ({
 *     setSearchQuery: (v: string) => set(s => ({ ...s, searchQuery: v })),
 *     clearFilters: () => reset(),
 *   }),
 *   derived: (s) => ({ filterNames: Object.values(s.selectedFilters).flat() }),
 * });
 *
 * // Côté section :
 * const { state, actions } = PageFilters.use();
 * actions.clearFilters();
 * ```
 *
 * Pour un module qui veut une API "à plat" (rétrocompat), wrapper après :
 * ```ts
 * export function usePageFilters() {
 *   const { state, actions } = PageFilters.use();
 *   return { ...state, ...actions };
 * }
 * ```
 */
export function createPageActionsState<
  S,
  A extends Record<string, (...args: never[]) => unknown>,
  D extends Record<string, unknown> = Record<string, never>
>(
  config: PageActionsConfig<S, A, D>
): PageActionsStateResult<S, A, D> {
  const Context = createContext<PageActionsContextValue<S, A, D> | null>(null);
  Context.displayName = `PageState(${config.name})`;

  const Provider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [rawState, setRawState] = useState<S>(config.initialState);

    // Ref toujours fraîche — permet aux actions (mémoïsées une seule fois) de
    // lire l'état courant sans closure stale. Synchronisée en post-commit
    // (useEffect) et non pendant le render : muter un ref pendant le render
    // casse le rendu concurrent. `get()` n'est appelé que dans des handlers
    // (post-commit), donc la valeur lue est toujours à jour.
    const stateRef = useRef(rawState);
    const initialFactory = useRef(config.initialState);
    useEffect(() => {
      stateRef.current = rawState;
      initialFactory.current = config.initialState;
    });

    // Actions mémoïsées une seule fois — référence stable.
    const actions = useMemo<A>(() => {
      const helpers: PageActionsHelpers<S> = {
        set: setRawState,
        reset: () => {
          const init = initialFactory.current;
          setRawState(typeof init === "function" ? (init as () => S)() : init);
        },
        get: () => stateRef.current,
      };
      // get()/reset() lisent les refs dans des closures appelées dans des
      // handlers (post-commit), jamais pendant le render → pattern valide. Le
      // React Compiler le signale à tort (il ne peut pas prouver que config.actions
      // n'appelle pas get() immédiatement).
      // eslint-disable-next-line react-hooks/refs
      return config.actions(helpers);
    }, []);

    // Derived recomputé quand l'état change.
    const state = useMemo<S & D>(() => {
      const derived = (config.derived ? config.derived(rawState) : ({} as D));
      return { ...rawState, ...derived };
    }, [rawState]);

    const value = useMemo<PageActionsContextValue<S, A, D>>(
      () => ({ state, actions }),
      [state, actions]
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
  };
  Provider.displayName = `PageState(${config.name}).Provider`;

  function use(): PageActionsContextValue<S, A, D> {
    const ctx = useContext(Context);
    if (!ctx) {
      throw new Error(
        `use${config.name} must be used inside <${config.name}.Provider>`
      );
    }
    return ctx;
  }

  function useOptional(): PageActionsContextValue<S, A, D> | null {
    return useContext(Context);
  }

  return { Provider, use, useOptional, Context };
}
