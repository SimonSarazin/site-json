import { AmpliConfig } from "../../schema";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { MeeteemSection } from "@/modules/ampli/components/sections/MeeteemSection";

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
        <section className="container py-12 md:py-16" id="ampli-messages-section">
            <div className="text-center my-4 sm:my-6 md:my-10">
                <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                    {headline ? t(headline) : t("AmpliMessage.headline")}
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    {subhead ? t(subhead) : t("AmpliMessage.subhead")}
                </p>
            </div>
            <MeeteemSection id={`meeteem-section-${coform}`} props={{ coform, path }} />
        </section>
    );
}