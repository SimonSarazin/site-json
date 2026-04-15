import { useLocalization } from "@/hooks/useLocalization";
import { type ActionButtonsRezoLaMerProps } from "@/types/site-schema";
import { Button } from "@/components/ui/button";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Link } from "react-router";

interface ActionButtonsRezoLaMerSectionProps {
    id?: string;
    props: ActionButtonsRezoLaMerProps;
}

export function ActionButtonsRezoLaMer({ id, props }: ActionButtonsRezoLaMerSectionProps) {
    const { t } = useLocalization();
    const variant = props.variant || "ocean";
    const isCyber = variant === "cyber";

    const DEFAULT_ICON_SIZE = 32;

    const isSvgIcon = (icon: string) => icon.trim().startsWith("<svg");

    const getSvgSize = (svg: string) => {
        const widthMatch = svg.match(/width=["'](\d+(?:\.\d+)?)["']/i);
        return widthMatch ? Number(widthMatch[1]) : DEFAULT_ICON_SIZE;
    };

    const getSizeClass = (size: number) => {
        if (size <= 20) return "size-5";
        if (size <= 24) return "size-6";
        if (size <= 28) return "size-7";
        if (size <= 32) return "size-8";
        if (size <= 40) return "size-10";
        if (size <= 48) return "size-12";
        if (size <= 56) return "size-14";
        return "size-16";
    };

    const ensureSvgHasClass = (svg: string, className: string) => {
        if (/class=["'][^"']*["']/i.test(svg)) {
            return svg.replace(/class=["']([^"']*)["']/i, (_match, existing) => `class="${existing} ${className}"`);
        }
        return svg.replace("<svg", `<svg class="${className}"`);
    };

    const renderIcon = (icon: string, colorClass: string) => {
        if (isSvgIcon(icon)) {
            const sizeInPixels = getSvgSize(icon);
            const svgWithSizeClass = ensureSvgHasClass(icon, getSizeClass(sizeInPixels));

            return (
                <div
                    className={`inline-flex items-center justify-center ${colorClass}`}
                    style={{ width: sizeInPixels, height: sizeInPixels }}
                    dangerouslySetInnerHTML={{ __html: svgWithSizeClass }}
                />
            );
        }

        return (
            <DynamicIcon
                name={icon as IconName}
                className={`w-8 h-8 ${colorClass}`}
            />
        );
    };

    const getButtonClasses = (color?: string) => {
        switch (color) {
            case "accent":
                return "bg-accent/20 hover:bg-accent/30 border-accent/30 hover:border-accent/50";
            case "amber":
                return "bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30 hover:border-amber-500/50";
            case "chart-2":
                return "bg-chart-2/20 hover:bg-chart-2/30 border-chart-2/30 hover:border-chart-2/50";
            case "teal":
                return "bg-teal-500/20 hover:bg-teal-500/30 border-teal-500/30 hover:border-teal-500/50";
            case "eco":
                return "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 hover:border-emerald-500/50";
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
            case "teal":
                return "text-teal-500";
            case "eco":
                return "text-emerald-500";
            case "primary":
            default:
                return "text-primary";
        }
    };

    const BG_MAP: Record<string, string> = {
        card: "bg-card",
        muted: "bg-muted",
        primary: "bg-primary/10",
        secondary: "bg-secondary",
        accent: "bg-accent/10",
        transparent: "bg-transparent",
    };

    const defaultBg = isCyber
        ? "bg-gradient-to-b from-card/20 to-background"
        : "bg-linear-to-b from-background/80 to-background";

    const sectionBg = props.bg && props.bg !== "default" ? BG_MAP[props.bg] : defaultBg;

    return (
        <section id={id} className={`px-4 ${sectionBg} ${props.variant !== "ssbe" ? "py-16 " : "py-12 "}`}>
            <div className="container mx-auto max-w-5xl">
                <div className="text-center mb-10">
                    {props.headline && (
                        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
                            {t(props.headline)}
                        </h2>
                    )}
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
                                {renderIcon(action.icon, getIconColorClass(action.color))}
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
