import { useState, type ReactNode } from 'react';
import { useT } from '@/hooks/useT';
import { useLoadNamespace } from '@/hooks/useLoadNamespace';
import { showErrorToast } from '@/lib/toastUtils';
import CreateMilestoneDialog from './CreateMilestoneDialog';
import { useCagnotteContext } from '@/modules/cagnotte/hooks/useCagnotteContext';

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
  useLoadNamespace('modules/cagnotte');
  const t = useT('modules/cagnotte');
  const [isOpen, setIsOpen] = useState(false);
  const cagnotteCtx = useCagnotteContext();

  const openDialog = () => {
    if (!isConnected) {
      showErrorToast(
        new Error(String(t('MilestoneCreateTrigger.toasts.loginRequired.description'))),
        'MilestoneCreateTrigger.toasts.loginRequired.title',
        t,
      );
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

          // Immediate request for already-rendered lists.
          cagnotteCtx.requestScrollToMilestone(scrollDetail);
          // Delayed re-trigger pour les listes en cours de refetch/render async.
          window.setTimeout(() => {
            cagnotteCtx.requestScrollToMilestone(scrollDetail);
          }, 350);
        }}
        onRefetch={onRefetch}
      />
      {children({ openDialog })}
    </>
  );
}
