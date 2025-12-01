import { AmpliConfig } from "../schema";
import { AmpliContext } from "./AmpliContext";

interface AmpliProviderProps {
    children: React.ReactNode;
    config: AmpliConfig;
}

export function AmpliProvider({ children, config }: AmpliProviderProps) {
    return (
        <AmpliContext.Provider value={{ config }}>
            {children}
        </AmpliContext.Provider>
    );
}