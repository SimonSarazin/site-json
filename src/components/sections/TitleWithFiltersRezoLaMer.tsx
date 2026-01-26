import { useState, useEffect, useRef } from "react";
import { useLocalization } from "@/hooks/useLocalization";
import { useT } from "@/hooks/useT";
import { LocalizedString } from "@/types/site-schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { ChevronDown, UserPlus, Crown, Loader2, Clock } from "lucide-react";
import { Link } from "react-router";
import { usePageFiltersOptional } from "@/contexts/PageFiltersContext";
import { useCocolight } from "@/hooks/useCocolight";
import { useRequestToJoin, useRequestToJoinAdmin } from "@/modules/profil/actions/mutations/relationship";
import { AddProjectModal } from "@/modules/profil/components/add/AddProjectModal";
import { AddEventModal } from "@/modules/profil/components/add/AddEventModal";
import { toast } from "sonner";

export interface ActionButton {
    label: LocalizedString;
    icon?: string;
    href?: string;
    variant?: "default" | "outline" | "primary" | "turquoise";
    action?: "join-dropdown" | "add-project" | "add-event";
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

function AddEventButton({
    button,
    tLocalized,
    tKey,
    getButtonClasses,
}: {
    button: ActionButton;
    tLocalized: (str: LocalizedString) => string;
    tKey: (key: string) => string;
    getButtonClasses: (variant?: string) => string;
}) {
    const { me, entity } = useCocolight();
    const isConnected = !!me;
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleClick = () => {
        if (!isConnected) {
            toast.error(tKey("Vous devez être connecté pour proposer un événement"));
            return;
        }
        setIsModalOpen(true);
    };

    return (
        <>
            <Button
                size="lg"
                className={getButtonClasses(button.variant)}
                onClick={handleClick}
                disabled={!isConnected}
            >
                {button.icon && (
                    <DynamicIcon name={button.icon as IconName} className="w-5 h-5 mr-2" />
                )}
                {tLocalized(button.label)}
            </Button>
            <AddEventModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                parent={entity}
            />
        </>
    );
}

function AddProjectButton({
    button,
    tLocalized,
    tKey,
    getButtonClasses,
}: {
    button: ActionButton;
    tLocalized: (str: LocalizedString) => string;
    tKey: (key: string) => string;
    getButtonClasses: (variant?: string) => string;
}) {
    const { me, entity } = useCocolight();
    const isConnected = !!me;
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleClick = () => {
        if (!isConnected) {
            toast.error(tKey("Vous devez être connecté pour proposer un projet"));
            return;
        }
        setIsModalOpen(true);
    };

    return (
        <>
            <Button
                size="lg"
                className={getButtonClasses(button.variant)}
                onClick={handleClick}
                disabled={!isConnected}
            >
                {button.icon && (
                    <DynamicIcon name={button.icon as IconName} className="w-5 h-5 mr-2" />
                )}
                {tLocalized(button.label)}
            </Button>
            <AddProjectModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                parent={entity}
            />
        </>
    );
}

function JoinDropdownButton({
    button,
    tLocalized,
    tKey,
    getButtonClasses,
}: {
    button: ActionButton;
    tLocalized: (str: LocalizedString) => string;
    tKey: (key: string) => string;
    getButtonClasses: (variant?: string) => string;
}) {
    const { me, entity } = useCocolight();
    const isConnected = !!me;

    const requestToJoinMutation = useRequestToJoin(entity);
    const requestToJoinAdminMutation = useRequestToJoinAdmin(entity);

    const isLoading = requestToJoinMutation.isPending || requestToJoinAdminMutation.isPending;

    const isContributor = entity?.isContributor?.() || false;
    const isAdmin = entity?.isAdmin?.() || false;
    const isToBeValidated = entity?.isToBeValidated?.() || false;
    const isAdminPending = entity?.isAdminPending?.() || false;

    const handleRequestContributor = () => {
        if (!isConnected) {
            toast.error(tKey("Vous devez être connecté pour rejoindre"));
            return;
        }
        requestToJoinMutation.mutate();
    };

    const handleRequestAdmin = () => {
        if (!isConnected) {
            toast.error(tKey("Vous devez être connecté pour demander les droits admin"));
            return;
        }
        requestToJoinAdminMutation.mutate();
    };

    if (isAdmin) {
        return null;
    }

    if (isContributor) {
        return (
            <Button
                size="lg"
                className={getButtonClasses("outline")}
                disabled
            >
                <UserPlus className="w-5 h-5 mr-2" />
                {tKey("Contributeur")}
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    size="lg"
                    className={getButtonClasses(button.variant)}
                    disabled={isLoading || !isConnected}
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : button.icon ? (
                        <DynamicIcon name={button.icon as IconName} className="w-5 h-5 mr-2" />
                    ) : (
                        <UserPlus className="w-5 h-5 mr-2" />
                    )}
                    {tLocalized(button.label)}
                    <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
                {isToBeValidated ? (
                    <DropdownMenuItem disabled className="opacity-70">
                        <Clock className="w-4 h-4 mr-2" />
                        {tKey("Demande en attente")}
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem
                        onClick={handleRequestContributor}
                        disabled={requestToJoinMutation.isPending}
                    >
                        {requestToJoinMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <UserPlus className="w-4 h-4 mr-2" />
                        )}
                        {tKey("Demander à contribuer")}
                    </DropdownMenuItem>
                )}

                {isAdminPending ? (
                    <DropdownMenuItem disabled className="opacity-70">
                        <Clock className="w-4 h-4 mr-2" />
                        {tKey("Demande admin en attente")}
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem
                        onClick={handleRequestAdmin}
                        disabled={requestToJoinAdminMutation.isPending}
                    >
                        {requestToJoinAdminMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Crown className="w-4 h-4 mr-2" />
                        )}
                        {tKey("Demander droits admin")}
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function TitleWithFiltersRezoLaMer({ id, props }: TitleWithFiltersRezoLaMerSectionProps) {
    const { t: tLocalized } = useLocalization();
    const tKey = useT("modules/search");
    const [activeCategory, setActiveCategory] = useState("all");
    const pageFilters = usePageFiltersOptional();
    const setSearchQuery = pageFilters?.setSearchQuery ?? (() => {});

    const [localSearchQuery, setLocalSearchQuery] = useState(pageFilters?.searchQuery ?? "");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            setSearchQuery(localSearchQuery);
        }, 1000);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [localSearchQuery, setSearchQuery]);

