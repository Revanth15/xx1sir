import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  ClipboardList,
  Clock3,
  Factory,
  Flame,
  MapPinned,
  ShieldCheck,
  Tag,
  Timer,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { BD_BLOCK_REFS, BD_COMPANY_OPTIONS, BD_STATUS_OPTIONS } from "@/lib/defaults";
import { cn } from "@/lib/utils";

type SearchParams = Record<string, string | undefined>;

type StatsIncident = {
  repaired_date: string | null;
  ifm_target_date: string | null;
  incident_status: string | null;
};

type StatsReport = {
  status: string | null;
  date_reported: string | null;
  is_urgent: boolean | null;
  company: string | null;
  block: string | null;
  type: string | null;
  approved_by_coy: boolean | null;
  damage_tag_placed: boolean | null;
  incident: StatsIncident | StatsIncident[] | null;
};

type StatusSummary = {
  key: string;
  label: string;
  value: number;
  color: string;
};

const CLOSED_STATUSES = new Set(["COMPLETED", "REJECTED", "MERGED"]);
const OVERDUE_DAYS = 25;
const STATUS_STYLES: Record<string, { dot: string; bar: string; text: string }> = {
  PENDING_COY: {
    dot: "bg-yellow-400",
    bar: "bg-yellow-400",
    text: "text-yellow-300",
  },
  PENDING_S4: {
    dot: "bg-orange-400",
    bar: "bg-orange-400",
    text: "text-orange-300",
  },
  REPORTED_IFM: {
    dot: "bg-blue-400",
    bar: "bg-blue-400",
    text: "text-blue-300",
  },
  COMPLETED: {
    dot: "bg-emerald-400",
    bar: "bg-emerald-400",
    text: "text-emerald-300",
  },
  REJECTED: {
    dot: "bg-red-400",
    bar: "bg-red-400",
    text: "text-red-300",
  },
  MERGED: {
    dot: "bg-purple-400",
    bar: "bg-purple-400",
    text: "text-purple-300",
  },
  DEFAULT: {
    dot: "bg-slate-400",
    bar: "bg-slate-400",
    text: "text-slate-300",
  },
};

function getIncident(report: StatsReport) {
  return Array.isArray(report.incident) ? report.incident[0] : report.incident;
}

function getBlockCode(block: string | null) {
  return block?.replace(/^Blk\s+/i, "") || "";
}

function getBlockLabel(block: string | null) {
  const code = getBlockCode(block);
  const match = BD_BLOCK_REFS.find((ref) => ref.block.replace("Blk ", "") === code);
  return match ? `${match.block} · ${match.label}` : code ? `Blk ${code}` : "No block";
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function getDaysBetween(start: string | null, end: string | Date) {
  if (!start) return 0;
  const startDate = new Date(start);
  const endDate = typeof end === "string" ? new Date(end) : end;
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  return Math.max(
    0,
    Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function getHref(params: SearchParams, updates: Record<string, string | undefined>) {
  const nextParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && key !== "page") nextParams.set(key, value);
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (value) nextParams.set(key, value);
    else nextParams.delete(key);
  });

  const queryString = nextParams.toString();
  return queryString ? `/dashboard?${queryString}` : "/dashboard";
}

function MetricTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "green" | "yellow" | "red" | "blue";
}) {
  const toneClass = {
    default: "text-muted-foreground",
    green: "text-emerald-400",
    yellow: "text-yellow-300",
    red: "text-red-300",
    blue: "text-blue-300",
  }[tone];

  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
      <div className={cn("mb-1 flex items-center gap-1.5", toneClass)}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="truncate text-lg font-bold leading-none text-white sm:text-xl">
        {value}
      </div>
    </div>
  );
}

