import { getStats } from "@/app/dashboard/stats/actions";

import { ReportsManager } from "./reports-manager";

export default async function ReportsPage() {
  const [dailyStats, weeklyStats, monthlyStats] = await Promise.all([
    getStats("today"),
    getStats("week"),
    getStats("month"),
  ]);

  return (
    <ReportsManager
      dailyStats={dailyStats}
      weeklyStats={weeklyStats}
      monthlyStats={monthlyStats}
    />
  );
}
