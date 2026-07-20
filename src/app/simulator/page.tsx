import { StockSimulator } from "@/components/stock-simulator";
import { PageHeader } from "@/components/ui";

export default async function SimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string }>;
}) {
  const { symbol } = await searchParams;
  const ticker = symbol?.trim().toUpperCase();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Single stock simulator"
        lede="Test what a stock could be worth if your assumptions hold. Load a real company to start from its actual figures, then change one assumption at a time to see which one your thesis really rests on."
      />
      <StockSimulator
        symbol={ticker && /^[A-Z0-9.\-]{1,12}$/.test(ticker) ? ticker : undefined}
      />
    </div>
  );
}
