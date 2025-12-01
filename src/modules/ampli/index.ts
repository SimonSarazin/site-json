// Routes
export { routes } from "./routes";
export type { ModuleRouteFactory } from "@/lib/modules";

// Pages
export { default as AmpliPage } from "./pages/AmpliPage";

// Composants
export { AmpliRenderer } from "./AmpliRenderer";
export { AmpliSectionRenderer } from "./AmpliSectionRenderer";
export { AmpliSeo } from "./AmpliSeo";

// Contexts & Hooks
export { AmpliProvider } from "./contexts/AmpliProvider";
export { useAmpliContext } from "./hooks/useAmpliContext";
export { useFetchAnswerQuery } from "./hooks/useFetchAnswerQuery";

export type {
    AmpliConfig,
} from "./schema";

export {
    AmpliConfigSchema,
} from "./schema";