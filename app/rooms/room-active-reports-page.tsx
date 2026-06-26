"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ClipboardPlus, Clock3, MapPinned, Tag, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeRoomBlock, normalizeRoomUnitNumber } from "@/utils/rooms";

type RoomActiveReport = {
  id: string;
  case_reference: string;
  company: string;
  reported_by: string;
  type: string;
  status: string;
  description: string;
  date_reported: string;
  is_urgent: boolean;
  damage_tag_placed: boolean;
  asset_id: string | null;
  asset: {
    id: string;
    asset_code: string;
    display_name: string | null;
    last_serviceability_status: string | null;
  } | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Singapore",
  });
}

export function RoomActiveReportsPage() {
  const searchParams = useSearchParams();
  const block = normalizeRoomBlock(searchParams.get("block"));
  const unitNumber = normalizeRoomUnitNumber(searchParams.get("unit_number"));
  const [reports, setReports] = useState<RoomActiveReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validRoom = Boolean(block && unitNumber);

  const reportHref = useMemo(() => {
    const params = new URLSearchParams({
      prefill_block: block,
      prefill_unit_number: unitNumber,
      prefill_type: "Others",
    });

    return `/submit-report?${params.toString()}`;
  }, [block, unitNumber]);

  useEffect(() => {
    if (!validRoom) {
      setReports([]);
      setError("Room QR is missing a block or unit number.");
      return;
    }

    const controller = new AbortController();

    async function loadReports() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          block,
          unit_number: unitNumber,
        });
        const response = await fetch(`/api/reports/room-active?${params.toString()}`, {
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load active reports.");
        }

        setReports(result.data.reports ?? []);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load active reports.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadReports();

    return () => controller.abort();
  }, [block, unitNumber, validRoom]);

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6 sm:py-10">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <section className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">
                <MapPinned className="h-3.5 w-3.5" />
                Reports for room:
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {validRoom ? `Blk ${block}, ${unitNumber}` : "Room Not Found"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loading
                    ? "Checking active reports..."
                    : `${reports.length} active report${reports.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </div>

            {validRoom ? (
              <Button asChild className="min-h-8 shrink-0">
                <Link href={reportHref}>
                  <ClipboardPlus className="h-4 w-4" />
                  Report Damage Here
                </Link>
              </Button>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Active Reports
            </h2>
          </div>

          {loading ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Loading active reports...
              </CardContent>
            </Card>
          ) : reports.length === 0 && !error ? (
            <Card>
              <CardContent className="space-y-4 p-6 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">No active reports for this room.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Submit a new report if the damage has not been logged yet.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            reports.map((report) => (
              <Card key={report.id} className={report.is_urgent ? "border-destructive/50" : ""}>
                <CardHeader className="space-y-2 px-4 pb-2 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="font-mono text-sm leading-5">
                      {report.case_reference}
                    </CardTitle>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {report.is_urgent ? (
                        <Badge variant="destructive">Urgent</Badge>
                      ) : null}
                      <Badge variant="secondary">{report.status.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{report.type}</span>
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <UserRound className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {report.reported_by}
                        {report.company ? ` · ${report.company}` : ""}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDate(report.date_reported)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 px-4 pb-4">
                  <p className="text-sm leading-5">{report.description}</p>
                  {report.asset ? (
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      <span className="font-mono font-semibold text-foreground">
                        {report.asset.asset_code}
                      </span>
                      {report.asset.display_name ? ` · ${report.asset.display_name}` : ""}
                      {report.asset.last_serviceability_status
                        ? ` · ${report.asset.last_serviceability_status}`
                        : ""}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
