import { useLocalization } from "@/hooks/useLocalization";
import { LocalizedString } from "@/types/site-schema";
import { Card } from "@/components/ui/card";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

export interface FeaturesRezoLaMerProps {
    headline: LocalizedString;
    subhead?: LocalizedString;
    features: Array<{
        icon: string;
        title: LocalizedString;
        description: LocalizedString;
        color?: "turquoise" | "cyan-bright" | "primary" | "turquoise-light";
    }>;
}

interface FeaturesRezoLaMerSectionProps {
    id?: string;
    props: FeaturesRezoLaMerProps;
}

export function FeaturesRezoLaMer({ id, props }: FeaturesRezoLaMerSectionProps) {
    const { t } = useLocalization();

    const getColorClass = (color?: string) => {
        switch (color) {
            case "cyan-bright":
                return "text-cyan-bright";
            case "primary":
                return "text-primary";
            case "turquoise-light":
                return "text-turquoise-light";
            case "turquoise":
            default:
                return "text-turquoise";
        }
    };

    return (
        <section id={id} className="py-24 px-4 bg-linear-to-b from-ocean-deep to-ocean-deep/80">
            <div className="container mx-auto max-w-6xl">
                <div className="text-center mb-16 animate-fade-in">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 text-ocean-text-light">
                        {t(props.headline)}
                    </h2>
                    {props.subhead && (
                        <p className="text-xl text-ocean-text-muted max-w-2xl mx-auto">
                            {t(props.subhead)}
                        </p>
                    )}
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {props.features.map((feature, index) => (
                        <Card
                            key={index}
                            className="p-6 bg-ocean-mid/30 backdrop-blur-ocean border-turquoise/20 hover:bg-ocean-mid/50 transition-all duration-300 hover:shadow-ocean animate-fade-in-up group"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <DynamicIcon
                                name={feature.icon as IconName}
                                className={`w-12 h-12 mb-4 ${getColorClass(feature.color)} group-hover:scale-110 transition-transform duration-300`}
                            />
                            <h3 className="text-xl font-semibold mb-3 text-ocean-text-light">
                                {t(feature.title)}
                            </h3>
                            <p className="text-ocean-text-muted leading-relaxed">
                                {t(feature.description)}
                            </p>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default FeaturesRezoLaMer;
