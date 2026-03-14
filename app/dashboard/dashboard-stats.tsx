import { createClient } from "@/utils/supabase/server";
import { StatusChart } from "./status-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Timer, AlertTriangle, Activity } from "lucide-react";

export async function DashboardStats() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("barrack_damage")
    .select(
      "status, date_reported, is_urgent, incident:damage_incident(repaired_date)"
    );

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

    const isClosed =
      status === "COMPLETED" || status === "REJECTED" || status === "MERGED";
    const reportedDate = new Date(report.date_reported);

    const incidentData = Array.isArray(report.incident)
      ? report.incident[0]
      : report.incident;

    if (!isClosed) {
      outstanding++;

      if (report.is_urgent) urgentOutstanding++;

      const ageMs = now.getTime() - reportedDate.getTime();
      if (ageMs > twentyFiveDaysMs) {
        overdue25++;
      }
    } else if (status === "COMPLETED" && incidentData?.repaired_date) {
      totalCompleted++;
      const repairedDate = new Date(incidentData.repaired_date);
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
      <Card className="flex flex-col hover:border-border/80 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Outstanding Reports
          </CardTitle>
          <ClipboardList className="h-4 w-4 text-muted-foreground/70" />
        </CardHeader>
        <CardContent className="flex flex-1 flex-col justify-center">
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tracking-tight">
                {outstanding}
              </span>
              {overdue25 > 0 && (
                <span className="text-[10px] font-semibold text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 uppercase tracking-wider">
                  {overdue25} Overdue
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Tickets not yet resolved
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col hover:border-border/80 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Avg. Completion Time
          </CardTitle>
          <Timer className="h-4 w-4 text-muted-foreground/70" />
        </CardHeader>
        <CardContent className="flex flex-1 flex-col justify-center">
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold tracking-tight">
                {avgDurationDays}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                days
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Based on {totalCompleted} completed cases
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col border-orange-500/20 bg-orange-500/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500 opacity-80" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
          <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-400">
            Urgent & Pending
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        </CardHeader>
        <CardContent className="flex flex-1 flex-col justify-center">
          <div className="flex flex-col gap-1">
            <span className="text-5xl font-bold tracking-tight text-orange-600 dark:text-orange-400">
              {urgentOutstanding}
            </span>
            <p className="text-xs text-orange-600/70 dark:text-orange-400/70">
              Critical outstanding issues
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col hover:border-border/80 transition-colors h-[160px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 mb-[-20px]">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Report Status
          </CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground/70" />
        </CardHeader>
        <CardContent className="">
          <StatusChart data={chartData} />
        </CardContent>
      </Card>
    </div>
  );
}