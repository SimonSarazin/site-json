import { useState } from "react";
import type { PaymentChoice } from "@/modules/cagnotte/utils/paymentMethods";

/** Moyen retenu : le choix de l'utilisateur s'il est toujours proposé, sinon le seul moyen proposé. */
export function usePaymentChoice(choices: PaymentChoice[]) {
  const [picked, setPicked] = useState<PaymentChoice | null>(null);
  const method = picked && choices.includes(picked) ? picked : choices.length === 1 ? choices[0] : null;
  return [method, setPicked] as const;
}
