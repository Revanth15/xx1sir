"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AssetStatusBadge } from "@/components/assets/asset-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/utils/toast";
import type { AssetWithStatus } from "@/lib/types/assets";

type AssetInspectionPageProps = {
  assetCode: string;
};

type FailedReportPrefill = {
  block: string;
  unit_number: string;
  location: string;
  description: string;
  asset_id: string;
  source_inspection_id: string;
};

export function AssetInspectionPage({ assetCode }: AssetInspectionPageProps) {
  const router = useRouter();
  const [asset, setAsset] = useState<AssetWithStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serviceabilityStatus, setServiceabilityStatus] = useState<"SERVICEABLE" | "UNSERVICEABLE">("SERVICEABLE");
  const [notes, setNotes] = useState("");
  const [checkResults, setCheckResults] = useState<Record<string, "YES" | "NO" | "">>({});
  const [openDamagePrompt, setOpenDamagePrompt] = useState(false);
  const [damagePrefill, setDamagePrefill] = useState<FailedReportPrefill | null>(null);

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

  const checklistFields = useMemo(() => {
    return Object.entries(asset?.asset_type_config?.checklist_schema_json ?? {});
  }, [asset]);

  useEffect(() => {
    if (!asset) return;

    const nextState: Record<string, "YES" | "NO" | ""> = {};
    for (const key of Object.keys(asset.asset_type_config?.checklist_schema_json ?? {})) {
      nextState[key] = "";
    }
    setCheckResults(nextState);
  }, [asset]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!asset) return;

    const check_results_json: Record<string, unknown> = {};
    for (const [fieldKey, fieldSchema] of checklistFields) {
      if (fieldSchema.type === "boolean") {
        const value = checkResults[fieldKey];
        if (fieldSchema.required && !value) {
          notify.error(`${fieldSchema.label || fieldKey} is required.`);
          return;
        }
        if (value) {
          check_results_json[fieldKey] = value === "YES";
        }
      }
    }

    if (
      asset.asset_type_code === "WATERCOOLER" &&
      typeof check_results_json.is_cold !== "boolean"
    ) {
      notify.error("Cold-water check is required.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(
        `/api/assets/${encodeURIComponent(asset.asset_code)}/inspections`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceability_status: serviceabilityStatus,
            notes,
            check_results_json,
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to save inspection");
      }

      if (result.data.prompt_linked_report) {
        setDamagePrefill(result.data.damage_report_prefill);
        setOpenDamagePrompt(true);
        notify.warning("Inspection saved. Damage report recommended.");
        return;
      }

      notify.success("Inspection saved.");
      router.push(`/assets/${encodeURIComponent(asset.asset_code)}`);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to save inspection");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDamageReport = () => {
    if (!damagePrefill) return;

    const params = new URLSearchParams({
      prefill_block: damagePrefill.block,
      prefill_unit_number: damagePrefill.unit_number,
      prefill_location: damagePrefill.location,
      prefill_description: damagePrefill.description,
      asset_id: damagePrefill.asset_id,
      source_inspection_id: damagePrefill.source_inspection_id,
    });

    router.push(`/submit-report?${params.toString()}`);
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-10 text-muted-foreground">Loading asset...</div>;
  }

  if (!asset) {
    return <div className="container mx-auto px-4 py-10 text-muted-foreground">Asset not found.</div>;
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Log Inspection</h1>
        <p className="font-mono text-sm text-muted-foreground">{asset.asset_code}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Asset Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Type</p>
            <p className="mt-1 font-medium">
              {asset.asset_type_config?.label ?? asset.asset_type_code}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Status</p>
            <div className="mt-2">
              <AssetStatusBadge status={asset.displayed_status} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="mt-1 font-medium">{`Unit ${asset.unit_code} · Blk ${asset.block_code} · Level ${asset.level_code}`}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inspection Form</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Serviceability Status</Label>
              <Select
                value={serviceabilityStatus}
                onValueChange={(value) =>
                  setServiceabilityStatus(value as "SERVICEABLE" | "UNSERVICEABLE")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SERVICEABLE">Serviceable</SelectItem>
                  <SelectItem value="UNSERVICEABLE">Unserviceable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {checklistFields.map(([fieldKey, fieldSchema]) => {
              if (fieldSchema.type !== "boolean") return null;

              return (
                <div className="space-y-2" key={fieldKey}>
                  <Label>{fieldSchema.label || fieldKey.replace(/_/g, " ")}</Label>
                  <Select
                    value={checkResults[fieldKey] || undefined}
                    onValueChange={(value) =>
                      setCheckResults((current) => ({
                        ...current,
                        [fieldKey]: value as "YES" | "NO",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select result" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YES">Yes</SelectItem>
                      <SelectItem value="NO">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}

            <div className="space-y-2">
              <Label htmlFor="inspection-notes">Notes</Label>
              <Textarea
                id="inspection-notes"
                rows={5}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Any notable defects, observations, or follow-up required"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save Inspection"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/assets/${encodeURIComponent(asset.asset_code)}`)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={openDamagePrompt} onOpenChange={setOpenDamagePrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Linked Damage Report</DialogTitle>
            <DialogDescription>
              The inspection is saved. This asset is currently unserviceable, so the next step is to open a prefilled damage report.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => router.push(`/assets/${encodeURIComponent(asset.asset_code)}`)}>
              Later
            </Button>
            <Button onClick={handleCreateDamageReport}>Create Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
