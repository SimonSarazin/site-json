import { Users, Loader2 } from "lucide-react";
import { useState } from "react";
import { useProfileEntity } from "../../hooks/useProfileEntity";
import { useLazyTab } from "@/hooks/useLazyTab";
import { useT } from "@/hooks/useT";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useCocolight } from "@/hooks/useCocolight";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import "@/modules/profil/i18n";

export function CommunitiesTab() {
  const { entityType } = useProfileEntity();
  useLoadNamespace("modules/profil");
  const t = useT("modules/profil");
  const { me } = useCocolight();

  const { shouldLoad } = useLazyTab("communities");
  const [isLoading] = useState(false);

  const isAuthor = me?.isConnected && entityType === "organizations";

  if (!shouldLoad) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-12 sm:py-16">
          <div className="animate-pulse space-y-3 sm:space-y-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-muted rounded-full mx-auto"></div>
            <div className="h-3 sm:h-4 bg-muted rounded w-1/2 mx-auto"></div>
            <div className="h-2 sm:h-3 bg-muted rounded w-1/3 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Déterminer les tabs selon le type d'entité
  const getTabsForEntityType = () => {
    switch (entityType) {
      case "citoyens":
        return [
          { id: "citoyensamis", label: t("CommunitiesTab.friends"), show: true },
          { id: "citoyensorganisations", label: t("CommunitiesTab.organizations"), show: true },
          { id: "citoyensabonnements", label: t("CommunitiesTab.subscriptions"), show: true },
          { id: "citoyensabonnés", label: t("CommunitiesTab.subscribers"), show: true },
          { id: "citoyensexterne", label: t("CommunitiesTab.externalNetwork"), show: isAuthor },
        ];
      case "projects":
        return [
          { id: "contributeurs", label: t("CommunitiesTab.contributors"), show: true },
          { id: "tovalidated", label: t("CommunitiesTab.contributorsToValidate"), show: isAuthor },
          { id: "contributeursabonnés", label: t("CommunitiesTab.subscriptions"), show: true },
        ];
      case "organizations":
        return [
          { id: "membres", label: t("CommunitiesTab.members"), show: true },
          { id: "tovalidated", label: t("CommunitiesTab.membersToValidate"), show: isAuthor },
          { id: "membresorganisations", label: t("CommunitiesTab.organizations"), show: true },
          { id: "membresabonnés", label: t("CommunitiesTab.subscriptions"), show: true },
        ];
      default:
        return [];
    }
  };

  const tabs = getTabsForEntityType().filter(tab => tab.show);

  if (tabs.length === 0) {
    return (
      <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
        <div className="text-center py-12 sm:py-16">
          <div className="text-muted-foreground mb-3 sm:mb-4">
            <Users className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />
          </div>
          <p className="text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2 px-4">
            {t("CommunitiesTab.noCommunities")}
          </p>
          <p className="text-sm sm:text-base text-muted-foreground px-4">
            {t("CommunitiesTab.noCommunitiesDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Tabs defaultValue={tabs[0].id} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            <div className="bg-background p-6 sm:p-8 rounded-lg border border-border shadow-sm">
              <div className="text-center py-12 sm:py-16">
                <div className="text-muted-foreground mb-3 sm:mb-4">
                  <Users className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto" />
                </div>
                <p className="text-lg sm:text-xl font-semibold text-foreground mb-1 sm:mb-2 px-4">
                  {t("CommunitiesTab.comingSoon")}
                </p>
                <p className="text-sm sm:text-base text-muted-foreground px-4">
                  {tab.label} - {t("CommunitiesTab.comingSoonDescription")}
                </p>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
