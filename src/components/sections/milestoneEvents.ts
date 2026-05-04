export const SCROLL_TO_MILESTONE_EVENT = 'cagnotte:scroll-to-milestone';
export const EDIT_MILESTONE_REQUEST_EVENT = 'cagnotte:edit-milestone-request';
export const DELETE_MILESTONE_REQUEST_EVENT = 'cagnotte:delete-milestone-request';

export type ScrollToMilestoneDetail = {
  milestoneId: string;
  projectId?: string;
};

export type MilestoneRequestDetail = {
  milestoneId: string;
  projectId?: string;
};

export function dispatchScrollToMilestone(detail: ScrollToMilestoneDetail) {
  if (!detail.milestoneId) return;
  window.dispatchEvent(
    new CustomEvent<ScrollToMilestoneDetail>(SCROLL_TO_MILESTONE_EVENT, {
      detail,
    })
  );
}

function dispatchMilestoneRequest(eventName: string, detail: MilestoneRequestDetail) {
  if (!detail.milestoneId) return;
  window.dispatchEvent(new CustomEvent<MilestoneRequestDetail>(eventName, { detail }));
}

export function dispatchEditMilestoneRequest(detail: MilestoneRequestDetail) {
  dispatchMilestoneRequest(EDIT_MILESTONE_REQUEST_EVENT, detail);
}

export function dispatchDeleteMilestoneRequest(detail: MilestoneRequestDetail) {
  dispatchMilestoneRequest(DELETE_MILESTONE_REQUEST_EVENT, detail);
}

