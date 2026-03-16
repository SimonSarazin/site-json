import { useLocalization } from "@/hooks/useLocalization";
import { LocalizedString } from "@/types/site-schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Link } from "react-router";

export interface CommunityRezoLaMerProps {
    headline: LocalizedString;
    subhead?: LocalizedString;
    variant?: "ocean" | "cyber";
    image?: string;
    imageAlt?: LocalizedString;
    actions?: Array<{
        icon: string;
        title: LocalizedString;
        description: LocalizedString;
        ctaLabel: LocalizedString;
        href: string;
    }>;
    stats?: Array<{
        value: string;
        label: LocalizedString;
        color?: string;
    }>;
}

interface CommunityRezoLaMerSectionProps {
    id?: string;
    props: CommunityRezoLaMerProps;
}

export function CommunityRezoLaMer({ id, props }: CommunityRezoLaMerSectionProps) {
    const { t } = useLocalization();
    const variant = props.variant || "ocean";
    const isCyber = variant === "cyber";

    const getStatColorClass = (color?: string) => {
        switch (color) {
            case "accent":
                return "text-accent";
            case "chart-2":
                return "text-chart-2";
            case "primary":
            default:
                return "text-primary";
        }
    };

    const cardClasses = isCyber
        ? "p-6 bg-card/40 backdrop-blur-sm border-border/50 hover:bg-card/60 transition-all duration-300 hover:shadow-lg hover:-translate-y-2 animate-fade-in-up group"
        : "p-6 bg-secondary/30 backdrop-blur-ocean border-primary/20 hover:bg-secondary/50 transition-all duration-300 hover:shadow-ocean hover:-translate-y-2 animate-fade-in-up group";

    const statClasses = isCyber
        ? "text-center p-6 rounded-lg bg-card/30 backdrop-blur-sm border border-border/30"
        : "text-center p-6 rounded-lg bg-secondary/30 backdrop-blur-ocean border border-primary/20";

    const imageShadow = isCyber ? "shadow-lg" : "shadow-ocean";

    return (
        <section id={id} className="relative py-24 px-4">
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-linear-to-b from-background/40 via-background to-background/40" />
            </div>

            <div className="relative z-10 container mx-auto max-w-6xl">
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

                {props.image && (
                    <div className={`mb-16 rounded-2xl overflow-hidden ${imageShadow} animate-fade-in`}>
                        <img
                            src={props.image}
                            alt={props.imageAlt ? t(props.imageAlt) : ""}
                            className="w-full h-100 object-cover"
                        />
                    </div>
                )}

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {props.actions?.map((action, index) => (
                        <Card
                            key={index}
                            className={cardClasses}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="text-center space-y-4">
                                <div className="flex justify-center">
                                    <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                        <DynamicIcon
                                            name={action.icon as IconName}
                                            className="w-8 h-8 text-primary group-hover:scale-110 transition-transform"
                                        />
                                    </div>
                                </div>
                                <h3 className="text-lg font-semibold text-foreground">
                                    {t(action.title)}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {t(action.description)}
                                </p>
                                <Link to={action.href}>
                                    <Button
                                        variant="outline"
                                        className="w-full border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground"
                                    >
                                        {t(action.ctaLabel)}
                                    </Button>
                                </Link>
                            </div>
                        </Card>
                    ))}
                </div>

                {props.stats && props.stats.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 animate-fade-in">
                        {props.stats.map((stat, index) => (
                            <div
                                key={index}
                                className={statClasses}
                            >
                                <div className={`text-4xl font-bold mb-2 ${getStatColorClass(stat.color)}`}>
                                    {stat.value}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {t(stat.label)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

export default CommunityRezoLaMer;
