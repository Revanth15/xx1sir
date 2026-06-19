"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon } from "lucide-react";

import { AssetStatusBadge } from "@/components/assets/asset-status-badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  readCachedInspectionAsset,
  writeCachedInspectionAsset,
} from "@/utils/asset-inspection-cache";
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

function getChecklistFieldLabel(fieldKey: string, label?: string) {
  return label || fieldKey.replace(/_/g, " ");
}

function parseDateFieldValue(value: string) {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(year, month - 1, day, 12);
}

function formatDateFieldValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateFieldLabel(value: string) {
  const date = parseDateFieldValue(value);
  if (!date) return "Pick a date";

  return date.toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AssetInspectionPage({ assetCode }: AssetInspectionPageProps) {
  const router = useRouter();
  const [asset, setAsset] = useState<AssetWithStatus | null>(() =>
    readCachedInspectionAsset(assetCode)
  );
  const [loading, setLoading] = useState(() => !readCachedInspectionAsset(assetCode));
  const [submitting, setSubmitting] = useState(false);
  const [serviceabilityStatus, setServiceabilityStatus] = useState<"SERVICEABLE" | "UNSERVICEABLE">("SERVICEABLE");
  const [notes, setNotes] = useState("");
  const [checkResults, setCheckResults] = useState<Record<string, "YES" | "NO" | "">>({});
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [openDateField, setOpenDateField] = useState<string | null>(null);
  const [openDamagePrompt, setOpenDamagePrompt] = useState(false);
  const [damagePrefill, setDamagePrefill] = useState<FailedReportPrefill | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAsset() {
      const cachedAsset = readCachedInspectionAsset(assetCode);
      if (cachedAsset && !cancelled) {
        setAsset(cachedAsset);
        setLoading(false);
      }

      try {
        if (!cachedAsset) {
          setLoading(true);
        }

        const response = await fetch(
          `/api/assets/${encodeURIComponent(assetCode)}/inspection-context`
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to load asset");
        }

        if (!cancelled) {
          setAsset(result.data.asset);
          writeCachedInspectionAsset(result.data.asset);
        }
      } catch (error) {
        if (!cancelled && !cachedAsset) {
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

    const checkState: Record<string, "YES" | "NO" | ""> = {};
    const fieldState: Record<string, string> = {};
    for (const [key, fieldSchema] of Object.entries(asset.asset_type_config?.checklist_schema_json ?? {})) {
      if (fieldSchema.type === "boolean") {
        checkState[key] = "";
      } else {
        fieldState[key] = "";
      }
    }
    setCheckResults(checkState);
    setFieldValues(fieldState);
  }, [asset]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!asset) return;

    const check_results_json: Record<string, unknown> = {};
    for (const [fieldKey, fieldSchema] of checklistFields) {
      const fieldLabel = getChecklistFieldLabel(fieldKey, fieldSchema.label);

      if (fieldSchema.type === "boolean") {
        const value = checkResults[fieldKey];
        if (fieldSchema.required && !value) {
          notify.error(`${fieldLabel} is required.`);
          return;
        }
        if (value) {
          check_results_json[fieldKey] = value === "YES";
        }
      } else if (fieldSchema.type === "date" || fieldSchema.type === "text") {
        const value =
          fieldSchema.type === "text"
            ? (fieldValues[fieldKey] || "").trim()
            : fieldValues[fieldKey] || "";

        if (fieldSchema.required && !value) {
          notify.error(`${fieldLabel} is required.`);
          return;
        }
        if (value) {
          check_results_json[fieldKey] = value;
        }
      } else if (fieldSchema.type === "number") {
        const value = fieldValues[fieldKey] || "";

        if (fieldSchema.required && !value) {
          notify.error(`${fieldLabel} is required.`);
          return;
        }

        if (value) {
          const numberValue = Number(value);
          if (!Number.isFinite(numberValue)) {
            notify.error(`${fieldLabel} must be a number.`);
            return;
          }
          check_results_json[fieldKey] = numberValue;
        }
      }
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
      router.push(`/assets/scan`);
      // router.push(`/assets/${encodeURIComponent(asset.asset_code)}`);
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
          <CardTitle>Asset</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 grid-cols-2">
          <div className="col-span-1">
            <p className="text-sm text-muted-foreground">Type</p>
            <p className="mt-1 font-medium">
              {asset.asset_type_config?.label ?? asset.asset_type_code}
            </p>
          </div>
          <div className="col-span-1">
            <p className="text-sm text-muted-foreground">Current Status</p>
            <div className="mt-2">
              <AssetStatusBadge status={asset.displayed_status} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="mt-1 font-medium">
              {`Unit ${asset.unit_code} · Blk ${asset.block_code} · Level ${asset.level_code}${
                asset.unit_number ? ` · ${asset.unit_number}` : ""
              }`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inspection Form</CardTitle>
        </CardHeader>
        <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Serviceability Status</Label>
                <Select
                  value={serviceabilityStatus}
                  onValueChange={(value) =>
                    setServiceabilityStatus(value as "SERVICEABLE" | "UNSERVICEABLE")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SERVICEABLE">Serviceable</SelectItem>
                    <SelectItem value="UNSERVICEABLE">Unserviceable</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {checklistFields.map(([fieldKey, fieldSchema]) => {
                const fieldLabel = getChecklistFieldLabel(fieldKey, fieldSchema.label);
                const fieldId = `inspection-field-${fieldKey}`;

                if (fieldSchema.type === "boolean") {
                  return (
                    <div className="space-y-2" key={fieldKey}>
                      <Label htmlFor={fieldId}>{fieldLabel}</Label>
                      <Select
                        value={checkResults[fieldKey] || undefined}
                        onValueChange={(value) =>
                          setCheckResults((current) => ({
                            ...current,
                            [fieldKey]: value as "YES" | "NO",
                          }))
                        }
                      >
                        <SelectTrigger id={fieldId} className="w-full">
                          <SelectValue placeholder="Select result" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="YES">Yes</SelectItem>
                          <SelectItem value="NO">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                if (fieldSchema.type === "date") {
                  return (
                    <div className="space-y-2" key={fieldKey}>
                      <Label htmlFor={fieldId}>{fieldLabel}</Label>
                      <Popover
                        open={openDateField === fieldKey}
                        onOpenChange={(open) =>
                          setOpenDateField(open ? fieldKey : null)
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            id={fieldId}
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-between text-left font-normal",
                              !fieldValues[fieldKey] && "text-muted-foreground"
                            )}
                          >
                            {formatDateFieldLabel(fieldValues[fieldKey] || "")}
                            <CalendarIcon className="size-4 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={parseDateFieldValue(fieldValues[fieldKey] || "")}
                            onSelect={(date) => {
                              setFieldValues((current) => ({
                                ...current,
                                [fieldKey]: date ? formatDateFieldValue(date) : "",
                              }));
                              setOpenDateField(null);
                            }}
                            autoFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                } else if (fieldSchema.type === "text" || fieldSchema.type === "number") {
                  return (
                    <div className="space-y-2" key={fieldKey}>
                      <Label htmlFor={fieldId}>{fieldLabel}</Label>
                      <Input
                        id={fieldId}
                        type={fieldSchema.type === "number" ? "number" : "text"}
                        required={fieldSchema.required}
                        value={fieldValues[fieldKey] || ""}
                        onChange={(e) =>
                          setFieldValues((current) => ({
                            ...current,
                            [fieldKey]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  );
                }
                return null;
              })}
            </div>

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
                onClick={() => router.push(`/assets/scan`)}
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
