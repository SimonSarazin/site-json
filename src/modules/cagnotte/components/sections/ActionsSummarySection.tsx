import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { CheckCircle2, Clock, Flag, ListChecks, Users, Zap , Plus } from 'lucide-react';
import type { ActionsSummarySectionProps } from '@/modules/cagnotte/schema';
import { useFundingEnvelope } from '@/modules/cagnotte/hooks/useFundingEnvelope';
import { useCocolight } from '@/hooks/useCocolight';
import { useT } from '@/hooks/useT';
import { useLoadNamespace } from '@/hooks/useLoadNamespace';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import SectionEmptyState from '@/components/sections/SectionEmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, initials } from '@/modules/cagnotte/utils/format';
import SummaryMilestoneCreateCard from './SummaryMilestoneCreateCard';
import { useCagnottePermissions } from '@/modules/cagnotte/hooks/useCagnottePermissions';
import { useOptionalProfileEntity } from '@/modules/profil/hooks/useProfileEntity';

type Contributor = { id: string; name: string };
type Action = { id: string; credits: number; status: 'todo' | 'done' };
type Milestone = { id: string; title: string; status: 'open' | 'done' | 'close'; actions: Action[] };

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-primary/10 bg-primary/5 p-2.5 space-y-0.5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className="font-display font-bold text-sm">{value}</p>
    </div>
  );
}

export default function ActionsSummarySection({ id, props }: { id?: string; props: ActionsSummarySectionProps }) {
  void id;
  const { data: fundingData, isLoading, error, refetch: refetchFundingEnvelope } = useFundingEnvelope(props?.idProjet);
  const { me, entity } = useCocolight();
  useLoadNamespace('modules/cagnotte');
  const t = useT('modules/cagnotte');

  const data = useMemo<{ milestones: Milestone[]; contributors: Contributor[] }>(() => {
    const maxItems = props?.maxItems ?? 10;
    return {
      milestones: (fundingData?.milestones ?? []).slice(0, maxItems) as Milestone[],
      contributors: (fundingData?.contributors ?? []) as Contributor[],
    };
  }, [fundingData?.contributors, fundingData?.milestones, props?.maxItems]);

  // Sur une page profil, l'entité de référence pour les permissions est CELLE
  // DU PROFIL (le projet visité), pas l'entité globale Cocolight (l'orga du site).
  const profileCtx = useOptionalProfileEntity();
  const permissionEntity = profileCtx?.entity ?? entity;
  const cagnottePerms = useCagnottePermissions(permissionEntity, {
    hasActiveMilestones: data.milestones.some((m) => m.status !== 'close'),
    projectId: props?.idProjet || fundingData?.selectedProject?.id || '',
  });

  const stats = useMemo(() => {
    const activeMilestones = data.milestones.filter((milestone) => milestone.status !== 'close');
    const allActions = activeMilestones.flatMap((milestone) => milestone.actions);
    const completedActions = allActions.filter((action) => action.status === 'done').length;
    return {
      totalMilestones: activeMilestones.length,
      totalActions: allActions.length,
      totalCredits: allActions.reduce((sum, action) => sum + action.credits, 0),
      completedActions,
      inProgressActions: allActions.filter((action) => action.status === 'todo').length,
      progressPct: allActions.length > 0 ? (completedActions / allActions.length) * 100 : 0,
    };
  }, [data.milestones]);
  const visibleContributors = data.contributors.slice(0, 3);
  const overflowContributors = data.contributors.slice(3);
  if (isLoading) {
    return (
      <Card className="border border-primary/10 shadow-md sticky top-24">
        <CardHeader className="space-y-5">
          <Skeleton className="h-10 w-full" />
        </CardHeader>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-10" />
            </div>
            <Skeleton className="h-3 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{t('ActionsSummarySection.error')}</p>;
  }

  return (
    <>
      <SummaryMilestoneCreateCard
        fundingData={fundingData}
        projectId={props?.idProjet}
        me={me}
        inputIdPrefix="actions-milestone"
        onRefetch={() => {
          void refetchFundingEnvelope();
        }}
      >
        {({ openDialog }) => (
          <Card className="border border-primary/10 shadow-md sticky top-24">
            {cagnottePerms.canCreateMilestone ? (
              <CardHeader className="space-y-5">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold" onClick={openDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('common.addMilestone')}
                </Button>
              </CardHeader>
            ) : null}
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Flag className="h-5 w-5 text-primary" />
                {t('ActionsSummarySection.titleSummary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">{t('common.progress')}</span>
                  <span className="font-semibold">{stats.progressPct.toFixed(0)}%</span>
                </div>
                <Progress value={stats.progressPct} className="h-3" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat icon={<Flag className="h-4 w-4" />} label={String(t('ActionsSummarySection.stats.milestones'))} value={stats.totalMilestones} />
                <MiniStat icon={<ListChecks className="h-4 w-4" />} label={String(t('ActionsSummarySection.stats.totalActions'))} value={stats.totalActions} />
                <MiniStat icon={<Clock className="h-4 w-4" />} label={String(t('ActionsSummarySection.stats.inProgressActions'))} value={stats.inProgressActions} />
                <MiniStat icon={<CheckCircle2 className="h-4 w-4" />} label={String(t('ActionsSummarySection.stats.completedActions'))} value={stats.completedActions} />
                <MiniStat icon={<Zap className="h-4 w-4" />} label={String(t('ActionsSummarySection.stats.totalCredits'))} value={formatCurrency(stats.totalCredits)} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4 text-primary" />
                  {t('ActionsSummarySection.contributorsLabel', undefined, { count: data.contributors.length })}
                </div>
                {data.contributors.length === 0 ? (
                  <SectionEmptyState message={String(t('ActionsSummarySection.noContributors'))} className="text-xs" />
                ) : (
                  <div className="flex items-center gap-1">
                    {visibleContributors.map((contributor) => (
                      <Tooltip key={contributor.id}>
                        <TooltipTrigger asChild>
                          <Avatar className="h-8 w-8 border-2 border-background -ml-1 first:ml-0">
                            <AvatarFallback className="text-xs bg-primary/20 text-primary-foreground">{initials(contributor.name)}</AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>{contributor.name}</TooltipContent>
                      </Tooltip>
                    ))}
                    {overflowContributors.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="ml-1 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground">
                            +{overflowContributors.length}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent sideOffset={6}>{data.contributors.map((contributor) => contributor.name).join(', ')}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </SummaryMilestoneCreateCard>
    </>
  );
}
