import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useLocation } from "react-router";

/* --------------------------------------------------------------------------
 * Types utilitaires ---------------------------------------------------------
 * ------------------------------------------------------------------------ */

/** Fonction qui convertit un string issu de l'URL vers le type T */
export type Parser<T> = (value: string) => T;
/** Fonction qui convertit une valeur T vers un string sérialisable dans l'URL */
export type Serializer<T> = (value: T) => string | undefined;

export interface ParamConfig<T> {
  parse?: Parser<T>;
  serialize?: Serializer<T>;
  defaultValue?: T | (() => T);
}

/** Infère le type de valeur porté par un ParamConfig */
type ValueOfConfig<P> = P extends ParamConfig<infer T> ? T : never;

/** Collection de paramètres supportés par le hook */
export type ConfigType = Record<string, ParamConfig<unknown>>;

/** Nom du setter généré pour une clé `K` (ex: foo → setFoo) */
type SetterName<K extends string> = `set${Capitalize<K>}`;

/** États calculés à partir d'une configuration */
export type States<C extends ConfigType> = {
  [K in keyof C]: ValueOfConfig<C[K]>;
};

/** Setters correspondants */
export type Setters<C extends ConfigType> = {
  [K in keyof C as SetterName<string & K>]: (value: States<C>[K]) => void;
};

/** Fusionne States + Setters */
type HookReturn<C extends ConfigType> = States<C> & Setters<C>;

/* --------------------------------------------------------------------------
 * Hook factory --------------------------------------------------------------
 * ------------------------------------------------------------------------ */

export function createSearchParamsSync<C extends ConfigType>(config: C) {
  const keys = Object.keys(config) as (keyof C & string)[];

  return function useSyncedParams(
    deferredDefaults: Partial<States<C>> = {},
  ): HookReturn<C> {
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();

    
    // ① on stocke la route au montage
    const initialPathRef = useRef(location.pathname);


    /* ------------------------ Initialisation des états ------------------- */
    const computeInitialStates = useCallback((): States<C> => {
      const initial = {} as States<C>;

      keys.forEach((key) => {
        const cfg = config[key];
        const parse = (cfg.parse as Parser<States<C>[typeof key]>) ??
          ((v: string) => v as unknown as States<C>[typeof key]);

        const raw = searchParams.get(key);

        const fallback =
          key in deferredDefaults
            ?  
              (deferredDefaults as Record<string, unknown>)[key] as States<C>[typeof key]
            : typeof cfg.defaultValue === "function"
              ?  
                (cfg.defaultValue as () => States<C>[typeof key])()
              : (cfg.defaultValue as States<C>[typeof key] | undefined);

        initial[key] = raw != null ? parse(raw) : fallback!;
      });

      return initial;
    }, [searchParams, deferredDefaults]);

    const [states, setStates] = useState<States<C>>(computeInitialStates);


    // ② si on change de route, on efface tout
    // reset URL + reset states
    useEffect(() => {
      if (location.pathname !== initialPathRef.current) {
        // vide l'URL
        setSearchParams(new URLSearchParams(), { replace: true });
        // remet les states à leurs valeurs par défaut
        setStates(computeInitialStates());
        initialPathRef.current = location.pathname;
      }
    }, [location.pathname, setSearchParams, computeInitialStates]);

    /* --------------------------- Setters dynamiques ---------------------- */
    const setters = useMemo(() => {
      const s = {} as Partial<Setters<C>>;

      keys.forEach((key) => {
        const capitalizedKey = (key.charAt(0).toUpperCase() + key.slice(1)) as Capitalize<typeof key>;
        const setterName = `set${capitalizedKey}` as SetterName<typeof key>;

         
        (s as Record<string, unknown>)[setterName] = (value: States<C>[typeof key]) => {
  // Protection : si on reçoit une fonction par erreur, on ignore
  if (typeof value === "function") {
    console.warn(`🛑 Ignored setter for ${key} because a function was passed instead of a value`, value);
    return;
  }

  setStates((prev) => ({ ...prev, [key]: value }));
};
      });

      return s as unknown as Setters<C>;
       
    }, [setStates]);

    /* ------------------------- Sync → URL -------------------------------- */
    useEffect(() => {
      if (location.pathname === initialPathRef.current) {
      const params: Record<string, string> = {};

      keys.forEach((key) => {
        const { serialize } = config[key];
        const value = states[key];
        const serialized = serialize ? serialize(value) : (value as unknown as string);
        if (serialized !== undefined && serialized !== null) {
          params[key] = serialized;
        }
      });

      setSearchParams(params, { replace: true });
    }
    }, [states, setSearchParams, location.pathname]);

    /* ------------------------- Valeur retournée -------------------------- */
    return { ...states, ...setters } as HookReturn<C>;
  };
}
