import { Suspense } from "react";
import { useAmpliContext } from "./hooks/useAmpliContext";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/hooks/useT";
import { AmpliSectionRenderer } from "./AmpliSectionRenderer";

interface AmpliRendererProps {
    activeTab: string;
}

export function AmpliRenderer({ activeTab }: AmpliRendererProps) {

    const { config } = useAmpliContext();
    const t = useT("modules/ampli");

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
                        <Spinner className="h-8 w-8" label={String(t("a11y.loading"))} />
                    </div>
                }
            >
                <AmpliSectionRenderer activeTab={activeTab} config={config.props} />
            </Suspense>
        </div>
    )
}