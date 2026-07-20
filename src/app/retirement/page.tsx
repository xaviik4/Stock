import { prisma } from "@/lib/prisma";
import { RetirementSimulator } from "@/components/retirement-simulator";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RetirementPage() {
  const holdings = await prisma.fidelityInvestment.findMany({
    select: { currentValue: true },
  });
  const portfolioValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Retirement simulator"
        lede="Projects your combined accounts forward with monthly compounding. The employer match is calculated against the match limit, not your deferral rate, so over-contributing doesn't inflate it."
      />
      <RetirementSimulator
        portfolioValue={portfolioValue}
        hasPortfolio={holdings.length > 0}
      />
    </div>
  );
}
