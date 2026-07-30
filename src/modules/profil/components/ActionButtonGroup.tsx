/**
 * Rendu des boutons d'action déclarés en config (`ActionButton[]`) : ouverture
 * de modals d'ajout d'entité (`add-project`/`add-poi`/…), dropdown de
 * follow/join (`join-dropdown`), liens (`href`), et bouton simple.
 *
 * Vit dans `modules/profil` car ces boutons dépendent du domaine profil
 * (permissions, actions d'organisation, modals d'ajout). Exposé comme API
 * unique : les sections qui veulent ces boutons (ex. `SearchHeaderSection`)
 * montent `<ActionButtonGroup buttons={...} />` sans toucher aux internes profil.
 */
import "@/modules/profil/i18n";
import { useState } from "react";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { Button } from "@/components/ui/button";
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
import { useAuthModal } from "@/modules/auth";
import type { Organization } from "@communecter/cocolight-api-client";
import type { ActionButton } from "@/types/action-button-schema";
import { useCocolight } from "@/hooks/useCocolight";
import { useOrgEntityActions } from "../actions/hooks/useOrgEntityActions";
import { ConfirmationDialog } from "./action-buttons/ConfirmationDialog";
import { DynamicModal } from "./add/ModalRegistry";
import type { EntityAction } from "../types";
import { useProfilPermissions } from "../hooks/useProfilPermissions";

const getButtonClasses = (variant?: string) => {
    switch (variant) {
        case "primary":
            return "bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow";
        case "outline":
            return "border-2 border-foreground/50 bg-background/20 backdrop-blur-md hover:bg-background/40 text-foreground";
        case "turquoise":
        default:
            return "bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow";
    }
};

/**
 * Bouton qui ouvre un modal dynamique (add-project/event/poi/organization…).
 * Gate admin via `requiresAdmin` (défaut: requiert admin).
 */
function DynamicModalButton({
    button,
    modalName,
}: {
    button: ActionButton;
    modalName: string;
}) {
    const t = useT("modules/profil");
    const { me, entity } = useCocolight();
    const { openLogin } = useAuthModal();
    const isConnected = !!me;
    const permissions = useProfilPermissions(entity || null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const requiresAdmin = button.requiresAdmin !== false;
    if (requiresAdmin && !permissions.isAdmin) {
        return null;
    }
    /*  Quand un visiteur non connecté clique sur le bouton d'action (add-project/event/poi/organization, requiresAdmin:false).
    openLogin() passe désormais un onSuccess callback qu ouvre le modal d'ajout directement après la connexion réussie */
    const handleClick = () => {
        if (!isConnected) {
            openLogin({ onSuccess: () => setIsModalOpen(true) });
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
                {t(button.label)}
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

/**
 * Bouton dropdown de statut d'organisation (suivre/rejoindre/quitter + statut).
 */
function JoinDropdownButton({
    button,
}: {
    button: ActionButton;
}) {
    const t = useT("modules/profil");
    const { me, entity } = useCocolight();
    const { openLogin } = useAuthModal();
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
                        openLogin();
                    }
                }}
            >
                {button.icon && (
                    <DynamicIcon name={button.icon as IconName} className="w-5 h-5 mr-2" />
                )}
                {t(button.label)}
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
                                    {t("Voir le profil")}
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
                    confirmLabel={confirmationAction.confirmationConfirm || t("Confirmer")}
                    cancelLabel={confirmationAction.confirmationCancel || t("Annuler")}
                    onConfirm={handleConfirm}
                    isDestructive={confirmationAction.isDestructive}
                />
            )}
        </>
    );
}

const MODAL_ACTIONS = ["add-project", "add-event", "add-poi", "add-organization"] as const;

/**
 * Rend une liste de boutons d'action config-driven dans un conteneur flex.
 * Retourne `null` si aucun bouton.
 */
export function ActionButtonGroup({ buttons }: { buttons?: ActionButton[] }) {
    useLoadNamespace("modules/profil");
    const t = useT("modules/profil");

    if (!buttons || buttons.length === 0) return null;

    return (
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
            {buttons.map((button, index) => {
                if (button.action === "join-dropdown") {
                    return <JoinDropdownButton key={index} button={button} />;
                }

                // Modal explicite (`button.modal`) ou action d'ajout d'entité (`add-*`).
                const modalName = button.modal ?? (MODAL_ACTIONS.includes(button.action as (typeof MODAL_ACTIONS)[number]) ? button.action : undefined);
                if (modalName) {
                    return <DynamicModalButton key={index} button={button} modalName={modalName} />;
                }

                const buttonElement = (
                    <Button key={index} size="lg" className={getButtonClasses(button.variant)}>
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
    );
}

export default ActionButtonGroup;
