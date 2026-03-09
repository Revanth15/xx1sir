import { createClient } from "@/utils/supabase/server";
import { StatusChart } from "./status-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function DashboardStats() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("barrack_damage")
    .select("status, date_reported, repaired_date, is_urgent");

  if (error || !data) {
    console.error("Failed to fetch stats:", error);
    return null;
  }

  const now = new Date();
  const twentyFiveDaysMs = 25 * 24 * 60 * 60 * 1000;

  let outstanding = 0;
  let overdue25 = 0;
  let urgentOutstanding = 0;
  let totalCompleted = 0;
  let totalDurationMs = 0;
  const statusCounts: Record<string, number> = {};

  data.forEach((report) => {
    const status = report.status || "UNKNOWN";
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const isCompleted = status === "COMPLETED" || status === "REPAIRED";
    const reportedDate = new Date(report.date_reported);

    if (!isCompleted) {
      outstanding++;

      if (report.is_urgent) urgentOutstanding++;

      const ageMs = now.getTime() - reportedDate.getTime();
      if (ageMs > twentyFiveDaysMs) {
        overdue25++;
      }
    } else if (report.repaired_date) {
      totalCompleted++;
      const repairedDate = new Date(report.repaired_date);
      totalDurationMs += repairedDate.getTime() - reportedDate.getTime();
    }
  });

  const avgDurationDays =
    totalCompleted > 0
      ? Math.round(totalDurationMs / totalCompleted / (1000 * 60 * 60 * 24))
      : 0;

  const chartData = Object.keys(statusCounts).map((key) => ({
    name: key,
    value: statusCounts[key],
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8 items-stretch">
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Outstanding Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{outstanding}</span>
            {overdue25 > 0 && (
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                {overdue25} Overdue (&gt;25 Days)
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Not yet completed
          </p>
        </CardContent>
      </Card>

      {/* 2. Avg Completion Time */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Avg. Completion Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgDurationDays} days</div>
          <p className="text-xs text-muted-foreground mt-1">
            Based on {totalCompleted} completed cases
          </p>
        </CardContent>
      </Card>

      {/* 3. Urgent & Pending */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Urgent & Pending
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-500">
            {urgentOutstanding}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Critical outstanding issues
          </p>
        </CardContent>
      </Card>

      {/* 4. Chart shifted into the 4th grid spot */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 px-4">
          <CardTitle className="text-sm font-medium">Report Status</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 pb-2 pt-0 px-2 flex flex-col justify-center">
          <StatusChart data={chartData} />
        </CardContent>
      </Card>
    </div>
  );
}
