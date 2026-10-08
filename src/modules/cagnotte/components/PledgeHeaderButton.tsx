import React, { useState, Suspense, useMemo } from "react";
import { CreditCard } from "lucide-react";
import { useCocolight } from "@/hooks/useCocolight";
import { useFundingEnvelope } from "@/modules/cagnotte/hooks/useFundingEnvelope";
import { useOrganizationProjectsWithAnswers } from "@/modules/cagnotte/hooks/useOrganizationProjectsWithAnswers";
import { useCagnotteType } from "@/modules/cagnotte/hooks/useCagnotteType";
import { useCagnotteAdapter , computePledgesFromResources } from "@/modules/cagnotte/hooks/useCagnotteAdapter";
import { useUserAdminOrganizations } from "@/modules/cagnotte/hooks/useUserAdminOrganizations";
import { useSite } from "@/hooks/useSite";
import { Pledge } from "@/modules/cagnotte/types";
import { useReactiveProperty } from "@/hooks/useReactiveProperty";
import { totalARegler } from "@/modules/cagnotte/hooks/useSaveCagnotteContribution";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import "@/modules/cagnotte/i18n";
import {isUser} from "@/lib/getTypedEntity.ts";
import type {User} from "@communecter/cocolight-api-client";
const PromessesDialog = React.lazy(() => import("./PromessesDialog"));

export function PledgeHeaderButton() {
    const { entity, me } = useCocolight();
    useLoadNamespace("modules/cagnotte");
    const t = useT("modules/cagnotte");
    const currentUserEntity = (me && isUser(me) ? me : null) as User | null;
    const userAdminOrganizations = useUserAdminOrganizations(currentUserEntity, {});
    const orgsIds = useMemo(() => userAdminOrganizations?.map((o) => o.id) || [], [userAdminOrganizations]);
    const [open, setOpen] = useState(false);
    const siteConfig = useSite();
    const { projects: allProjects } = useOrganizationProjectsWithAnswers({
        entity: entity || null,
        enabled: !!entity && !!me?.id,
    });

    const preferencesData = useReactiveProperty<Record<string, unknown>>(entity?.serverData, 'preferences');
    const projectModalId = (preferencesData?.projectModalId as string | undefined) || null;
    
    const { data: envelope } = useFundingEnvelope(projectModalId || undefined);
    const { config: cagnotteConfig } = useCagnotteType({
        siteConfig: siteConfig?.config?.cagnotteModuleConfig?.defaultType,
    });

    const { resources } = useCagnotteAdapter(
        envelope,
        allProjects,
        cagnotteConfig,
        projectModalId || ''
    );

    // calcule du tableau complet des promesses (pour la modale)
    const computedPledges = useMemo<Pledge[]>(() => computePledgesFromResources(resources, me?.serverData?.id, orgsIds) , [resources, me?.serverData?.id, orgsIds]);

    // Total à régler, affiché sur le bouton.
    const totalPledgesAmount = useMemo(() => totalARegler(computedPledges), [computedPledges]);

    if (!me?.id || totalPledgesAmount === 0) return null;
    
    return (
        <>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={() => setOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/20 hover:bg-secondary/30 text-secondary-foreground transition-all group"
                        aria-label={String(t("HeaderButtons.pledge.aria", "Voir les promesses"))}
                    >
                        <CreditCard className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="font-semibold text-sm">
                            {totalPledgesAmount.toLocaleString("fr-FR")} €
                        </span>
                    </button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{t("HeaderButtons.pledge.tooltip", "Voir et payer mes promesses en cours")}</p>
                </TooltipContent>
            </Tooltip>

            {open && (
                <Suspense fallback={null}>
                    <PromessesDialog
                        open={open}
                        onOpenChange={setOpen}
                        pledges={computedPledges}
                    />
                </Suspense>
            )}
        </>
    );
}

export default PledgeHeaderButton;