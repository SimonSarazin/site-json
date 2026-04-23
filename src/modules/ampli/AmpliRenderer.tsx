import { Suspense } from "react";
import { useAmpliContext } from "./hooks/useAmpliContext";
import { Loader2 } from "lucide-react";
import { AmpliSectionRenderer } from "./AmpliSectionRenderer";

interface AmpliRendererProps {
    activeTab: string;
}

export function AmpliRenderer({ activeTab }: AmpliRendererProps) {

    const { config } = useAmpliContext();

    const layoutClass = {
        "default": "max-w-4xl mx-auto",
        "modern": "max-w-6xl mx-auto",
        "compact": "max-w-3xl mx-auto",
        "fullwidth": "w-full",
    }[config.layout || "default"];

    return (
        <div className={`ampli-container ${layoutClass}`}>
            <Suspense
                fallback={
                    <div className="flex items-center justify-center min-h-[400px]">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                }
            >
                <AmpliSectionRenderer activeTab={activeTab} config={config.props} />
            </Suspense>
        </div>
    )
}