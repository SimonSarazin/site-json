import { createContext } from "react";
import type { ConfiguredAmpli } from "../types";

interface AmpliContextType {
    ampli: ConfiguredAmpli;
}

export const AmpliContext = createContext<AmpliContextType | null>(null);
