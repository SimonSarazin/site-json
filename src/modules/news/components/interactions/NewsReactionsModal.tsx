import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { Loader2 } from "lucide-react";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { useT } from "@/hooks/useT";
import { useNewsVotes } from "../../hooks/useNewsVotes";
import { useState } from "react";
import { voteTypes, voteTypeMap } from "../../constants/voteTypes";
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

  /** Récupère la classe `text-X` depuis le type de vote (fallback muted). */
  const getIconClass = (voteType: string | undefined) =>
    (voteType && voteTypeMap[voteType]?.iconClass) || "text-muted-foreground";

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
                      <tab.icon className={`w-4 h-4 ${getIconClass(tab.value)}`} />
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
                          <tab.icon className={`w-5 h-5 ${getIconClass(tab.value)}`} />
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