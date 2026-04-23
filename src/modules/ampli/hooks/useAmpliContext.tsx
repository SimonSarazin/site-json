import { useContext } from "react";
import { AmpliContext } from "../contexts/AmpliContext";

export function useAmpliContext() {
    const context = useContext(AmpliContext);
    if (!context) {
        throw new Error("useAmpliContext must be used within an AmpliProvider");
    }
    return context;
}