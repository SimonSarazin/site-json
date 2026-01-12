import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { Loader2 } from "lucide-react";
import { useT } from "@/hooks/useT";
import { useNewsVotes } from "../../hooks/useNewsVotes";
import { useState } from "react";
import { voteTypes } from "./constants";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface NewsReactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voteCount: Record<string, number>;
  newsId: string | null;
}

export function NewsReactionsModal({ open, onOpenChange, voteCount, newsId }: NewsReactionsModalProps) {
  const t = useT("modules/profil");
  const [activeTab, setActiveTab] = useState<string>("all");
  const { data: voteData, isLoading } = useNewsVotes(open ? newsId : null);

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      red: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20" },
      blue: { bg: "bg-info/10", text: "text-info", border: "border-info/20" },
      green: { bg: "bg-success/10", text: "text-success", border: "border-success/20" },
      teal: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
      yellow: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" },
      gray: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
      purple: { bg: "bg-chart-2/10", text: "text-chart-2", border: "border-chart-2/20" },
      indigo: { bg: "bg-chart-3/10", text: "text-chart-3", border: "border-chart-3/20" },
    };
    return colorMap[color] || colorMap.gray;
  };


  const allVotes = voteData?.vote
    ? Object.entries(voteData.vote).map(([userId, userData]) => ({
        id: userId,
        name: userData.name,
        photo: userData.profilThumbImageUrl,
        slug: userData.slug,
        status: userData.status,
      }))
    : [];

  const totalVotes = allVotes.length;

  const tabs = [
    {
      label: t("NewsTab.allReactions"),
      value: "all",
      votes: allVotes,
      count: totalVotes,
      icon: undefined,
      color: undefined,
    },
    ...voteTypes
      .filter(voteType => (voteCount[voteType.type] || 0) > 0)
      .map(voteType => ({
        label: voteType.label,
        value: voteType.type,
        icon: voteType.icon,
        color: voteType.color,
        votes: allVotes.filter(vote => vote.status === voteType.type),
        count: voteCount[voteType.type] || 0,
      })),
  ];


  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <ModalHeader>
          <ModalTitle>{t("NewsTab.allReactions")} ({totalVotes})</ModalTitle>
        </ModalHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
            <div className="px-6 pb-4 border-b border-border">
              <TabsList className="h-auto p-1 bg-muted/50 flex-wrap justify-start">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const colors = tab.icon ? getColorClasses(tab.color!) : null;

                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      {Icon && (
                        <Icon
                          className={`w-4 h-4 ${activeTab === tab.value ? "" : colors?.text}`}
                        />
                      )}
                      {tab.value === "all" ? (
                        <span>{tab.label}</span>
                      ) : (
                        <span className="hidden sm:inline">{t(`NewsTab.${tab.label}`)}</span>
                      )}
                      <span className={`${activeTab === tab.value ? "opacity-100" : "opacity-70"}`}>
                        ({tab.count})
                      </span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {tabs.map((tab) => (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="flex-1 overflow-y-auto px-6 py-4 mt-0"
              >
                {tab.votes.length > 0 ? (
                <ul className="space-y-2">
                  {tab.votes.map((vote) => {
                    const voteType = voteTypes.find(v => v.type === vote.status);
                    const Icon = voteType?.icon;
                    const colors = voteType ? getColorClasses(voteType.color) : getColorClasses("gray");

                    return (
                      <li
                        key={vote.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {vote.photo ? (
                            <img
                              src={vote.photo}
                              alt={vote.name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-border flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-bold flex-shrink-0 border-2 border-border">
                              {vote.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{vote.name}</p>
                            {vote.slug && (
                              <p className="text-xs text-muted-foreground truncate">@{vote.slug}</p>
                            )}
                          </div>
                        </div>
                        {Icon && (
                          <div className={`w-8 h-8 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0 ml-2`}>
                            <Icon className={`w-4 h-4 ${colors.text}`} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>{t("NewsTab.noReactionsYet")}</p>
                </div>
              )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </ModalContent>
    </Modal>
  );
}
