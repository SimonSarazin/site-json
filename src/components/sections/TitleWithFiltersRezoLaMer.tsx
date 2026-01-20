import { useState } from "react";
import { useLocalization } from "@/hooks/useLocalization";
import { LocalizedString } from "@/types/site-schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { Link } from "react-router";

export interface ActionButton {
    label: LocalizedString;
    icon?: string;
    href?: string;
    variant?: "default" | "outline" | "primary" | "turquoise";
}

export interface TitleWithFiltersRezoLaMerProps {
    headline: LocalizedString;
    subhead?: LocalizedString;
    categories?: Array<{
        id: string;
        label: LocalizedString;
    }>;
    buttons?: ActionButton[];
    searchPlaceholder?: LocalizedString;
    showSearch?: boolean;
}

interface TitleWithFiltersRezoLaMerSectionProps {
    id?: string;
    props: TitleWithFiltersRezoLaMerProps;
}

const getButtonClasses = (variant?: string) => {
    switch (variant) {
        case "primary":
            return "bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow";
        case "outline":
            return "border-2 border-foreground/50 bg-background/20 backdrop-blur-ocean hover:bg-background/40 text-foreground";
        case "turquoise":
        default:
            return "bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow";
    }
};

export function TitleWithFiltersRezoLaMer({ id, props }: TitleWithFiltersRezoLaMerSectionProps) {
    const { t } = useLocalization();
    const [activeCategory, setActiveCategory] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    return (
        <section id={id} className="relative py-20 px-4 bg-ocean-gradient overflow-hidden">
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-10 left-10 w-64 h-64 bg-primary rounded-full blur-3xl animate-float" />
                <div
                    className="absolute bottom-10 right-10 w-96 h-96 bg-chart-2 rounded-full blur-3xl animate-float"
                    style={{ animationDelay: "2s" }}
                />
            </div>

            <div className="relative z-10 container mx-auto max-w-6xl text-center py-12 px-4">
                <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground animate-fade-in">
                    {t(props.headline)}
                </h1>
                {props.subhead && (
                    <p className="text-xl text-white/80 max-w-2xl mx-auto animate-fade-in">
                        {t(props.subhead)}
                    </p>
                )}

                {props.buttons && props.buttons.length > 0 && (
                    <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
                        {props.buttons.map((button, index) => {
                            const buttonElement = (
                                <Button
                                    key={index}
                                    size="lg"
                                    className={getButtonClasses(button.variant)}
                                >
                                    {button.icon && (
                                        <DynamicIcon name={button.icon as IconName} className="w-5 h-5 mr-2" />
                                    )}
                                    {t(button.label)}
                                </Button>
                            );

                            if (button.href) {
                                return (
                                    <Link key={index} to={button.href}>
                                        {buttonElement}
                                    </Link>
                                );
                            }

                            return buttonElement;
                        })}
                    </div>
                )}
            </div>

            {props.showSearch && (
                <div className="container mx-auto max-w-2xl px-4 mb-8">
                    <div className="relative">
                        <DynamicIcon
                            name="search"
                            className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground"
                        />
                        <Input
                            type="search"
                            placeholder={props.searchPlaceholder ? t(props.searchPlaceholder) : "Rechercher..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-12 h-12 bg-secondary/40 backdrop-blur-ocean border-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                </div>
            )}

            {props.categories && props.categories.length > 0 && (
                <div className="px-4">
                    <div className="container mx-auto max-w-6xl">
                        <div className="flex flex-wrap gap-3 justify-center">
                            {props.categories.map((category) => (
                                <Badge
                                    key={category.id}
                                    variant="outline"
                                    className={`px-4 py-2 cursor-pointer transition-all ${activeCategory === category.id
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-secondary/30 text-foreground border-primary/30 hover:bg-primary hover:text-primary-foreground hover:border-primary"
                                        }`}
                                    onClick={() => setActiveCategory(category.id)}
                                >
                                    {t(category.label)}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default TitleWithFiltersRezoLaMer;
