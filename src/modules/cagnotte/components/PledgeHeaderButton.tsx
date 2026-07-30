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
import { toSafeInt } from "@/modules/cagnotte/utils/dataTransform";
import {isUser} from "@/lib/getTypedEntity.ts";
import type {User} from "@communecter/cocolight-api-client";
const PromessesDialog = React.lazy(() => import("./PromessesDialog"));

export function PledgeHeaderButton() {
    const { entity, me } = useCocolight();
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

    // calcule la somme totale des promesses pour le bouton
    const totalPledgesAmount = useMemo<number>(() => {
        return computedPledges.reduce((sum, pledge) => sum + toSafeInt(pledge.fundingAmount), 0);
    }, [computedPledges]);

    if (!me?.id || totalPledgesAmount === 0) return null;
    
    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/20 hover:bg-secondary/30 text-secondary-foreground transition-all group"
                aria-label="Voir les promesses"
            >
                <CreditCard className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-sm">
                    {totalPledgesAmount.toLocaleString("fr-FR")} €
                </span>
            </button>

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