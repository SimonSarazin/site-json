import { useState, type ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';
import CreateMilestoneDialog from './CreateMilestoneDialog';
import { dispatchScrollToMilestone } from './milestoneEvents';

type MilestoneCreatePayload = {
  milestoneId: string;
  name: string;
  targetAmount: number;
};

type MilestoneCreateTriggerProps = {
  selectedProjectId: string;
  answerId: string;
  currentUserId: string;
  existingMilestoneIds: string[];
  isConnected: boolean;
  inputIdPrefix: string;
  onRefetch?: () => unknown | Promise<unknown>;
  onCreated?: (payload: MilestoneCreatePayload) => void | Promise<void>;
  children: (controls: { openDialog: () => void }) => ReactNode;
};

export default function MilestoneCreateTrigger({
  selectedProjectId,
  answerId,
  currentUserId,
  existingMilestoneIds,
  isConnected,
  inputIdPrefix,
  onRefetch,
  onCreated,
  children,
}: MilestoneCreateTriggerProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const openDialog = () => {
    if (!isConnected) {
      toast({
        title: 'Connexion requise',
        description: 'Vous devez être connecte pour ajouter un jalon.',
        variant: 'destructive',
      });
      return;
    }
    setIsOpen(true);
  };

  return (
    <>
      <CreateMilestoneDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        selectedProjectId={selectedProjectId}
        answerId={answerId}
        currentUserId={currentUserId}
        existingMilestoneIds={existingMilestoneIds}
        isConnected={isConnected}
        inputIdPrefix={inputIdPrefix}
        onCreated={async (payload) => {
          if (onCreated) {
            await onCreated(payload);
          }

          const scrollDetail = {
            milestoneId: payload.milestoneId,
            projectId: selectedProjectId,
          };

          // Immediate event for already-rendered lists.
          dispatchScrollToMilestone(scrollDetail);

          // Delayed event to handle async refetch/render before scrolling.
          window.setTimeout(() => {
            dispatchScrollToMilestone(scrollDetail);
          }, 350);
        }}
        onRefetch={onRefetch}
      />
      {children({ openDialog })}
    </>
  );
}