    return (
        <section id={id} className="relative pt-10 px-4 bg-ocean-gradient overflow-hidden">
            <div className="absolute inset-0 opacity-10">
                <div className="absolute top-10 left-10 w-64 h-64 bg-primary rounded-full blur-3xl animate-float" />
                <div
                    className="absolute bottom-10 right-10 w-96 h-96 bg-chart-2 rounded-full blur-3xl animate-float"
                    style={{ animationDelay: "2s" }}
                />
            </div>

            <div className="relative z-10 container mx-auto max-w-6xl text-center py-12 px-4">
                <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground animate-fade-in">
                    {tLocalized(props.headline)}
                </h1>
                {props.subhead && (
                    <p className="text-xl text-white/80 max-w-2xl mx-auto animate-fade-in">
                        {tLocalized(props.subhead)}
                    </p>
                )}

                {props.buttons && props.buttons.length > 0 && (
                    <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
                        {props.buttons.map((button, index) => {
                            if (button.action === "join-dropdown") {
                                return (
                                    <JoinDropdownButton
                                        key={index}
                                        button={button}
                                        tLocalized={tLocalized}
                                        tKey={tKey}
                                        getButtonClasses={getButtonClasses}
                                    />
                                );
                            }

                            if (button.action === "add-project") {
                                return (
                                    <AddProjectButton
                                        key={index}
                                        button={button}
                                        tLocalized={tLocalized}
                                        tKey={tKey}
                                        getButtonClasses={getButtonClasses}
                                    />
                                );
                            }

                            if (button.action === "add-event") {
                                return (
                                    <AddEventButton
                                        key={index}
                                        button={button}
                                        tLocalized={tLocalized}
                                        tKey={tKey}
                                        getButtonClasses={getButtonClasses}
                                    />
                                );
                            }

                            const buttonElement = (
                                <Button
                                    key={index}
                                    size="lg"
                                    className={getButtonClasses(button.variant)}
                                >
                                    {button.icon && (
                                        <DynamicIcon name={button.icon as IconName} className="w-5 h-5 mr-2" />
                                    )}
                                    {tLocalized(button.label)}
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
                            placeholder={props.searchPlaceholder ? tLocalized(props.searchPlaceholder) : tKey("Rechercher...")}
                            value={localSearchQuery}
                            onChange={(e) => setLocalSearchQuery(e.target.value)}
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
                                    {tLocalized(category.label)}
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
