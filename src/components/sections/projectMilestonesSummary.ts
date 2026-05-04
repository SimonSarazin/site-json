export interface NormalizedProjectMilestone {
  id: string;
  name: string;
  status: 'open' | 'in_progress' | 'done' | 'blocked';
  progress: number;
  targetAmount: number;
  currentAmount: number;
  contributors: number;
  startDate: string | undefined;
  dueDate: string | undefined;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function toProgress(rawProgress: unknown, current: number, target: number): number {
  const parsed = toNumber(rawProgress);
  if (parsed > 0) return Math.min(100, parsed);
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

function resolveStatus(rawStatus: unknown, progress: number): NormalizedProjectMilestone['status'] {
  if (typeof rawStatus === 'string') {
    const normalized = rawStatus.toLowerCase();
    if (normalized === 'done' || normalized === 'open' || normalized === 'blocked') return normalized;
    if (normalized === 'in_progress' || normalized === 'in progress') return 'in_progress';
  }

  if (progress >= 100) return 'done';
  if (progress > 0) return 'in_progress';
  return 'open';
}

function getServerData(entity: unknown): Record<string, unknown> {
  const anyEntity = entity as Record<string, unknown> | null | undefined;
  const fromServerData = anyEntity?.serverData as Record<string, unknown> | undefined;
  if (fromServerData && typeof fromServerData === 'object') return fromServerData;

  const fromPrivateServerData = anyEntity?._serverData as Record<string, unknown> | undefined;
  if (fromPrivateServerData && typeof fromPrivateServerData === 'object') return fromPrivateServerData;

  return {};
}

export function getNormalizedProjectMilestones(entity: unknown, maxItems = 10): NormalizedProjectMilestone[] {
  const serverData = getServerData(entity);
  const oceco = serverData.oceco as Record<string, unknown> | undefined;
  const milestones = oceco?.milestones;

  if (!Array.isArray(milestones)) return [];

  const normalized = milestones
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const item = raw as Record<string, unknown>;

      const id = String(item.milestoneId ?? item.id ?? '');
      if (!id) return null;

      const name = String(item.name ?? item.title ?? 'Sans titre');
      const targetAmount = toNumber(
        item.montantTotal ?? item.targetAmount ?? item.totalAmount ?? item.amount ?? item.budget,
      );
      const currentAmount = toNumber(
        item.montantFinance ?? item.currentAmount ?? item.fundedAmount ?? item.amountFinanced ?? item.amountRaised,
      );
      const progress = toProgress(item.progress, currentAmount, targetAmount);
      const status = resolveStatus(item.status, progress);
      const contributorsRaw = item.contributors;
      const contributors = Array.isArray(contributorsRaw)
        ? contributorsRaw.length
        : toNumber(item.contributorsCount ?? item.nbContributors ?? item.contributors);

      return {
        id,
        name,
        status,
        progress,
        targetAmount,
        currentAmount,
        contributors,
        startDate: typeof item.startDate === 'string' ? item.startDate : undefined,
        dueDate: typeof item.dueDate === 'string' ? item.dueDate : undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return normalized.slice(0, Math.max(1, maxItems));
}

export function getMilestonesTotals(items: NormalizedProjectMilestone[]) {
  return items.reduce(
    (acc, item) => {
      acc.current += item.currentAmount;
      acc.target += item.targetAmount;
      acc.contributors += item.contributors;
      return acc;
    },
    { current: 0, target: 0, contributors: 0 },
  );
}