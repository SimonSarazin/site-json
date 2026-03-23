import { createContext } from "react";
import { AmpliConfig } from "../schema";

interface AmpliContextType {
    config: AmpliConfig;
}

export const AmpliContext = createContext<AmpliContextType | null>(null);