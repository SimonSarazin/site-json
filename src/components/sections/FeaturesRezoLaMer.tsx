import { useLocalization } from "@/hooks/useLocalization";
import { LocalizedString } from "@/types/site-schema";
import { Card } from "@/components/ui/card";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

export interface FeaturesRezoLaMerProps {
    headline: LocalizedString;
    subhead?: LocalizedString;
    variant?: "ocean" | "cyber";
    features: Array<{
        icon: string;
        title: LocalizedString;
        description: LocalizedString;
        color?: string;
    }>;
}

interface FeaturesRezoLaMerSectionProps {
    id?: string;
    props: FeaturesRezoLaMerProps;
}

export function FeaturesRezoLaMer({ id, props }: FeaturesRezoLaMerSectionProps) {
    const { t } = useLocalization();
    const variant = props.variant || "ocean";
    const isCyber = variant === "cyber";

    const getColorClass = (color?: string) => {
        switch (color) {
            case "accent":
                return "text-accent";
            case "chart-2":
                return "text-chart-2";
            case "chart-3":
                return "text-chart-3";
            case "primary":
            default:
                return "text-primary";
        }
    };

    const cardClasses = isCyber
        ? "p-6 bg-card/40 backdrop-blur-sm border-border/50 hover:bg-card/60 transition-all duration-300 hover:shadow-lg animate-fade-in-up group"
        : "p-6 bg-secondary/30 backdrop-blur-ocean border-primary/20 hover:bg-secondary/50 transition-all duration-300 hover:shadow-ocean animate-fade-in-up group";

    const sectionClasses = isCyber
        ? "py-24 px-4 bg-gradient-to-b from-background to-card/20"
        : "py-24 px-4 bg-linear-to-b from-background to-background/80";

    return (
        <section id={id} className={sectionClasses}>
            <div className="container mx-auto max-w-6xl">
                <div className="text-center mb-16 animate-fade-in">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                        {t(props.headline)}
                    </h2>
                    {props.subhead && (
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            {t(props.subhead)}
                        </p>
                    )}
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {props.features.map((feature, index) => (
                        <Card
                            key={index}
                            className={cardClasses}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <DynamicIcon
                                name={feature.icon as IconName}
                                className={`w-12 h-12 mb-4 ${getColorClass(feature.color)} group-hover:scale-110 transition-transform duration-300`}
                            />
                            <h3 className="text-xl font-semibold mb-3 text-foreground">
                                {t(feature.title)}
                            </h3>
                            <p className="text-muted-foreground leading-relaxed">
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
