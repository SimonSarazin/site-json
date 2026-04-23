import type { ReactNode } from 'react';
import MilestoneCreateTrigger from './MilestoneCreateTrigger';

type FundingDataLike = {
  selectedProject?: { id?: string; answerId?: string };
  milestones?: Array<{ id?: string }>;
};

type MeLike = {
  id?: string;
  isConnected?: boolean;
};

type SummaryMilestoneCreateCardProps = {
  fundingData?: FundingDataLike | null;
  projectId?: string;
  me?: MeLike | null;
  inputIdPrefix: string;
  onRefetch?: () => unknown | Promise<unknown>;
  children: (controls: { openDialog: () => void }) => ReactNode;
};

export default function SummaryMilestoneCreateCard({
  fundingData,
  projectId,
  me,
  inputIdPrefix,
  onRefetch,
  children,
}: SummaryMilestoneCreateCardProps) {
  const selectedProjectId = fundingData?.selectedProject?.id || projectId || '';
  const answerId = fundingData?.selectedProject?.answerId || '';
  const currentUserId = me?.id?.trim() || '';
  const isConnected = !!me?.isConnected;
  const existingMilestoneIds = (fundingData?.milestones || [])
    .map((milestone) => milestone.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  return (
    <MilestoneCreateTrigger
      selectedProjectId={selectedProjectId}
      answerId={answerId}
      currentUserId={currentUserId}
      existingMilestoneIds={existingMilestoneIds}
      isConnected={isConnected}
      inputIdPrefix={inputIdPrefix}
      onRefetch={onRefetch}
    >
      {children}
    </MilestoneCreateTrigger>
  );
}



