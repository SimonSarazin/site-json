import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";

interface ParamConfig<T> {
  parse?: (val: string) => T;
  serialize?: (value: T) => string | undefined;
  defaultValue?: T | (() => T);
}

type ConfigType = Record<string, ParamConfig<any>>;

type SetterName<K extends string> = `set${Capitalize<K>}`;

type States<C extends ConfigType> = {
  [K in keyof C]: ReturnType<C[K]['parse'] extends Function ? C[K]['parse'] : (v: string) => any>
};

type Setters<C extends ConfigType> = {
  [K in keyof C as SetterName<K extends string ? K : never>]: (value: States<C>[K]) => void
};

export function createSearchParamsSync<C extends ConfigType>(config: C) {
  return function useSyncedParams(deferredDefaults: Partial<States<C>> = {}): States<C> & Setters<C> {
    const [searchParams, setSearchParams] = useSearchParams();

    const states: Partial<States<C>> = {};
    const setters: Partial<Setters<C>> = {};

    for (const [key, { parse = (v: string) => v as any, defaultValue }] of Object.entries(config) as [keyof C & string, ParamConfig<any>][]) {
      const raw = searchParams.get(key);

      const fallback =
        key in deferredDefaults
          ? deferredDefaults[key as keyof typeof deferredDefaults]
          : typeof defaultValue === "function"
            ? defaultValue()
            : defaultValue;

      const initialValue = raw != null ? parse(raw) : fallback;

      const [state, setState] = useState(initialValue);
      states[key] = state;
      
      const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
      setters[`set${capitalizedKey}` as SetterName<typeof key>] = setState as any;
    }

    useEffect(() => {
      const params: Record<string, string> = {};
      for (const [key, { serialize }] of Object.entries(config) as [keyof C & string, ParamConfig<any>][]) {
        const val = states[key];
        const serialized = serialize ? serialize(val) : val;
        if (serialized !== undefined && serialized !== null) {
          params[key] = serialized;
        }
      }
      setSearchParams(params, { replace: true });
    }, Object.values(states));

    return { ...states, ...setters } as States<C> & Setters<C>;
  };
}
