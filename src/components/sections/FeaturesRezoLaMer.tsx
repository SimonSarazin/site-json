import { useLocalization } from "@/hooks/useLocalization";
import { type FeaturesRezoLaMerProps } from "@/types/site-schema";
import { Card } from "@/components/ui/card";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

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

    const BG_MAP: Record<string, string> = {
        card: "bg-card",
        muted: "bg-muted",
        primary: "bg-primary/10",
        secondary: "bg-secondary",
        accent: "bg-accent/10",
        transparent: "bg-transparent",
    };

    const defaultBg = isCyber
        ? "bg-gradient-to-b from-background to-card/20"
        : "bg-linear-to-b from-background to-background/80";

    const sectionBg = props.bg && props.bg !== "default" ? BG_MAP[props.bg] : defaultBg;

    return (
        <section id={id} className={`py-24 px-4 ${sectionBg}`}>
            <div className="container mx-auto max-w-6xl">
                <div className="text-center mb-16 animate-fade-in">
                    {props.subhead && (
                        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                            {t(props.headline)}
                        </h2>
                    )}
                    {props.subhead && (
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            {t(props.subhead)}
                        </p>
                    )}
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {props.features.map((feature, index) => {
                        const CardContent = (
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
                                {feature.description && (
                                    <p className="text-muted-foreground leading-relaxed">
                                        {t(feature.description)}
                                    </p>
                                )}
                            </Card>
                        );

                        if (feature.link) {
                            return (
                                <a
                                    key={index}
                                    href={feature.link}
                                    className="no-underline hover:no-underline"
                                >
                                    {CardContent}
                                </a>
                            );
                        }

                        return CardContent;
                    })}
                </div>
            </div>
        </section>
    );
}

export default FeaturesRezoLaMer;
