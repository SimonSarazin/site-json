import { AmpliConfig } from "../../schema";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import MeeteemSection from "./MeeteemSection";
import { AMPLI_SECTION_IDS } from "../../constants/sectionIds";

interface AmpliMessagesProps {
    props: AmpliConfig["props"]["message"];
    path: AmpliConfig["props"]["path"];
    coform: AmpliConfig["props"]["coform"];
}

export default function AmpliMessages({ props, path, coform }: AmpliMessagesProps) {
    const { headline, subhead } = props || {};
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");

    return (
        <section
            className="container mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24"
            id={AMPLI_SECTION_IDS.MESSAGES}
        >
            <div className="text-center my-4 sm:my-6 md:my-10">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground text-balance mb-4 sm:mb-6">
                    {headline ? t(headline) : t("AmpliMessage.headline")}
                </h2>
                <p className="text-base sm:text-lg md:text-xl text-muted-foreground text-pretty max-w-3xl mx-auto leading-relaxed">
                    {subhead ? t(subhead) : t("AmpliMessage.subhead")}
                </p>
            </div>
            <MeeteemSection id={`meeteem-section-${coform}`} props={{ coform, path }} />
        </section>
    );
}