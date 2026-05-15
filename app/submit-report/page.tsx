"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type QrScanner from "qr-scanner";
import { CheckCircle2, Clock, Link2Off, MessageCircleWarning, QrCode } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ImageUploader } from "@/components/imageUploader";
import {
  BD_BLOCK_REFS,
  BD_COMPANY_OPTIONS,
  BD_DAMAGE_TYPE_OPTIONS,
  BD_STATUS_OPTIONS,
} from "@/lib/defaults";

const REPORT_STATUS = BD_STATUS_OPTIONS;

const schema = z.object({
  company: z.string().min(1, "Select a company"),
  damage_tag_placed: z.boolean(),
  is_urgent: z.boolean(),
  reported_by: z.string().min(2, "Enter rank and name"),
  type: z.string().min(1, "Select a damage type"),
  block: z.string().min(1, "Block is required"),
  unit_number: z.string().min(1, "Unit number is required"),
  location: z.string().min(2, "Specific area is required"), // Repurposed to mean 'Specific Area'
  description: z.string().min(20, "Description must be at least 20 characters"),
  image_urls: z.array(z.string()),
  status: z.enum(REPORT_STATUS),
  approved_by_coy: z.boolean(),
  asset_id: z.string().optional(),
  source_inspection_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type LinkedAssetSummary = {
  id: string;
  asset_code: string;
  display_name?: string | null;
  last_serviceability_status?: string | null;
};

type DetailedQrScanResult = {
  data: string;
};

// --- NEW DATA STRUCTURE TYPES ---
export type DamageIncident = {
  id: string;
  incident_reference?: string;
  incident_status: string;
  ifm_reported_date: string | null;
  ifm_target_date: string | null;
  repaired_date: string | null;
  block?: string;
  unit_number?: string;
  location?: string;
};

export type BarrackDamageReport = {
  id: string;
  case_reference: string;
  date_reported: string;
  incident_id: string | null;
  asset_id?: string | null;
  source_inspection_id?: string | null;
  incident: DamageIncident | null; 
} & FormValues;
// --------------------------------

const COMPANIES = BD_COMPANY_OPTIONS;
const DAMAGE_TYPES = BD_DAMAGE_TYPE_OPTIONS;
const BLOCK_REFS: { block: string; label: string }[] = BD_BLOCK_REFS;
const BLOCKS = BLOCK_REFS.map((r) => r.block.replace("Blk", "").trim());

const INPUT_H = "";

function deriveLevel(unitNumber: string): string {
  const firstChar = (unitNumber ?? "").replace(/^#/, "").charAt(0);
  return /[1-6]/.test(firstChar) ? firstChar : "";
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive animate-in fade-in slide-in-from-top-1">
      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 1a5 5 0 100 10A5 5 0 006 1zm-.5 2.5h1v3h-1v-3zm0 4h1v1h-1v-1z" />
      </svg>
      {message}
    </p>
  );
}

function YesNo({
  value,
  onChange,
  urgent,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  urgent: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex w-full items-center rounded-md border bg-muted/50 p-1 ${INPUT_H} ${
        disabled ? "opacity-60 cursor-not-allowed" : ""
      }`}
    >
      {([true, false] as const).map((v) => {
        const active = value === v;
        const isYes = v === true;

        let activeClass = "text-muted-foreground hover:bg-muted hover:text-foreground";
        if (active) {
          if (isYes) {
            activeClass = urgent
              ? "bg-destructive text-destructive-foreground shadow-sm"
              : "bg-primary text-primary-foreground shadow-sm";
          } else {
            activeClass = "bg-background text-foreground shadow-sm";
          }
        }

        return (
          <button
            key={String(v)}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(v)}
            className={`flex flex-1 h-full items-center justify-center rounded-sm text-sm font-medium transition-all ${activeClass} ${
              disabled ? "pointer-events-none" : ""
            }`}
          >
            {isYes ? "Yes" : "No"}
          </button>
        );
      })}
    </div>
  );
}

function AssetQrLinkField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (asset: LinkedAssetSummary | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const resolvingScanRef = useRef(false);
  const [manualCode, setManualCode] = useState("");
  const [linkedAsset, setLinkedAsset] = useState<LinkedAssetSummary | null>(null);
  const [scanning, setScanning] = useState(false);
  const [startingScanner, setStartingScanner] = useState(false);
  const [lookingUpAsset, setLookingUpAsset] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const buildCameraErrorMessage = (error: unknown) => {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      return "Camera scanning requires HTTPS or localhost access. Use manual entry instead.";
    }

    if (error instanceof Error) {
      switch (error.name) {
        case "NotAllowedError":
          return "Camera access was blocked. Allow camera permission and try again.";
        case "NotFoundError":
          return "No camera was detected on this device. Use manual entry instead.";
        case "NotReadableError":
          return "The camera is already in use by another app or browser tab.";
        default:
          return error.message || "Unable to access the camera. Use manual entry instead.";
      }
    }

    return "Unable to access the camera. Use manual entry instead.";
  };

  const stopScanner = () => {
    scannerRef.current?.stop();
    setScanning(false);
    setStartingScanner(false);
  };

  const destroyScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }

    setScanning(false);
    setStartingScanner(false);
  };

  const setLinked = (asset: LinkedAssetSummary) => {
    setLinkedAsset(asset);
    setExpanded(false);
    onChange(asset);
    setMessage(`Linked ${asset.asset_code}. Submitting this report will mark it unserviceable.`);
    setMessageIsError(false);
  };

  const lookupAsset = async (rawCode: string) => {
    const trimmedCode = rawCode.trim();
    if (!trimmedCode) {
      throw new Error("Enter or scan an asset QR code.");
    }

    setLookingUpAsset(true);
    setMessage("Resolving asset QR code...");
    setMessageIsError(false);

    try {
      const response = await fetch("/api/assets/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_qr_code: trimmedCode }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to resolve QR code.");
      }

      if (!result.data.asset) {
        throw new Error("Unknown asset code.");
      }

      setLinked(result.data.asset);
    } finally {
      setLookingUpAsset(false);
    }
  };

  const getScanner = async () => {
    if (scannerRef.current) {
      return scannerRef.current;
    }

    if (!videoRef.current) {
      throw new Error("Camera preview is not ready yet.");
    }

    const { default: QrScannerClass } = await import("qr-scanner");
    const scanner = new QrScannerClass(
      videoRef.current,
      (result: DetailedQrScanResult) => {
        const rawCode = result.data?.trim();
        if (!rawCode || resolvingScanRef.current) {
          return;
        }

        resolvingScanRef.current = true;
        scanner.stop();
        setScanning(false);

        void lookupAsset(rawCode).catch(async (error) => {
          const errorMessage =
            error instanceof Error ? error.message : "Failed to resolve QR code.";
          setMessage(errorMessage);
          setMessageIsError(true);
          resolvingScanRef.current = false;

          try {
            await scanner.start();
            setScanning(true);
          } catch (restartError) {
            setMessage(buildCameraErrorMessage(restartError));
            setMessageIsError(true);
          }
        });
      },
      {
        preferredCamera: "environment",
        maxScansPerSecond: 8,
        returnDetailedScanResult: true,
      }
    );

    scannerRef.current = scanner;
    return scanner;
  };

  const startScanner = async () => {
    setStartingScanner(true);
    setMessage(null);
    setMessageIsError(false);

    try {
      const { default: QrScannerClass } = await import("qr-scanner");
      if (!(await QrScannerClass.hasCamera())) {
        throw new Error("No camera detected on this device. Use manual entry instead.");
      }

      const scanner = await getScanner();
      await scanner.start();
      resolvingScanRef.current = false;
      setScanning(true);
      setMessage("Point the camera at the asset QR code.");
    } catch (error) {
      setMessage(buildCameraErrorMessage(error));
      setMessageIsError(true);
      stopScanner();
    } finally {
      setStartingScanner(false);
    }
  };

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await lookupAsset(manualCode);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Lookup failed.");
      setMessageIsError(true);
    }
  };

  const clearLinkedAsset = () => {
    setLinkedAsset(null);
    setManualCode("");
    stopScanner();
    onChange(null);
    setMessage("No asset linked. The report can still be submitted.");
    setMessageIsError(false);
  };

  useEffect(() => {
    return () => {
      destroyScanner();
    };
  }, []);

  useEffect(() => {
    if (!value) {
      setLinkedAsset(null);
    }
  }, [value]);

  return (
    <div className="space-y-4 rounded-md border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Label className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Scan QR Code <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Link an asset to this damage report!
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {linkedAsset ? (
            <Button type="button" variant="outline" size="sm" onClick={clearLinkedAsset}>
              <Link2Off className="mr-2 h-4 w-4" />
              Unlink
            </Button>
          ) : null}
          <Button
            type="button"
            variant={linkedAsset ? "outline" : "secondary"}
            size="sm"
            onClick={() => {
              const nextExpanded = !expanded;
              setExpanded(nextExpanded);
              if (!nextExpanded) stopScanner();
            }}
          >
            <QrCode className="mr-2 h-4 w-4" />
            {expanded ? "Hide QR Link" : linkedAsset ? "Change Asset" : "Link Asset QR"}
          </Button>
        </div>
      </div>

      {linkedAsset ? (
        <div className="rounded-md border bg-background p-3 text-sm">
          <div className="font-mono font-semibold">{linkedAsset.asset_code}</div>
          <div className="text-muted-foreground">
            {linkedAsset.display_name || "Asset linked"} · Current status:{" "}
            {linkedAsset.last_serviceability_status || "Not inspected"}
          </div>
        </div>
      ) : null}

      {expanded ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
          <div className="space-y-3">
            <div className="overflow-hidden rounded-md border bg-black">
              <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={startScanner}
                disabled={scanning || startingScanner || lookingUpAsset}
              >
                {startingScanner ? "Starting..." : scanning ? "Scanning..." : "Scan QR"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={stopScanner}
                disabled={!scanning && !startingScanner}
              >
                Stop
              </Button>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="report-asset-code">Manual Asset Code</Label>
              <Input
                id="report-asset-code"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                placeholder="1SIR-265-1-WC-017"
              />
            </div>
            <Button type="submit" variant="secondary" disabled={lookingUpAsset} className="w-full">
              {lookingUpAsset ? "Looking up..." : "Link Asset"}
            </Button>
          </form>
        </div>
      ) : null}

      {message ? (
        <p className={messageIsError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

interface DamageReportFormProps {
  report?: BarrackDamageReport;
  mode?: "create" | "edit" | "view";
  onSuccess?: (data: FormValues, id?: string) => void;
}

export default function DamageReportForm({
  report,
  mode = "create",
  onSuccess,
}: DamageReportFormProps) {
  const searchParams = useSearchParams();
  const currentMode =
    !report && mode === "edit"
      ? "create"
      : report && mode === "create"
      ? "edit"
      : mode;

  const isEditMode = currentMode === "edit";
  const isViewMode = currentMode === "view";

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedLinkedAssetCode, setSubmittedLinkedAssetCode] = useState<string | null>(null);
  const [linkedAsset, setLinkedAsset] = useState<LinkedAssetSummary | null>(null);

  const prefillDefaults = useMemo(
    () => ({
      block: searchParams.get("prefill_block") || "",
      unit_number: searchParams.get("prefill_unit_number") || "",
      location: searchParams.get("prefill_location") || "",
      description: searchParams.get("prefill_description") || "",
      asset_id: searchParams.get("asset_id") || "",
      source_inspection_id: searchParams.get("source_inspection_id") || "",
    }),
    [searchParams]
  );

  const {
    handleSubmit,
    control,
    watch,
    reset,
    register,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company: report?.company || "",
      damage_tag_placed: report?.damage_tag_placed || false,
      is_urgent: report?.is_urgent || false,
      reported_by: report?.reported_by || "",
      type: report?.type || "",
      block: report?.block || prefillDefaults.block,
      unit_number: report?.unit_number || prefillDefaults.unit_number,
      location: report?.location || prefillDefaults.location, 
      description: report?.description || prefillDefaults.description,
      image_urls: report?.image_urls || [],
      status: report?.status || "PENDING_COY",
      approved_by_coy: report?.approved_by_coy || false,
      asset_id: report?.asset_id || prefillDefaults.asset_id,
      source_inspection_id:
        report?.source_inspection_id || prefillDefaults.source_inspection_id,
    },
  });

  useEffect(() => {
    if (report) {
      reset({
        company: report.company,
        damage_tag_placed: report.damage_tag_placed,
        is_urgent: report.is_urgent,
        reported_by: report.reported_by,
        type: report.type,
        block: report.block,
        unit_number: report.unit_number,
        location: report.location,
        description: report.description,
        image_urls: report.image_urls,
        status: report.status,
        approved_by_coy: report.approved_by_coy,
        asset_id: report.asset_id || "",
        source_inspection_id: report.source_inspection_id || "",
      });
      return;
    }

    reset({
      company: "",
      damage_tag_placed: false,
      is_urgent: false,
      reported_by: "",
      type: "",
      block: prefillDefaults.block,
      unit_number: prefillDefaults.unit_number,
      location: prefillDefaults.location,
      description: prefillDefaults.description,
      image_urls: [],
      status: "PENDING_COY",
      approved_by_coy: false,
      asset_id: prefillDefaults.asset_id,
      source_inspection_id: prefillDefaults.source_inspection_id,
    });
  }, [prefillDefaults, report, reset]);

  const isUrgent = watch("is_urgent");
  const watchBlock = watch("block");
  const watchUnitNumber = watch("unit_number") ?? "";
  const watchLocation = watch("location");
  const watchAssetId = watch("asset_id");
  
  const derivedLevel = deriveLevel(watchUnitNumber);

  const handleUnitNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith("#") && val.length > 0) val = "#" + val.replace(/^#+/, "");
    setValue("unit_number", val, { shouldValidate: true });
  };

  const onSubmit = async (data: FormValues) => {
    if (isViewMode) return;
    setSubmitting(true);

    try {
      const method = isEditMode ? "PUT" : "POST";
      const payload = isEditMode && report 
        ? { ...data, id: report.id, incident_id: report.incident_id }
        : data;

      const response = await fetch("/api/reports", {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save report");
      }

      if (onSuccess) {
        onSuccess(data, isEditMode ? report?.id : result.data.id);
      } else {
        setSubmittedLinkedAssetCode(
          linkedAsset?.asset_code || (data.asset_id ? "linked asset" : null)
        );
        setSubmitted(true);
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert(error instanceof Error ? error.message : "An error occurred while saving.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setSubmittedLinkedAssetCode(null);
    setLinkedAsset(null);
    reset({
      company: "",
      damage_tag_placed: false,
      is_urgent: false,
      reported_by: "",
      type: "",
      block: prefillDefaults.block,
      unit_number: prefillDefaults.unit_number,
      location: prefillDefaults.location,
      description: prefillDefaults.description,
      image_urls: [],
      status: "PENDING_COY",
      approved_by_coy: false,
      asset_id: prefillDefaults.asset_id,
      source_inspection_id: prefillDefaults.source_inspection_id,
    });
  };

  if (submitted && !isEditMode && !isViewMode) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <Card className="w-full max-w-md text-center shadow-lg animate-in zoom-in-95">
            <CardHeader className="pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <CardTitle className="text-2xl">Report Logged</CardTitle>
            <CardDescription className="text-base">
              Your damage report has been securely submitted and is pending verification by the Company.
            </CardDescription>
            {submittedLinkedAssetCode ? (
              <p className="text-sm text-muted-foreground">
                The {submittedLinkedAssetCode} has been marked unserviceable.
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            <Button onClick={handleReset} className="w-full h-12 text-base">
              Submit Another Report
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-muted/20 px-4 py-8 sm:py-12 md:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shadow-sm">
              <span className={`h-1.5 w-1.5 rounded-full ${isUrgent ? "bg-destructive animate-pulse" : "bg-primary"}`} />
              Facilities Management
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {isViewMode ? "View Report" : isEditMode ? "Edit Report" : "Barrack Damage"}
            </h1>
          </div>
          {(isEditMode || isViewMode) && report?.case_reference && (
            <div className="flex flex-col items-start sm:items-end">
              <span className={`rounded px-2 py-0.5 text-xs font-bold ${isViewMode ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"}`}>
                {isViewMode ? "VIEW MODE" : "EDIT MODE"}
              </span>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Ref: <span className="font-semibold text-foreground">{report.case_reference}</span>
              </p>
              {report.incident?.incident_reference && (
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
                  Inc: {report.incident.incident_reference}
                </p>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Card className={`shadow-md transition-colors duration-300 ${isUrgent ? "border-destructive/50 pt-0 ring-1 ring-destructive/10" : ""}`}>
            {isUrgent && (
              <div className="bg-destructive/10 px-6 py-3 mt-0 text-sm font-medium text-destructive flex items-center gap-2 rounded-t-xl border-b border-destructive/20">
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Urgent report: {isViewMode ? "Escalated" : "Will be escalated"} to IFM immediately.
              </div>
            )}

            <CardHeader>
              <CardTitle>Report Details</CardTitle>
              <CardDescription>
                {isViewMode ? "Review the details of the reported facility issue." : isEditMode ? "Update the details of your facility issue." : "Submit a facility issue for verification and repair."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">
            {!isViewMode && prefillDefaults.asset_id ? (
              <Alert className="border-primary/30 bg-primary/5">
                <AlertTitle>Linked Asset Inspection</AlertTitle>
                <AlertDescription>
                  Block, unit/location, and description were prefilled from the failed asset inspection. Review and adjust the damage category fields before submission.
                </AlertDescription>
              </Alert>
            ) : null}
            {isViewMode && report && (
              <>
                <div className="border-t border-border/50" />
                <CardContent className="bg-muted/10 rounded-b-xl">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Administrative Details
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-y-6 gap-x-4 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Report Status</Label>
                        <div className="font-medium text-sm">
                          {report.status.replace(/_/g, ' ')}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Coy Approval</Label>
                        <div className="font-medium text-sm">
                          {report.approved_by_coy ? (
                            <span className="flex items-center gap-1.5 text-green-600">
                              <CheckCircle2 className="h-4 w-4" /> Approved
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-4 w-4" /> Pending
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Date Reported</Label>
                        <div className="font-medium text-sm">
                          {new Date(report.date_reported).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">IFM Reported Date</Label>
                        <div className="font-medium text-sm">
                          {report.incident?.ifm_reported_date ? new Date(report.incident.ifm_reported_date).toLocaleDateString() : "—"}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">IFM Target Date</Label>
                        <div className="font-medium text-sm">
                          {report.incident?.ifm_target_date ? new Date(report.incident.ifm_target_date).toLocaleDateString() : "—"}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Repaired Date</Label>
                        <div className="font-medium text-sm">
                          {report.incident?.repaired_date ? new Date(report.incident.repaired_date).toLocaleDateString() : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </>
            )}
            
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="space-y-2.5">
                  <Label className={errors.company ? "text-destructive" : ""}>
                    Company {!isViewMode && <span className="text-destructive">*</span>}
                  </Label>
                  <Controller
                    name="company"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || undefined} disabled={isViewMode}>
                        <SelectTrigger className={errors.company ? "border-destructive focus:ring-destructive/20 w-full" : "w-full"}>
                          <SelectValue placeholder="Which Company are you from?" />
                        </SelectTrigger>
                        <SelectContent>
                          {COMPANIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {!isViewMode && <FieldError message={errors.company?.message} />}
                </div>

                <div className="space-y-2.5">
                  <Label className={errors.reported_by ? "text-destructive" : ""}>
                    Reported By (Rank & Name) {!isViewMode && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    {...register("reported_by")}
                    disabled={isViewMode}
                    placeholder="e.g. CPL Tan Wei Ming"
                    className={errors.reported_by ? "border-destructive focus-visible:ring-destructive/20" : ""}
                  />
                  {!isViewMode && <FieldError message={errors.reported_by?.message} />}
                </div>

                <div className="space-y-2.5">
                  <Label className={errors.type ? "text-destructive" : ""}>
                    Damage Category {!isViewMode && <span className="text-destructive">*</span>}
                  </Label>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || undefined} disabled={isViewMode}>
                        <SelectTrigger className={errors.type ? "border-destructive focus:ring-destructive/20 w-full" : "w-full"}>
                          <SelectValue placeholder="Select primary category" />
                        </SelectTrigger>
                        <SelectContent>
                          {DAMAGE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {!isViewMode && <FieldError message={errors.type?.message} />}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2.5">
                  <Label className="flex items-center justify-between">
                    Physical Tag Placed
                  </Label>
                  <Controller
                    name="damage_tag_placed"
                    control={control}
                    render={({ field }) => <YesNo value={field.value} onChange={field.onChange} urgent={isUrgent} disabled={isViewMode} />}
                  />
                </div>

                <div className="space-y-2.5">
                  <Label className={`flex items-center justify-between ${isUrgent ? "text-destructive font-bold" : ""}`}>
                    Escalate as Urgent
                  </Label>
                  <Controller
                    name="is_urgent"
                    control={control}
                    render={({ field }) => <YesNo value={field.value} onChange={field.onChange} urgent={isUrgent} disabled={isViewMode} />}
                  />
                </div>
              </div>

              {isUrgent && !isViewMode && (
                <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                  <MessageCircleWarning className="h-4 w-4" />
                  <AlertTitle>Reminder: submit this urgent case via IFM WhatsApp</AlertTitle>
                  <AlertDescription>
                    After saving this report, send the case reference, location, and supporting photos to IFM WhatsApp so the urgent escalation is actioned immediately.
                  </AlertDescription>
                </Alert>
              )}

              <div className="border-t border-border/50" />

              <div className="space-y-6">
                {!isViewMode && (
                  <div className="space-y-2.5">
                    <Label>Block Reference Hints</Label>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border bg-card p-3 sm:grid-cols-2 md:grid-cols-3">
                      {BLOCK_REFS.slice(0, 9).map(({ block, label }) => (
                        <div key={block} className="flex items-center gap-2">
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] font-bold text-muted-foreground">{block}</span>
                          <span className="truncate text-[13px] text-muted-foreground">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label className={`mb-2.5 block ${errors.block || errors.unit_number || errors.location ? "text-destructive" : ""}`}>
                    Exact Location {!isViewMode && <span className="text-destructive">*</span>}
                  </Label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:grid-cols-3">
                    <Controller
                      name="block"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value || undefined} disabled={isViewMode}>
                          <SelectTrigger className={errors.block ? "border-destructive focus:ring-destructive/20 w-full" : "w-full"}>
                            <SelectValue placeholder="Block" />
                          </SelectTrigger>
                          <SelectContent>
                            {BLOCKS.map((b) => (
                              <SelectItem key={b} value={b}>Blk {b}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />

                    <div className={`flex items-stretch rounded-md shadow-sm ${isViewMode ? "opacity-60 cursor-not-allowed" : ""}`}>
                      <span className="flex items-center justify-center rounded-l-md border border-r-0 border-input bg-muted px-3 font-mono text-sm text-muted-foreground select-none">
                        #
                      </span>
                      <Input
                        value={watchUnitNumber.replace(/^#/, "")}
                        onChange={handleUnitNumberChange}
                        disabled={isViewMode}
                        placeholder="01-04"
                        className={`rounded-l-none font-mono ${errors.unit_number ? "border-destructive focus-visible:ring-destructive/20" : ""}`}
                      />
                    </div>

                    <Input
                      {...register("location")}
                      disabled={isViewMode}
                      placeholder="Specific area (e.g. Toilet, Bunk 3)"
                      className={errors.location ? "border-destructive focus-visible:ring-destructive/20" : ""}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    <div>
                      {(watchBlock || watchUnitNumber || watchLocation) && (
                        <div className="text-xs text-muted-foreground p-2.5 rounded bg-muted/40">
                          Compiled:{" "}
                          <span className="font-medium text-foreground">
                            {[
                              watchBlock ? `Blk ${watchBlock}` : "",
                              watchUnitNumber ? `#${watchUnitNumber.replace(/^#/, "")}` : "",
                              watchLocation,
                            ].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                      {derivedLevel && !isViewMode && (
                        <p className="mt-1.5 text-[11px] font-medium text-muted-foreground pl-2.5">
                          Level <span className="text-foreground">{derivedLevel}</span> automatically inferred from unit.
                        </p>
                      )}
                    </div>
                  </div>

                  {!isViewMode && (
                    <div className="space-y-1">
                      <FieldError message={errors.block?.message} />
                      <FieldError message={errors.unit_number?.message} />
                      <FieldError message={errors.location?.message} />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-border/50" />

              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-2.5 flex flex-col">
                  <Label className={errors.description ? "text-destructive" : ""}>
                    Detailed Description {!isViewMode && <span className="text-destructive">*</span>}
                  </Label>
                  <Textarea
                    {...register("description")}
                    disabled={isViewMode}
                    placeholder="Provide as much detail as possible to assist technicians..."
                    className={`flex-1 resize-none ${errors.description ? "border-destructive focus-visible:ring-destructive/20" : ""}`}
                    rows={6}
                  />
                  {!isViewMode && (
                    <div className="flex items-center justify-between mt-1">
                      <FieldError message={errors.description?.message} />
                      <span className="text-[10px] text-muted-foreground uppercase ml-auto">Min 20 chars</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5">
                  <Label className="flex items-center justify-between">
                    Photographic Evidence
                    <span className="text-[10px] font-normal text-muted-foreground uppercase tracking-wider">White Zone Only</span>
                  </Label>
                  <Controller
                    name="image_urls"
                    control={control}
                    render={({ field }) => (
                      <ImageUploader value={field.value} onChange={field.onChange} urgent={isUrgent} disabled={isViewMode} />
                    )}
                  />
                </div>
              </div>
              {!isViewMode && !isEditMode ? (
                <>
                  <div className="border-t border-border/50" />
                  <AssetQrLinkField
                    value={watchAssetId}
                    onChange={(asset) => {
                      setLinkedAsset(asset);
                      setValue("asset_id", asset?.id ?? "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  />
                </>
              ) : null}
            </CardContent>
            
            {!isViewMode && (
              <CardFooter className="flex flex-col-reverse gap-4 border-t bg-muted/20 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Ensure all <span className="text-destructive font-bold">*</span> fields are filled accurately.
                </p>
                <Button type="submit" disabled={submitting} variant={isUrgent ? "destructive" : "default"} className="w-full sm:w-auto min-h-[3rem] px-8 font-semibold flex items-center justify-center transition-all">
                  {submitting ? "Processing..." : isEditMode ? "Save Changes" : isUrgent ? "Submit Urgent Report" : "Submit Report"}
                </Button>
              </CardFooter>
            )}
          </Card>
        </form>
      </div>
    </div>
  );
}
