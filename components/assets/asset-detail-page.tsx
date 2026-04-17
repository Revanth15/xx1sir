"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AssetForm } from "@/components/assets/asset-form";
import { AssetQrLabel } from "@/components/assets/asset-qr-label";
import { AssetStatusBadge } from "@/components/assets/asset-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/utils/AuthProvider";
import { notify } from "@/utils/toast";
import { formatDueDate } from "@/utils/assets";
import type { AssetWithStatus } from "@/lib/types/assets";

type AssetDetailPageProps = {
  assetCode: string;
};

export function AssetDetailPage({ assetCode }: AssetDetailPageProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const [asset, setAsset] = useState<AssetWithStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAsset() {
      try {
        setLoading(true);
        const response = await fetch(`/api/assets/${encodeURIComponent(assetCode)}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load asset");
        }

        if (!cancelled) {
          setAsset(result.data.asset);
        }
      } catch (error) {
        if (!cancelled) {
          notify.error(error instanceof Error ? error.message : "Failed to load asset");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAsset();

    return () => {
      cancelled = true;
    };
  }, [assetCode]);

  if (loading) {
    return <div className="container mx-auto px-4 py-10 text-muted-foreground">Loading asset...</div>;
  }

  if (!asset) {
    return (
      <div className="container mx-auto space-y-4 px-4 py-10">
        <Button asChild variant="outline" className="w-fit">
          <Link href="/assets">Back to Assets</Link>
        </Button>
        <div className="text-muted-foreground">Asset not found.</div>
      </div>
    );
  }

  const linkedReportByInspectionId = new Map(
    (asset.linked_reports ?? [])
      .filter((report) => report.source_inspection_id)
      .map((report) => [report.source_inspection_id as string, report.case_reference])
  );

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{asset.display_name || asset.asset_code}</h1>
            <AssetStatusBadge status={asset.displayed_status} />
          </div>
          <p className="font-mono text-sm text-muted-foreground">{asset.asset_code}</p>
          <p className="text-sm text-muted-foreground">
            {asset.asset_type_config?.label ?? asset.asset_type_code}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="w-fit">
            <Link href="/assets">Back to Assets</Link>
          </Button>
          <Button asChild>
            <Link href={`/assets/${encodeURIComponent(asset.asset_code)}/inspect`}>
              Log Inspection
            </Link>
          </Button>
          {profile?.role === "admin" ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit Asset
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Current Status</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Displayed Status</p>
                <div className="mt-2">
                  <AssetStatusBadge status={asset.displayed_status} />
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inspection Freshness</p>
                <p className="mt-2 font-medium">{asset.freshness}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Inspection</p>
                <p className="mt-2 font-medium">
                  {asset.last_inspected_at
                    ? new Date(asset.last_inspected_at).toLocaleString("en-SG", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Singapore",
                      })
                    : "No inspections yet"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="mt-2 font-medium">{formatDueDate(asset.due_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Inspector</p>
                <p className="mt-2 font-medium">{asset.last_inspected_by || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Serviceability</p>
                <p className="mt-2 font-medium">{asset.last_serviceability_status || "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Asset Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="mt-1 font-medium">
                  {asset.asset_type_config?.label ?? asset.asset_type_code}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inspection Cadence</p>
                <p className="mt-1 font-medium">
                  Every {asset.asset_type_config?.inspection_frequency_days ?? "—"} day(s)
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="mt-1 font-medium">{`Unit ${asset.unit_code} · Blk ${asset.block_code} · Level ${asset.level_code}`}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Serial Number</p>
                <p className="mt-1 font-medium">{asset.serial_number}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">Location Note</p>
                <p className="mt-1 font-medium">{asset.location_note || "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inspection History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {asset.asset_inspections && asset.asset_inspections.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Inspector</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Checks</TableHead>
                      <TableHead>Linked Report</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {asset.asset_inspections.map((inspection) => (
                      <TableRow key={inspection.id}>
                        <TableCell>
                          {new Date(inspection.inspected_at).toLocaleString("en-SG", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Asia/Singapore",
                          })}
                        </TableCell>
                        <TableCell>{inspection.inspected_by_name}</TableCell>
                        <TableCell>{inspection.serviceability_status}</TableCell>
                        <TableCell className="whitespace-normal">
                          {Object.entries(inspection.check_results_json ?? {}).length > 0
                            ? Object.entries(inspection.check_results_json)
                                .map(([key, value]) => `${key}: ${String(value)}`)
                                .join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {inspection.linked_report_id ? (
                            <Link href="/dashboard" className="hover:underline">
                              {linkedReportByInspectionId.get(inspection.id) ??
                                inspection.linked_report_id}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6 text-sm text-muted-foreground">No inspections logged yet.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linked Damage Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {asset.linked_reports && asset.linked_reports.length > 0 ? (
                asset.linked_reports.map((report) => (
                  <div key={report.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href="/dashboard" className="font-medium hover:underline">
                        {report.case_reference}
                      </Link>
                      <span className="text-xs text-muted-foreground">{report.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {`Blk ${report.block} · ${report.unit_number} · ${report.location}`}
                    </p>
                    <p className="mt-2 text-sm">{report.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No linked damage reports yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <AssetQrLabel
          assetCode={asset.asset_code}
          title={profile?.role === "admin" ? "QR Label" : "Asset QR"}
          subtitle={asset.display_name || asset.asset_type_config?.label || null}
        />
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="!max-w-[50vw] !w-[50vw]">
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>
              Updating any code component regenerates the canonical asset code and requires a fresh QR print.
            </DialogDescription>
          </DialogHeader>
          <AssetForm
            mode="edit"
            assetCode={asset.asset_code}
            initialAsset={asset}
            onSaved={(savedAsset) => {
              setAsset(savedAsset);
              setEditing(false);
              if (savedAsset.asset_code !== asset.asset_code) {
                router.replace(`/assets/${encodeURIComponent(savedAsset.asset_code)}`);
              }
            }}
            onCancel={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
