import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { Loader2 } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { useT } from "@/hooks/useT";
import { useNewsVotes } from "../../hooks/useNewsVotes";
import { useState } from "react";
import { voteTypes } from "../../constants/voteTypes";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface NewsReactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voteCount: Record<string, number>;
  newsId: string | null;
}

export function NewsReactionsModal({ open, onOpenChange, voteCount, newsId }: NewsReactionsModalProps) {
  const t = useT("modules/news");
  const [activeTab, setActiveTab] = useState<string>("all");
  const { data: voteData, isLoading } = useNewsVotes(open ? newsId : null);

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      red: { bg: "bg-red-100 dark:bg-red-900/20", text: "text-red-500", border: "border-red-200 dark:border-red-800" },
      blue: { bg: "bg-blue-100 dark:bg-blue-900/20", text: "text-blue-500", border: "border-blue-200 dark:border-blue-800" },
      green: { bg: "bg-green-100 dark:bg-green-900/20", text: "text-green-500", border: "border-green-200 dark:border-green-800" },
      primary: { bg: "bg-primary/10 dark:bg-primary/20", text: "text-primary", border: "border-primary/30 dark:border-primary/40" },
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
      label: t("reactions.allReactions"),
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
          <ModalTitle>{t("reactions.allReactions")} ({totalVotes})</ModalTitle>
        </ModalHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-4">
              {tabs.slice(0, 4).map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  <div className="flex items-center gap-1">
                    {tab.icon && (
                      <tab.icon className={`w-4 h-4 ${tab.color ? getColorClasses(tab.color).text : ""}`} />
                    )}
                    <span className="text-xs truncate">{tab.label}</span>
                    <span className="text-xs">({tab.count})</span>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>

            {tabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="mt-4 flex-1 overflow-y-auto">
                <div className="space-y-3 px-1">
                  {tab.votes.map((vote) => (
                    <div key={vote.id} className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {vote.photo ? (
                          <OptimizedImage
                            src={vote.photo}
                            alt={vote.name}
                            width={40}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                            {vote.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {vote.name}
                        </p>
                      </div>
                      {tab.icon && (
                        <div className="flex-shrink-0">
                          <tab.icon className={`w-5 h-5 ${tab.color ? getColorClasses(tab.color).text : ""}`} />
                        </div>
                      )}
                    </div>
                  ))}
                  {tab.votes.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {t("reactions.noReactions")}
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </ModalContent>
    </Modal>
  );
}