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
      red: { bg: "bg-red-100 dark:bg-red-900/20", text: "text-red-500", border: "border-red-200 dark:border-red-800" },
      blue: { bg: "bg-blue-100 dark:bg-blue-900/20", text: "text-blue-500", border: "border-blue-200 dark:border-blue-800" },
      green: { bg: "bg-green-100 dark:bg-green-900/20", text: "text-green-500", border: "border-green-200 dark:border-green-800" },
      teal: { bg: "bg-teal-100 dark:bg-teal-900/20", text: "text-teal-500", border: "border-teal-200 dark:border-teal-800" },
      yellow: { bg: "bg-yellow-100 dark:bg-yellow-900/20", text: "text-yellow-500", border: "border-yellow-200 dark:border-yellow-800" },
      gray: { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-500 dark:text-gray-400", border: "border-gray-200 dark:border-gray-600" },
      purple: { bg: "bg-purple-100 dark:bg-purple-900/20", text: "text-purple-500", border: "border-purple-200 dark:border-purple-800" },
      indigo: { bg: "bg-indigo-100 dark:bg-indigo-900/20", text: "text-indigo-500", border: "border-indigo-200 dark:border-indigo-800" },
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
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold flex-shrink-0 border-2 border-border">
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
