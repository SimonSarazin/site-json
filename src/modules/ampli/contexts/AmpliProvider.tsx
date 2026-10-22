import { useMemo } from "react";
import type { ConfiguredAmpli } from "../types";
import { AmpliContext } from "./AmpliContext";

interface AmpliProviderProps {
    children: React.ReactNode;
    ampli: ConfiguredAmpli;
}

export function AmpliProvider({ children, ampli }: AmpliProviderProps) {
    // Valeur mémoïsée : un littéral `{ ampli }` neuf à chaque rendu re-rendrait
    // tous les consommateurs du contexte, même quand l'ampli n'a pas changé.
    const value = useMemo(() => ({ ampli }), [ampli]);
    return (
        <AmpliContext.Provider value={value}>
            {children}
        </AmpliContext.Provider>
    );
}
