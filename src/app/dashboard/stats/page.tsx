import { getStats } from "./actions";
import { StatsManager } from "./stats-manager";

export default async function StatsPage() {
  const stats = await getStats("month");

  return <StatsManager initialStats={stats} initialPeriod="month" />;
}
