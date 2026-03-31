import { useState, useEffect, useRef, useMemo } from "react";
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { usePageFiltersOptional } from "@/contexts/PageFiltersContext";
import { useCocolight } from "@/hooks/useCocolight";
import { useOrgEntityActions } from "@/modules/profil/actions/hooks/useOrgEntityActions";
import { ConfirmationDialog } from "@/modules/profil/components/action-buttons/ConfirmationDialog";
import { DynamicModal } from "@/modules/profil/components/add/ModalRegistry";
import { toast } from "sonner";
import type { Organization } from "@communecter/cocolight-api-client";
import type { EntityAction } from "@/modules/profil/types";
import { useProfilPermissions } from "@/modules/profil/hooks/useProfilPermissions";
import type { JsonFormModalConfig } from "@/types/site-schema";

export interface ActionButton {
    label: LocalizedString;
    icon?: string;
    href?: string;
    variant?: "default" | "outline" | "primary" | "turquoise";
    action?: "join-dropdown" | "add-project" | "add-event" | "add-poi" | "add-organization";
    modal?: string;
    formConfig?: JsonFormModalConfig;
    requiresAdmin?: boolean;
}

export interface TitleWithFiltersRezoLaMerProps {
    headline?: LocalizedString;
    subhead?: LocalizedString;
    categories?: Array<{
        id: string;
        label: LocalizedString;
    }>;
    types?: Array<{
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

/**
 * Composant générique pour les boutons qui ouvrent un modal dynamique
 * Remplace AddPoiButton, AddEventButton, AddProjectButton
 */
function DynamicModalButton({
    button,
    modalName,
    tLocalized,
    tKey,
    getButtonClasses,
}: {
    button: ActionButton;
    modalName: string;
    tLocalized: (str: LocalizedString) => string;
    tKey: (key: string) => string;
    getButtonClasses: (variant?: string) => string;
}) {
    const { me, entity } = useCocolight();
    const isConnected = !!me;
    const permissions = useProfilPermissions(entity || null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const requiresAdmin = button.requiresAdmin !== false;
    if (requiresAdmin && !permissions.isAdmin) {
        return null;
    }

    const handleClick = () => {
        if (!isConnected) {
            toast.error(tKey("Vous devez être connecté"));
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
            >
                {button.icon && (
                    <DynamicIcon name={button.icon as IconName} className="w-5 h-5 mr-2" />
                )}
                {tLocalized(button.label)}
            </Button>
            <DynamicModal
                modalName={modalName}
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                parent={entity}
                formConfig={button.formConfig}
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
    const [confirmationAction, setConfirmationAction] = useState<EntityAction | null>(null);

    const orgActions = useOrgEntityActions(entity as Organization | null);

    const entitySlug = entity?.slug;
    const profileUrl = entitySlug ? `/@${entitySlug}` : null;

    if (!orgActions || !isConnected) {
        return (
            <Button
                size="lg"
                className={getButtonClasses(button.variant)}
                onClick={() => {
                    if (!isConnected) {
                        toast.error(tKey("Vous devez être connecté pour rejoindre"));
                    }
                }}
            >
                {button.icon && (
                    <DynamicIcon name={button.icon as IconName} className="w-5 h-5 mr-2" />
                )}
                {tLocalized(button.label)}
            </Button>
        );
    }

    const { actions, statusLabel, statusIcon, statusVariant } = orgActions;

    const handleActionClick = (action: EntityAction) => {
        if (action.requiresConfirmation) {
            setConfirmationAction(action);
        } else {
            action.onClick();
        }
    };

    const handleConfirm = () => {
        if (confirmationAction) {
            confirmationAction.onClick();
            setConfirmationAction(null);
        }
    };

    const followActions = actions.filter((a) => a.type === "follow" || a.type === "unfollow");
    const membershipActions = actions.filter((a) => a.type === "join" || a.type === "leave");
    const invitationActions = actions.filter((a) => a.type === "accept" || a.type === "reject");
    const pendingActions = actions.filter((a) => a.type === "pending");

    const hasFollow = followActions.length > 0;
    const hasMembership = membershipActions.length > 0;
    const hasInvitation = invitationActions.length > 0;
    const hasPending = pendingActions.length > 0;

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="lg"
                        className={getButtonClasses(statusVariant === "default" ? "primary" : "outline")}
                    >
                        {statusIcon}
                        {statusLabel}
                        <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                    {profileUrl && (
                        <>
                            <DropdownMenuItem asChild>
                                <Link to={profileUrl}>
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    {tKey("Voir le profil")}
                                </Link>
                            </DropdownMenuItem>
                            {(hasFollow || hasMembership || hasInvitation || hasPending) && (
                                <DropdownMenuSeparator />
                            )}
                        </>
                    )}

                    {followActions.filter((a) => a.show).map((action) => (
                        <DropdownMenuItem key={action.id} onClick={() => handleActionClick(action)}>
                            {action.icon}
                            {action.label}
                        </DropdownMenuItem>
                    ))}

                    {hasFollow && (hasMembership || hasInvitation || hasPending) && <DropdownMenuSeparator />}

                    {invitationActions.filter((a) => a.show).map((action) => (
                        <DropdownMenuItem
                            key={action.id}
                            onClick={() => handleActionClick(action)}
                            className={action.type === "reject" ? "text-destructive focus:text-destructive" : ""}
                        >
                            {action.icon}
                            {action.label}
                        </DropdownMenuItem>
                    ))}

                    {hasInvitation && (hasMembership || hasPending) && <DropdownMenuSeparator />}

                    {pendingActions.filter((a) => a.show).map((action) => (
                        <DropdownMenuItem
                            key={action.id}
                            className="opacity-70 cursor-default"
                        >
                            {action.icon}
                            {action.label}
                        </DropdownMenuItem>
                    ))}

                    {hasPending && hasMembership && <DropdownMenuSeparator />}

                    {membershipActions.filter((a) => a.show).map((action) => (
                        <DropdownMenuItem
                            key={action.id}
                            onClick={() => handleActionClick(action)}
                            className={action.isDestructive ? "text-destructive focus:text-destructive" : ""}
                        >
                            {action.icon}
                            {action.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {confirmationAction && (
                <ConfirmationDialog
                    open={!!confirmationAction}
                    onOpenChange={(open) => !open && setConfirmationAction(null)}
                    title={confirmationAction.confirmationTitle || ""}
                    description={confirmationAction.confirmationDescription || ""}
                    confirmLabel={confirmationAction.confirmationConfirm || tKey("Confirmer")}
                    cancelLabel={confirmationAction.confirmationCancel || tKey("Annuler")}
                    onConfirm={handleConfirm}
                    isDestructive={confirmationAction.isDestructive}
                />
            )}
        </>
    );
}

export function TitleWithFiltersRezoLaMer({ id, props }: TitleWithFiltersRezoLaMerSectionProps) {
    const { t: tLocalized } = useLocalization();
    const tKey = useT("modules/search");
    const [activeCategory, setActiveCategory] = useState("all");
    
    const pageFilters = usePageFiltersOptional();
    const setSearchQuery = useMemo(() => pageFilters?.setSearchQuery ?? (() => {}), [pageFilters?.setSearchQuery]);
    const setSelectedFilters = pageFilters?.setSelectedFilters ?? (() => {});
    const selectedFilters = pageFilters?.selectedFilters ?? {};

    const activeType = selectedFilters['type']?.[0] ?? "all";

    const { entity } = useCocolight();
    const slugEntity = entity?.slug;

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

    const handleTypeChange = (typeId: string) => {
        if (typeId === "all") {
            setSelectedFilters(prev => {
                const newFilters = { ...prev };
                delete newFilters['type'];
                return newFilters;
            });
        } else {
            setSelectedFilters(prev => ({
                ...prev,
                type: [typeId]
            }));
        }
    };

    return (
        <section id={id} className="relative pt-10 px-4 bg-ocean-gradient overflow-hidden">
            <div className="inset-0 opacity-10">
                <div className="absolute top-10 left-10 w-64 h-64 bg-primary rounded-full blur-3xl animate-float" />
                <div
                    className="absolute bottom-10 right-10 w-96 h-96 bg-chart-2 rounded-full blur-3xl animate-float"
                    style={{ animationDelay: "2s" }}
                />
            </div>

            <div className="relative z-10 container mx-auto max-w-6xl text-center py-12 px-4">
                {props.headline && (
                    <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground animate-fade-in">
                        {tLocalized(props.headline)}
                    </h1>
                )}
                {props.subhead && (
                    <p className={`text-xl ${(slugEntity == "nosCommunes" || slugEntity == "etangsale1") ? "" : "text-white/80"} max-w-2xl mx-auto animate-fade-in`}>
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

                            if (button.modal) {
                                return (
                                    <DynamicModalButton
                                        key={index}
                                        button={button}
                                        modalName={button.modal}
                                        tLocalized={tLocalized}
                                        tKey={tKey}
                                        getButtonClasses={getButtonClasses}
                                    />
                                );
                            }

                            if (button.action === "add-project") {
                                return (
                                    <DynamicModalButton
                                        key={index}
                                        button={button}
                                        modalName="add-project"
                                        tLocalized={tLocalized}
                                        tKey={tKey}
                                        getButtonClasses={getButtonClasses}
                                    />
                                );
                            }

                            if (button.action === "add-event") {
                                return (
                                    <DynamicModalButton
                                        key={index}
                                        button={button}
                                        modalName="add-event"
                                        tLocalized={tLocalized}
                                        tKey={tKey}
                                        getButtonClasses={getButtonClasses}
                                    />
                                );
                            }

                            if (button.action === "add-poi") {
                                return (
                                    <DynamicModalButton
                                        key={index}
                                        button={button}
                                        modalName="add-poi"
                                        tLocalized={tLocalized}
                                        tKey={tKey}
                                        getButtonClasses={getButtonClasses}
                                    />
                                );
                            }

                            if (button.action === "add-organization") {
                                return (
                                    <DynamicModalButton
                                        key={index}
                                        button={button}
                                        modalName="add-organization"
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
            {props.types && props.types.length > 0 && (
                <div className="px-4">
                    <div className="container mx-auto max-w-6xl">
                        <div className="flex flex-wrap gap-3 justify-center">
                            {props.types.map((type) => (
                                <Badge
                                    key={type.id}
                                    variant="outline"
                                    className={`px-4 py-2 cursor-pointer transition-all ${activeType === type.id
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-secondary/30 text-foreground border-primary/30 hover:bg-primary hover:text-primary-foreground hover:border-primary"
                                        }`}
                                    onClick={() => handleTypeChange(type.id)}
                                >
                                    {tLocalized(type.label)}
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
