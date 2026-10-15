// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Ce qui est verrouillé ici : le toast annonce le nombre et le solde des promesses réglables,
 * comme la page de règlement.
 */

vi.mock("@/hooks/useLoadNamespace", () => ({ useLoadNamespace: () => ({ loaded: true }) }));
vi.mock("@/hooks/useT", () => ({
  useT: () => (key: string, _fallback?: string, params?: Record<string, unknown>) =>
    `${key} ${String(params?.count)} ${String(params?.totalAmount)}`,
}));

const { PledgeFundingToast } = await import("./PledgeFundingToast");
const { CAGNOTTE_TYPE_CONFIGS } = await import("@/modules/cagnotte/types");

const promesse = (over: Record<string, unknown>) => ({
  id: "p1",
  financerId: "u1",
  resourceId: "ans1",
  resourceName: "Commun",
  depenseIndex: 0,
  depenseName: "Palier",
  fundingAmount: 1000,
  userPledge: 0,
  userfundingPledge: [],
  ...over,
});

describe("PledgeFundingToast", () => {
  it("annonce le nombre et le solde des promesses réglables, pas le montant engagé", () => {
    render(
      <PledgeFundingToast
        pending={[
          promesse({ remainingAmount: 600 }),
          promesse({ id: "p2", resourceId: undefined, remainingAmount: 50 }),
        ] as never[]}
        onOpenPromesses={vi.fn()}
        cagnotteConfig={CAGNOTTE_TYPE_CONFIGS.standard}
        context=""
      />,
    );

    expect(screen.getByRole("button")).toHaveTextContent("CagnotteDialog.pledges.toast 1 600");
  });

  it("disparaît sans promesse réglable", () => {
    const { container } = render(
      <PledgeFundingToast
        pending={[promesse({ resourceId: undefined, remainingAmount: 50 })] as never[]}
        onOpenPromesses={vi.fn()}
        cagnotteConfig={CAGNOTTE_TYPE_CONFIGS.standard}
        context=""
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