export async function DashboardStats({ params }: { params: SearchParams }) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("barrack_damage")
    .select(
      `
      status,
      date_reported,
      is_urgent,
      company,
      block,
      type,
      approved_by_coy,
      damage_tag_placed,
      incident:damage_incident (
        repaired_date,
        ifm_target_date,
        incident_status
      )
    `
    );

  if (error || !data) {
    console.error("Failed to fetch stats:", error);
    return null;
  }

  const reports = data as StatsReport[];
  const selectedCompany = params.company?.toUpperCase();
  const selectedBlock = params.block;
  const now = new Date();

  const companyScopedReports = selectedCompany
    ? reports.filter((report) => report.company?.toUpperCase() === selectedCompany)
    : reports;

  const scopedReports = selectedBlock
    ? companyScopedReports.filter((report) => getBlockCode(report.block) === selectedBlock)
    : companyScopedReports;

  const totalReports = scopedReports.length;
  const activeReports = scopedReports.filter(
    (report) => !CLOSED_STATUSES.has(report.status || "UNKNOWN")
  );
  const completedReports = scopedReports.filter((report) => report.status === "COMPLETED");
  const urgentOutstanding = activeReports.filter((report) => report.is_urgent).length;
  const overdueReports = activeReports.filter(
    (report) => getDaysBetween(report.date_reported, now) > OVERDUE_DAYS
  ).length;
  const awaitingCoy = activeReports.filter(
    (report) => report.status === "PENDING_COY" || !report.approved_by_coy
  ).length;
  const untaggedReports = activeReports.filter((report) => !report.damage_tag_placed).length;
  const reportedIfm = activeReports.filter((report) => report.status === "REPORTED_IFM").length;

  const completedDurationTotal = completedReports.reduce((total, report) => {
    const incident = getIncident(report);
    return total + getDaysBetween(report.date_reported, incident?.repaired_date || now);
  }, 0);

  const avgCompletionDays =
    completedReports.length > 0
      ? Math.round(completedDurationTotal / completedReports.length)
      : 0;

  const statusSummaries: StatusSummary[] = BD_STATUS_OPTIONS.map((status) => ({
    key: status,
    label: formatStatus(status),
    value: scopedReports.filter((report) => report.status === status).length,
    color: STATUS_STYLES[status]?.bar || STATUS_STYLES.DEFAULT.bar,
  })).filter((item) => item.value > 0);

  const activeByCompany = BD_COMPANY_OPTIONS.map((company) => ({
    company,
    active: reports.filter(
      (report) =>
        report.company?.toUpperCase() === company &&
        !CLOSED_STATUSES.has(report.status || "UNKNOWN")
    ).length,
  }));

  const blockSummaries = BD_BLOCK_REFS.map((ref) => {
    const code = ref.block.replace("Blk ", "");
    const count = companyScopedReports.filter((report) => getBlockCode(report.block) === code)
      .length;
    return { ...ref, code, count };
  });

  const blockCounts = scopedReports.reduce<Record<string, number>>((acc, report) => {
    const key = getBlockCode(report.block) || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const [topBlockCode, topBlockCount = 0] =
    Object.entries(blockCounts).sort((a, b) => b[1] - a[1])[0] || [];

  const typeCounts = scopedReports.reduce<Record<string, number>>((acc, report) => {
    const key = report.type || "Others";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const totalStatusCount = statusSummaries.reduce((total, item) => total + item.value, 0);
  const activeScopeLabel = selectedCompany || "All companies";
  const selectedBlockLabel = selectedBlock ? getBlockLabel(selectedBlock) : "All blocks";
  const overduePercent =
    activeReports.length > 0 ? Math.round((overdueReports / activeReports.length) * 100) : 0;

  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-white/10 bg-black/35 text-white shadow-2xl shadow-black/20 backdrop-blur-sm">
      <div className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/45">
              <span>Company overview</span>
              <span className="h-1 w-1 rounded-full bg-white/30" />
              <span>{selectedBlockLabel}</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {activeScopeLabel}
            </h2>
          </div>
          <Link
            href="/dashboard/archive"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-sm text-white/80 transition hover:bg-white/[0.08] hover:text-white"
          >
            Completed archive
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href={getHref(params, { company: undefined, block: undefined })}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition",
              !selectedCompany
                ? "border-white/30 bg-white/15 text-white"
                : "border-white/10 bg-white/[0.035] text-white/60 hover:text-white"
            )}
          >
            <Building2 className="h-4 w-4" />
            All
          </Link>
          {activeByCompany.map(({ company, active }) => (
            <Link
              key={company}
              href={getHref(params, { company, block: undefined })}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition",
                selectedCompany === company
                  ? "border-white/30 bg-white/15 text-white"
                  : "border-white/10 bg-white/[0.035] text-white/60 hover:text-white"
              )}
            >
              <Factory className="h-4 w-4" />
              {company}
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
                {active}
              </span>
            </Link>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href={getHref(params, { block: undefined })}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium transition",
              !selectedBlock
                ? "border-white/20 bg-white/[0.12] text-white"
                : "border-white/10 bg-white/[0.025] text-white/55 hover:text-white"
            )}
          >
            <MapPinned className="h-3.5 w-3.5" />
            All blocks
          </Link>
          {blockSummaries.map((block) => (
            <Link
              key={block.block}
              href={getHref(params, { block: block.code })}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium transition",
                selectedBlock === block.code
                  ? "border-amber-300/40 bg-amber-400/15 text-amber-100"
                  : "border-white/10 bg-white/[0.025] text-white/55 hover:text-white"
              )}
            >
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {block.block}
              <span className="text-white/45">{block.count}</span>
            </Link>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.1fr_1.1fr_0.9fr]">
          <div className="rounded-xl border border-white/10 bg-black/35 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                Active workload
              </div>
              <ClipboardList className="h-4 w-4 text-white/45" />
            </div>
            <div className="flex items-end gap-3">
              <span className="text-6xl font-bold leading-none tracking-tight">
                {activeReports.length}
              </span>
              <span className="pb-2 text-sm text-white/50">open reports</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <MetricTile label="Urgent" value={urgentOutstanding} icon={Flame} tone="red" />
              <MetricTile label="Overdue" value={overdueReports} icon={Clock3} tone="yellow" />
              <MetricTile label="IFM" value={reportedIfm} icon={ShieldCheck} tone="blue" />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/35 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                Resolution health
              </div>
              <Timer className="h-4 w-4 text-white/45" />
            </div>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="text-4xl font-bold leading-none tracking-tight text-white sm:text-5xl">
                {completedReports.length > 0 ? avgCompletionDays : "—"}
              </span>
              <span className="pb-1.5 text-sm text-white/50">
                avg days to complete
              </span>
            </div>
            <p className="mt-2 text-sm text-white/50">
              Based on {completedReports.length} completed of {totalReports} total reports.
            </p>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs text-white/45">
                <span>Overdue exposure</span>
                <span>{overduePercent}% of active</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-red-500"
                  style={{ width: `${Math.min(overduePercent, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/35 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                Hotspot
              </div>
              <TrendingUp className="h-4 w-4 text-white/45" />
            </div>
            <div className="text-3xl font-bold tracking-tight">
              {topBlockCode ? `Blk ${topBlockCode}` : "No data"}
            </div>
            <p className="mt-1 text-sm text-white/50">
              {topBlockCount} reports in the busiest block.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {topTypes.length > 0 ? (
                topTypes.map(([type, count]) => (
                  <div
                    key={type}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs"
                  >
                    <span className="truncate text-white/70">{type}</span>
                    <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-semibold leading-none text-white">
                      {count}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-white/45">No report types yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.7fr_1fr]">
          <div className="rounded-xl border border-white/10 bg-black/35 p-4">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                  Report status
                </div>
                <div className="mt-1 text-sm text-white/55">
                  Quick status mix for the selected scope
                </div>
              </div>
              <Link
                href={getHref(params, { status: undefined })}
                className="inline-flex h-8 w-fit items-center justify-center rounded-md border border-white/10 bg-white/[0.035] px-3 text-xs text-white/65 transition hover:text-white"
              >
                Clear status filter
              </Link>
            </div>
            {statusSummaries.length > 0 ? (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
                  {statusSummaries.map((status) => (
                    <div
                      key={status.key}
                      className={status.color}
                      style={{ width: `${(status.value / totalStatusCount) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {statusSummaries.map((status) => (
                    <Link
                      key={status.key}
                      href={getHref(params, { status: status.key })}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 transition hover:bg-white/[0.07]",
                        params.status === status.key && "border-white/30 bg-white/[0.12]"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 shrink-0 rounded-full",
                            STATUS_STYLES[status.key]?.dot || STATUS_STYLES.DEFAULT.dot
                          )}
                        />
                        <span className="truncate text-xs font-semibold uppercase tracking-wider text-white/65">
                          {status.label}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "text-lg font-bold",
                          STATUS_STYLES[status.key]?.text || STATUS_STYLES.DEFAULT.text
                        )}
                      >
                        {status.value}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/[0.035] px-3 py-6 text-center text-sm text-white/45">
                No reports in this scope.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/35 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                Action queue
              </div>
              <AlertTriangle className="h-4 w-4 text-white/45" />
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <MetricTile label="Awaiting COY" value={awaitingCoy} icon={ShieldCheck} tone="yellow" />
              <MetricTile label="Tags missing" value={untaggedReports} icon={Tag} tone="red" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
