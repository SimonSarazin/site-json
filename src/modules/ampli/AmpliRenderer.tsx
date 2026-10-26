import { Suspense } from "react";
import { useAmpliContext } from "./hooks/useAmpliContext";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/hooks/useT";
import { AmpliSectionRenderer } from "./AmpliSectionRenderer";

interface AmpliRendererProps {
    activeTab: string;
}

export function AmpliRenderer({ activeTab }: AmpliRendererProps) {

    const { ampli } = useAmpliContext();
    const t = useT("modules/ampli");

    return (
        <div className="ampli-container w-full">
            <Suspense
                fallback={
                    <div className="flex items-center justify-center min-h-[400px]">
                        <Spinner className="h-8 w-8" label={String(t("a11y.loading"))} />
                    </div>
                }
            >
                <AmpliSectionRenderer activeTab={activeTab} ampli={ampli} />
            </Suspense>
        </div>
    )
}
