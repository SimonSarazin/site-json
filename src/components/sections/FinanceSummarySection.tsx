import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { HandCoins, PiggyBank, Plus, Target, TrendingUp, Users, Wallet } from 'lucide-react';
import type { FinanceSummarySectionProps } from '@/types/site-schema';
import { useFundingEnvelope } from '@/hooks/useFundingEnvelope';
import { useCocolight } from '@/hooks/useCocolight';
import { Progress } from '../ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import SummaryMilestoneCreateCard from './SummaryMilestoneCreateCard';
import CagnotteDialog from '@/components/cagnotte/CagnotteDialog';

type Funder = { id: string; name: string; amount: number };
type Milestone = { id: string; status?: 'open' | 'done' | 'close'; actions: Array<{ credits: number }> };

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function MiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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

export default function FinanceSummarySection({ id, props }: { id?: string; props: FinanceSummarySectionProps }) {
  void id;
  const { data: fundingData, isLoading, error, refetch: refetchFundingEnvelope } = useFundingEnvelope(props?.idProjet);
  const { me } = useCocolight();

  const data = useMemo<{
    finance: { totalCost: number; totalFunding: number; userFunding: number; remaining: number };
    funders: Funder[];
    milestones: Milestone[];
  }>(() => {
    const maxItems = props?.maxItems ?? 10;
    return {
      finance: {
        totalCost: fundingData?.finance.totalCost ?? 0,
        totalFunding: fundingData?.finance.totalFunding ?? 0,
        userFunding: fundingData?.finance.userFunding ?? 0,
        remaining: fundingData?.finance.remaining ?? 0,
      },
      funders: (fundingData?.funders ?? []).slice(0, maxItems) as Funder[],
      milestones: (fundingData?.milestones ?? []).slice(0, maxItems) as Milestone[],
    };
  }, [fundingData?.finance, fundingData?.funders, fundingData?.milestones, props?.maxItems]);

  const totalSpent = data.milestones
    .filter((milestone) => milestone.status !== 'close')
    .reduce((sum, milestone) => sum + milestone.actions.reduce((acc, action) => acc + action.credits, 0), 0);

  const progressPct = data.finance.totalCost > 0 ? (data.finance.totalFunding / data.finance.totalCost) * 100 : 0;
  const visibleFunders = data.funders.slice(0, 3);
  const overflowFunders = data.funders.slice(3);
  const supportProjectContext = props?.idProjet
    ? {
        projectId: props.idProjet,
        hideProjectSelect: true,
      }
    : undefined;
  if (isLoading) {
    return <p className="text-sm text-muted-foreground italic">Chargement de la synthese financement...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">Erreur lors du chargement de la synthese financement</p>;
  }

  return (
    <>
    <SummaryMilestoneCreateCard
      fundingData={fundingData}
      projectId={props?.idProjet}
      me={me}
      inputIdPrefix="finance-milestone"
      onRefetch={() => {
        void refetchFundingEnvelope();
      }}
    >
      {({ openDialog }) => (
        <Card className="border border-primary/10 shadow-md sticky top-24">
          <CardHeader className="space-y-5 grid-cols-2 gap-2">
            <CagnotteDialog
              totalAmount={data.finance.totalFunding}
              defaultProjectId={props?.idProjet}
              onRefresh={() => {
                void refetchFundingEnvelope();
              }}
              openContext={supportProjectContext}
            >
              <Button
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
              >
                <HandCoins className="h-4 w-4 mr-2" />
                Soutenir le projet
              </Button>
            </CagnotteDialog>
            <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold" onClick={openDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter jalon
            </Button>
          </CardHeader>
          <CardHeader className="pb-3 pt-0">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Synthese financement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-semibold">{progressPct.toFixed(0)}%</span>
              </div>
              <Progress value={progressPct} className="h-3" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MiniStat icon={<Target className="h-4 w-4" />} label="Cout total" value={formatCurrency(data.finance.totalCost)} />
              <MiniStat icon={<TrendingUp className="h-4 w-4" />} label="Financé" value={formatCurrency(data.finance.totalFunding)} />
              <MiniStat icon={<PiggyBank className="h-4 w-4" />} label="Reste" value={formatCurrency(data.finance.remaining)} />
              <MiniStat icon={<HandCoins className="h-4 w-4" />} label="Total crédits actions" value={formatCurrency(totalSpent)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-primary" />
                Financeurs ({data.funders.length})
              </div>
              {data.funders.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Aucun financeur pour le moment.</p>
              ) : (
                <div className="flex items-center gap-1">
                  {visibleFunders.map((funder) => (
                    <Tooltip key={funder.id}>
                      <TooltipTrigger asChild>
                        <Avatar className="h-8 w-8 border-2 border-background -ml-1 first:ml-0">
                          <AvatarFallback className="text-xs bg-primary/20 text-primary-foreground">{initials(funder.name)}</AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>{`${funder.name} - ${formatCurrency(funder.amount)}`}</TooltipContent>
                    </Tooltip>
                  ))}
                  {overflowFunders.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="ml-1 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground">
                          +{overflowFunders.length}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>{data.funders.map((funder) => `${funder.name} (${formatCurrency(funder.amount)})`).join(', ')}</TooltipContent>
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