import { Pledge} from "@/modules/cagnotte/types.ts";
import { useLoadNamespace } from "@/hooks/useLoadNamespace.tsx";
import { AlertCircle, ArrowRight } from "lucide-react";
import { CagnotteTypeConfig } from "../../types";
import { useT } from "@/hooks/useT";
import { toSafeInt } from "@/modules/cagnotte/utils/dataTransform";

export interface UnpaidFundingToastProps {
    pending: Pledge[]
    onOpenPromesses: () => void;
    cagnotteConfig: CagnotteTypeConfig;
    context: string;
}

export function PledgeFundingToast({
   pending,
   onOpenPromesses,
   cagnotteConfig,
   context
}: UnpaidFundingToastProps) {
    useLoadNamespace("modules/cagnotte");
    const t = useT("modules/cagnotte");

    // Si plus de promesses, le toast disparaît automatiquement
    if (pending.length === 0) return null;

    const count = pending.length;
    const totalAmount = pending.reduce((sum, p) => sum + toSafeInt(p.fundingAmount), 0);

    return (
        <button
            type="button"
            onClick={onOpenPromesses}
            className="m-0 w-full flex items-center justify-between rounded-xl border bg-primary/10 p-2 m-2 transition-colors hover:bg-primary/15 text-left"
        >
            <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5" />
                <div>
                    <div className="text-sm font-medium">
                        {
                            t("CagnotteDialog.pledges.toast", undefined, 
                                {
                                    context: cagnotteConfig.selectorType + context,
                                    count,
                                    totalAmount
                                }
                            )
                        }
                    </div>
                </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary shrink-0" />
        </button>
    );
}