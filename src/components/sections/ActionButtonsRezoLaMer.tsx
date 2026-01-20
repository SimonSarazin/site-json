import { useLocalization } from "@/hooks/useLocalization";
import { LocalizedString } from "@/types/site-schema";
import { Button } from "@/components/ui/button";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Link } from "react-router";

export interface ActionButtonsRezoLaMerProps {
    headline: LocalizedString;
    subhead?: LocalizedString;
    actions: Array<{
        icon: string;
        title: LocalizedString;
        subtitle?: LocalizedString;
        href: string;
        color?: "primary" | "accent" | "amber" | "chart-2";
    }>;
}

interface ActionButtonsRezoLaMerSectionProps {
    id?: string;
    props: ActionButtonsRezoLaMerProps;
}

export function ActionButtonsRezoLaMer({ id, props }: ActionButtonsRezoLaMerSectionProps) {
    const { t } = useLocalization();

    const getButtonClasses = (color?: string) => {
        switch (color) {
            case "accent":
                return "bg-accent/20 hover:bg-accent/30 border-accent/30 hover:border-accent/50";
            case "amber":
                return "bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30 hover:border-amber-500/50";
            case "chart-2":
                return "bg-chart-2/20 hover:bg-chart-2/30 border-chart-2/30 hover:border-chart-2/50";
            case "primary":
            default:
                return "bg-primary/20 hover:bg-primary/30 border-primary/30 hover:border-primary/50";
        }
    };

    const getIconColorClass = (color?: string) => {
        switch (color) {
            case "accent":
                return "text-accent";
            case "amber":
                return "text-amber-400";
            case "chart-2":
                return "text-chart-2";
            case "primary":
            default:
                return "text-primary";
        }
    };

    return (
        <section id={id} className="py-16 px-4 bg-linear-to-b from-background/80 to-background">
            <div className="container mx-auto max-w-5xl">
                <div className="text-center mb-10">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
                        {t(props.headline)}
                    </h2>
                    {props.subhead && (
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            {t(props.subhead)}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {props.actions.map((action, index) => (
                        <Link key={index} to={action.href}>
                            <Button
                                size="lg"
                                className={`h-auto w-full py-6 flex flex-col items-center gap-3 text-foreground border transition-all ${getButtonClasses(action.color)}`}
                            >
                                <DynamicIcon
                                    name={action.icon as IconName}
                                    className={`w-8 h-8 ${getIconColorClass(action.color)}`}
                                />
                                <span className="font-semibold">{t(action.title)}</span>
                                {action.subtitle && (
                                    <span className="text-xs text-muted-foreground">
                                        {t(action.subtitle)}
                                    </span>
                                )}
                            </Button>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default ActionButtonsRezoLaMer;
