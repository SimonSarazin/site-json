import { Loader2, Activity } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useT } from "@/hooks/useT";
import { useClientModule } from "@/hooks/useClientModule";
import { useMultiEvalData } from "../hooks/useMultiEvalData";

interface MultiEvalChartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  answerId: string | null | undefined;
  /** Si fourni, ne charge que cette step. Sinon, toutes les steps avec multi-eval. */
  stepKey?: string | null;
  stepName?: string | null;
}

export function MultiEvalChartDialog({
  open,
  onOpenChange,
  answerId,
  stepKey,
  stepName,
}: MultiEvalChartDialogProps) {
  const t = useT("modules/coform");

  // Lazy fetch : ne lance la query qu'à l'ouverture du dialog. Un peu de
  // staleTime côté hook permet de cache-hit si on rouvre rapidement.
  const { data, isLoading, error } = useMultiEvalData({
    answerId,
    stepKey,
    enabled: open,
  });

  // Recharts est lourd (~150kB). On ne le charge que côté client après
  // mount, et seulement quand l'utilisateur ouvre le dialog — pattern
  // identique à `MarkdownEditor.tsx`.
  const [mounted, radarMod] = useClientModule(() =>
    open ? import("./MultiEvalRadarChart") : Promise.resolve(null)
  );
  const RadarSection = radarMod?.RadarSection;

  const steps = data?.steps ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {stepName
              ? t("coform.multiEval.titleWithStep", undefined, { stepName })
              : t("coform.multiEval.title")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("coform.multiEval.title")}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !mounted || !RadarSection ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {t("coform.multiEval.loading")}
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">
            {t("coform.multiEval.errorLoad")}
          </p>
        ) : steps.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">
            {t("coform.multiEval.empty")}
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-6">
              {steps.map((step, idx) => (
                <div key={step.stepKey}>
                  {steps.length > 1 && (
                    <h3 className="text-sm font-semibold mb-2">{step.stepName}</h3>
                  )}
                  <RadarSection step={step} />
                  {idx < steps.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("coform.multiEval.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
